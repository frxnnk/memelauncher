import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNDING_NETWORK, checkedDepositTransaction, checkedPayoutTransaction, walletChain, creditPlayModels, chooseCreditPlayModel } from '../public/funding-network.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkPhantom, sendPhantomDeposit, sendPhantomPayout } from '../client/phantom.mjs';
import { getAddress } from 'viem';
const address = n => '0x' + n.repeat(40);
const prepared = () => ({ environment: 'testnet', realFundsEnabled: false,
  order: { owner: address('1'), minimumReceived: '1000', expiresAt: Date.now() + 60000,
    asset: { chainId: '46630', tokenAddress: address('2'), destination: address('3') } },
  transfer: { signingEnabled: true, transaction: { from: address('1'), to: address('2'), chainId: '0xb626', value: '0x0',
    data: '0xa9059cbb' + address('3').slice(2).padStart(64, '0') + (1000n).toString(16).padStart(64, '0') } } });
function providerFixture() {
  const calls = [], control = { account: address('1'), chainId: '0xb626' };
  return { calls, control, provider: { async request(input) {
    calls.push(input);
    if (input.method === 'eth_accounts' || input.method === 'eth_requestAccounts') return [control.account];
    if (input.method === 'eth_chainId') return control.chainId;
    if (input.method === 'wallet_switchEthereumChain') { if (control.changeOnSwitch) control.account = address('4'); return null; }
    if (input.method === 'personal_sign') { if (control.changeOnSign) control.account = address('4'); return '0xsignature'; }
    if (input.method === 'eth_sendTransaction') return '0x' + 'a'.repeat(64);
    throw new Error('Unexpected wallet method');
  } } };
}
test('the wallet configuration and transaction gate target Robinhood testnet only', () => {
  assert.equal(walletChain().id, 46630); assert.equal(FUNDING_NETWORK.hexId, '0xb626');
  assert.equal(checkedDepositTransaction(prepared()).to, address('2'));
  for (const chainId of ['0x1237', '0x14a34', '0x1']) {
    const value = prepared(); value.transfer.transaction.chainId = chainId;
    assert.throws(() => checkedDepositTransaction(value));
  }
  for (const change of [v => v.transfer.transaction.to = address('4'), v => v.transfer.transaction.data += '00',
    v => v.order.minimumReceived = '999', v => v.order.expiresAt = 0, v => v.order.credited = true,
    v => v.order.submittedTransactionHash = '0xhash', v => v.realFundsEnabled = true]) {
    const value = prepared(); change(value); assert.throws(() => checkedDepositTransaction(value));
  }
});
test('prize payout calldata is treasury to winner and rejects a deposit-shaped transaction', () => {
  const payout = () => ({ environment: 'testnet', realFundsEnabled: false, state: 'won', amount: '70',
    recipient: address('4'), treasury: address('3'),
    asset: { chainId: '46630', tokenAddress: address('2'), destination: address('3') },
    transfer: { signingEnabled: true, transaction: { from: address('3'), to: address('2'), chainId: '0xb626', value: '0x0',
      data: '0xa9059cbb' + address('4').slice(2).padStart(64, '0') + (70n).toString(16).padStart(64, '0') } } });
  assert.equal(checkedPayoutTransaction(payout()).from, address('3'));
  assert.equal(checkedPayoutTransaction(payout()).to, address('2'));
  assert.throws(() => checkedPayoutTransaction(prepared()));
  assert.throws(() => checkedPayoutTransaction({ ...payout(), realFundsEnabled: true }));
});
test('Phantom prize send uses the treasury account', async () => {
  const payout = () => ({ environment: 'testnet', realFundsEnabled: false, state: 'won', amount: '70',
    recipient: address('4'), treasury: address('3'),
    asset: { chainId: '46630', tokenAddress: address('2'), destination: address('3') },
    transfer: { signingEnabled: true, transaction: { from: address('3'), to: address('2'), chainId: '0xb626', value: '0x0',
      data: '0xa9059cbb' + address('4').slice(2).padStart(64, '0') + (70n).toString(16).padStart(64, '0') } } });
  const f = providerFixture(); f.control.account = address('3');
  await sendPhantomPayout(payout(), f.provider);
  assert.equal(f.calls.filter(call => call.method === 'eth_sendTransaction').length, 1);
  assert.equal(f.calls.at(-1).params[0].from, address('3'));
});
test('Phantom transfer sends only the reviewed ERC20 transaction and stops on network/account changes', async () => {
  const f = providerFixture(); await sendPhantomDeposit(prepared(), f.provider);
  assert.deepEqual(f.calls.at(-1), { method: 'eth_sendTransaction', params: [checkedDepositTransaction(prepared())] });
  assert.equal(f.calls.filter(call => call.method === 'eth_sendTransaction').length, 1);
  for (const control of [{ chainId: '0x1237' }, { account: address('4') }, { chainId: '0x1', changeOnSwitch: true }]) {
    const bad = providerFixture(); Object.assign(bad.control, control);
    await assert.rejects(sendPhantomDeposit(prepared(), bad.provider));
    assert.ok(!bad.calls.some(call => call.method === 'eth_sendTransaction'));
  }
});

