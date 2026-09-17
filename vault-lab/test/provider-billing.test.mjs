import test from 'node:test';
import assert from 'node:assert/strict';
import { createInferenceLimits } from '../server/limits.mjs';
import { meteredAttempt } from '../server/metered-attempt.mjs';

const errorReceipt = () => ({ id: 'receipt-empty-error', status: 'error',
  upstreamId: 'gen-fixture', modelRequested: 'google/gemini-2.5-flash', modelReturned: 'google/gemini-2.5-flash',
  finishReason: 'error', usage: null, toolCalls: [],
  outputMessage: { role: 'assistant', content: null, reasoning: null },
  error: { code: 'INVALID_MODEL_RESPONSE', message: 'The response was incomplete or interrupted. This does not count as a loss.' } });

test('an explicit empty upstream error is reconciled by the published no-charge policy without modifying its raw usage', t => {
  const limits = createInferenceLimits(); t.after(limits.close);
  const receipt = { ...errorReceipt(), usageReservationId: limits.reserve('player_one') };
  limits.settle(receipt.usageReservationId, undefined);
  const before = structuredClone(receipt);
  const proof = limits.reconcile(receipt);
  assert.equal(proof.accountedCostUsd, 0);
  assert.equal(proof.source, 'openrouter-zero-completion-policy');
  assert.match(proof.policyUrl, /^https:\/\/openrouter.ai\/docs\//);
  assert.deepEqual(receipt, before);
  assert.equal(limits.reconcile(receipt).accountedCostUsd, 0);
  assert.equal(limits.operationalState().unknown, 0);
  assert.equal(limits.operationalState().known, 1);
});

test('missing, truncated, conflicting or ambiguous output never qualifies for the no-charge policy', t => {
  const limits = createInferenceLimits(); t.after(limits.close);
  const id = limits.reserve('player_one'); limits.settle(id, undefined);
  for (const patch of [
    { finishReason: 'length' }, { finishReason: null }, { upstreamId: null },
    { error: { code: 'INVALID_MODEL_RESPONSE', message: 'Multiple responses.' } },
    { modelReturned: 'other/model' }, { outputMessage: null },
    { outputMessage: { role: 'assistant', content: 'Partial output' } },
    { outputMessage: { role: 'assistant', content: null, reasoning: 'work' } },
    { toolCalls: [{ id: 'call' }] }, { usage: { cost: '0' } },
    { usage: { cost: -1 } }, { usage: { completion_tokens: 10 } }
  ]) assert.throws(() => limits.reconcile({ ...errorReceipt(), usageReservationId: id, ...patch }));
  assert.equal(limits.operationalState().unknown, 1);
});

test('a metered explicit empty error does not freeze future requests; network errors still do', async t => {
  const limits = createInferenceLimits(); t.after(limits.close);
  const receipt = errorReceipt();
  const error = Object.assign(new Error('Upstream error'), { receipt });
  await assert.rejects(meteredAttempt({ limits, scope: { ownerId: 'player_one' }, input: {},
    vault: { attempt: async (_, scope) => { receipt.usageReservationId = scope.usageReservationId; throw error; } } }), /Upstream error/);
  assert.equal(limits.operationalState().unknown, 0);
  assert.equal(receipt.usage, null);
  await assert.rejects(meteredAttempt({ limits, scope: { ownerId: 'player_one' }, input: {},
    vault: { attempt: async () => { throw new Error('Connection lost'); } } }), /Connection lost/);
  assert.equal(limits.operationalState().unknown, 1);
});
