import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTopupController, tokenAmount, displayTokens, unsignedTopupDisclosure, unsignedClaimDisclosure, localOperatorHeaders, readLocalOperatorWallet, provingRoundTransfer, sendProvingRoundTransfer, provingRoundClaimTransfer, sendProvingRoundClaim, recordProvingRoundClaim, injectedPhantom, requestReviewedDeposit, requestReviewedPayout, demoteFundingDialog, assertReviewedAmznBalance, readLinkedAmznBalances, payFromWalletLabel, defaultPayFromAddress, payFromShortageCopy, pendingTopupUi, pendingTopupStatusCopy, topupErrorFollowup, PROVING_ROUND_BUTTON, PROVING_CLAIM_BUTTON } from '../public/funding-client.js';
import { FUNDING_NETWORK, phantomBrowseUrl } from '../public/funding-network.js';
import { LOCAL_OPERATOR_HEADER } from '../server/local-operator.mjs';
import { PAYER_BOX, TREASURY_BOX, PRODUCT_X402_BOX, LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const X402_OPS = PRODUCT_X402_BOX;
const ONE_AMZN = '1000000000000000000';

function fixture() {
  const records = new Map(), requests = [], controls = {}; let sends = 0;
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  const api = async (path, body) => {
    requests.push({ path, body }); if (controls.fail) throw new Error('Connection lost');
    const creating = path === '/api/funding/deposits' && body != null;
    return { order: { id: 'order1', credited: Boolean(controls.credited),
      expiresAt: creating ? Date.now() + 60000 : (controls.expiresAt ?? Date.now() + 60000),
      submittedTransactionHash: creating ? undefined : controls.submittedHash }, transfer: { signingEnabled: true } };
  };
  const make = () => createTopupController({ api, storage, storageKey: 'alice', uuid: () => 'stable-key',
    send: async () => { sends++; if (controls.sendError) throw controls.sendError; return '0x' + 'a'.repeat(64); } });
  return { make, controls, requests, storage, get sends() { return sends; } };
}
test('wallet progress precedes signing and a confirmed deposit is not sent twice after reload', async () => {
  const data = new Map(), progress = [];
  let sends = 0;
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const api = async () => ({ order: { id: 'id', credited: sends > 0, expiresAt: Date.now() + 60000 }, transfer: { signingEnabled: true } });
  const make = () => createTopupController({ api, storage, storageKey: 'x', uuid: () => 'key', onProgress: stage => progress.push(stage),
    send: async () => { assert.equal(progress.at(-1), 'wallet'); sends++; return '0x' + 'a'.repeat(64); } });
  await make().prepare({ amountBaseUnits: '100' });
  await make().confirm();
  assert.deepEqual(progress, ['review', 'wallet', 'confirmations']);
  await assert.rejects(make().confirm());
  await make().recover();
  assert.equal(sends, 1);
});

test('Confirm starts the wallet send in the same turn without fetching the order again', async () => {
  const records = new Map(), requests = [];
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  const api = async (path, body) => {
    requests.push({ path, body });
    await new Promise(resolve => setTimeout(resolve, 30));
    return { order: { id: 'order1', credited: false, expiresAt: Date.now() + 60000 }, transfer: { signingEnabled: true } };
  };
  let sendCalls = 0, sendArg;
  const c = createTopupController({
    api, storage, storageKey: 'alice', uuid: () => 'k',
    send: prepared => {
      sendCalls++;
      sendArg = prepared;
      return '0x' + 'a'.repeat(64);
    }
  });
  await c.prepare({ amountBaseUnits: '100' });
  const apisBeforeConfirm = requests.length;
  const pending = c.confirm();
  assert.equal(sendCalls, 1, 'eth_sendTransaction must start before Confirm awaits the network');
  assert.equal(requests.length, apisBeforeConfirm);
  assert.equal(sendArg.order.id, 'order1');
  await pending;
  assert.equal(sendCalls, 1);
});

test('readyToSend is true only after Review caches a live prepared transfer', async () => {
  const f = fixture(), c = f.make();
  assert.equal(c.readyToSend(), false);
  await c.prepare({ amountBaseUnits: '100' });
  assert.equal(c.readyToSend(), true);
  await c.confirm();
  assert.equal(c.readyToSend(), false);
});

test('demoteFundingDialog drops a modal Top up before eth_sendTransaction', () => {
  const dialog = {
    open: true,
    closed: false,
    shown: false,
    matches(selector) { return selector === ':modal' && !this.shown; },
    close() { this.open = false; this.closed = true; },
    show() { this.open = true; this.shown = true; }
  };
  const root = { querySelector(selector) { return selector === '#info-dialog' ? dialog : null; } };
  assert.equal(demoteFundingDialog(root), true);
  assert.equal(dialog.closed, true);
  assert.equal(dialog.shown, true);
  assert.equal(dialog.open, true);
  assert.equal(demoteFundingDialog(root), false);
});

test('reviewed deposit asks Phantom to eth_sendTransaction in the same turn', async () => {
  const address = n => '0x' + n.repeat(40);
  const prepared = {
    environment: 'testnet', realFundsEnabled: false,
    order: {
      owner: address('1'), minimumReceived: '1000', expiresAt: Date.now() + 60000,
      asset: { chainId: '46630', tokenAddress: address('2'), destination: address('3') }
    },
    transfer: {
      signingEnabled: true,
      transaction: {
        from: address('1'), to: address('2'), chainId: '0xb626', value: '0x0',
        data: '0xa9059cbb' + address('3').slice(2).padStart(64, '0') + (1000n).toString(16).padStart(64, '0')
      }
    }
  };
  const calls = [];
  const provider = {
    request(input) {
      calls.push(input.method);
      return new Promise(resolve => setTimeout(() => resolve('0x' + 'a'.repeat(64)), 20));
    }
  };
  const pending = requestReviewedDeposit(prepared, provider);
  assert.deepEqual(calls, ['eth_sendTransaction']);
  assert.equal(await pending, '0x' + 'a'.repeat(64));
});

test('reviewed prize asks Phantom to eth_sendTransaction in the same turn', async () => {
  const address = n => '0x' + n.repeat(40);
  const prepared = {
    environment: 'testnet', realFundsEnabled: false, state: 'won', amount: '70',
    recipient: address('4'), treasury: address('3'),
    asset: { chainId: '46630', tokenAddress: address('2'), destination: address('3') },
    transfer: {
      signingEnabled: true,
      transaction: {
        from: address('3'), to: address('2'), chainId: '0xb626', value: '0x0',
        data: '0xa9059cbb' + address('4').slice(2).padStart(64, '0') + (70n).toString(16).padStart(64, '0')
      }
    }
  };
  const calls = [];
  const provider = {
    request(input) {
      calls.push(input.method);
      return new Promise(resolve => setTimeout(() => resolve('0x' + 'b'.repeat(64)), 20));
    }
  };
  const pending = requestReviewedPayout(prepared, provider);
  assert.deepEqual(calls, ['eth_sendTransaction']);
  assert.equal(await pending, '0x' + 'b'.repeat(64));
});

function reviewedDepositPrepared() {
  const address = n => '0x' + n.repeat(40);
  return {
    environment: 'testnet', realFundsEnabled: false,
    order: {
      owner: address('1'), minimumReceived: '1000', expiresAt: Date.now() + 60000,
      asset: { chainId: '46630', tokenAddress: address('2'), destination: address('3') }
    },
    transfer: {
      signingEnabled: true,
      transaction: {
        from: address('1'), to: address('2'), chainId: '0xb626', value: '0x0',
        data: '0xa9059cbb' + address('3').slice(2).padStart(64, '0') + (1000n).toString(16).padStart(64, '0')
      }
    }
  };
}

test('an empty Phantom eth_sendTransaction result is not-sent, not an uncertain hash', async () => {
  const calls = [];
  const provider = {
    request(input) {
      calls.push(input.method);
      return undefined;
    }
  };
  const pending = requestReviewedDeposit(reviewedDepositPrepared(), provider);
  assert.deepEqual(calls, ['eth_sendTransaction']);
  await assert.rejects(pending, error => {
    assert.equal(error.code, 'VAULT_WALLET_NOT_SENT');
    assert.match(error.message, /did not open a signature/i);
    assert.match(error.message, /Testnet Mode/i);
    return true;
  });
});

test('Review rejects a 5 AMZN top-up when Pay-from only holds 2.9 AMZN', async () => {
  const prepared = reviewedDepositPrepared();
  prepared.order.minimumReceived = '5000000000000000000';
  prepared.order.asset.decimals = 18;
  prepared.transfer.transaction.data = '0xa9059cbb' + prepared.order.asset.destination.slice(2).padStart(64, '0') + (5n * 10n ** 18n).toString(16).padStart(64, '0');
  const fetchImpl = async (url, init) => {
    assert.equal(url, FUNDING_NETWORK.rpcUrl);
    const body = JSON.parse(init.body);
    assert.equal(body.method, 'eth_call');
    return { json: async () => ({ result: '0x' + (29n * 10n ** 17n).toString(16) }) };
  };
  await assert.rejects(assertReviewedAmznBalance(prepared, { fetchImpl }), error => {
    assert.equal(error.code, 'VAULT_INSUFFICIENT_TEST_AMZN');
    assert.match(error.message, /2\.9 AMZN/);
    assert.match(error.message, /needs 5 AMZN/i);
    assert.match(error.message, /faucet\.testnet\.chain\.robinhood\.com/i);
    return true;
  });
});

const FIVE_AMZN = 5n * 10n ** 18n;
const TWO_POINT_NINE = 29n * 10n ** 17n;
const FUNDED_BOX = '0x1111111111111111111111111111111111111111';

function ethWallet(address, kind = 'external') {
  return { address, chainType: 'ethereum', kind };
}

test('Pay from reads AMZN on RPC 46630 token 0x5884 for each linked ethereum wallet', async () => {
  const wallets = [
    ethWallet(PAYER_BOX),
    ethWallet(FUNDED_BOX),
    { address: '0x2222222222222222222222222222222222222222', chainType: 'solana', kind: 'external' }
  ];
  const seen = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, FUNDING_NETWORK.rpcUrl);
    const body = JSON.parse(init.body);
    const calls = Array.isArray(body) ? body : [body];
    for (const call of calls) {
      assert.equal(call.method, 'eth_call');
      const to = call.params[0].to.toLowerCase();
      assert.equal(to, AMZN);
      const holder = ('0x' + call.params[0].data.slice(-40)).toLowerCase();
      seen.push(holder);
    }
    const holder = ('0x' + calls[0].params[0].data.slice(-40)).toLowerCase();
    const amount = holder === PAYER_BOX ? TWO_POINT_NINE : FIVE_AMZN;
    return { json: async () => ({ result: '0x' + amount.toString(16) }) };
  };
  const balances = await readLinkedAmznBalances(wallets, { tokenAddress: AMZN, fetchImpl });
  assert.deepEqual(seen.sort(), [FUNDED_BOX, PAYER_BOX].sort());
  assert.equal(balances[PAYER_BOX], TWO_POINT_NINE);
  assert.equal(balances[FUNDED_BOX], FIVE_AMZN);
  assert.equal(balances['0x2222222222222222222222222222222222222222'], undefined);
});

