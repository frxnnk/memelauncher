import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { address, hash } from './fixtures/account-game.mjs';
import { createAuthentication } from '../server/auth.mjs';
import { createVaultApplication } from '../server/boot.mjs';
import { createHttpServer } from '../server/http.mjs';
import { startWebFunding } from '../server/economy/web-funding-runtime.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createVaultService } from '../server/service.mjs';
import { createLaptopRehearsalPayer, createLiveX402Payer } from '../server/x402-payer.mjs';
import {
  LOCAL_OPERATOR_HEADER, localOperatorAccountId, localOperatorEnabled, localOperatorPrincipal, wrapLocalOperatorAuth
} from '../server/local-operator.mjs';
import { FUNDING_NETWORK } from '../public/funding-network.js';
import { classifyOperatingBox, TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const haikuConfigPath = join(root, 'config/paid-beta-haiku.testnet.json');
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const OWNER = address('2');
const AMOUNT = '1000000000000000000';

const localCtx = {
  runtime: { mode: 'local' },
  hosting: { name: 'local' },
  env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true' }
};

test('local operator observe is gated to paid-beta:testnet local mode', () => {
  assert.equal(localOperatorEnabled({ mode: 'local' }, { name: 'local' }, { VAULT_LOCAL_TESTNET_OBSERVE: 'true' }), true);
  assert.equal(localOperatorEnabled({ mode: 'local' }, { name: 'local' }, {}), false);
  assert.equal(localOperatorEnabled({ mode: 'public-practice' }, { name: 'local' }, { VAULT_LOCAL_TESTNET_OBSERVE: 'true' }), false);
  assert.equal(localOperatorEnabled({ mode: 'local' }, { name: 'vercel' }, { VAULT_LOCAL_TESTNET_OBSERVE: 'true', VERCEL: '1' }), false);
  assert.equal(localOperatorAccountId(OWNER), 'player_rh' + OWNER.slice(2));
});

test('local operator principal can be the inbound payer EOA and never the treasury or laptop box', () => {
  const principal = localOperatorPrincipal(OWNER);
  assert.equal(principal.authenticated, true);
  assert.equal(principal.walletOwnershipVerified, true);
  assert.equal(principal.wallets[0].address, OWNER);
  assert.equal(principal.localOperatorObserve, true);
  assert.match(principal.accountId, /^player_rh[0-9a-f]{40}$/);
  const payer = localOperatorPrincipal(PAYER_BOX);
  assert.equal(payer.accountId, localOperatorAccountId(PAYER_BOX));
  assert.equal(payer.wallets[0].address, PAYER_BOX);
  assert.equal(payer.localOperatorObserve, true);
  assert.equal(classifyOperatingBox(PAYER_BOX), 'forbidden-funds');
  for (const forbidden of [TREASURY_BOX, LAPTOP_REHEARSAL_BOX, '0x0'.padEnd(42, '0'), 'not-an-address']) {
    assert.throws(() => localOperatorPrincipal(forbidden), error => error.code === 'WALLET_NOT_VERIFIED');
  }
});

test('wrap falls through to Privy unless the local observe header is present', async () => {
  const wrapped = wrapLocalOperatorAuth(createAuthentication({}), localCtx);
  assert.equal(wrapped.localOperatorObserve, true);
  assert.equal(wrapped.publicConfig().localOperatorObserve, true);
  await assert.rejects(() => wrapped.authenticate({ host: '127.0.0.1:4319' }), error => error.status === 503 && error.code === 'AUTH_NOT_CONFIGURED');
  const observed = await wrapped.authenticate({ host: '127.0.0.1:4319', [LOCAL_OPERATOR_HEADER]: OWNER });
  assert.equal(observed.wallets[0].address, OWNER);
  const inboundPayer = await wrapped.authenticate({ host: '127.0.0.1:4319', [LOCAL_OPERATOR_HEADER]: PAYER_BOX });
  assert.equal(inboundPayer.accountId, localOperatorAccountId(PAYER_BOX));
  await assert.rejects(
    () => wrapped.authenticate({ host: 'vault.example', [LOCAL_OPERATOR_HEADER]: OWNER }),
    error => error.status === 403 && error.code === 'LOCAL_ONLY'
  );
  const production = wrapLocalOperatorAuth(createAuthentication({}), {
    runtime: { mode: 'local' }, hosting: { name: 'vercel' }, env: { VAULT_LOCAL_TESTNET_OBSERVE: 'true' }
  });
  assert.equal(production.localOperatorObserve, false);
  assert.equal(production.publicConfig().localOperatorObserve, false);
  await assert.rejects(
    () => production.authenticate({ host: '127.0.0.1:4319', [LOCAL_OPERATOR_HEADER]: OWNER }),
    error => error.status === 503 && error.code === 'AUTH_NOT_CONFIGURED'
  );
  await assert.rejects(
    () => production.authenticate({ host: '127.0.0.1:4319', [LOCAL_OPERATOR_HEADER]: PAYER_BOX }),
    error => error.status === 503 && error.code === 'AUTH_NOT_CONFIGURED'
  );
});

test('treasury local operator is claim-only and never a play identity', async () => {
  const wrapped = wrapLocalOperatorAuth(createAuthentication({}), localCtx);
  const treasury = await wrapped.authenticate({ host: '127.0.0.1:4319', [LOCAL_OPERATOR_HEADER]: TREASURY_BOX });
  assert.equal(treasury.localOperatorTreasury, true);
  assert.equal(treasury.wallets[0].address, TREASURY_BOX);
  assert.equal(treasury.localOperatorObserve, true);
  assert.throws(() => localOperatorPrincipal(TREASURY_BOX), error => error.code === 'WALLET_NOT_VERIFIED');
  await assert.rejects(
    () => wrapped.authenticate({ host: '127.0.0.1:4319', [LOCAL_OPERATOR_HEADER]: LAPTOP_REHEARSAL_BOX }),
    error => error.code === 'WALLET_NOT_VERIFIED'
  );
});

test('laptop rehearsal payer does not arm product paidConfigured', () => {
  assert.equal(createLiveX402Payer({}), null);
  assert.equal(createLaptopRehearsalPayer({}), null);
  assert.equal(createLaptopRehearsalPayer({ VAULT_X402_PRIVATE_KEY: `0x${'11'.repeat(32)}` }), null);
  assert.equal(createLaptopRehearsalPayer({
    VAULT_X402_PRIVATE_KEY: `0x${'11'.repeat(32)}`, VERCEL: '1'
  }), null);
  const service = createVaultService({
    payment: { kind: 'laptop-rehearsal', address: LAPTOP_REHEARSAL_BOX, assertCoverage: async () => {}, sign: async () => {} },
    logDir: join(tmpdir(), 'vault-rehearsal-status'),
    fetchImpl: () => { throw new Error('Unexpected network call'); }
  });
  const status = service.status();
  assert.equal(status.paidConfigured, false);
  assert.equal(status.localRehearsalPayer, true);
  assert.equal(status.mode, 'practice');
  assert.equal(status.bountyEnabled, false);
  service.close();
});

function amznReceipt(transactionHash = hash('a')) {
  return {
    transactionHash, status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
    logs: [{
      transactionHash, logIndex: '0x0', address: AMZN, blockHash: hash('b'), blockNumber: '0x64', removed: false,
      topics: [
        TRANSFER_TOPIC,
        '0x' + OWNER.slice(2).padStart(64, '0'),
        '0x' + TREASURY_BOX.slice(2).padStart(64, '0')
      ],
      data: '0x' + BigInt(AMOUNT).toString(16).padStart(64, '0')
    }]
  };
}

test('local operator header records a broadcast hash through production RPC inspect', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-local-operator-'));
  const control = { head: '0x63', receipt: null };
  const rpcUrl = 'https://fixture.invalid/local-operator';
  const fetchImpl = async (url, init) => {
    assert.equal(url, rpcUrl);
    const { id, method } = JSON.parse(init.body);
    assert.ok(!/send|sign|personal_/i.test(method), 'Observe must not sign or broadcast.');
    const results = {
      eth_chainId: FUNDING_NETWORK.hexId,
      eth_blockNumber: control.head,
      eth_getTransactionReceipt: control.receipt,
      eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
    };
    assert.ok(Object.hasOwn(results, method), `Unexpected RPC method ${method}`);
    return Response.json({ jsonrpc: '2.0', id, result: results[method] });
  };
  const authentication = wrapLocalOperatorAuth(createAuthentication({}), localCtx);
  const limits = createInferenceLimits({ path: join(directory, 'usage.sqlite') });
  const vault = createVaultService({
    logDir: join(directory, 'logs'),
    fetchImpl: () => { throw new Error('Unexpected model call'); }
  });
  const runtime = await startWebFunding({
    configPath: haikuConfigPath,
    dataDirectory: join(directory, 'web-funding-paid-beta'),
    authentication, limits, vault, rpcUrl, fetchImpl,
    hosting: { name: 'local', ephemeralData: false, backgroundTimers: false }
  });
  assert.equal(runtime.billing, null);
  const server = createHttpServer({ service: vault, authentication, publicDir: '.', funding: runtime.funding });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await runtime.close();
    vault.close();
    limits.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { [LOCAL_OPERATOR_HEADER]: OWNER, 'Content-Type': 'application/json' };
  const auth = await (await fetch(`${base}/api/auth/config`)).json();
  assert.equal(auth.localOperatorObserve, true);
  assert.equal((await fetch(`${base}/api/funding/deposits`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'unauth', wallet: OWNER, amountBaseUnits: AMOUNT })
  })).status, 503);
  const prepared = await fetch(`${base}/api/funding/deposits`, {
    method: 'POST', headers,
    body: JSON.stringify({ key: 'observe-hash', wallet: OWNER, amountBaseUnits: AMOUNT })
  });
  const body = await prepared.json();
  assert.equal(prepared.status, 200, JSON.stringify(body));
  const id = body.order.id;
  const submitted = await fetch(`${base}/api/funding/deposits/${id}/submit`, {
    method: 'POST', headers, body: JSON.stringify({ transactionHash: hash('a') })
  });
  assert.equal(submitted.status, 200);
  assert.equal((await (await fetch(`${base}/api/funding/deposits/${id}/check`, {
    method: 'POST', headers, body: '{}'
  })).json()).order.credited, false);
  control.receipt = amznReceipt();
  control.head = '0x66';
  const checked = await (await fetch(`${base}/api/funding/deposits/${id}/check`, {
    method: 'POST', headers, body: '{}'
  })).json();
  assert.equal(checked.order.credited, true);
  const account = await (await fetch(`${base}/api/funding/account`, { headers })).json();
  assert.equal(account.available, AMOUNT);
});

