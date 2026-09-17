import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertWebFundingAllowed, assertVercelFundingRuntime, createVaultApplication,
  resolveFundingConfigPath, resolveWebFundingDirectory, resolveWebFundingRpc
} from '../server/boot.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';
import { FUNDING_NETWORK } from '../public/funding-network.js';
import { unsignedTopupDisclosure, unsignedClaimDisclosure } from '../public/funding-client.js';
import { hash } from './fixtures/account-game.mjs';
import { TREASURY_BOX, PRODUCT_X402_BOX } from '../server/x402-operating-box-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const haikuConfigPath = join(root, 'config/paid-beta-haiku.testnet.json');
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';

function fixtureRpc(expectedUrl = FUNDING_NETWORK.rpcUrl) {
  const href = new URL(expectedUrl).href;
  const fetchImpl = async (url, init) => {
    assert.equal(url, href);
    const { id, method } = JSON.parse(init.body);
    assert.ok(!/send|sign|personal_/i.test(method), 'Boot must not sign or broadcast.');
    const results = {
      eth_chainId: FUNDING_NETWORK.hexId,
      eth_blockNumber: '0x66',
      eth_getTransactionReceipt: null,
      eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
    };
    assert.ok(Object.hasOwn(results, method), `Unexpected RPC method ${method}`);
    return Response.json({ jsonrpc: '2.0', id, result: results[method] });
  };
  return fetchImpl;
}

test('local paid-beta funding defaults to the public Robinhood testnet RPC', () => {
  assert.equal(resolveWebFundingRpc({}), FUNDING_NETWORK.rpcUrl);
  assert.equal(resolveWebFundingRpc({ VAULT_FUNDING_RPC_URL: '  ' }), FUNDING_NETWORK.rpcUrl);
  assert.equal(resolveWebFundingRpc({ VAULT_FUNDING_RPC_URL: FUNDING_NETWORK.rpcUrl }), FUNDING_NETWORK.rpcUrl);
});

test('paid-beta config uses web-funding-paid-beta and refuses the AMZN rehearsal path', () => {
  const dataRoot = join(root, '.local');
  assert.equal(resolveFundingConfigPath(root, 'config/paid-beta-haiku.testnet.json'), haikuConfigPath);
  assert.equal(resolveFundingConfigPath(root, haikuConfigPath), haikuConfigPath);
  assert.match(resolveWebFundingDirectory({ env: {}, dataRoot, configPath: haikuConfigPath }), /web-funding-paid-beta$/);
  assert.throws(() => resolveWebFundingDirectory({
    env: { VAULT_FUNDING_DATA_DIRECTORY: join(dataRoot, 'web-funding-testnet') },
    dataRoot, configPath: haikuConfigPath
  }), /rehearsal|web-funding-paid-beta/i);
  assert.throws(() => resolveWebFundingDirectory({
    env: { VAULT_FUNDING_DATA_DIRECTORY: 'web-funding-testnet', VERCEL: '1' },
    dataRoot, configPath: haikuConfigPath, hosting: { name: 'vercel' }
  }), /rehearsal|web-funding-paid-beta/i);
});

test('Vercel funding runtime refuses /tmp sqlite, memory Turso, and an unarmed x402 box', () => {
  const hosting = { name: 'vercel', ephemeralData: true, backgroundTimers: false };
  const runtime = { mode: 'public-practice', closedBeta: true };
  const payment = { address: PRODUCT_X402_BOX };
  assert.throws(() => assertVercelFundingRuntime({
    runtime, hosting, env: { VAULT_WEB_FUNDING_CONFIG: haikuConfigPath }, payment
  }), /durable|Turso|\/tmp/i);
  assert.throws(() => assertVercelFundingRuntime({
    runtime, hosting: { ...hosting, ephemeralData: false },
    env: { VAULT_WEB_FUNDING_CONFIG: haikuConfigPath, VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'memory:cutover' },
    payment
  }), /memory|Turso/i);
  assert.throws(() => assertVercelFundingRuntime({
    runtime, hosting: { ...hosting, ephemeralData: false },
    env: {
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath, VAULT_DURABLE_DATA: 'true',
      VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok'
    },
    payment: null
  }), /0xf670|VAULT_X402_PRIVATE_KEY/i);
  assert.throws(() => assertVercelFundingRuntime({
    runtime: { mode: 'local' }, hosting: { ...hosting, ephemeralData: false },
    env: {
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath, VAULT_DURABLE_DATA: 'true',
      VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok'
    },
    payment
  }), /public-practice/i);
  assert.doesNotThrow(() => assertVercelFundingRuntime({
    runtime, hosting: { ...hosting, ephemeralData: false },
    env: {
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath, VAULT_DURABLE_DATA: 'true',
      VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok'
    },
    payment
  }));
});

