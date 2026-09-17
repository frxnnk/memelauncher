import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createVaultService } from '../server/service.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createHttpServer } from '../server/http.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';
import { apiError } from '../server/errors.mjs';

const MODEL = 'qwen/qwen3.5-9b', A = 'player_a', B = 'player_b';
const code = expected => error => error.code === expected;
async function setup(t) {
  const root = resolve(tmpdir()), directory = await mkdtemp(join(root, 'vault-history-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  let now = Date.now(), calls = 0, invalid = false;
  const services = [];
  const create = () => {
    const service = createVaultService({ apiKey:'private-fixture-key', logDir:join(directory, 'receipts'),
      sessionsPath:join(directory, 'sessions.sqlite'), now:() => now, fetchImpl:async url => {
        if (url.endsWith('/models')) return Response.json({ data:[{ id:MODEL, supported_parameters:['tools'], pricing:{ prompt:'0.00001', completion:'0.00001' } }] });
        calls++;
        return Response.json({ model:MODEL, usage:{ cost:0.001 }, choices:invalid ? [] : [
          { finish_reason:'stop', message:{ role:'assistant', content:'PRIVATE_REPLY private-fixture-key' } }] });
      } });
    services.push(service); return service;
  };
  t.after(async () => {
    for (const service of services) { try { service.close(); } catch {} }
    await rm(directory, { recursive:true, force:true });
  });
  return { create, advance:() => { now += 61 * 60000; }, calls:() => calls, fail:() => { invalid = true; },
    attempt:(service, ownerId = A) => service.attempt({ modelId:MODEL, prompt:'PRIVATE_ARGUMENT private-fixture-key' }, { ownerId }) };
}

test('owner receipts survive restart and session expiry, without exposing stored API keys or repeating inference', async t => {
  const f = await setup(t); let service = f.create();
  const first = await f.attempt(service); service.close(); service = f.create();
  assert.equal(service.receipt(A, first.receipt.id).record.id, first.receipt.id);
  assert.ok(!JSON.stringify(service.receipt(A, first.receipt.id)).includes('private-fixture-key'));
  f.advance(); await f.attempt(service);
  assert.equal(service.operationalState().storedSessions, 1);
  assert.equal(service.receiptHistory(A).records.length, 2);
  assert.equal(service.receipt(A, first.receipt.id).record.id, first.receipt.id);
  assert.throws(() => service.receipt(B, first.receipt.id), code('RECEIPT_NOT_FOUND'));
  assert.equal(service.receiptHistory(B).records.length, 0); assert.equal(f.calls(), 2);
});

test('receipt pages are bounded, owner scoped and stable while newer attempts arrive', async t => {
  const f = await setup(t), service = f.create(), ids = [];
  for (let i = 0; i < 22; i++) ids.push((await f.attempt(service)).receipt.id);
  const foreign = await f.attempt(service, B);
  const first = service.receiptHistory(A);
  assert.equal(first.records.length, 20); assert.equal(first.nextCursor, ids[2]);
  assert.ok(!JSON.stringify(first).includes('PRIVATE_ARGUMENT')); assert.ok(!JSON.stringify(first).includes('PRIVATE_REPLY'));
  await f.attempt(service);
  const second = service.receiptHistory(A, first.nextCursor);
  assert.deepEqual(second.records.map(r => r.id), [ids[1], ids[0]]); assert.equal(second.nextCursor, null);
  assert.throws(() => service.receiptHistory(A, foreign.receipt.id), code('RECEIPT_NOT_FOUND'));
  assert.throws(() => service.receiptHistory(A, randomUUID()), code('RECEIPT_NOT_FOUND'));
  assert.throws(() => service.receiptHistory(A, '-1'), code('INVALID_RECEIPT_CURSOR'));
  assert.throws(() => service.receiptHistory('local-demo'), code('AUTH_REQUIRED'));
  assert.equal(f.calls(), 24);
});

test('model errors remain errors in account history, and the exact receipt can be downloaded', async t => {
  const f = await setup(t), service = f.create(); f.fail();
  let saved;
  await assert.rejects(f.attempt(service), e => { saved = e.receipt; return saved?.status === 'error'; });
  assert.equal(service.receiptHistory(A).records[0].status, 'error');
  assert.equal(service.receiptHistory(A).records[0].decision, undefined);
  assert.deepEqual(service.receipt(A, saved.id).record, saved); assert.equal(f.calls(), 1);
});

test('HTTP history requires verified identity, rejects owner selectors and does not disclose another account receipt', async t => {
  const f = await setup(t), service = f.create(), receipt = (await f.attempt(service)).receipt;
  const limits = createInferenceLimits();
  const authentication = { configured:true, authenticate:async headers => {
    if (!['Bearer a', 'Bearer b'].includes(headers.authorization)) throw apiError(401, 'AUTH_REQUIRED', 'Sign in.');
    return { accountId:headers.authorization === 'Bearer a' ? A : B };
  } };
  const server = createHttpServer({ service, limits, authentication, publicDir:'.',
    runtime:runtimeConfiguration({ VAULT_ACCESS_MODE:'public-practice', VAULT_PUBLIC_ORIGIN:'https://vault.example' }) });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose)); limits.close(); });
  const get = (path, token = 'a') => new Promise((resolveResult, reject) => {
    const req = request({ hostname:'127.0.0.1', port:server.address().port, path,
      headers:{ host:'vault.example', ...(token ? { authorization:`Bearer ${token}` } : {}) } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolveResult({ status:res.statusCode, headers:res.headers, body:JSON.parse(text) }));
    }); req.on('error', reject); req.end();
  });
  for (const path of ['/api/receipts', `/api/receipts/${receipt.id}`]) assert.equal((await get(path, null)).status, 401);
  const page = await get('/api/receipts'); assert.equal(page.status, 200); assert.equal(page.headers['cache-control'], 'no-store');
  assert.equal(page.body.records[0].id, receipt.id);
  assert.deepEqual((await get(`/api/receipts/${receipt.id}`)).body.record, receipt);
  const foreign = await get(`/api/receipts/${receipt.id}`, 'b'), missing = await get(`/api/receipts/${randomUUID()}`, 'b');
  assert.equal(foreign.status, 404); assert.deepEqual(foreign.body, missing.body);
  assert.equal((await get('/api/receipts', 'b')).body.records.length, 0);
  for (const path of ['/api/receipts?owner=player_b', '/api/receipts?before=a&before=b', '/api/receipts?before=bad', `/api/receipts/${receipt.id}?owner=player_b`]) {
    assert.equal((await get(path)).status, 400);
  }
  assert.equal((await get('/api/receipts?path=receipts')).status, 200);
  assert.equal((await get(`/api/receipts/${receipt.id}?path=receipts/${receipt.id}`)).status, 200);
  assert.equal((await get('/api/receipts?__vault_path=/api/receipts&_vercel_share=1')).status, 200);
  assert.equal(f.calls(), 1); assert.equal(limits.operationalState().globalRequestsToday, 0);
});

