import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { address, completion, hash } from './fixtures/account-game.mjs';
import { privateKeyToAccount } from 'viem/accounts';
import { createAuthentication } from '../server/auth.mjs';
import { createVaultApplication } from '../server/boot.mjs';
import { createHttpServer } from '../server/http.mjs';
import { startWebFunding } from '../server/economy/web-funding-runtime.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createVaultService } from '../server/service.mjs';
import { createOperatingBox } from '../server/operating-box.mjs';
import { BLOCKRUN_CHAT, BASE_USDC, signExactPayment } from '../server/x402-blockrun.mjs';
import { provingAutoplayEnabled } from '../server/economy/proving-autoplay.mjs';
import { localOperatorHeaders, unsignedTopupDisclosure } from '../public/funding-client.js';
import { FUNDING_NETWORK } from '../public/funding-network.js';
import {
  LOCAL_OPERATOR_HEADER, localOperatorAccountId, wrapLocalOperatorAuth
} from '../server/local-operator.mjs';
import { TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const haikuConfigPath = join(root, 'config/paid-beta-haiku.testnet.json');
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const OWNER = address('2');
const AMOUNT = '1000000000000000000';
const OLD_AMOUNT = '100000000000000000';
const OLD_HASH = '0x2df3f5c1c1b97c0e89011daaa436bb4fa165056dd5bcda3a98f42423eaa2ba31';
const X402_OPS = '0xf670531e46ba92f49c5d9c11d2c03875cffe7d40';
const localCtx = {
  runtime: { mode: 'local' },
  hosting: { name: 'local' },
  env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true' }
};

function topic(value) {
  return '0x' + value.slice(2).toLowerCase().padStart(64, '0');
}

function transferLog({ from, amount, transactionHash, logIndex = '0x0' }) {
  return {
    transactionHash, logIndex, address: AMZN, blockHash: hash('b'), blockNumber: '0x64', removed: false,
    topics: [TRANSFER_TOPIC, topic(from), topic(TREASURY_BOX)],
    data: '0x' + BigInt(amount).toString(16).padStart(64, '0')
  };
}

function receiptFor(log) {
  return {
    transactionHash: log.transactionHash, status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
    logs: [log]
  };
}

function observeRpc() {
  const rpcUrl = 'https://fixture.invalid/inbound-observe';
  const control = { head: '0x66', logs: [], receipts: {} };
  const methods = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, rpcUrl);
    const { id, method, params } = JSON.parse(init.body);
    methods.push({ method, params });
    assert.ok(!/send|sign|personal_/i.test(method), 'Observe must not sign or broadcast.');
    const results = {
      eth_chainId: FUNDING_NETWORK.hexId,
      eth_blockNumber: control.head,
      eth_getLogs: control.logs,
      eth_getTransactionReceipt: control.receipts[params?.[0]?.toLowerCase?.() ?? ''] ?? null,
      eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
    };
    assert.ok(Object.hasOwn(results, method), `Unexpected RPC method ${method}`);
    return Response.json({ jsonrpc: '2.0', id, result: results[method] });
  };
  return { rpcUrl, fetchImpl, control, methods };
}

function available(economy, wallet) {
  const account = `player:${localOperatorAccountId(wallet)}:available`;
  return economy.state().balances.find(row => row.account === account)?.amount ?? '0';
}

function roundBucket(economy, bucket, roundId = 'rh-paid-haiku-v1') {
  return economy.state().balances.find(row => row.account === `round:${roundId}:${bucket}`)?.amount ?? '0';
}

function ledgerBalance(economy, account) {
  return economy.state().balances.find(row => row.account === account)?.amount ?? '0';
}

