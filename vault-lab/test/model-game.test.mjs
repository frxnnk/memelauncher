import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { createEconomyService } from '../server/economy/service.mjs';
import { createCreditGame } from '../server/economy/model-game.mjs';
import { apiError } from '../server/errors.mjs';

const input = (key = 'test-job') => ({ key, roundId: 'round-1', modelId: 'qwen/qwen3.5-9b', prompt: 'Fictional vault argument.', simulatedCredits: true });
const reply = (decision = 'locked') => ({ sessionId: 'fixture-session', response: 'QA reply, not a real model.', decision,
  receipt: { id: 'fixture-receipt', status: 'complete', decision, mode: 'practice', bountyEnabled: false } });
function setup(t, handler = async () => reply(), configured = true) {
  const economy = createEconomyService(); let calls = 0;
  economy.action({ action: 'topup', key: 'initial-credits', amount: '1000' });
  const vault = { status: () => ({ configured }), attempt: async (...args) => { calls++; return handler(...args); } };
  const game = createCreditGame({ economy, vault });
  t.after(() => { game.close(); economy.close(); });
  return { economy, game, vault, calls: () => calls };
}
const balance = (economy, account) => economy.state().balances.find(row => row.account === account)?.amount ?? '0';

test('valid model reply consumes test credits and feeds treasury exactly once on request replay', async t => {
  const f = setup(t); const result = await f.game.attempt(input());
  assert.equal(result.accounting.prizeContribution, '70');
  assert.equal(result.accounting.realFunds, false);
  assert.deepEqual(result.receipt.accounting, result.accounting);
  assert.equal(balance(f.economy, 'player:local-demo:available'), '900');
  const replay = await f.game.attempt(input());
  assert.equal(replay.replayed, true); assert.equal(f.calls(), 1);
  assert.equal(balance(f.economy, 'round:round-1:prize'), '70');
  assert.equal(f.game.result('test-job').receipt.id, result.receipt.id);
  assert.equal(f.game.reconcile('test-job').replayed, true);
  assert.equal(f.calls(), 1);
});
test('missing inference key leaves credits and the ledger untouched', async t => {
  const f = setup(t, undefined, false); const before = f.economy.export();
  await assert.rejects(f.game.attempt(input()), error => error.code === 'MISSING_API_KEY');
  assert.deepEqual(f.economy.export(), before); assert.equal(f.calls(), 0);
});
test('known model errors return credits and persist error replay without re-inference', async t => {
  const f = setup(t, async () => { throw apiError(502, 'INVALID_MODEL_RESPONSE', 'QA invalid tool.', {
    receipt: { id: 'fixture-error', status: 'error', error: { code: 'INVALID_MODEL_RESPONSE' } } }); });
  await assert.rejects(f.game.attempt(input()), error => error.accounting.creditsReturned === '100');
  assert.equal(balance(f.economy, 'player:local-demo:available'), '1000');
  await assert.rejects(f.game.attempt(input()), error => error.code === 'INVALID_MODEL_RESPONSE');
  assert.equal(f.calls(), 1); assert.equal(balance(f.economy, 'round:round-1:prize'), '0');
});
test('receipt storage gate refunds TEST credits, while a write failure after inference preserves uncertainty', async t => {
  let failure = apiError(503, 'RECEIPT_STORAGE_UNAVAILABLE', 'Storage gate closed before inference.');
  const f = setup(t, async () => { throw failure; });
  await assert.rejects(f.game.attempt(input()), e => e.code === 'RECEIPT_STORAGE_UNAVAILABLE' && e.accounting.creditsReturned === '100');
  assert.equal(balance(f.economy, 'player:local-demo:available'), '1000');
  assert.equal(balance(f.economy, 'round:round-1:prize'), '0');
  await assert.rejects(f.game.attempt(input()), e => e.code === 'RECEIPT_STORAGE_UNAVAILABLE');
  assert.equal(f.calls(), 1);
  failure = apiError(500, 'RECEIPT_WRITE_FAILED', 'Receipt could not be saved after inference.');
  await assert.rejects(f.game.attempt(input('uncertain-storage')), e => e.code === 'MODEL_JOB_UNCERTAIN');
  assert.equal(balance(f.economy, 'player:local-demo:reserved'), '100');
  assert.equal(balance(f.economy, 'round:round-1:prize'), '0');
  assert.equal(f.game.result('uncertain-storage').status, 'unknown');
});