test('live Top up is not a modal dialog so Phantom can overlay Brave', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const fundingUi = readFileSync(join(root, 'public/funding.js'), 'utf8');
  const details = readFileSync(join(root, 'public/details.js'), 'utf8');
  const css = readFileSync(join(root, 'public/dialogs.css'), 'utf8');
  assert.match(fundingUi, /showInfo\('Top up & bounty', 'TESTNET AMZN', \{ modal: false \}\)/);
  assert.match(details, /dialog\.show\(\)/);
  assert.match(css, /info-dialog:not\(:modal\)/);
  assert.match(fundingUi, /demoteFundingDialog/);
  assert.match(readFileSync(join(root, 'public/index.html'), 'utf8'), /app\.js\?v=phantom-sign-5/);
});

test('Brave Wallet on window.ethereum is not used when Phantom is in providers', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const phantom = providerFixture();
  phantom.provider.isPhantom = true;
  const brave = providerFixture();
  brave.provider.isBraveWallet = true;
  brave.control.account = address('9');
  globalThis.window = {
    ethereum: Object.assign(brave.provider, {
      isBraveWallet: true,
      providers: [brave.provider, phantom.provider]
    })
  };
  await sendPhantomDeposit(prepared());
  assert.equal(phantom.calls.filter(call => call.method === 'eth_sendTransaction').length, 1);
  assert.equal(brave.calls.filter(call => call.method === 'eth_sendTransaction').length, 0);
});

test('already on Robinhood testnet asks Phantom then sends without wallet_switchEthereumChain', async () => {
  const f = providerFixture();
  await sendPhantomDeposit(prepared(), f.provider);
  const methods = f.calls.map(call => call.method);
  assert.equal(methods.includes('wallet_switchEthereumChain'), false);
  assert.ok(methods.indexOf('eth_requestAccounts') < methods.indexOf('eth_sendTransaction'));
  assert.equal(f.calls.filter(call => call.method === 'eth_sendTransaction').length, 1);
});

test('a hung wallet_switchEthereumChain is not-sent so Confirm can prompt again', { timeout: 800 }, async () => {
  const f = providerFixture();
  f.control.chainId = '0x1';
  const original = f.provider.request;
  f.provider.request = input => input.method === 'wallet_switchEthereumChain'
    ? new Promise(() => {})
    : original(input);
  await assert.rejects(sendPhantomDeposit(prepared(), f.provider, { timeoutMs: 40 }), error =>
    error.code === 'VAULT_WALLET_NOT_SENT' && /Testnet Mode/.test(error.message));
  assert.ok(!f.calls.some(call => call.method === 'eth_sendTransaction'));
});

