import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../server/economy/ledger.mjs';
import { createEconomyService } from '../server/economy/service.mjs';
import { createSessionStore } from '../server/sessions.mjs';
import { openDatabase, durableStore, resetDurableBackends } from '../server/storage/database.mjs';
import { paidBetaTerms, paidBetaPricePolicy } from '../server/economy/paid-beta-policy.mjs';

const EXAMPLE_ASSET = {
  chainId: '46630',
  tokenAddress: '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02',
  destination: '0x0000000000000000000000000000000000000001',
  decimals: 18,
  minimumConfirmations: 3,
  standardTransferVerified: true
};

test('local sqlite remains the default durable store', () => {
  const db = openDatabase(':memory:', {});
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); INSERT INTO t(v) VALUES (\'ok\')');
  assert.equal(db.prepare('SELECT v FROM t').get().v, 'ok');
  db.close();
  assert.equal(durableStore({}).enabled, false);
  assert.equal(durableStore({ VAULT_LIBSQL_URL: 'libsql://example.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok' }).enabled, false);
});

test('VAULT_DURABLE_DATA requires a libsql URL and never accepts the AMZN rehearsal path', () => {
  assert.throws(() => durableStore({ VAULT_DURABLE_DATA: 'true' }), /VAULT_LIBSQL_URL/);
  assert.throws(() => durableStore({
    VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'libsql://vault.turso.io'
  }), /VAULT_LIBSQL_AUTH_TOKEN/);
  assert.throws(() => durableStore({
    VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'postgres://neon.example/db', VAULT_LIBSQL_AUTH_TOKEN: 'tok'
  }), /libsql|https/);
  const ok = durableStore({
    VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok'
  });
  assert.equal(ok.enabled, true);
  assert.equal(ok.driver, 'libsql');
  const memory = durableStore({ VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'memory:paid-beta-unit' });
  assert.equal(memory.driver, 'memory');
  assert.throws(() => durableStore({
    VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'memory:paid-beta-unit', VERCEL: '1'
  }), /memory|Turso/i);
  const rehearsalEnv = { VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'memory:x' };
  assert.throws(() => openDatabase('C:\\\\vault-beta\\\\shared\\\\data\\\\web-funding-testnet\\\\credits.sqlite', rehearsalEnv),
    /rehearsal|AMZN|web-funding-testnet/i);
  assert.throws(() => openDatabase('/tmp/web-funding-testnet/credits.sqlite', rehearsalEnv), /rehearsal|web-funding-testnet/i);
});

test('boot refuses durable mode without a libsql URL before opening rehearsal files', async () => {
  const { createVaultApplication } = await import('../server/boot.mjs');
  await assert.rejects(() => createVaultApplication({
    env: { VAULT_DURABLE_DATA: 'true' }, root: 'C:\\vault-lab-durable-boot-test'
  }), /VAULT_LIBSQL_URL/);
});

test('a memory libsql backend preserves sqlite schema across files without sharing user_version', async t => {
  t.after(resetDurableBackends);
  const env = { VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'memory:paid-beta-shared' };
  const directory = await mkdtemp(join(tmpdir(), 'vault-libsql-ns-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sessions = createSessionStore({ path: join(directory, 'sessions.sqlite'), env });
  t.after(() => sessions.close());
  sessions.set('s1', { updatedAt: 1, ownerId: 'player_a' });
  const terms = paidBetaTerms();
  const prices = paidBetaPricePolicy(0);
  const ledger = createLedger({
    path: join(directory, 'credits.sqlite'), env, now: () => '2026-09-16T00:00:00.000Z'
  });
  t.after(() => ledger.close());
  ledger.execute('open', {
    type: 'open-round', roundId: 'haiku-v1', price: prices.basePrice, prizeBps: terms.prizeBps,
    operationsBps: terms.operationsBps, winRetainBps: terms.winRetainBps, priceStep: prices.stepPrice,
    maximumPrice: prices.maximumPrice, durationMonths: 5,
    configuration: 'paid-beta:anthropic/claude-haiku-4.5:v1'
  });
  ledger.execute('top', { type: 'topup', player: 'alice', amount: '100' });
  ledger.execute('r', { type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  ledger.execute('s', { type: 'start', attemptId: 'a1' });
  const settled = ledger.execute('x', { type: 'settle', attemptId: 'a1', outcome: 'locked', receiptRef: 'r1' });
  assert.equal(settled.prizeContribution, '3');
  assert.equal(ledger.snapshot().rounds[0].price, '6');
  assert.ok(sessions.get('s1'));
  const sessionDb = openDatabase(join(directory, 'sessions.sqlite'), env);
  t.after(() => sessionDb.close());
  const creditDb = openDatabase(join(directory, 'credits.sqlite'), env);
  t.after(() => creditDb.close());
  sessionDb.exec('PRAGMA user_version=3');
  creditDb.exec('PRAGMA user_version=6');
  assert.equal(sessionDb.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(creditDb.prepare('PRAGMA user_version').get().user_version, 6);
});

test('sandbox sqlite files stay local so a durable paid ledger can freeze a token asset', async t => {
  t.after(resetDurableBackends);
  const env = { VAULT_DURABLE_DATA: 'true', VAULT_LIBSQL_URL: 'memory:paid-beta-sandbox-split' };
  const directory = await mkdtemp(join(tmpdir(), 'vault-sandbox-split-'));
  t.after(() => rm(directory, { recursive: true, force: true }).catch(() => {}));
  const sandbox = createEconomyService({ path: join(directory, 'economy-sandbox.sqlite'), env });
  t.after(() => sandbox.close());
  assert.equal(sandbox.state().rounds[0].operations_bps, 2000);
  const jobs = openDatabase(join(directory, 'model-jobs.sqlite'), env);
  t.after(() => jobs.close());
  jobs.exec('CREATE TABLE model_jobs (key TEXT PRIMARY KEY)');
  const ledger = createLedger({ path: join(directory, 'credits.sqlite'), env, asset: EXAMPLE_ASSET });
  t.after(() => ledger.close());
  assert.equal(ledger.snapshot().unit.mode, 'rpc-credit-preparation');
  assert.equal(ledger.snapshot().asset.destination, EXAMPLE_ASSET.destination);
  const creditDb = openDatabase(join(directory, 'credits.sqlite'), env);
  t.after(() => creditDb.close());
  assert.equal(creditDb.prepare("SELECT name FROM sqlite_master WHERE name='model_jobs'").get(), undefined);
});