test('Pay from labels include each linked wallet AMZN and default to one with at least 5', () => {
  assert.equal(
    payFromWalletLabel(ethWallet(PAYER_BOX), TWO_POINT_NINE),
    'External wallet · 0x686c6c…dc2f79 · 2.9 AMZN'
  );
  assert.equal(
    payFromWalletLabel(ethWallet(FUNDED_BOX, 'embedded'), FIVE_AMZN),
    'Privy · 0x111111…111111 · 5 AMZN'
  );
  const wallets = [ethWallet(PAYER_BOX), ethWallet(FUNDED_BOX)];
  const balances = { [PAYER_BOX]: TWO_POINT_NINE, [FUNDED_BOX]: FIVE_AMZN };
  assert.equal(defaultPayFromAddress(wallets, balances, FIVE_AMZN), FUNDED_BOX);
});

test('Pay from keeps the faucet copy when no linked wallet has 5 AMZN', () => {
  const wallets = [ethWallet(PAYER_BOX), ethWallet(FUNDED_BOX)];
  const balances = { [PAYER_BOX]: TWO_POINT_NINE, [FUNDED_BOX]: TWO_POINT_NINE };
  assert.equal(defaultPayFromAddress(wallets, balances, FIVE_AMZN), PAYER_BOX);
  const copy = payFromShortageCopy({ needed: '5' });
  assert.match(copy, /5 AMZN/);
  assert.match(copy, /faucet\.testnet\.chain\.robinhood\.com/i);
  const fundingUi = readFileSync(join(root, 'public/funding.js'), 'utf8');
  assert.match(fundingUi, /readLinkedAmznBalances/);
  assert.match(fundingUi, /defaultPayFromAddress/);
  assert.match(fundingUi, /payFromWalletLabel/);
  assert.match(fundingUi, /payFromShortageCopy/);
  assert.match(fundingUi, /assertReviewedAmznBalance/);
});