async function listen(t, { controlSeed, hosting, env, runtime, authentication, haiku = false, paidX402 = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'vault-inbound-'));
  const { rpcUrl, fetchImpl, control, methods } = observeRpc();
  if (controlSeed) controlSeed(control);
  const auth = authentication ?? wrapLocalOperatorAuth(createAuthentication({}), localCtx);
  const limits = createInferenceLimits({ path: join(directory, 'usage.sqlite') });
  const x402Calls = [];
  const payerAccount = paidX402 ? privateKeyToAccount(`0x${'aa'.repeat(32)}`) : null;
  const payment = paidX402 ? {
    address: payerAccount.address,
    assertCoverage: createOperatingBox({ readBalance: async () => 1_000_000n, floor: 1n }).assertCoverage,
    sign: requirement => signExactPayment({ account: payerAccount, requirement, now: () => 1_700_000_000 })
  } : null;
  const vault = createVaultService({
    apiKey: haiku && !paidX402 ? 'fixture-not-real' : '',
    payment,
    logDir: join(directory, 'logs'),
    fetchImpl: (haiku || paidX402)
      ? async (url, init) => {
          if (url === 'https://openrouter.ai/api/v1/models') {
            return Response.json({
              data: [{ id: 'anthropic/claude-haiku-4.5', supported_parameters: ['tools'], pricing: { prompt: '0.00001', completion: '0.00001' } }]
            });
          }
          if (paidX402 && url === BLOCKRUN_CHAT) {
            if (!init.headers?.['PAYMENT-SIGNATURE']) {
              return Response.json({
                x402Version: 2,
                accepts: [{
                  scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: BASE_USDC,
                  payTo: address('a'), maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' }
                }],
                price: { amount: '0.002000', currency: 'USD' }
              }, { status: 402 });
            }
            const body = JSON.parse(init.body);
            x402Calls.push({ transport: 'x402', ...body });
            return Response.json(completion(body.model));
          }
          if (url === 'https://openrouter.ai/api/v1/chat/completions') {
            return Response.json(completion(JSON.parse(init.body).model));
          }
          throw new Error(`Unexpected model call ${url}`);
        }
      : () => { throw new Error('Unexpected model call'); }
  });
  const fundingRuntime = await startWebFunding({
    configPath: haikuConfigPath,
    dataDirectory: join(directory, 'web-funding-paid-beta'),
    authentication: auth, limits, vault, rpcUrl, fetchImpl,
    hosting: hosting ?? { name: 'local', ephemeralData: false, backgroundTimers: false },
    env: env ?? { VAULT_LOCAL_TESTNET_OBSERVE: 'true' },
    runtime: runtime ?? { mode: 'local' }
  });
  const server = createHttpServer({ service: vault, authentication: auth, publicDir: '.', funding: fundingRuntime.funding });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await fundingRuntime.close();
    vault.close();
    limits.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    control, methods, economy: fundingRuntime.economy, vault, fundingRuntime, x402Calls
  };
}

test('local inbound observe credits 1 AMZN from any EOA without a Privy prepare', async t => {
  const tx = hash('a');
  const log = transferLog({ from: OWNER, amount: AMOUNT, transactionHash: tx });
  const { base, methods, economy } = await listen(t, {
    controlSeed: control => {
      control.logs = [log];
      control.receipts[tx] = receiptFor(log);
    }
  });
  const config = await (await fetch(`${base}/api/funding/config`)).json();
  assert.equal(config.localOperatorObserve, true);
  assert.equal(config.rounds[0].id, 'rh-paid-haiku-v1');
  const panel = unsignedTopupDisclosure(config);
  assert.match(panel.gate, /send 1 AMZN to treasury on Robinhood testnet/i);
  assert.match(panel.gate, /localhost login optional for this proving round/i);
  assert.equal((await fetch(`${base}/api/funding/deposits`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'no-session', wallet: OWNER, amountBaseUnits: AMOUNT })
  })).status, 503);
  assert.equal(available(economy, OWNER), AMOUNT);
  const account = await (await fetch(`${base}/api/funding/account`, {
    headers: { [LOCAL_OPERATOR_HEADER]: OWNER }
  })).json();
  assert.equal(account.available, AMOUNT);
  assert.ok(methods.some(call => call.method === 'eth_getLogs'));
  const logsCall = methods.find(call => call.method === 'eth_getLogs');
  assert.equal(logsCall.params[0].address, AMZN);
  assert.equal(logsCall.params[0].topics[0], TRANSFER_TOPIC);
  assert.equal(logsCall.params[0].topics[1], null);
  assert.notEqual(logsCall.params[0].topics[1], topic(PAYER_BOX));
  assert.equal(logsCall.params[0].topics[2], topic(TREASURY_BOX));
  assert.notEqual(OWNER.toLowerCase(), PAYER_BOX);
  assert.ok(!methods.some(call => /send|sign/i.test(call.method)));
});

