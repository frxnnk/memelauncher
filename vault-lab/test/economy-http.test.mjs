import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createHttpServer } from '../server/http.mjs';
import { createEconomyService } from '../server/economy/service.mjs';

async function setup(t) {
  const economy = createEconomyService();
  const server = createHttpServer({ economy, publicDir: resolve('public'), service: { status: () => ({ configured: false }) } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(() => { economy.close(); resolve(); })));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const action = (body, extra = {}) => fetch(`${origin}/api/sandbox/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify(body) });
  return { economy, origin, action };
}
test('same-origin treasury flow is explicit simulation and replay does not double credits', async t => {
  const f = await setup(t);
  const initial = await (await fetch(`${f.origin}/api/sandbox/treasury`)).json();
  assert.equal(initial.unit.symbol, 'TEST'); assert.equal(initial.realFundsEnabled, false);
  const body = { action: 'topup', key: 'topup', amount: '1000' };
  assert.equal((await f.action(body)).status, 200);
  const replay = await (await f.action(body)).json();
  assert.equal(replay.result.replayed, true); assert.equal(replay.state.audit.custody, '1000');
  const reserved = await (await f.action({ action: 'reserve', key: 'reserve', roundId: 'round-1' })).json();
  const settled = await (await f.action({ action: 'locked', key: 'settle', attemptId: reserved.result.attemptId })).json();
  assert.equal(settled.result.prizeContribution, '70');
  const exported = await (await fetch(`${f.origin}/api/sandbox/export`)).json();
  assert.equal(exported.events.length, 5);
  assert.equal(exported.audit.balanced, true);
});
test('foreign origins and arbitrary ledger operations are rejected without mutations', async t => {
  const f = await setup(t);
  assert.equal((await f.action({ action: 'topup', key: 'x', amount: '1000' }, { Origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await f.action({ action: 'topup', key: 'x', amount: '1000', player: 'somebody' })).status, 400);
  assert.equal((await f.action({ action: 'send-real-funds', key: 'x' })).status, 400);
  assert.equal((await f.action({ action: 'start', key: 'x', attemptId: 42 })).status, 400);
  assert.equal((await f.action({ action: 'topup', key: 'x', amount: '-1' })).status, 409);
  assert.equal(f.economy.state().audit.custody, '0');
});