test('Pay from does not default to treasury, x402, or laptop even if they hold at least 5 AMZN', () => {
  const wallets = [
    ethWallet(PAYER_BOX),
    ethWallet(TREASURY_BOX),
    ethWallet(PRODUCT_X402_BOX),
    ethWallet(LAPTOP_REHEARSAL_BOX)
  ];
  const balances = {
    [PAYER_BOX]: TWO_POINT_NINE,
    [TREASURY_BOX]: FIVE_AMZN,
    [PRODUCT_X402_BOX]: FIVE_AMZN,
    [LAPTOP_REHEARSAL_BOX]: FIVE_AMZN
  };
  assert.equal(defaultPayFromAddress(wallets, balances, FIVE_AMZN), PAYER_BOX);
  const copy = payFromShortageCopy({ needed: '5' });
  assert.match(copy, /faucet\.testnet\.chain\.robinhood\.com/i);
});

test('Review can start a new Pay-from after an unsigned leftover for a different wallet', async () => {
  const f = fixture(), c = f.make();
  await c.prepare({ wallet: PAYER_BOX, amountBaseUnits: String(FIVE_AMZN) });
  f.controls.expiresAt = Date.now() - 1;
  const prepared = await c.prepare({ wallet: FUNDED_BOX, amountBaseUnits: String(FIVE_AMZN) });
  assert.equal(prepared.order.id, 'order1');
  const created = f.requests.filter(request => request.path === '/api/funding/deposits' && request.body?.wallet);
  assert.equal(created.at(-1).body.wallet, FUNDED_BOX);
});

test('Review can add Robinhood testnet on 4902; Send never awaits that switch', async () => {
  const { ensureRobinhoodTestnet } = await import('../public/funding-client.js');
  assert.equal(typeof ensureRobinhoodTestnet, 'function');
  const calls = [];
  let chainId = '0x1';
  const provider = {
    async request(input) {
      calls.push(input.method);
      if (input.method === 'eth_chainId') return chainId;
      if (input.method === 'wallet_switchEthereumChain') {
        if (chainId !== FUNDING_NETWORK.hexId) {
          throw Object.assign(new Error('Unrecognized chain ID'), { code: 4902 });
        }
        return null;
      }
      if (input.method === 'wallet_addEthereumChain') {
        assert.equal(input.params[0].chainId, FUNDING_NETWORK.hexId);
        chainId = FUNDING_NETWORK.hexId;
        return null;
      }
      throw new Error(`unexpected ${input.method}`);
    }
  };
  await ensureRobinhoodTestnet(provider);
  assert.ok(calls.includes('wallet_addEthereumChain'));
  assert.ok(!calls.includes('eth_sendTransaction'));
  const sendSource = readFileSync(join(root, 'public/funding-client.js'), 'utf8');
  const sendFn = sendSource.slice(sendSource.indexOf('export function requestReviewedDeposit'), sendSource.indexOf('export async function ensureRobinhoodTestnet'));
  assert.doesNotMatch(sendFn, /wallet_switchEthereumChain/);
  assert.doesNotMatch(sendFn, /wallet_addEthereumChain/);
  assert.doesNotMatch(sendFn, /\bawait\b/);
  const fundingUi = readFileSync(join(root, 'public/funding.js'), 'utf8');
  assert.match(fundingUi, /ensureRobinhoodTestnet/);
  assert.match(fundingUi, /walletRequested/);
  const reviewHandler = fundingUi.slice(fundingUi.indexOf("'Review top-up'"), fundingUi.indexOf('Confirm testnet transfer'));
  assert.match(reviewHandler, /ensureRobinhoodTestnet/);
  assert.match(reviewHandler, /assertReviewedAmznBalance/);
  assert.ok(
    reviewHandler.indexOf('ensureRobinhoodTestnet') < reviewHandler.indexOf('controller.prepare'),
    'Review must ask Phantom to switch before any deposit fetch'
  );
  const sendStart = fundingUi.indexOf('button(signControls, SEND_WITH_PHANTOM_BUTTON');
  const sendHandler = fundingUi.slice(sendStart, fundingUi.indexOf("'Review top-up'", sendStart));
  assert.match(sendHandler, /demoteFundingDialog/);
  assert.match(sendHandler, /busy = false/);
  assert.match(sendHandler, /releaseHungSend/);
  assert.doesNotMatch(sendHandler, /ensureRobinhoodTestnet/);
  assert.doesNotMatch(sendHandler, /assertReviewedAmznBalance/);
  assert.doesNotMatch(sendHandler, /wallet_switchEthereumChain/);
  assert.doesNotMatch(sendHandler, /controller\.prepare/);
  assert.match(fundingUi, /modal:\s*false/);
  assert.match(fundingUi, /phantomBrowseUrl/);
  assert.equal(
    phantomBrowseUrl('https://vault-closed-beta.vercel.app/play', 'https://vault-closed-beta.vercel.app'),
    'https://phantom.app/ul/browse/https%3A%2F%2Fvault-closed-beta.vercel.app%2Fplay?ref=https%3A%2F%2Fvault-closed-beta.vercel.app'
  );
});

test('Top up keeps the wallet error after Asking Phantom instead of wiping the panel', () => {
  const fundingUi = readFileSync(join(root, 'public/funding.js'), 'utf8');
  assert.match(fundingUi, /walletRequested/);
  const runFn = fundingUi.slice(fundingUi.indexOf('async function run'), fundingUi.indexOf('button(controls, usesWebCredits()'));
  assert.match(runFn, /liveStatus\.textContent = text/);
  assert.doesNotMatch(runFn, /replaceChildren/);
  const openCatch = fundingUi.slice(fundingUi.lastIndexOf('} catch (error)'));
  assert.match(openCatch, /liveStatus/);
  assert.match(fundingUi, /if \(!walletRequested && current\(\)\)/);
});