test('inbound payer EOA can GET balance and POST Haiku without Privy and without becoming x402 ops', async t => {
  const tx = hash('c');
  const payerLog = transferLog({ from: PAYER_BOX, amount: AMOUNT, transactionHash: tx });
  const { base, economy, vault } = await listen(t, {
    haiku: true,
    controlSeed: control => {
      control.logs = [payerLog];
      control.receipts[tx] = receiptFor(payerLog);
    }
  });
  await fetch(`${base}/api/funding/config`);
  assert.equal(available(economy, PAYER_BOX), AMOUNT);
  const headers = { ...localOperatorHeaders(PAYER_BOX), 'Content-Type': 'application/json' };
  const identity = await (await fetch(`${base}/api/account`, { headers })).json();
  assert.equal(identity.accountId, localOperatorAccountId(PAYER_BOX));
  assert.equal(identity.wallets[0].address, PAYER_BOX);
  const account = await (await fetch(`${base}/api/funding/account`, { headers })).json();
  assert.equal(account.available, AMOUNT);
  const attempted = await fetch(`${base}/api/funding/attempts`, {
    method: 'POST', headers,
    body: JSON.stringify({
      key: 'payer-haiku-1',
      roundId: 'rh-paid-haiku-v1',
      modelId: 'anthropic/claude-haiku-4.5',
      prompt: 'Keep the vault locked for the local proving round.',
      payoutWallet: PAYER_BOX,
      creditMode: 'asset-preparation'
    })
  });
  const body = await attempted.json();
  assert.equal(attempted.status, 200, JSON.stringify(body));
  assert.equal(body.decision, 'locked');
  assert.equal(body.accounting?.prizeContribution, '700000000000000000');
  assert.equal(body.accounting?.operations, '300000000000000000');
  assert.equal(body.accounting?.nextRound, '0');
  assert.notEqual(vault.status().paidConfigured && vault.status().address, PAYER_BOX);
  assert.notEqual(identity.wallets[0].address, X402_OPS);
  assert.equal((await fetch(`${base}/api/funding/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'still-unauth', wallet: PAYER_BOX, amountBaseUnits: AMOUNT })
  })).status, 503);
});

test('inbound observe credits the deposit payer EOA and never the old 0.1 AMZN hash', async t => {
  const fresh = hash('c');
  const payerLog = transferLog({ from: PAYER_BOX, amount: AMOUNT, transactionHash: fresh });
  const oldLog = transferLog({ from: OWNER, amount: OLD_AMOUNT, transactionHash: OLD_HASH });
  const otherTenth = transferLog({ from: OWNER, amount: OLD_AMOUNT, transactionHash: hash('d') });
  const { base, economy } = await listen(t, {
    controlSeed: control => {
      control.logs = [oldLog, otherTenth, payerLog];
      control.receipts[fresh] = receiptFor(payerLog);
      control.receipts[OLD_HASH] = receiptFor(oldLog);
      control.receipts[hash('d')] = receiptFor(otherTenth);
    }
  });
  await fetch(`${base}/api/funding/config`);
  assert.equal(available(economy, PAYER_BOX), AMOUNT);
  assert.equal(available(economy, OWNER), '0');
  const events = economy.export().events.filter(row => row.request.type === 'verified-deposit');
  assert.equal(events.length, 1);
  assert.equal(events[0].request.player, localOperatorAccountId(PAYER_BOX));
  assert.doesNotMatch(JSON.stringify(events), new RegExp(OLD_HASH.slice(2), 'i'));
  assert.equal(economy.state().attempts.length, 0);
  assert.equal(roundBucket(economy, 'prize'), '0');
});

test('historical 0.1 AMZN never autoplays even when x402 is armed', async t => {
  const oldLog = transferLog({ from: OWNER, amount: OLD_AMOUNT, transactionHash: OLD_HASH });
  const otherTenth = transferLog({ from: OWNER, amount: OLD_AMOUNT, transactionHash: hash('d') });
  const { base, economy, x402Calls } = await listen(t, {
    paidX402: true,
    controlSeed: control => {
      control.logs = [oldLog, otherTenth];
      control.receipts[OLD_HASH] = receiptFor(oldLog);
      control.receipts[hash('d')] = receiptFor(otherTenth);
    }
  });
  await fetch(`${base}/api/funding/config`);
  assert.equal(available(economy, OWNER), '0');
  assert.equal(economy.state().attempts.length, 0);
  assert.equal(x402Calls.length, 0);
  assert.equal(roundBucket(economy, 'prize'), '0');
  assert.doesNotMatch(JSON.stringify(economy.export().events), new RegExp(OLD_HASH.slice(2), 'i'));
});

test('vercel hosting does not watch inbound transfers even with the observe flag', async t => {
  const tx = hash('a');
  const log = transferLog({ from: OWNER, amount: AMOUNT, transactionHash: tx });
  const { base, methods, economy } = await listen(t, {
    controlSeed: control => {
      control.logs = [log];
      control.receipts[tx] = receiptFor(log);
    },
    hosting: { name: 'vercel', ephemeralData: false, backgroundTimers: false },
    env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true', VERCEL: '1' },
    runtime: { mode: 'local' },
    authentication: wrapLocalOperatorAuth(createAuthentication({}), {
      runtime: { mode: 'local' }, hosting: { name: 'vercel' }, env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true', VERCEL: '1' }
    })
  });
  const config = await (await fetch(`${base}/api/funding/config`)).json();
  assert.equal(config.localOperatorObserve, false);
  assert.match(unsignedTopupDisclosure(config).gate, /Sign in, then Connect Phantom/);
  assert.equal(available(economy, OWNER), '0');
  assert.ok(!methods.some(call => call.method === 'eth_getLogs'));
  assert.equal((await fetch(`${base}/api/funding/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [LOCAL_OPERATOR_HEADER]: OWNER },
    body: JSON.stringify({ key: 'prod', wallet: OWNER, amountBaseUnits: AMOUNT })
  })).status, 503);
  assert.equal((await fetch(`${base}/api/funding/claims/rh-paid-haiku-v1`)).status, 503);
  assert.equal(economy.state().attempts.length, 0);
  assert.equal(roundBucket(economy, 'prize'), '0');
});

