import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger } from '../server/economy/ledger.mjs';
import { paidBetaTerms, paidBetaPricePolicy, addCalendarMonths } from '../server/economy/paid-beta-policy.mjs';

function fixture(t, now = () => '2026-09-16T00:00:00.000Z') {
  const ledger = createLedger({ now });
  t.after(() => ledger.close());
  let seq = 0;
  const exec = request => ledger.execute(`paid-${++seq}`, request);
  const balance = account => ledger.snapshot().balances.find(row => row.account === account)?.amount ?? '0';
  const terms = paidBetaTerms();
  const prices = paidBetaPricePolicy(0);
  exec({
    type: 'open-round', roundId: 'haiku-v1', price: prices.basePrice, prizeBps: terms.prizeBps,
    operationsBps: terms.operationsBps, winRetainBps: terms.winRetainBps, priceStep: prices.stepPrice,
    maximumPrice: prices.maximumPrice, durationMonths: 5, configuration: 'paid-beta:anthropic/claude-haiku-4.5:v1'
  });
  return { ledger, exec, balance, prices };
}

test('a paid-beta attempt splits 70/30 and raises the next global price', t => {
  const f = fixture(t);
  f.exec({ type: 'topup', player: 'alice', amount: '100' });
  f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  f.exec({ type: 'start', attemptId: 'a1' });
  const settled = f.exec({ type: 'settle', attemptId: 'a1', outcome: 'locked', receiptRef: 'r1' });
  assert.equal(settled.prizeContribution, '3');
  assert.equal(settled.operations, '2');
  assert.equal(settled.nextRound, '0');
  assert.equal(f.balance('round:haiku-v1:prize'), '3');
  assert.equal(f.balance('treasury:operations'), '2');
  assert.equal(f.balance('treasury:next'), '0');
  assert.equal(f.ledger.snapshot().rounds.find(row => row.id === 'haiku-v1').price, '6');
});

test('a technical error restores credits and does not raise the price', t => {
  const f = fixture(t);
  f.exec({ type: 'topup', player: 'alice', amount: '100' });
  f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  f.exec({ type: 'start', attemptId: 'a1' });
  f.exec({ type: 'settle', attemptId: 'a1', outcome: 'error', receiptRef: 'e1' });
  assert.equal(f.ledger.snapshot().rounds.find(row => row.id === 'haiku-v1').price, '5');
  assert.equal(f.balance('player:alice:available'), '100');
});

test('a win pays 75% of the bounty, keeps 25% continuity and retires that configuration', t => {
  const f = fixture(t);
  f.exec({ type: 'topup', player: 'alice', amount: '100' });
  f.exec({ type: 'contribution', roundId: 'haiku-v1', source: 'seed', amount: '500', received: true });
  f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  f.exec({ type: 'start', attemptId: 'a1' });
  const won = f.exec({ type: 'settle', attemptId: 'a1', outcome: 'released', receiptRef: 'win' });
  assert.equal(f.balance('round:haiku-v1:prize'), '0');
  assert.equal(won.winnerPayable, '378');
  assert.equal(won.continuityRetained, '125');
  assert.equal(f.balance('round:haiku-v1:payable'), '378');
  assert.equal(f.balance('treasury:next'), '125');
  assert.throws(() => f.exec({
    type: 'open-round', roundId: 'haiku-v1-reopen', price: '5', prizeBps: 7000, operationsBps: 3000,
    configuration: 'paid-beta:anthropic/claude-haiku-4.5:v1'
  }), /retired/);
});

test('retirement follows the guardian key, not a new round document hash', t => {
  const ledger = createLedger({ now: () => '2026-09-16T00:00:00.000Z' });
  t.after(() => ledger.close());
  let seq = 0;
  const exec = request => ledger.execute(`rk-${++seq}`, request);
  exec({
    type: 'open-round', roundId: 'haiku-v1', price: '5', prizeBps: 7000, operationsBps: 3000,
    winRetainBps: 2500, configuration: 'manifest-hash-a', retireKey: 'guardian:anthropic/claude-haiku-4.5'
  });
  exec({ type: 'topup', player: 'alice', amount: '100' });
  exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  exec({ type: 'start', attemptId: 'a1' });
  exec({ type: 'settle', attemptId: 'a1', outcome: 'released', receiptRef: 'win' });
  assert.throws(() => exec({
    type: 'open-round', roundId: 'haiku-v2', price: '5', prizeBps: 7000, operationsBps: 3000,
    winRetainBps: 2500, configuration: 'manifest-hash-b', retireKey: 'guardian:anthropic/claude-haiku-4.5'
  }), /retired/);
  exec({
    type: 'open-round', roundId: 'gemini-v1', price: '5', prizeBps: 7000, operationsBps: 3000,
    winRetainBps: 2500, configuration: 'manifest-hash-c', retireKey: 'guardian:google/gemini-2.5-flash'
  });
});