test('review of an expired unsigned order prepares a replacement without sending', async () => {
  const f = fixture(), c = f.make(), input = { amountBaseUnits: '100' };
  await c.prepare(input);
  f.controls.expiresAt = Date.now() - 1000;
  await c.prepare(input);
  assert.equal(c.read().state, 'prepared');
  assert.equal(f.requests.filter(r => r.path === '/api/funding/deposits').length, 2);
  assert.equal(f.sends, 0);
  delete f.controls.expiresAt;
  await c.confirm();
  assert.equal(f.sends, 1);
});

test('expiry never clears a recorded transfer, and a credited or expired order cannot be signed', async () => {
  for (const state of ['recorded', 'credited', 'expired']) {
    const f = fixture(), c = f.make(), input = { amountBaseUnits: '100' };
    await c.prepare(input);
    const saved = JSON.parse(f.storage.getItem('alice'));
    if (state === 'recorded') saved.prepared.order.submittedTransactionHash = '0x' + 'b'.repeat(64);
    if (state === 'credited') saved.prepared.order.credited = true;
    if (state === 'expired') saved.prepared.order.expiresAt = Date.now() - 1000;
    f.storage.setItem('alice', JSON.stringify(saved));
    await assert.rejects(c.confirm());
    if (state === 'recorded') f.controls.submittedHash = '0x' + 'b'.repeat(64);
    if (state === 'credited') f.controls.credited = true;
    f.controls.expiresAt = Date.now() - 1000;
    await c.prepare(input);
    assert.equal(c.read().state, state === 'credited' ? 'complete' : 'prepared');
    assert.equal(f.sends, 0);
  }
});

