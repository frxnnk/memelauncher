import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { createLedger } from '../server/economy/ledger.mjs';
import { MAX_UNITS } from '../server/economy/schema.mjs';
import { DatabaseSync } from 'node:sqlite';

const opening = (roundId = 'round-1', price = '100') => ({ type: 'open-round', roundId, price,
  prizeBps: 7000, operationsBps: 2000, configuration: 'public-simulation-v1' });

test('a newer schema is rejected without silently rewriting its version or data', async t => {
  const root=resolve(tmpdir()),dir=await mkdtemp(join(root,'vault-schema-'));
  assert.ok(resolve(dir).startsWith(root+sep));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'ledger.sqlite'),db=new DatabaseSync(path);
  db.exec('PRAGMA user_version=2; CREATE TABLE future_data(value TEXT); INSERT INTO future_data VALUES (\'preserve\');');db.close();
  assert.throws(()=>createLedger({path}),/Unsupported ledger schema/);
  const checked=new DatabaseSync(path);
  assert.equal(checked.prepare('PRAGMA user_version').get().user_version,2);
  assert.equal(checked.prepare('SELECT value FROM future_data').get().value,'preserve');checked.close();
});
function fixture(t, path) {
  const ledger = createLedger({ path });
  t.after(() => ledger.close());
  let seq = 0;
  const exec = request => ledger.execute(`operation-${++seq}`, request);
  exec(opening());
  const balance = account => ledger.snapshot().balances.find(b => b.account === account)?.amount ?? '0';
  const topup = (amount = '1000', player = 'alice') => exec({ type: 'topup', player, amount });
  const reserve = (attemptId = 'a1', player = 'alice', roundId = 'round-1') => exec({ type: 'reserve', roundId, attemptId, player });
  const start = (attemptId = 'a1') => exec({ type: 'start', attemptId });
  const settle = (outcome, attemptId = 'a1', reconciled = false) => exec({ type: 'settle', attemptId, outcome, receiptRef: `receipt-${attemptId}`, reconciled });
  return { ledger, exec, balance, topup, reserve, start, settle };
}

test('confirmed topup is a player liability; only a settled valid attempt grows the prize', t => {
  const f = fixture(t);
  f.topup();
  assert.equal(f.balance('custody'), '1000');
  assert.equal(f.balance('round:round-1:prize'), '0');
  f.reserve();
  assert.equal(f.balance('player:alice:available'), '900');
  assert.equal(f.balance('player:alice:reserved'), '100');
  f.start();
  const result = f.settle('locked');
  assert.deepEqual([result.prizeContribution, result.operations, result.nextRound], ['70', '20', '10']);
  assert.equal(f.balance('round:round-1:prize'), '70');
  assert.equal(f.balance('player:alice:reserved'), '0');
  assert.equal(f.ledger.audit().balanced, true);
});

test('a technical error returns credits once without claiming prize income', t => {
  const f = fixture(t); f.topup(); f.reserve(); f.start();
  f.settle('error');
  assert.equal(f.balance('player:alice:available'), '1000');
  assert.equal(f.balance('round:round-1:prize'), '0');
  assert.throws(() => f.settle('error'), /cannot be settled/);
  assert.equal(f.balance('custody'), '1000');
});

test('winning attempt includes its contribution, cancels queued reservations and pays the fixed winner once', t => {
  const f = fixture(t); f.topup(); f.topup('200', 'bob');
  f.exec({ type: 'contribution', roundId: 'round-1', source: 'sponsor', amount: '500', received: true });
  f.reserve(); f.reserve('b1', 'bob'); f.start();
  f.settle('released');
  assert.equal(f.balance('round:round-1:payable'), '570');
  assert.equal(f.balance('round:round-1:prize'), '0');
  assert.equal(f.balance('player:bob:available'), '200');
  assert.equal(f.balance('player:bob:reserved'), '0');
  assert.throws(() => f.reserve('a2'), /no longer accepts/);
  const result = f.exec({ type: 'payout', roundId: 'round-1' });
  assert.equal(result.player, 'alice');
  assert.equal(result.paid, '570');
  assert.equal(f.balance('custody'), '1130');
  assert.equal(f.balance('treasury:next'), '10');
  assert.throws(() => f.exec({ type: 'payout', roundId: 'round-1' }), /unpaid/);
});

test('same idempotency key returns previous receipt; a conflicting payload changes nothing', t => {
  const f = fixture(t);
  const request = { type: 'topup', player: 'alice', amount: '150' };
  f.ledger.execute('deposit-1', request);
  const replay = f.ledger.execute('deposit-1', { amount: '150', type: 'topup', player: 'alice' });
  assert.equal(replay.replayed, true);
  assert.equal(f.balance('custody'), '150');
  assert.throws(() => f.ledger.execute('deposit-1', { ...request, amount: '151' }), /different request/);
  assert.equal(f.balance('custody'), '150');
  assert.equal(f.ledger.snapshot().eventCount, 2);
});

test('failed reserve rolls back all balances and does not append an event', t => {
  const f = fixture(t); f.topup('99');
  const before = f.ledger.exportAll();
  assert.throws(() => f.reserve(), /Insufficient/);
  assert.deepEqual(f.ledger.exportAll(), before);
});