test('beating an easy guardian does not empty a harder guardian’s pot', t => {
  const f = fixture(t);
  f.exec({
    type: 'open-round', roundId: 'qwen-v1', price: '5', prizeBps: 7000, operationsBps: 3000,
    winRetainBps: 2500, configuration: 'paid-beta:qwen/qwen3.5-9b:v1'
  });
  f.exec({ type: 'topup', player: 'alice', amount: '100' });
  f.exec({ type: 'contribution', roundId: 'haiku-v1', source: 'seed', amount: '500', received: true });
  f.exec({ type: 'contribution', roundId: 'qwen-v1', source: 'seed', amount: '50', received: true });
  f.exec({ type: 'reserve', roundId: 'qwen-v1', attemptId: 'q1', player: 'alice' });
  f.exec({ type: 'start', attemptId: 'q1' });
  f.exec({ type: 'settle', attemptId: 'q1', outcome: 'released', receiptRef: 'qwin' });
  assert.equal(f.balance('round:haiku-v1:prize'), '500');
  assert.equal(f.balance('round:qwen-v1:prize'), '0');
  assert.equal(f.ledger.snapshot().rounds.find(row => row.id === 'qwen-v1').state, 'won');
  assert.equal(f.ledger.snapshot().rounds.find(row => row.id === 'haiku-v1').state, 'open');
});

test('expiry after five months refunds player bounty and returns seed without inventing holders', t => {
  let now = '2026-09-16T00:00:00.000Z';
  const f = fixture(t, () => now);
  f.exec({ type: 'topup', player: 'alice', amount: '100' });
  f.exec({ type: 'topup', player: 'bob', amount: '100' });
  f.exec({ type: 'contribution', roundId: 'haiku-v1', source: 'seed', amount: '500', received: true });
  f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  f.exec({ type: 'start', attemptId: 'a1' });
  f.exec({ type: 'settle', attemptId: 'a1', outcome: 'locked', receiptRef: 'a' });
  f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'b1', player: 'bob' });
  f.exec({ type: 'start', attemptId: 'b1' });
  f.exec({ type: 'settle', attemptId: 'b1', outcome: 'locked', receiptRef: 'b' });
  assert.throws(() => f.exec({ type: 'expire-round', roundId: 'haiku-v1' }), /not expired/);
  now = addCalendarMonths('2026-09-16T00:00:00.000Z', 5);
  const expired = f.exec({ type: 'expire-round', roundId: 'haiku-v1' });
  assert.equal(expired.seedReturn, '500');
  assert.equal(f.balance('round:haiku-v1:prize'), '0');
  assert.equal(f.balance('player:alice:available'), '98');
  assert.equal(f.balance('player:bob:available'), '98');
  assert.equal(f.balance('treasury:operations'), '4');
  assert.equal(f.ledger.snapshot().rounds.find(row => row.id === 'haiku-v1').state, 'expired');
});

test('after five months new paid play stops; unused credits stay; operating surplus stays in operations', t => {
  let now = '2026-09-16T00:00:00.000Z';
  const f = fixture(t, () => now);
  f.exec({ type: 'topup', player: 'alice', amount: '100' });
  f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a1', player: 'alice' });
  f.exec({ type: 'start', attemptId: 'a1' });
  now = addCalendarMonths('2026-09-16T00:00:00.000Z', 5);
  const inFlight = f.exec({ type: 'settle', attemptId: 'a1', outcome: 'locked', receiptRef: 'late' });
  assert.equal(inFlight.prizeContribution, '3');
  assert.equal(inFlight.operations, '2');
  assert.equal(f.balance('player:alice:available'), '95');
  assert.equal(f.balance('treasury:operations'), '2');
  assert.throws(() => f.exec({ type: 'reserve', roundId: 'haiku-v1', attemptId: 'a2', player: 'alice' }), /expir/i);
  assert.throws(() => f.exec({
    type: 'contribution', roundId: 'haiku-v1', source: 'seed', amount: '500', received: true
  }), /expir/i);
  assert.equal(f.balance('player:alice:available'), '95');
  assert.equal(f.balance('treasury:operations'), '2');
  const expired = f.exec({ type: 'expire-round', roundId: 'haiku-v1' });
  assert.equal(expired.state, 'expired');
  assert.equal(f.balance('player:alice:available'), '98');
  assert.equal(f.balance('treasury:operations'), '2');
});
