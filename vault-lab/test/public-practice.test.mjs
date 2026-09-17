import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request } from 'node:http';
import { createInferenceLimits } from '../server/limits.mjs';
import { runtimeConfiguration, checkPublicRequest } from '../server/runtime.mjs';
import { createPublicPractice } from '../server/public-practice.mjs';
import { createHttpServer } from '../server/http.mjs';
import { apiError } from '../server/errors.mjs';

const USER = 'player_fixture';
const runtime = runtimeConfiguration({ VAULT_ACCESS_MODE: 'public-practice', VAULT_PUBLIC_ORIGIN: 'https://vault.example' });
const authentication = { configured: true, publicConfig: () => ({ configured: true }),
  authenticate: async headers => {
    if (headers.authorization !== 'Bearer fixture') throw apiError(401, 'AUTH_REQUIRED', 'Sign in.');
    return { accountId: USER };
  } };
const code = expected => error => error.code === expected;

test('usage reservations enforce per-account and global UTC daily limits', t => {
  let time = Date.UTC(2026, 8, 14, 23, 59);
  const limits = createInferenceLimits({ perUserPerDay: 1, totalPerDay: 2, now: () => time });
  t.after(limits.close);
  const first = limits.reserve(USER);
  assert.throws(() => limits.reserve('player_second'), code('ATTEMPT_BUSY'));
  limits.settle(first, 0.003);
  assert.throws(() => limits.reserve(USER), code('DAILY_LIMIT_REACHED'));
  limits.settle(limits.reserve('player_second'), 0.001);
  assert.throws(() => limits.reserve('player_third'), code('DAILY_LIMIT_REACHED'));
  time += 120000;
  limits.settle(limits.reserve(USER), 0.001);
  assert.equal(limits.status(USER).requestsToday, 1);
  assert.equal(limits.status(USER).reportedCostUsd, 0.005);
});

test('runtime rejects public admission without a persistent beta service', () => {
  assert.throws(() => runtimeConfiguration({ VAULT_ACCESS_MODE:'public-practice', VAULT_PUBLIC_ORIGIN:'https://vault.example', VAULT_PUBLIC_ADMISSION:'true' }), /persistent beta/);
  assert.equal(runtimeConfiguration({ VAULT_ACCESS_MODE:'public-practice', VAULT_PUBLIC_ORIGIN:'https://vault.example', VAULT_CLOSED_BETA:'true', VAULT_PUBLIC_ADMISSION:'true' }).publicAdmission, true);
});

test('known costs close the budget; settlement cannot be rewritten or double counted', t => {
  const limits = createInferenceLimits({ budgetUsd: 0.005 }); t.after(limits.close);
  const id = limits.reserve(USER); limits.settle(id, 0.005); limits.settle(id, 0.005);
  assert.throws(() => limits.settle(id, 0));
  assert.equal(limits.status(USER).reportedCostUsd, 0.005);
  assert.throws(() => limits.reserve(USER), code('APP_BUDGET_REACHED'));
});