test('Confirm send uses injected phantom.ethereum, not window.ethereum', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const phantom = providerFixture();
  const injected = providerFixture();
  injected.control.account = address('9');
  globalThis.window = { phantom: { ethereum: phantom.provider }, ethereum: injected.provider };
  await sendPhantomDeposit(prepared());
  assert.equal(phantom.calls.filter(call => call.method === 'eth_sendTransaction').length, 1);
  assert.equal(injected.calls.length, 0);
});

test('unknown Robinhood testnet chain is added then switched before the deposit send', async () => {
  const f = providerFixture();
  f.control.chainId = '0x1';
  const original = f.provider.request;
  f.provider.request = async input => {
    if (input.method === 'wallet_switchEthereumChain') {
      f.calls.push(input);
      if (f.control.chainId !== FUNDING_NETWORK.hexId) {
        throw Object.assign(new Error('Unrecognized chain ID'), { code: 4902 });
      }
      return null;
    }
    if (input.method === 'wallet_addEthereumChain') {
      f.calls.push(input);
      assert.equal(input.params[0].chainId, FUNDING_NETWORK.hexId);
      assert.equal(input.params[0].chainName, FUNDING_NETWORK.name);
      f.control.chainId = FUNDING_NETWORK.hexId;
      return null;
    }
    return original(input);
  };
  await sendPhantomDeposit(prepared(), f.provider);
  assert.equal(f.calls.filter(call => call.method === 'wallet_addEthereumChain').length, 1);
  assert.equal(f.calls.filter(call => call.method === 'wallet_switchEthereumChain').length, 2);
  assert.equal(f.calls.filter(call => call.method === 'eth_sendTransaction').length, 1);
});

test('Phantom marks only failures before eth_sendTransaction as definitely not sent', async () => {
  const before = providerFixture(); before.control.account = address('4');
  await assert.rejects(sendPhantomDeposit(prepared(), before.provider), error => error.code === 'VAULT_WALLET_NOT_SENT');
  assert.ok(!before.calls.some(call => call.method === 'eth_sendTransaction'));
  const after = providerFixture(), request = after.provider.request;
  after.provider.request = async input => {
    if (input.method === 'eth_sendTransaction') throw new Error('Lost wallet response');
    return request(input);
  };
  await assert.rejects(sendPhantomDeposit(prepared(), after.provider), error => error.message === 'Lost wallet response' && !error.code);
});
test('linking Phantom uses Privy SIWE for this origin and never sends a transaction', async t => {
  const previous = globalThis.window; t.after(() => { globalThis.window = previous; });
  globalThis.window = { location: { host: 'vault.example', origin: 'https://vault.example' } };
  const f = providerFixture(), links = [];
  const privy = { user: { get: async () => ({ user: { id: 'fixture-user' } }) }, auth: { siwe: {
    init: async (wallet, domain, uri) => {
      assert.equal(wallet.chainId, 'eip155:46630'); assert.equal(wallet.walletClientType, 'phantom');
      assert.equal(domain, 'vault.example'); assert.equal(uri, 'https://vault.example'); return { message: 'fixture sign-in' };
    }, linkWithSiwe: async (...args) => { links.push(args); return {}; }
  } } };
  await linkPhantom(privy, f.provider);
  assert.equal(links.length, 1); assert.equal(links[0][2], 'fixture sign-in');
  const sign = f.calls.find(call => call.method === 'personal_sign');
  assert.equal(Buffer.from(sign.params[0].slice(2), 'hex').toString(), 'fixture sign-in');
  assert.ok(!f.calls.some(call => call.method === 'eth_sendTransaction'));
  f.control.changeOnSign = true;
  await assert.rejects(linkPhantom(privy, f.provider)); assert.equal(links.length, 1);
});
test('connecting from mainnet does not request a testnet switch or authorize spending', async t => {
  const previous = globalThis.window; t.after(() => { globalThis.window = previous; });
  globalThis.window = { location: { host: 'vault.example', origin: 'https://vault.example' } };
  const f = providerFixture(); f.control.chainId = '0x1'; let linked = false;
  const original = f.provider.request;
  f.provider.request = async input => {
    if (input.method === 'wallet_switchEthereumChain') throw new Error('Not in testnet mode');
    return original(input);
  };
  const privy = { user: { get: async () => ({ user: { id: 'test-user' } }) }, auth: { siwe: {
    init: async wallet => { assert.equal(wallet.chainId, 'eip155:1'); return { message: 'fixture identity only' }; },
    linkWithSiwe: async () => { linked = true; }
  } } };
  await linkPhantom(privy, f.provider); assert.equal(linked, true);
  assert.ok(!f.calls.some(call => ['wallet_switchEthereumChain', 'eth_sendTransaction'].includes(call.method)));
  await assert.rejects(sendPhantomDeposit(prepared(), f.provider), error =>
    error.code === 'VAULT_WALLET_NOT_SENT' && /Settings.*Developer Settings.*Testnet Mode/.test(error.message));
});