test('token amounts use exact base units and reject exponent notation, negative, precision and overflow', () => {
  assert.equal(tokenAmount('1.000001', 6), '1000001'); assert.equal(displayTokens('1000001', 6), '1.000001');
  for (const value of ['1e6', '-1', '0', 'NaN', '0.0000001', '9'.repeat(80)]) assert.throws(() => tokenAmount(value, 6));
});
test('lost prepare response retains the same key, and cannot silently change the amount', async () => {
  const f = fixture(), c = f.make(), input = { wallet: 'alice', amountBaseUnits: '100' };
  f.controls.fail = true; await assert.rejects(c.prepare(input));
  f.controls.fail = false; await c.prepare(input);
  assert.equal(f.requests[0].body.key, f.requests[1].body.key);
  await assert.rejects(c.prepare({ ...input, amountBaseUnits: '200' })); assert.equal(f.sends, 0);
});
test('uncertain wallet send survives reload and blocks a second signature; known hash recovers without resending', async () => {
  const f = fixture(), c = f.make(); await c.prepare({ amountBaseUnits: '100' });
  f.controls.sendError = new Error('Lost wallet response'); await assert.rejects(c.confirm());
  const restored = f.make(); await assert.rejects(restored.confirm()); assert.equal(f.sends, 1);
  f.controls.credited = true; await restored.recover('0x' + 'b'.repeat(64));
  assert.equal(restored.read().state, 'complete'); assert.equal(f.sends, 1);
});
test('an explicit user rejection may be reviewed again; concurrent confirms only send once', async () => {
  const f = fixture(), c = f.make(); await c.prepare({ amountBaseUnits: '100' });
  f.controls.sendError = Object.assign(new Error('Rejected'), { code: 4001 }); await assert.rejects(c.confirm());
  assert.equal(c.read().state, 'prepared'); delete f.controls.sendError;
  const results = await Promise.allSettled([c.confirm(), c.confirm()]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(f.sends, 2);
});

test('local wallet preflight errors allow review without treating an uncalled send as uncertain', async () => {
  const f = fixture(), c = f.make(); await c.prepare({ amountBaseUnits: '100' });
  f.controls.sendError = Object.assign(new Error('Wrong account'), { code: 'VAULT_WALLET_NOT_SENT' });
  await assert.rejects(c.confirm()); assert.equal(c.read().state, 'prepared');
  f.controls.sendError = new Error('Disconnected after send');
  await assert.rejects(c.confirm()); assert.equal(c.read().state, 'signing-unknown');
});

test('legacy unknown state needs explicit no-signature acknowledgement and rejects a recorded hash', async () => {
  const f = fixture(), c = f.make(); await c.prepare({ amountBaseUnits: '100' });
  f.controls.sendError = new Error('Old wallet preflight failure'); await assert.rejects(c.confirm());
  await assert.rejects(c.acknowledgeNotSigned());
  f.controls.submittedHash = '0x' + 'a'.repeat(64);
  await assert.rejects(c.acknowledgeNotSigned({ confirmedNoSignature: true }), /already recorded/);
  delete f.controls.submittedHash;
  await c.acknowledgeNotSigned({ confirmedNoSignature: true });
  assert.equal(c.read().state, 'prepared'); assert.equal(c.read().userConfirmedNotSigned, true);
  assert.equal(f.sends, 1);
});

const unsignedOrder = (overrides = {}) => ({
  id: 'order1',
  credited: false,
  state: 'awaiting-transaction',
  owner: '0x686c000000000000000000000000000000002f79',
  minimumReceived: '5000000000000000000',
  expiresAt: Date.now() + 60000,
  submittedTransactionHash: undefined,
  transactionHash: undefined,
  ...overrides
});

test('unsigned pending order shows Confirm, not Recover, when no hash was recorded', () => {
  const ui = pendingTopupUi({
    record: { state: 'prepared', hash: null },
    order: unsignedOrder(),
    transfer: { signingEnabled: true }
  });
  assert.equal(ui.confirmVisible, true);
  assert.equal(ui.recoverOpen, false);
  assert.equal(ui.acknowledgeVisible, false);
  assert.match(pendingTopupStatusCopy(ui, {
    amount: '5',
    owner: unsignedOrder().owner,
    destination: '0xbec4fdb33ed39844956d9078fd232aca92d7396d'
  }), /Click Send with Phantom once/i);
  assert.match(pendingTopupStatusCopy(ui, {
    amount: '5',
    owner: unsignedOrder().owner,
    destination: '0xbec4fdb33ed39844956d9078fd232aca92d7396d'
  }), /Asking Phantom/i);
  assert.doesNotMatch(pendingTopupStatusCopy(ui, { amount: '5' }), /Recover it before starting another/i);
  assert.doesNotMatch(pendingTopupStatusCopy(ui, { amount: '5' }), /transaction hash/i);
});

test('local prepared record without a fetched order still shows Confirm', () => {
  const ui = pendingTopupUi({ record: { state: 'prepared' } });
  assert.equal(ui.confirmVisible, true);
  assert.equal(ui.recoverOpen, false);
  assert.match(pendingTopupStatusCopy(ui), /Send with Phantom/i);
});

test('signing-unknown without a hash treats I did not sign as the path, not hash recovery', () => {
  const ui = pendingTopupUi({
    record: { state: 'signing-unknown' },
    order: unsignedOrder(),
    transfer: { signingEnabled: true }
  });
  assert.equal(ui.confirmVisible, false);
  assert.equal(ui.acknowledgeVisible, true);
  assert.equal(ui.recoverOpen, false);
  const copy = pendingTopupStatusCopy(ui);
  assert.match(copy, /Send with Phantom again/i);
  assert.doesNotMatch(copy, /Recover it before starting another/i);
  assert.doesNotMatch(copy, /recover it below/i);
});

test('expired unsigned order asks for a new Review, not a hash hunt', () => {
  const ui = pendingTopupUi({
    record: { state: 'prepared' },
    order: unsignedOrder({ expiresAt: Date.now() - 1000 }),
    transfer: { signingEnabled: true }
  });
  assert.equal(ui.confirmVisible, false);
  assert.equal(ui.recoverOpen, false);
  const copy = pendingTopupStatusCopy(ui);
  assert.match(copy, /Review top-up/i);
  assert.doesNotMatch(copy, /recover the transaction hash first/i);
});

test('only a recorded hash opens Recover as the main path', () => {
  const ui = pendingTopupUi({
    record: { state: 'submitted', hash: '0x' + 'a'.repeat(64) },
    order: unsignedOrder({ submittedTransactionHash: '0x' + 'a'.repeat(64) }),
    transfer: { signingEnabled: false }
  });
  assert.equal(ui.confirmVisible, false);
  assert.equal(ui.recoverOpen, true);
  assert.match(pendingTopupStatusCopy(ui), /transaction hash/i);
});

test('review errors without a hash do not tell the player to recover a transfer', () => {
  assert.equal(topupErrorFollowup({ message: 'Recover the existing top-up before starting another.' }, { state: 'prepared' }), '');
  assert.match(topupErrorFollowup({ message: 'Lost' }, { state: 'signing-unknown' }), /Send with Phantom again/i);
  assert.doesNotMatch(topupErrorFollowup({ message: 'Lost' }, { state: 'signing-unknown' }), /recover it below/i);
  assert.match(topupErrorFollowup({ message: 'Lost' }, { state: 'submitted', hash: '0x' + 'a'.repeat(64) }), /recover it below/i);
  assert.match(topupErrorFollowup(Object.assign(new Error('Cancelled'), { code: 4001 }), { state: 'prepared' }), /cancelled/i);
});

test('second Review of an unsigned interrupted send revives without hunting a hash', async () => {
  const f = fixture(), c = f.make(), input = { wallet: '0x686c000000000000000000000000000000002f79', amountBaseUnits: '5000000000000000000' };
  await c.prepare(input);
  f.controls.sendError = new Error('Lost wallet response');
  await assert.rejects(c.confirm());
  assert.equal(c.read().state, 'signing-unknown');
  const prepared = await c.prepare(input);
  assert.equal(c.read().state, 'prepared');
  assert.equal(prepared.order.credited, false);
  assert.equal(f.sends, 1);
});

test('Send after an unsigned leftover prompts again without fetching', async () => {
  const f = fixture(), c = f.make();
  await c.prepare({ amountBaseUnits: '100' });
  f.controls.sendError = new Error('Lost wallet response');
  await assert.rejects(c.confirm());
  assert.equal(c.read().state, 'signing-unknown');
  delete f.controls.sendError;
  c.releaseHungSend();
  const apis = f.requests.length;
  const pending = c.confirm();
  assert.equal(f.sends, 2);
  assert.equal(f.requests.length, apis);
  await pending;
  assert.equal(c.read().state, 'submitted');
  assert.equal(c.read().hash, '0x' + 'a'.repeat(64));
});

test('Review of an expired unsigned signing-unknown leftover prepares a replacement without asking to acknowledge', async () => {
  const f = fixture(), c = f.make(), input = { wallet: '0x686c000000000000000000000000000000002f79', amountBaseUnits: '5000000000000000000' };
  await c.prepare(input);
  f.controls.sendError = new Error('Lost wallet response');
  await assert.rejects(c.confirm());
  assert.equal(c.read().state, 'signing-unknown');
  f.controls.expiresAt = Date.now() - 1000;
  const replaced = await c.prepare(input);
  assert.equal(c.read().state, 'prepared');
  assert.equal(replaced.order.credited, false);
  assert.equal(f.requests.filter(r => r.path === '/api/funding/deposits').length, 2);
  assert.equal(f.sends, 1);
});

test('recover without a hash retires an expired unsigned order so the next Review can create a replacement', async () => {
  const f = fixture(), c = f.make(), input = { amountBaseUnits: '5000000000000000000' };
  await c.prepare(input);
  f.controls.expiresAt = Date.now() - 1000;
  await c.recover();
  assert.equal(c.read().state, 'complete');
  assert.equal(f.sends, 0);
  delete f.controls.expiresAt;
  await c.prepare(input);
  assert.equal(c.read().state, 'prepared');
  assert.equal(f.sends, 0);
});

test('a held Web Lock fails immediately so Review and Confirm do not freeze', async () => {
  const storage = { getItem: () => null, setItem() {} };
  const c = createTopupController({
    api: async () => ({ order: { id: 'x', expiresAt: Date.now() + 60000 }, transfer: { signingEnabled: true } }),
    storage, storageKey: 'held-lock', send: async () => '0x' + 'a'.repeat(64),
    locks: { request: async (_name, _opts, callback) => callback(null) }
  });
  await assert.rejects(c.prepare({ amountBaseUnits: '1' }), /hard-refresh/i);
});

const publicHaikuConfig = {
  enabled: true,
  environment: 'testnet',
  realFundsEnabled: false,
  asset: {
    chainId: '46630',
    tokenAddress: '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02',
    destination: '0xbec4fdb33ed39844956d9078fd232aca92d7396d',
    decimals: 18
  },
  network: { name: 'Robinhood Chain Testnet', chainId: '46630' },
  rounds: [{
    id: 'rh-paid-haiku-v1',
    price: '1000000000000000000',
    prizeBps: 7000,
    operationsBps: 3000,
    nextRoundBps: 0
  }]
};

test('unsigned Top up disclosure shows public funding terms without a Privy session', () => {
  const panel = unsignedTopupDisclosure(publicHaikuConfig);
  const text = [panel.gate, ...panel.facts].join('\n');
  assert.match(text, /Sign in, then Connect Phantom/);
  assert.match(text, /do not need the CLI faucet address/i);
  assert.match(text, /Robinhood Chain Testnet/);
  assert.match(text, /46630/);
  assert.match(text, /AMZN/i);
  assert.match(text, /0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02/i);
  assert.match(text, /0xbec4fdb33ed39844956d9078fd232aca92d7396d/i);
  assert.match(text, /\b1\b/);
  assert.match(text, /70% bounty/);
  assert.match(text, /30% operations/);
  assert.doesNotMatch(text, /CLI faucet address is required/i);
  const invited = unsignedTopupDisclosure(publicHaikuConfig, { signedIn: true });
  assert.match(invited.gate, /active beta invitation/);
  assert.match(invited.facts.join('\n'), /Robinhood Chain Testnet/);
});

test('local operator client headers identify the inbound payer without treating it as x402 ops', async () => {
  assert.deepEqual(localOperatorHeaders(PAYER_BOX), { [LOCAL_OPERATOR_HEADER]: PAYER_BOX });
  assert.deepEqual(localOperatorHeaders('not-an-address'), {});
  const wallet = await readLocalOperatorWallet({
    request: async ({ method }) => {
      assert.equal(method, 'eth_accounts');
      return [PAYER_BOX];
    }
  });
  assert.equal(wallet, PAYER_BOX);
});

test('unsigned Top up disclosure for local observe tells a raw Phantom send', () => {
  const panel = unsignedTopupDisclosure({ ...publicHaikuConfig, localOperatorObserve: true });
  assert.match(panel.gate, /send 1 AMZN to treasury on Robinhood testnet/i);
  assert.match(panel.gate, /localhost login optional for this proving round/i);
  assert.match(panel.gate, /refresh \/play/i);
  assert.match(panel.gate, /player_rh\{your address\}/);
  assert.doesNotMatch(panel.gate, /Sign in, then Connect Phantom/);
  const text = [panel.gate, ...panel.facts].join('\n');
  assert.match(text, /46630/);
  assert.match(text, /0xbec4fdb33ed39844956d9078fd232aca92d7396d/i);
});

function provingConfig(overrides = {}) {
  return { ...publicHaikuConfig, localOperatorObserve: true, realFundsEnabled: false, ...overrides };
}

test('proving-round helper encodes exactly 1e18 AMZN to treasury on chain 46630', () => {
  const tx = provingRoundTransfer(provingConfig(), PAYER_BOX);
  assert.equal(tx.from, PAYER_BOX);
  assert.equal(tx.to, AMZN);
  assert.equal(tx.chainId, '0xb626');
  assert.equal(tx.value, '0x0');
  assert.equal(tx.data, '0xa9059cbb' + TREASURY_BOX.slice(2).padStart(64, '0') + BigInt(ONE_AMZN).toString(16).padStart(64, '0'));
  assert.equal(BigInt('0x' + tx.data.slice(74), 16), 10n ** 18n);
  const phantom = '0x1111111111111111111111111111111111111111';
  const anyFrom = provingRoundTransfer(provingConfig(), phantom);
  assert.equal(anyFrom.from, phantom);
  assert.notEqual(anyFrom.from, PAYER_BOX);
  assert.equal(anyFrom.data, tx.data);
});

test('proving-round helper is local paid-beta:testnet only and never uses x402 ops or treasury as the sender', () => {
  assert.throws(() => provingRoundTransfer(provingConfig({ localOperatorObserve: false }), PAYER_BOX), /local/i);
  assert.throws(() => provingRoundTransfer(provingConfig({ environment: 'mainnet' }), PAYER_BOX));
  assert.throws(() => provingRoundTransfer(provingConfig({ realFundsEnabled: true }), PAYER_BOX));
  assert.throws(() => provingRoundTransfer(provingConfig({ asset: { ...publicHaikuConfig.asset, chainId: '4663' } }), PAYER_BOX));
  assert.throws(() => provingRoundTransfer(provingConfig({ asset: { ...publicHaikuConfig.asset, tokenAddress: TREASURY_BOX } }), PAYER_BOX));
  assert.throws(() => provingRoundTransfer(provingConfig({ asset: { ...publicHaikuConfig.asset, destination: PAYER_BOX } }), PAYER_BOX));
  assert.throws(() => provingRoundTransfer(provingConfig(), TREASURY_BOX));
  assert.throws(() => provingRoundTransfer(provingConfig(), X402_OPS));
});

test('proving-round Phantom send switches to 0xb626 then eth_sendTransaction 1 AMZN', async () => {
  const calls = [];
  const provider = {
    async request(input) {
      calls.push(input);
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return [PAYER_BOX];
      if (input.method === 'eth_chainId') return '0xb626';
      if (input.method === 'wallet_switchEthereumChain') return null;
      if (input.method === 'eth_sendTransaction') return '0x' + 'c'.repeat(64);
      throw new Error(`Unexpected ${input.method}`);
    }
  };
  const hash = await sendProvingRoundTransfer(provider, provingConfig());
  assert.equal(hash, '0x' + 'c'.repeat(64));
  assert.equal(calls[0].method, 'eth_requestAccounts');
  const switchCall = calls.find(call => call.method === 'wallet_switchEthereumChain');
  const sendCall = calls.find(call => call.method === 'eth_sendTransaction');
  assert.ok(switchCall);
  assert.ok(sendCall);
  assert.ok(calls.findIndex(call => call.method === 'wallet_switchEthereumChain') < calls.findIndex(call => call.method === 'eth_sendTransaction'));
  assert.deepEqual(switchCall.params, [{ chainId: '0xb626' }]);
  assert.deepEqual(sendCall.params[0], provingRoundTransfer(provingConfig(), PAYER_BOX));
  assert.ok(!calls.some(call => /personal_sign|eth_sign|privy/i.test(call.method)));
});

test('proving-round Phantom send does not eth_sendTransaction if the chain switch fails', async () => {
  const calls = [];
  const provider = {
    async request(input) {
      calls.push(input);
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return [PAYER_BOX];
      if (input.method === 'wallet_switchEthereumChain') throw new Error('Not in testnet mode');
      throw new Error(`Unexpected ${input.method}`);
    }
  };
  await assert.rejects(sendProvingRoundTransfer(provider, provingConfig()), error => error.code === 'VAULT_WALLET_NOT_SENT');
  assert.ok(!calls.some(call => call.method === 'eth_sendTransaction'));
});

test('injected Phantom prefers window.phantom.ethereum and the play button is local-observe copy', () => {
  assert.equal(PROVING_ROUND_BUTTON, 'Send 1 AMZN to treasury');
  const phantom = { request() {} };
  assert.equal(injectedPhantom({ window: { phantom: { ethereum: phantom }, ethereum: { request() {} } } }), phantom);
  const listed = { isPhantom: true, request() {} };
  const brave = { isBraveWallet: true, isMetaMask: true, request() {} };
  assert.equal(injectedPhantom({ window: { ethereum: { isBraveWallet: true, providers: [brave, listed] } } }), listed);
  assert.throws(() => injectedPhantom({ window: {} }), /Phantom/i);
  assert.throws(() => injectedPhantom({ window: { ethereum: brave } }), /never received a request|Phantom/i);
  const html = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.match(html, /id="proving-round-send"/);
  assert.match(html, /id="proving-round-claim"/);
  assert.match(html, /Send 1 AMZN to treasury/);
  assert.match(html, /Send prize from treasury/);
  const account = readFileSync(join(root, 'public/account.js'), 'utf8');
  assert.match(account, /sendProvingRoundTransfer/);
  assert.match(account, /sendProvingRoundClaim/);
  assert.match(account, /recordProvingRoundClaim/);
  assert.match(account, /injectedPhantom/);
  assert.match(account, /localOperatorObserve/);
  assert.doesNotMatch(account, /sendProvingRoundTransfer\(await ensureClient/);
  assert.doesNotMatch(account, /sendProvingRoundClaim\(await ensureClient/);
  assert.doesNotMatch(account, /adoptLocalOperator\(TREASURY/);
  const fundingUi = readFileSync(join(root, 'public/funding.js'), 'utf8');
  assert.match(fundingUi, /createTopupController/);
  assert.match(fundingUi, /pendingTopupUi/);
  assert.match(fundingUi, /pendingTopupStatusCopy/);
  assert.match(fundingUi, /topupErrorFollowup/);
  assert.match(fundingUi, /Confirm testnet transfer/);
  assert.match(fundingUi, /I did not sign a transfer/);
  assert.match(fundingUi, /SEND_WITH_PHANTOM_BUTTON/);
  assert.match(fundingUi, /ASKING_PHANTOM/);
  assert.match(fundingUi, /requestReviewedDeposit/);
  assert.match(fundingUi, /requestReviewedPayout/);
  assert.match(fundingUi, /Review prize transfer/);
  assert.match(fundingUi, /Confirm prize transfer/);
  const prizeReview = fundingUi.slice(fundingUi.indexOf('Review prize transfer'), fundingUi.indexOf("'Confirm prize transfer'"));
  assert.match(prizeReview, /ensureRobinhoodTestnet/);
  assert.ok(
    prizeReview.indexOf('ensureRobinhoodTestnet') < prizeReview.indexOf('fundingRequest'),
    'Review prize must switch to Robinhood testnet before prepare'
  );
  const prizeConfirm = fundingUi.slice(fundingUi.indexOf("'Confirm prize transfer'"), fundingUi.indexOf('Your top-up stays'));
  assert.match(prizeConfirm, /demoteFundingDialog/);
  assert.match(prizeConfirm, /requestReviewedPayout/);
  assert.ok(
    prizeConfirm.indexOf('requestReviewedPayout') < prizeConfirm.indexOf('/submit'),
    'Confirm prize must ask Phantom before submit/check fetch'
  );
  assert.doesNotMatch(prizeConfirm, /fundingRequest\(`\/api\/funding\/claims\/\$\{roundId\}\/prepare`/);
  assert.doesNotMatch(fundingUi, /sendTestnetPayout/);
  assert.match(account, /requestReviewedPayout/);
  assert.match(fundingUi, /readyToSend/);
  assert.match(fundingUi, /keepStatus/);
  assert.doesNotMatch(fundingUi, /send: sendTestnetDeposit/);
  assert.doesNotMatch(fundingUi, /confirm\.hidden = true;/);
  assert.doesNotMatch(fundingUi, /Recover it before starting another/);
  assert.doesNotMatch(fundingUi, /if \(busy \|\| !current\(\)\) return;/);
  assert.match(account, /requestReviewedDeposit/);
  assert.match(account, /requestReviewedPayout/);
  assert.doesNotMatch(account, /sendPhantomDeposit/);
  const client = readFileSync(join(root, 'public/funding-client.js'), 'utf8');
  assert.match(client, /requestReviewedDeposit/);
  assert.match(client, /sendPromise = send\(prepared\)/);
  assert.doesNotMatch(client, /confirm: \(\) => exclusive\(async/);
  assert.match(fundingUi, /treasury-dialog.*close/);
  assert.match(fundingUi, /already running/);
  assert.match(fundingUi, /Working/);
  assert.match(fundingUi, /PROVING_ROUND_BUTTON/);
  assert.match(fundingUi, /PROVING_CLAIM_BUTTON/);
  assert.match(fundingUi, /localOperatorObserve/);
  assert.match(fundingUi, /sendProvingRoundTransfer/);
  assert.match(fundingUi, /sendProvingRoundClaim/);
  assert.match(fundingUi, /recordProvingRoundClaim/);
  assert.doesNotMatch(fundingUi, /sendProvingRoundClaim\(await ensureClient/);
});

test('unsigned claim disclosure shows prize terms from public funding config without a session', () => {
  const panel = unsignedClaimDisclosure({
    ...publicHaikuConfig,
    testnetClaimsEnabled: true,
    rounds: [{ ...publicHaikuConfig.rounds[0], winRetainBps: 2500, prizePayable: '0' }]
  });
  const text = [panel.gate, ...panel.facts].join('\n');
  assert.match(text, /Sign in/);
  assert.match(text, /Robinhood Chain Testnet/);
  assert.match(text, /46630/);
  assert.match(text, /AMZN/i);
  assert.match(text, /0xbec4fdb33ed39844956d9078fd232aca92d7396d/i);
  assert.match(text, /75%/);
  assert.match(text, /25%/);
  assert.match(text, /no cash prize/i);
  assert.match(text, /x402 operating box/i);
  assert.doesNotMatch(text, /Confirm prize transfer/);
});

test('unsigned claim disclosure for local observe tells a raw Phantom prize send', () => {
  const panel = unsignedClaimDisclosure({
    ...publicHaikuConfig,
    localOperatorObserve: true,
    testnetClaimsEnabled: true,
    rounds: [{
      ...publicHaikuConfig.rounds[0],
      state: 'won',
      winRetainBps: 2500,
      prizePayable: '700000000000000000',
      prizeRecipient: PAYER_BOX
    }]
  });
  const text = [panel.gate, ...panel.facts].join('\n');
  assert.match(panel.gate, /disclosed treasury in Phantom/i);
  assert.match(panel.gate, /0xb626/);
  assert.match(panel.gate, /sign-in is optional/i);
  assert.doesNotMatch(panel.gate, /Sign in to review/);
  assert.match(text, /0xbec4fdb33ed39844956d9078fd232aca92d7396d/i);
  assert.match(text, new RegExp(PAYER_BOX, 'i'));
  assert.match(text, /0\.7 AMZN/);
});

function wonRound(overrides = {}) {
  return {
    id: 'rh-paid-haiku-v1',
    state: 'won',
    prizePayable: '700000000000000000',
    prizeRecipient: PAYER_BOX,
    ...overrides
  };
}

test('proving-round claim helper encodes treasury to winner for the recorded payable', () => {
  const round = wonRound();
  const tx = provingRoundClaimTransfer(provingConfig({ rounds: [round] }), round, TREASURY_BOX);
  assert.equal(tx.from, TREASURY_BOX);
  assert.equal(tx.to, AMZN);
  assert.equal(tx.chainId, '0xb626');
  assert.equal(tx.value, '0x0');
  assert.equal(tx.data, '0xa9059cbb' + PAYER_BOX.slice(2).padStart(64, '0') + BigInt('700000000000000000').toString(16).padStart(64, '0'));
  assert.equal(PROVING_CLAIM_BUTTON, 'Send prize from treasury');
});

test('proving-round claim helper is local testnet only and never spends 0.1 AMZN or x402 ops', () => {
  const round = wonRound();
  assert.throws(() => provingRoundClaimTransfer(provingConfig({ localOperatorObserve: false }), round, TREASURY_BOX), /local/i);
  assert.throws(() => provingRoundClaimTransfer(provingConfig(), round, PAYER_BOX), /treasury/i);
  assert.throws(() => provingRoundClaimTransfer(provingConfig(), round, X402_OPS), /treasury/i);
  assert.throws(() => provingRoundClaimTransfer(provingConfig(), wonRound({ prizePayable: '100000000000000000' }), TREASURY_BOX), /0\.1|historical/i);
  assert.throws(() => provingRoundClaimTransfer(provingConfig(), wonRound({ state: 'open', prizePayable: '0', prizeRecipient: PAYER_BOX }), TREASURY_BOX));
  assert.throws(() => provingRoundClaimTransfer(provingConfig(), wonRound({ prizeRecipient: TREASURY_BOX }), TREASURY_BOX));
  assert.throws(() => provingRoundClaimTransfer(provingConfig(), wonRound({ prizeRecipient: X402_OPS }), TREASURY_BOX));
});

test('proving-round Phantom claim switches to 0xb626 then eth_sendTransaction from treasury', async () => {
  const round = wonRound();
  const config = provingConfig({ rounds: [round] });
  const calls = [];
  const provider = {
    async request(input) {
      calls.push(input);
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return [TREASURY_BOX];
      if (input.method === 'eth_chainId') return '0xb626';
      if (input.method === 'wallet_switchEthereumChain') return null;
      if (input.method === 'eth_sendTransaction') return '0x' + 'd'.repeat(64);
      throw new Error(`Unexpected ${input.method}`);
    }
  };
  const hash = await sendProvingRoundClaim(provider, config, round);
  assert.equal(hash, '0x' + 'd'.repeat(64));
  const switchCall = calls.find(call => call.method === 'wallet_switchEthereumChain');
  const sendCall = calls.find(call => call.method === 'eth_sendTransaction');
  assert.ok(switchCall);
  assert.ok(sendCall);
  assert.ok(calls.findIndex(call => call.method === 'wallet_switchEthereumChain') < calls.findIndex(call => call.method === 'eth_sendTransaction'));
  assert.deepEqual(switchCall.params, [{ chainId: '0xb626' }]);
  assert.deepEqual(sendCall.params[0], provingRoundClaimTransfer(config, round, TREASURY_BOX));
  assert.ok(!calls.some(call => /personal_sign|eth_sign|privy/i.test(call.method)));
});

test('proving-round Phantom claim does not send if Phantom is the player', async () => {
  const calls = [];
  const provider = {
    async request(input) {
      calls.push(input);
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return [PAYER_BOX];
      if (input.method === 'eth_chainId') return '0xb626';
      if (input.method === 'wallet_switchEthereumChain') return null;
      throw new Error(`Unexpected ${input.method}`);
    }
  };
  await assert.rejects(sendProvingRoundClaim(provider, provingConfig(), wonRound()), error => error.code === 'VAULT_WALLET_NOT_SENT');
  assert.ok(!calls.some(call => call.method === 'eth_sendTransaction'));
});

test('recordProvingRoundClaim posts submit then check with the treasury local-operator header', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    return Response.json({ order: { state: 'paid', transactionHash: '0x' + 'e'.repeat(64) } });
  };
  const result = await recordProvingRoundClaim(wonRound(), '0x' + 'c'.repeat(64), { fetchImpl });
  assert.equal(result.order.state, 'paid');
  assert.equal(calls[0].url, '/api/funding/claims/rh-paid-haiku-v1/submit');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers[LOCAL_OPERATOR_HEADER], TREASURY_BOX);
  assert.equal(JSON.parse(calls[0].body).transactionHash, '0x' + 'c'.repeat(64));
  assert.equal(calls[1].url, '/api/funding/claims/rh-paid-haiku-v1/check');
  assert.equal(calls[1].headers[LOCAL_OPERATOR_HEADER], TREASURY_BOX);
});