test('pending and unknown costs survive restart and block another inference', async t => {
  const root = resolve(tmpdir()), dir = await mkdtemp(join(root, 'vault-limits-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  let limits;
  t.after(async () => { limits?.close(); await rm(dir, { recursive: true, force: true }); });
  const path = join(dir, 'usage.sqlite');
  limits = createInferenceLimits({ path }); const id = limits.reserve(USER); limits.close();
  limits = createInferenceLimits({ path });
  assert.throws(() => limits.reserve(USER), code('ATTEMPT_BUSY'));
  limits.settle(id, undefined); limits.close(); limits = createInferenceLimits({ path });
  assert.throws(() => limits.reserve(USER), code('USAGE_UNRECONCILED'));
  assert.equal(limits.status(USER).unresolved, 1);
});

test('authentication precedes reservations; account ownership comes from verification', async t => {
  const limits = createInferenceLimits(); t.after(limits.close); const calls = [];
  const vault = { attempt: async (input, scope) => { calls.push(scope); return { receipt: { usage: { cost: 0.001 } } }; } };
  const practice = createPublicPractice({ vault, authentication, limits });
  await assert.rejects(practice.attempt({}, {}), code('AUTH_REQUIRED'));
  assert.equal(limits.status(USER).globalRequestsToday, 0);
  await practice.attempt({ authorization: 'Bearer fixture', 'x-player-id': 'player_attacker' }, {});
  assert.equal(calls.length, 1); assert.equal(calls[0].ownerId, USER);
  assert.match(calls[0].usageReservationId, /^[a-f0-9-]{36}$/);
});

test('preflight rejection releases usage reservation; transport failure keeps an unknown cost', async t => {
  const limits = createInferenceLimits(); t.after(limits.close);
  let failure = apiError(400, 'INVALID_INPUT', 'Bad prompt.');
  const practice = createPublicPractice({ authentication, limits, vault: { attempt: async () => { throw failure; } } });
  await assert.rejects(practice.attempt({ authorization: 'Bearer fixture' }, {}), code('INVALID_INPUT'));
  assert.equal(limits.status(USER).unresolved, 0);
  failure = apiError(503, 'RECEIPT_STORAGE_UNAVAILABLE', 'Storage gate closed before inference.');
  await assert.rejects(practice.attempt({ authorization: 'Bearer fixture' }, {}), code('RECEIPT_STORAGE_UNAVAILABLE'));
  assert.equal(limits.status(USER).unresolved, 0);
  assert.equal(limits.operationalState().notSent, 2);
  assert.equal(limits.status(USER).reportedCostUsd, 0);
  failure = new Error('Uncertain transport');
  await assert.rejects(practice.attempt({ authorization: 'Bearer fixture' }, {}));
  assert.equal(limits.status(USER).unresolved, 1);
  await assert.rejects(practice.attempt({ authorization: 'Bearer fixture' }, {}), code('USAGE_UNRECONCILED'));
});

test('recovery uses an existing linked receipt, preserves evidence and never invents a zero cost', t => {
  const limits = createInferenceLimits(); t.after(limits.close);
  const id = limits.reserve(USER); limits.settle(id, null);
  const receipt = { id: 'receipt-fixture', usageReservationId: id, status: 'complete', usage: { cost: 0.002 } };
  assert.throws(() => limits.reconcile({ ...receipt, usage: {} }));
  assert.equal(limits.status(USER).unresolved, 1);
  limits.reconcile(receipt); limits.reconcile(receipt);
  assert.equal(limits.status(USER).reportedCostUsd, 0.002);
  assert.equal(limits.status(USER).unresolved, 0);
  assert.throws(() => limits.reconcile({ ...receipt, usage: { cost: 0 } }), /Conflicting/);
  limits.settle(limits.reserve(USER), 0.001);
});

test('public runtime requires exact HTTPS origin and refuses funded or invalid limits', () => {
  for (const value of ['http://vault.example', 'https://vault.example/path', 'https://x:y@vault.example', 'https://vault.example?x']) {
    assert.throws(() => runtimeConfiguration({ VAULT_ACCESS_MODE: 'public-practice', VAULT_PUBLIC_ORIGIN: value }));
  }
  assert.throws(() => runtimeConfiguration({ VAULT_ACCESS_MODE: 'funded' }));
  assert.throws(() => runtimeConfiguration({ VAULT_REQUESTS_PER_DAY: '0' }));
  for (const headers of [{ host: 'other.example' }, { host: 'vault.example', origin: 'https://evil.example' }, { host: 'vault.example', 'sec-fetch-site': 'cross-site' }]) {
    assert.throws(() => checkPublicRequest({ headers }, runtime), code('ORIGIN_REJECTED'));
  }
});

test('public HTTP rejects anonymous inference, hides all sandbox operations and meters verified calls', async t => {
  const limits = createInferenceLimits(); let calls = 0;
  const service = { status: () => ({ configured: true, bountyEnabled: false }),
    attempt: async () => { calls++; return { receipt: { usage: { cost: 0.001 } } }; } };
  const economy = { action: () => { throw new Error('Sandbox must never run'); }, state: () => { throw new Error('No public ledger'); } };
  const server = createHttpServer({ service, economy, publicDir: '.', runtime, authentication, limits });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); limits.close(); });
  const send = (path, headers = {}, method = 'POST') => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method,
      headers: { host: 'vault.example', origin: 'https://vault.example', 'content-type': 'application/json', ...headers } }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }); req.on('error', reject); req.end(method === 'POST' ? '{}' : undefined);
  });
  assert.equal((await send('/api/attempt')).status, 401);
  assert.equal(calls, 0);
  for (const path of ['/api/sandbox/action', '/api/sandbox/model-attempt', '/api/sandbox/reconcile-model']) assert.equal((await send(path)).status, 404);
  assert.equal((await send('/api/sandbox/treasury', {}, 'GET')).status, 404);
  assert.equal((await send('/api/usage', {}, 'GET')).status, 401);
  assert.equal((await send('/api/attempt', { authorization: 'Bearer fixture' })).status, 200);
  const usage = await send('/api/usage', { authorization: 'Bearer fixture' }, 'GET');
  assert.equal(usage.body.requestsToday, 1); assert.equal(calls, 1);
  assert.equal((await send('/api/attempt', { authorization: 'Bearer fixture', origin: 'https://evil.example' })).status, 403);
  assert.equal(calls, 1);
});