test('SIWE uses the same EIP-55 address for Privy and Phantom and stops before signing on account changes', async t => {
  const previous = globalThis.window; t.after(() => { globalThis.window = previous; });
  globalThis.window = { location: { host: 'vault.example', origin: 'https://vault.example' } };
  const f = providerFixture();
  f.control.account = '0x52908400098527886e0f7030069857d2e4169ee7';
  const checksum = '0x52908400098527886E0F7030069857D2E4169EE7';
  let changeDuringInit = false;
  const privy = { user: { get: async () => ({ user: { id: 'fixture-user' } }) }, auth: { siwe: {
    init: async wallet => {
      assert.equal(wallet.address, checksum);
      if (changeDuringInit) f.control.account = address('4');
      return { message: `vault.example wants you to sign in with your Ethereum account:\n${wallet.address}\n` };
    }, linkWithSiwe: async () => ({})
  } } };
  let progress;
  await linkPhantom(privy, f.provider, value => { progress = value; });
  assert.equal(progress.address, checksum);
  const sign = f.calls.find(call => call.method === 'personal_sign');
  assert.equal(sign.params[1], checksum);
  assert.ok(Buffer.from(sign.params[0].slice(2), 'hex').toString().includes(checksum));
  assert.equal(getAddress(f.control.account), checksum);
  f.calls.length = 0; changeDuringInit = true;
  await assert.rejects(linkPhantom(privy, f.provider), /account or network changed/);
  assert.ok(!f.calls.some(call => call.method === 'personal_sign'));
});

test('credit play lists the funding-round guardian even when practice omits it', () => {
  const catalog = [{ id: 'anthropic/claude-haiku-4.5', name: 'Haiku' }];
  const funding = { rounds: [{ state: 'open', manifest: { manifest: { configuration: { guardians: [{ modelId: 'anthropic/claude-opus-5' }] } } } }] };
  assert.deepEqual(creditPlayModels(catalog, funding, false), catalog);
  const credited = creditPlayModels(catalog, funding, true);
  assert.deepEqual(credited.map(model => model.id), ['anthropic/claude-opus-5']);
  assert.equal(credited[0].company, 'anthropic');
  assert.deepEqual(creditPlayModels(catalog, { rounds: [{ state: 'won', manifest: funding.rounds[0].manifest }] }, true), []);
  assert.equal(chooseCreditPlayModel(catalog, funding, true, 'anthropic/claude-haiku-4.5').id, 'anthropic/claude-opus-5');
  assert.equal(chooseCreditPlayModel(catalog, funding, false, 'anthropic/claude-opus-5').id, 'anthropic/claude-haiku-4.5');
  const app = readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'public/app.js'), 'utf8');
  assert.match(app, /selectedCreditPlayModel/);
  const handler = app.slice(app.lastIndexOf('vault:credit-mode-changed'));
  assert.match(handler, /applyModel\(next\)/);
});