test('queue order survives uncertain results; unknown is not automatically refunded or lost', t => {
  const f = fixture(t); f.topup(); f.reserve('a1'); f.reserve('a2');
  assert.throws(() => f.start('a2'), /first reserved/);
  f.start('a1'); f.exec({ type: 'unknown', attemptId: 'a1' });
  assert.throws(() => f.exec({ type: 'cancel-reservation', attemptId: 'a1' }), /reconciled/);
  assert.throws(() => f.start('a2'), /first reserved/);
  assert.throws(() => f.settle('locked', 'a1'), /explicit reconciliation/);
  assert.equal(f.balance('player:alice:reserved'), '200');
  f.settle('error', 'a1', true); f.start('a2'); f.settle('locked', 'a2');
  assert.equal(f.balance('player:alice:available'), '900');
});

test('promised creator fees cannot increase custody; a received contribution can', t => {
  const f = fixture(t);
  const contribution = { type: 'contribution', roundId: 'round-1', source: 'creator-fees', amount: '70' };
  assert.throws(() => f.exec({ ...contribution, received: false }), /not received/);
  assert.equal(f.balance('custody'), '0');
  f.exec({ ...contribution, received: true });
  assert.equal(f.balance('round:round-1:prize'), '70');
});

test('next-round seeding moves an allocation, without inventing an external inflow', t => {
  const f = fixture(t); f.topup(); f.reserve(); f.start(); f.settle('locked');
  f.exec(opening('round-2'));
  f.exec({ type: 'seed-next-round', roundId: 'round-2', amount: '10' });
  assert.equal(f.balance('round:round-2:prize'), '10');
  assert.equal(f.balance('treasury:next'), '0');
  assert.equal(f.balance('custody'), '1000');
});

test('only unreserved credits can be withdrawn from simulated custody', t => {
  const f = fixture(t); f.topup('150'); f.reserve();
  assert.throws(() => f.exec({ type: 'refund-credits', player: 'alice', amount: '51' }), /Insufficient/);
  f.exec({ type: 'refund-credits', player: 'alice', amount: '50' });
  assert.equal(f.balance('custody'), '100');
  f.exec({ type: 'cancel-reservation', attemptId: 'a1' });
  assert.equal(f.balance('player:alice:available'), '100');
});

test('256-bit accounting preserves integers above JS safe precision and rolls back overflow', t => {
  const f = fixture(t); const large = 1n << 100n;
  f.topup(String(large));
  assert.equal(f.balance('custody'), String(large));
  const before = f.ledger.exportAll();
  assert.throws(() => f.topup(String(MAX_UNITS)), /exceeds/);
  assert.deepEqual(f.ledger.exportAll(), before);
  for (const value of [1, '1.1', '-1', '01', '1e6', String(MAX_UNITS + 1n)]) assert.throws(() => f.topup(value));
});

test('split rounding assigns the exact remainder to next round and the published config cannot be edited', t => {
  const f = fixture(t); f.topup('10');
  f.exec({ ...opening('round-2', '3'), prizeBps: 3333, operationsBps: 3333 });
  f.reserve('a2', 'alice', 'round-2'); f.start('a2'); f.settle('locked', 'a2');
  assert.equal(f.balance('treasury:next'), '3');
  assert.throws(() => f.exec({ ...opening('round-2'), configuration: 'changed' }));
  assert.equal(f.ledger.snapshot().rounds[0].configuration, 'public-simulation-v1');
});

test('restart preserves money, open reservations, processing state and idempotency', async t => {
  const root = resolve(tmpdir()); const dir = await mkdtemp(join(root, 'vault-ledger-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'ledger.sqlite');
  const first = createLedger({ path });
  first.execute('round', opening());
  first.execute('topup', { type: 'topup', player: 'alice', amount: '1000' });
  first.execute('reserve', { type: 'reserve', player: 'alice', roundId: 'round-1', attemptId: 'a1' });
  first.execute('start', { type: 'start', attemptId: 'a1' });
  const before = first.exportAll(); first.close();
  const second = createLedger({ path });
  assert.deepEqual(second.exportAll(), before);
  assert.equal(second.execute('topup', { type: 'topup', player: 'alice', amount: '1000' }).replayed, true);
  second.close();
});

test('two connections serialize reservations against the same player balance', async t => {
  const root = resolve(tmpdir()); const dir = await mkdtemp(join(root, 'vault-connections-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'ledger.sqlite');
  const a = createLedger({ path }); const b = createLedger({ path });
  try {
    a.execute('round', opening()); a.execute('deposit', { type: 'topup', player: 'alice', amount: '100' });
    a.execute('a', { type: 'reserve', roundId: 'round-1', attemptId: 'a', player: 'alice' });
    assert.throws(() => b.execute('b', { type: 'reserve', roundId: 'round-1', attemptId: 'b', player: 'alice' }), /Insufficient/);
    assert.equal(b.audit().custody, '100');
    assert.equal(b.snapshot().attempts.length, 1);
  } finally { a.close(); b.close(); }
});

test('all events remain exportable after the recent-activity window', t => {
  const f = fixture(t);
  for (let i = 1; i <= 80; i++) f.topup(String(i));
  assert.equal(f.ledger.snapshot().events.length, 60);
  assert.equal(f.ledger.exportAll().events.length, 81);
  assert.equal(f.balance('custody'), '3240');
  assert.equal(f.ledger.exportAll().realFundsEnabled, false);
});