test('unknown outcome holds the reservation and blocks replay with a different message', async t => {
  const f = setup(t, async () => { throw new Error('Unexpected storage failure'); });
  await assert.rejects(f.game.attempt(input()), error => error.code === 'MODEL_JOB_UNCERTAIN');
  assert.equal(balance(f.economy, 'player:local-demo:reserved'), '100');
  await assert.rejects(f.game.attempt(input()), error => error.code === 'MODEL_JOB_UNCERTAIN');
  await assert.rejects(f.game.attempt({ ...input(), prompt: 'Replacement message.' }), error => error.code === 'MODEL_JOB_CONFLICT');
  assert.equal(f.calls(), 1);
  assert.equal(f.game.result('test-job').status, 'unknown');
  assert.throws(() => f.game.reconcile('test-job'), error => error.code === 'MODEL_JOB_UNCERTAIN');
  assert.equal(f.calls(), 1);
});
test('manual accounting controls cannot override a model-linked attempt', async t => {
  const f = setup(t, async () => { throw new Error('QA unknown'); });
  await assert.rejects(f.game.attempt(input()));
  assert.throws(() => f.economy.action({ action: 'reconcile-released', key: 'manual', attemptId: 'model-test-job' }), error => error.code === 'MODEL_ATTEMPT_PROTECTED');
});
test('queue conflict cancels only the new reservation without an inference request', async t => {
  const f = setup(t);
  f.economy.action({ action: 'reserve', key: 'manual-first', roundId: 'round-1' });
  await assert.rejects(f.game.attempt(input()), error => error.code === 'CREDIT_RESERVATION_REJECTED');
  assert.equal(f.calls(), 0); assert.equal(balance(f.economy, 'player:local-demo:reserved'), '100');
  assert.throws(() => f.game.reconcile('test-job'), error => error.accounting.status === 'not-charged');
});
test('simultaneous duplicate cannot launch a second API call', async t => {
  let finish;
  const f = setup(t, () => new Promise(resolve => { finish = resolve; }));
  const pending = f.game.attempt(input());
  await assert.rejects(f.game.attempt(input()), error => error.code === 'MODEL_JOB_UNCERTAIN');
  finish(reply()); await pending;
  assert.equal(f.calls(), 1);
});
test('winning model receipt reserves the full test prize for payout', async t => {
  const f = setup(t, async () => reply('released'));
  f.economy.action({ action: 'seed', key: 'seed', amount: '500', roundId: 'round-1' });
  const result = await f.game.attempt(input());
  assert.equal(result.accounting.winnerPayable, '570');
  assert.equal(balance(f.economy, 'round:round-1:payable'), '570');
});
test('restart after inference but before accounting can settle without replaying inference', async t => {
  const root = resolve(tmpdir()), dir = await mkdtemp(join(root, 'vault-model-jobs-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const economy = createEconomyService({ path: join(dir, 'economy.sqlite') });
  economy.action({ action: 'topup', key: 'topup', amount: '1000' });
  let calls = 0;
  const vault = { status: () => ({ configured: true }), attempt: async () => { calls++; return reply(); } };
  let game = createCreditGame({ path: join(dir, 'jobs.sqlite'), economy, vault });
  const execute = economy.ledger.execute;
  economy.ledger.execute = (...args) => { if (args[1].type === 'settle') throw new Error('QA storage interruption'); return execute(...args); };
  await assert.rejects(game.attempt(input()), /storage interruption/);
  assert.equal(game.result('test-job').status, 'inferred');
  game.close(); economy.ledger.execute = execute;
  game = createCreditGame({ path: join(dir, 'jobs.sqlite'), economy, vault });
  const result = game.reconcile('test-job');
  assert.equal(result.accounting.prizeContribution, '70'); assert.equal(calls, 1);
  game.close(); economy.close();
});