test('public receipts list every attempt transcript without auth and still hide API keys', async t => {
  const f = await setup(t), service = f.create();
  const first = await f.attempt(service);
  await f.attempt(service, B);
  const limits = createInferenceLimits();
  const authentication = { configured:true, authenticate:async () => { throw apiError(401, 'AUTH_REQUIRED', 'Sign in.'); } };
  const server = createHttpServer({ service, limits, authentication, publicDir:'.',
    runtime:runtimeConfiguration({ VAULT_ACCESS_MODE:'public-practice', VAULT_PUBLIC_ORIGIN:'https://vault.example' }) });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose)); limits.close(); });
  const get = path => new Promise((resolveResult, reject) => {
    const req = request({ hostname:'127.0.0.1', port:server.address().port, path,
      headers:{ host:'vault.example' } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolveResult({ status:res.statusCode, headers:res.headers, body:JSON.parse(text) }));
    }); req.on('error', reject); req.end();
  });
  const page = await get('/api/receipts/public');
  assert.equal(page.status, 200, JSON.stringify(page.body));
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.equal(page.body.records.length, 2);
  assert.equal(page.body.records.some(row => row.id === first.receipt.id), true);
  assert.match(JSON.stringify(page.body.records[0].messages), /PRIVATE_ARGUMENT/);
  assert.doesNotMatch(JSON.stringify(page.body), /private-fixture-key/);
  assert.match(page.body.records[0].player, /…/);
  const leftover = await get('/api/receipts/public?path=receipts/public&_vercel_share=1');
  assert.equal(leftover.status, 200);
  assert.equal(leftover.body.records.length, 2);
});