test('boot observe-without-session credits rh-paid-haiku-v1 and leaves x402 ops on the dedicated box', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-inbound-boot-'));
  const tx = hash('a');
  const log = transferLog({ from: OWNER, amount: AMOUNT, transactionHash: tx });
  const { rpcUrl, fetchImpl, control } = observeRpc();
  control.logs = [log];
  control.receipts[tx] = receiptFor(log);
  const app = await createVaultApplication({
    root: directory,
    fetchImpl: async (url, init) => {
      if (url !== rpcUrl) return fetchImpl(url, init);
      return fetchImpl(url, init);
    },
    env: {
      VAULT_ACCESS_MODE: 'local',
      VAULT_CLOSED_BETA: 'false',
      VAULT_TELEGRAM_ENABLED: 'false',
      VAULT_LOCAL_TESTNET_OBSERVE: 'true',
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath,
      VAULT_FUNDING_DATA_DIRECTORY: join(directory, 'web-funding-paid-beta'),
      VAULT_FUNDING_RPC_URL: rpcUrl
    }
  });
  const server = createServer(app.listener);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await app.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.notEqual(app.payment?.address?.toLowerCase?.(), PAYER_BOX);
  assert.notEqual(app.payment?.address?.toLowerCase?.(), TREASURY_BOX);
  assert.notEqual(app.payment?.address?.toLowerCase?.(), LAPTOP_REHEARSAL_BOX);
  if (app.payment?.address) assert.equal(app.payment.address.toLowerCase(), X402_OPS);
  const funding = await (await fetch(`${base}/api/funding/config`)).json();
  assert.equal(funding.localOperatorObserve, true);
  assert.equal(funding.rounds[0].id, 'rh-paid-haiku-v1');
  assert.match(unsignedTopupDisclosure(funding).gate, /localhost login optional for this proving round/i);
  assert.equal(available(app.webFunding.economy, OWNER), AMOUNT);
});