test('boot without the observe flag still refuses unauthenticated funding writes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-observe-off-'));
  const app = await createVaultApplication({
    root: directory,
    fetchImpl: async (_url, init) => {
      const { id, method } = JSON.parse(init.body);
      const results = {
        eth_chainId: FUNDING_NETWORK.hexId, eth_blockNumber: '0x66',
        eth_getTransactionReceipt: null, eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
      };
      return Response.json({ jsonrpc: '2.0', id, result: results[method] });
    },
    env: {
      VAULT_ACCESS_MODE: 'local',
      VAULT_CLOSED_BETA: 'false',
      VAULT_TELEGRAM_ENABLED: 'false',
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath,
      VAULT_FUNDING_DATA_DIRECTORY: join(directory, 'web-funding-paid-beta')
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
  assert.equal((await (await fetch(`${base}/api/auth/config`)).json()).localOperatorObserve, false);
  const unauth = await fetch(`${base}/api/funding/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [LOCAL_OPERATOR_HEADER]: OWNER },
    body: JSON.stringify({ key: 'no-flag', wallet: OWNER, amountBaseUnits: AMOUNT })
  });
  assert.equal(unauth.status, 503);
});

test('boot with local observe prepares an unsigned deposit without a Privy session', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-observe-on-'));
  const app = await createVaultApplication({
    root: directory,
    fetchImpl: async (_url, init) => {
      const { id, method } = JSON.parse(init.body);
      assert.ok(!/send|sign|personal_/i.test(method), 'Observe boot must not sign or broadcast.');
      const results = {
        eth_chainId: FUNDING_NETWORK.hexId, eth_blockNumber: '0x66', eth_getLogs: [],
        eth_getTransactionReceipt: null, eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
      };
      assert.ok(Object.hasOwn(results, method), `Unexpected RPC method ${method}`);
      return Response.json({ jsonrpc: '2.0', id, result: results[method] });
    },
    env: {
      VAULT_ACCESS_MODE: 'local',
      VAULT_CLOSED_BETA: 'false',
      VAULT_TELEGRAM_ENABLED: 'false',
      VAULT_LOCAL_TESTNET_OBSERVE: 'true',
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath,
      VAULT_FUNDING_DATA_DIRECTORY: join(directory, 'web-funding-paid-beta')
    }
  });
  assert.equal(app.service.status().paidConfigured, false);
  const server = createServer(app.listener);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await app.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(`${base}/api/auth/config`)).json()).localOperatorObserve, true);
  assert.equal((await fetch(`${base}/api/funding/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'still-unauth', wallet: OWNER, amountBaseUnits: AMOUNT })
  })).status, 503);
  const prepared = await fetch(`${base}/api/funding/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [LOCAL_OPERATOR_HEADER]: OWNER },
    body: JSON.stringify({ key: 'observe-boot', wallet: OWNER, amountBaseUnits: AMOUNT })
  });
  const body = await prepared.json();
  assert.equal(prepared.status, 200, JSON.stringify(body));
  assert.equal(body.realFundsEnabled, false);
  assert.equal(body.transfer.paymentsEnabled, false);
  assert.equal(body.order.owner, OWNER);
});

test('treasury local operator can inspect claims and cannot deposit, play, or become /api/account', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-observe-treasury-'));
  const app = await createVaultApplication({
    root: directory,
    fetchImpl: async (_url, init) => {
      const { id, method } = JSON.parse(init.body);
      assert.ok(!/send|sign|personal_/i.test(method), 'Observe boot must not sign or broadcast.');
      const results = {
        eth_chainId: FUNDING_NETWORK.hexId, eth_blockNumber: '0x66', eth_getLogs: [],
        eth_getTransactionReceipt: null, eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
      };
      assert.ok(Object.hasOwn(results, method), `Unexpected RPC method ${method}`);
      return Response.json({ jsonrpc: '2.0', id, result: results[method] });
    },
    env: {
      VAULT_ACCESS_MODE: 'local',
      VAULT_CLOSED_BETA: 'false',
      VAULT_TELEGRAM_ENABLED: 'false',
      VAULT_LOCAL_TESTNET_OBSERVE: 'true',
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath,
      VAULT_FUNDING_DATA_DIRECTORY: join(directory, 'web-funding-paid-beta')
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
  const treasury = { 'Content-Type': 'application/json', [LOCAL_OPERATOR_HEADER]: TREASURY_BOX };
  assert.equal((await fetch(`${base}/api/account`, { headers: treasury })).status, 400);
  assert.equal((await fetch(`${base}/api/funding/deposits`, {
    method: 'POST', headers: treasury,
    body: JSON.stringify({ key: 'treasury-deposit', wallet: TREASURY_BOX, amountBaseUnits: AMOUNT })
  })).status, 400);
  assert.equal((await fetch(`${base}/api/funding/attempts`, {
    method: 'POST', headers: treasury,
    body: JSON.stringify({
      key: 'treasury-attempt', roundId: 'rh-paid-haiku-v1', modelId: 'anthropic/claude-haiku-4.5',
      prompt: 'no', payoutWallet: TREASURY_BOX, creditMode: 'asset-preparation'
    })
  })).status, 400);
  const claim = await fetch(`${base}/api/funding/claims/rh-paid-haiku-v1`, { headers: treasury });
  const body = await claim.json();
  assert.equal(claim.status, 200, JSON.stringify(body));
  assert.equal(body.treasury, TREASURY_BOX);
  assert.equal(body.broadcast, false);
  const unauth = await fetch(`${base}/api/funding/claims/rh-paid-haiku-v1`);
  const unauthBody = await unauth.json();
  assert.equal(unauth.status, 200, JSON.stringify(unauthBody));
  assert.notEqual(unauthBody.error?.code, 'AUTH_REQUIRED');
  assert.equal(unauthBody.broadcast, false);
  assert.equal(unauthBody.treasury, TREASURY_BOX);
  const unauthPrepare = await fetch(`${base}/api/funding/claims/rh-paid-haiku-v1/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  const unauthPrepared = await unauthPrepare.json();
  assert.equal(unauthPrepare.status, 409, JSON.stringify(unauthPrepared));
  assert.equal(unauthPrepared.error.code, 'CLAIM_NOT_PAYABLE');
  const unauthSubmit = await fetch(`${base}/api/funding/claims/rh-paid-haiku-v1/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionHash: hash('c') })
  });
  assert.ok([401, 503].includes(unauthSubmit.status), 'Submit still requires treasury local-operator or Privy.');
  const prepared = await fetch(`${base}/api/funding/claims/rh-paid-haiku-v1/prepare`, {
    method: 'POST', headers: treasury, body: '{}'
  });
  assert.equal(prepared.status, 409);
});