test('local mode may enable testnet funding; public-practice still needs closed beta', () => {
  assert.doesNotThrow(() => assertWebFundingAllowed(
    runtimeConfiguration({ VAULT_ACCESS_MODE: 'local' }),
    { VAULT_WEB_FUNDING_CONFIG: haikuConfigPath, VAULT_TELEGRAM_ENABLED: 'false' }
  ));
  assert.throws(() => assertWebFundingAllowed(
    runtimeConfiguration({ VAULT_ACCESS_MODE: 'public-practice', VAULT_PUBLIC_ORIGIN: 'https://vault.example' }),
    { VAULT_WEB_FUNDING_CONFIG: haikuConfigPath }
  ), /closed web beta/i);
  assert.throws(() => assertWebFundingAllowed(
    runtimeConfiguration({ VAULT_ACCESS_MODE: 'local' }),
    { VAULT_WEB_FUNDING_CONFIG: haikuConfigPath, VAULT_TELEGRAM_ENABLED: 'true' }
  ), /Telegram/i);
});

test('local paid-beta boot serves unsigned Haiku funding config without rehearsal or durable store', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-paid-beta-boot-'));
  const app = await createVaultApplication({
    root: directory,
    fetchImpl: fixtureRpc(),
    env: {
      VAULT_ACCESS_MODE: 'local',
      VAULT_CLOSED_BETA: 'false',
      VAULT_TELEGRAM_ENABLED: 'false',
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath,
      VAULT_FUNDING_DATA_DIRECTORY: join(directory, 'web-funding-paid-beta')
    }
  });
  assert.equal(app.runtime.mode, 'local');
  assert.equal(app.runtime.closedBeta, false);
  assert.ok(app.webFunding);
  const server = createServer(app.listener);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await app.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.accessMode, 'local');
  assert.equal(status.closedBeta, false);
  const funding = await (await fetch(`${base}/api/funding/config`)).json();
  assert.equal(funding.enabled, true);
  assert.equal(funding.environment, 'testnet');
  assert.equal(funding.realFundsEnabled, false);
  assert.equal(funding.asset.chainId, '46630');
  assert.equal(funding.asset.tokenAddress, AMZN);
  assert.equal(funding.asset.destination, TREASURY_BOX);
  assert.equal(funding.rounds.length, 1);
  assert.equal(funding.rounds[0].id, 'rh-paid-haiku-v1');
  assert.equal(funding.rounds[0].prizeBps, 7000);
  assert.equal(funding.rounds[0].operationsBps, 3000);
  assert.deepEqual(funding.rounds[0].manifest.manifest.configuration.guardians.map(g => g.modelId),
    ['anthropic/claude-haiku-4.5']);
  const unsigned = unsignedTopupDisclosure(funding);
  const unsignedText = [unsigned.gate, ...unsigned.facts].join('\n');
  assert.match(unsignedText, /Robinhood Chain Testnet/i);
  assert.match(unsignedText, /AMZN/i);
  assert.match(unsignedText, /46630/);
  assert.match(unsignedText, /\b1\b/);
  assert.match(unsignedText, /70% bounty/);
  assert.match(unsignedText, /30% operations/);
  assert.match(unsignedText, new RegExp(TREASURY_BOX, 'i'));
  assert.match(unsignedText, /Sign in, then Connect Phantom/);
  const fundingSource = readFileSync(join(root, 'public/funding.js'), 'utf8');
  assert.match(fundingSource, /unsignedTopupDisclosure/);
  assert.match(fundingSource, /unsignedClaimDisclosure/);
  const claim = unsignedClaimDisclosure(funding);
  const claimText = [claim.gate, ...claim.facts].join('\n');
  assert.match(claimText, /75%/);
  assert.match(claimText, /25%/);
  assert.match(claimText, /no cash prize/i);
  assert.match(claimText, new RegExp(TREASURY_BOX, 'i'));
  assert.match(claimText, /x402 operating box/i);
  const prepared = await fetch(`${base}/api/funding/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'unauth', wallet: TREASURY_BOX, amountBaseUnits: '1000000000000000000' })
  });
  assert.equal(prepared.status, 503);
});

test('Vercel application boot refuses funded /tmp sqlite', async () => {
  await assert.rejects(() => createVaultApplication({
    env: {
      VERCEL: '1',
      VAULT_ACCESS_MODE: 'local',
      VAULT_WEB_FUNDING_CONFIG: haikuConfigPath
    },
    root: join(root, 'tmp-vercel-boot-test')
  }), /durable|Turso|\/tmp/i);
});
