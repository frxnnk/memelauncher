import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createHttpServer } from '../server/http.mjs';
import { createEconomyService } from '../server/economy/service.mjs';
import { createCreditGame } from '../server/economy/model-game.mjs';

test('model credit HTTP routes reserve, settle and reconcile once; reads and foreign origins cannot infer', async t => {
  let calls = 0;
  const economy = createEconomyService();
  economy.action({ action: 'topup', key: 'credits', amount: '1000' });
  const service = { status: () => ({ configured: true }), attempt: async () => {
    calls++;
    return { decision: 'locked', response: 'QA fixture.', receipt: { id: 'http-fixture', status: 'complete' } };
  } };
  const creditGame = createCreditGame({ economy, vault: service });
  const server = createHttpServer({ economy, creditGame, service, publicDir: resolve('public') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(() => { creditGame.close(); economy.close(); resolve(); })));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, site = origin) => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: site }, body: JSON.stringify(body) });
  const input = { key: 'http-job', roundId: 'round-1', modelId: 'qwen/qwen3.5-9b', prompt: 'QA test', simulatedCredits: true };
  assert.equal((await post('/api/sandbox/model-attempt', input, 'https://elsewhere.invalid')).status, 403);
  assert.equal(calls, 0);
  const first = await (await post('/api/sandbox/model-attempt', input)).json();
  assert.equal(first.accounting.prizeContribution, '70');
  const recovered = await (await post('/api/sandbox/reconcile-model', { key: input.key })).json();
  assert.equal(recovered.replayed, true); assert.equal(recovered.receipt.id, first.receipt.id);
  const read = await (await fetch(`${origin}/api/sandbox/model-attempt?key=${input.key}`)).json();
  assert.deepEqual(read.receipt.accounting, first.receipt.accounting);
  assert.equal((await post('/api/sandbox/reconcile-model', { key: input.key, outcome: 'released' })).status, 400);
  assert.equal((await post('/api/sandbox/reconcile-model', { key: 'missing-job' })).status, 404);
  assert.equal(calls, 1);
});
