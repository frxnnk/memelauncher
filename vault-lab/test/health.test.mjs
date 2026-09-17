import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createVaultService } from '../server/service.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';
import { readOperationalHealth } from '../server/health.mjs';

const runtime = runtimeConfiguration(), MODEL = 'qwen/qwen3.5-9b';
async function setup(t, apiKey = 'private-fixture-key') {
  const root = resolve(tmpdir()), directory = await mkdtemp(join(root, 'vault-health-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  const logDir = join(directory, 'receipts'); let calls = 0;
  const service = createVaultService({ apiKey, logDir, fetchImpl:async (url) => {
    if (url.endsWith('/models')) return Response.json({ data:[{ id:MODEL, supported_parameters:['tools'], pricing:{ prompt:'0.00001', completion:'0.00001' } }] });
    calls++;
    return Response.json({ model:MODEL, choices:[{ finish_reason:'stop', message:{ role:'assistant', content:'PRIVATE_RESPONSE' } }], usage:{ cost:0.001 } });
  } });
  t.after(async () => { try { service.close(); } catch {} await rm(directory, { recursive:true, force:true }); });
  return { service, logDir, calls:() => calls };
}

test('operational status distinguishes missing setup and returns aggregates without private data', async t => {
  const missing = await setup(t, '');
  const initial = readOperationalHealth({ service:missing.service, runtime });
  assert.equal(initial.statusCode, 200); assert.equal(initial.body.state, 'setup-required');
  assert.equal(initial.body.requestGateOpen, false); assert.equal(missing.calls(), 0);
  const f = await setup(t);
  await f.service.attempt({ modelId:MODEL, prompt:'PRIVATE_PROMPT' }, { ownerId:'PRIVATE_OWNER' });
  const health = readOperationalHealth({ service:f.service, runtime });
  assert.equal(health.body.state, 'requests-enabled'); assert.equal(health.body.execution.persistedReceipts, 1);
  assert.equal(health.body.execution.validReplies, 1); assert.equal(health.body.execution.errors, 0);
  assert.equal(health.body.providerAvailability, 'not-probed');
  assert.equal(health.body.paymentsEnabled, false); assert.equal(health.body.execution.scope, 'since-process-start');
  for (const secret of ['PRIVATE_PROMPT', 'PRIVATE_RESPONSE', 'PRIVATE_OWNER', 'private-fixture-key']) assert.ok(!JSON.stringify(health).includes(secret));
  assert.equal(f.calls(), 1);
});

test('a receipt write failure is visible and prevents another billed inference until repair/restart', async t => {
  const f = await setup(t); await writeFile(f.logDir, 'A file blocks the receipt directory.');
  await assert.rejects(f.service.attempt({ modelId:MODEL, prompt:'One.' }), e => e.code === 'RECEIPT_WRITE_FAILED');
  const health = readOperationalHealth({ service:f.service, runtime });
  assert.equal(health.statusCode, 503); assert.equal(health.body.state, 'storage-failure');
  assert.equal(health.body.execution.receiptWriteFailures, 1); assert.equal(health.body.execution.persistedReceipts, 0);
  await assert.rejects(f.service.attempt({ modelId:MODEL, prompt:'Do not bill again.' }), e => e.code === 'RECEIPT_STORAGE_UNAVAILABLE');
  assert.equal(f.calls(), 1);
});

test('closed/unreadable storage never produces an affirmative health result or leaks paths', async t => {
  const f = await setup(t); f.service.close();
  const health = readOperationalHealth({ service:f.service, runtime });
  assert.equal(health.statusCode, 503); assert.equal(health.body.state, 'storage-unavailable');
  assert.equal(health.body.execution, null); assert.equal(health.body.requestGateOpen, false);
  assert.ok(!JSON.stringify(health).includes(f.logDir));
});

test('persistent usage exposes busy, stale pending, unknown cost, budget and daily gates separately', async t => {
  const f = await setup(t); let clock = 1000;
  const limits = createInferenceLimits({ budgetUsd:0.002, now:() => clock }); t.after(limits.close);
  const health = () => readOperationalHealth({ service:f.service, limits, runtime, now:() => clock }).body;
  const id = limits.reserve('player_private');
  assert.equal(health().state, 'busy'); clock += 60000;
  assert.equal(health().state, 'reconciliation-required');
  limits.settle(id, undefined); assert.equal(health().usage.unknown, 1);
  assert.ok(!JSON.stringify(health()).includes('player_private')); assert.ok(!JSON.stringify(health()).includes(id));
  limits.reconcile({ id:'receipt', usageReservationId:id, status:'complete', usage:{ cost:0.002 } });
  assert.equal(health().state, 'budget-exhausted');
  const daily = createInferenceLimits({ totalPerDay:1 }); t.after(daily.close); daily.settle(daily.reserve('player_one'), 0.001);
  assert.equal(readOperationalHealth({ service:f.service, limits:daily, runtime }).body.state, 'daily-limit');
});
