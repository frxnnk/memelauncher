import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAttemptPrice } from '../server/economy/schema.mjs';
import {
  PAID_BETA_MONTHS, PAID_BETA_WIN_RETAIN_BPS,
  paidBetaTerms, paidBetaPricePolicy, paidBetaFundingTerms, applyPaidBetaFundingConfig,
  roundAttemptPrice, splitWinPrize,
  addCalendarMonths, expireDistribution
} from '../server/economy/paid-beta-policy.mjs';

test('when continuity drip is zero, integer remainder stays in operations not the next-round pot', () => {
  assert.deepEqual(splitAttemptPrice({ price: '5', prizeBps: 7000, operationsBps: 3000 }),
    { prize: '3', operations: '2', nextRound: '0' });
});

test('paid beta terms put 70% in bounty, 30% in operations and drip nothing to continuity', () => {
  assert.deepEqual(paidBetaTerms(), { prizeBps: 7000, operationsBps: 3000, nextRoundBps: 0, winRetainBps: 2500 });
  assert.equal(PAID_BETA_WIN_RETAIN_BPS, 2500);
  assert.equal(PAID_BETA_MONTHS, 5);
});

test('the closed-beta price starts at 5, rises globally by 1 per valid attempt and caps at 25', () => {
  const policy = paidBetaPricePolicy(0);
  assert.deepEqual([0, 1, 2, 19, 20, 21, 100].map(n => roundAttemptPrice(policy, n)),
    ['5', '6', '7', '24', '25', '25', '25']);
  const usdg = paidBetaPricePolicy(6);
  assert.equal(roundAttemptPrice(usdg, 0), '5000000');
  assert.equal(roundAttemptPrice(usdg, 3), '8000000');
  assert.equal(roundAttemptPrice(usdg, 30), '25000000');
});

test('errors must not be used as the price counter', () => {
  assert.throws(() => roundAttemptPrice(paidBetaPricePolicy(0), -1));
  assert.throws(() => roundAttemptPrice(paidBetaPricePolicy(0), 1.2));
});

test('a win pays 75% of the announced bounty and keeps 25% as continuity', () => {
  assert.deepEqual(splitWinPrize('570'), { payable: '428', continuity: '142' });
  assert.deepEqual(splitWinPrize('100'), { payable: '75', continuity: '25' });
  assert.deepEqual(splitWinPrize('1'), { payable: '1', continuity: '0' });
  assert.equal(BigInt(splitWinPrize('999').payable) + BigInt(splitWinPrize('999').continuity), 999n);
});

test('five calendar months from opening is the expiry instant', () => {
  assert.equal(addCalendarMonths('2026-09-16T00:00:00.000Z', 5), '2027-02-16T00:00:00.000Z');
});

test('paid-beta funding config fills 70/30 and the 5→25 staircase without rewriting a rehearsal config', () => {
  const rehearsal = { policy: undefined, asset: { decimals: 18 }, terms: { price: '1', prizeBps: 7000, operationsBps: 2000 } };
  assert.equal(applyPaidBetaFundingConfig(rehearsal), rehearsal);
  const filled = applyPaidBetaFundingConfig({ policy: 'paid-beta', asset: { decimals: 18 } });
  assert.deepEqual(filled.terms, paidBetaFundingTerms(18));
  assert.equal(filled.terms.prizeBps, 7000);
  assert.equal(filled.terms.operationsBps, 3000);
  assert.equal(filled.terms.price, '5000000000000000000');
  assert.throws(() => applyPaidBetaFundingConfig({
    policy: 'paid-beta', asset: { decimals: 18 },
    terms: { price: '1', prizeBps: 7000, operationsBps: 2000 }
  }), /paid-beta/);
});

test('expiry returns player-funded bounty pro rata, seed to founder, and does not airdrop to holders', () => {
  const result = expireDistribution({
    prize: '1000',
    seedAmount: '500',
    playerPrizeAmount: '350',
    contributions: [
      { player: 'alice', prizeContribution: '210' },
      { player: 'bob', prizeContribution: '140' }
    ]
  });
  assert.equal(result.playerRefunds.find(row => row.player === 'alice').amount, '210');
  assert.equal(result.playerRefunds.find(row => row.player === 'bob').amount, '140');
  assert.equal(result.seedReturn, '500');
  assert.equal(result.unassigned, '150');
  assert.equal(BigInt(result.playerRefunds[0].amount) + BigInt(result.playerRefunds[1].amount)
    + BigInt(result.seedReturn) + BigInt(result.unassigned), 1000n);
});