test('local inbound credit autoplays one paid Haiku x402 attempt with a 70/30/0 split', async t => {
  const tx = hash('e');
  const log = transferLog({ from: OWNER, amount: AMOUNT, transactionHash: tx });
  const { base, economy, vault, x402Calls } = await listen(t, {
    paidX402: true,
    controlSeed: control => {
      control.logs = [log];
      control.receipts[tx] = receiptFor(log);
    }
  });
  await fetch(`${base}/api/funding/config`);
  assert.equal(provingAutoplayEnabled({
    runtime: { mode: 'local' }, hosting: { name: 'local' },
    env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true' }, vault
  }), true);
  assert.equal(vault.status().paidConfigured, true);
  assert.equal(vault.status().mode, 'x402-exact');
  assert.equal(available(economy, OWNER), '0');
  assert.equal(roundBucket(economy, 'prize'), '700000000000000000');
  assert.equal(ledgerBalance(economy, 'treasury:operations'), '300000000000000000');
  assert.equal(ledgerBalance(economy, 'treasury:next'), '0');
  assert.equal(economy.state().attempts.length, 1);
  assert.equal(economy.state().attempts[0].player, localOperatorAccountId(OWNER));
  assert.equal(economy.state().attempts[0].state, 'locked');
  assert.equal(x402Calls.length, 1);
  assert.equal(x402Calls[0].transport, 'x402');
  assert.equal(x402Calls[0].model, 'anthropic/claude-haiku-4.5');
  await fetch(`${base}/api/funding/config`);
  await fetch(`${base}/api/funding/account`, { headers: { [LOCAL_OPERATOR_HEADER]: OWNER } });
  assert.equal(x402Calls.length, 1);
  assert.equal(economy.state().attempts.length, 1);
  assert.equal(roundBucket(economy, 'prize'), '700000000000000000');
});

test('vercel and unarmed practice do not autoplay after an inbound credit', async t => {
  assert.equal(provingAutoplayEnabled({
    runtime: { mode: 'local' }, hosting: { name: 'vercel' },
    env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true', VERCEL: '1' },
    vault: { status: () => ({ paidConfigured: true, mode: 'x402-exact' }) }
  }), false);
  assert.equal(provingAutoplayEnabled({
    runtime: { mode: 'public-practice' }, hosting: { name: 'local' },
    env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true' },
    vault: { status: () => ({ paidConfigured: true, mode: 'x402-exact' }) }
  }), false);
  assert.equal(provingAutoplayEnabled({
    runtime: { mode: 'local' }, hosting: { name: 'local' },
    env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true' },
    vault: { status: () => ({ paidConfigured: false, localRehearsalPayer: true, mode: 'practice' }) }
  }), false);
  const tx = hash('f');
  const log = transferLog({ from: OWNER, amount: AMOUNT, transactionHash: tx });
  const { economy, x402Calls } = await listen(t, {
    paidX402: true,
    hosting: { name: 'vercel', ephemeralData: false, backgroundTimers: false },
    env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true', VERCEL: '1' },
    runtime: { mode: 'local' },
    authentication: wrapLocalOperatorAuth(createAuthentication({}), {
      runtime: { mode: 'local' }, hosting: { name: 'vercel' }, env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true', VERCEL: '1' }
    }),
    controlSeed: control => {
      control.logs = [log];
      control.receipts[tx] = receiptFor(log);
    }
  });
  assert.equal(available(economy, OWNER), '0');
  assert.equal(economy.state().attempts.length, 0);
  assert.equal(x402Calls.length, 0);
});

test('paid-beta:testnet copy tells a raw 1 AMZN send for the local proving round', () => {
  const script = readFileSync(join(root, 'scripts/paid-beta-testnet.mjs'), 'utf8');
  assert.match(script, /send 1 AMZN to treasury/i);
  assert.match(script, /localhost login optional/i);
  assert.match(script, /refresh \/play/i);
  assert.match(script, /player_rh\{your address\}/);
  const client = readFileSync(join(root, 'public/funding-client.js'), 'utf8');
  assert.match(client, /localhost login optional for this proving round/);
  assert.match(client, /refresh \/play/);
  assert.match(client, /player_rh\{your address\}/);
  assert.match(client, /Send 1 AMZN to treasury/);
  const play = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.match(play, /id="proving-round-send"/);
  assert.match(play, /Send 1 AMZN to treasury/);
  const app = readFileSync(join(root, 'public/app.js'), 'utf8');
  assert.match(app, /\.\.\.\(await accountHeaders\(\)\)/);
  assert.doesNotMatch(app, /publicPractice \? await accountHeaders/);
});
