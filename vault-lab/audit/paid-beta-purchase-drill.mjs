// Local simulation only. Reuses the existing ledger; does not alter live purchase policy.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createLedger } from '../server/economy/ledger.mjs';

function scenario(name, outcomes, { costPerCall = 2, returnAtClosure = false } = {}) {
  const ledger = createLedger();
  let sequence = 0;
  const execute = request => ledger.execute(`drill-${++sequence}`, request);
  const balance = account => BigInt(ledger.snapshot().balances.find(b => b.account === account)?.amount ?? '0');
  let consumed = 0n, prize = 0n, operations = 0n, continuity = 0n, paidPrize = 0n, returned = 0n;
  try {
    execute({ type: 'open-round', roundId: 'pilot', price: '50', prizeBps: 7000,
      operationsBps: 2000, configuration: 'synthetic-terms-not-approved' });
    execute({ type: 'topup', player: 'alice', amount: '1000' });
    execute({ type: 'contribution', roundId: 'pilot', source: 'seed', amount: '25000', received: true });
    assert.equal(balance('treasury:operations'), 0n, 'A purchase is not already operating income');
    for (const [index, outcome] of outcomes.entries()) {
      const attemptId = `attempt-${index}`;
      const before = balance('player:alice:available');
      execute({ type: 'reserve', roundId: 'pilot', attemptId, player: 'alice' });
      execute({ type: 'start', attemptId });
      const result = execute({ type: 'settle', attemptId, outcome, receiptRef: `receipt-${index}` });
      if (outcome === 'error') {
        assert.equal(balance('player:alice:available'), before);
        assert.equal(result.prizeContribution, '0');
      } else {
        consumed += 50n;
        prize += BigInt(result.prizeContribution);
        operations += BigInt(result.operations);
        continuity += BigInt(result.nextRound);
      }
      assert.equal(ledger.audit().balanced, true);
      if (outcome === 'released') {
        paidPrize = BigInt(execute({ type: 'payout', roundId: 'pilot' }).paid);
        assert.equal(paidPrize, 25000n + prize);
        assert.throws(() => execute({ type: 'payout', roundId: 'pilot' }), /unpaid/);
        assert.throws(() => execute({ type: 'reserve', roundId: 'pilot', attemptId: 'extra', player: 'alice' }), /no longer accepts/);
      }
    }
    assert.equal(consumed, prize + operations + continuity);
    const unusedBeforeReturn = balance('player:alice:available');
    assert.equal(unusedBeforeReturn, 1000n - consumed);
    if (returnAtClosure && unusedBeforeReturn > 0n) {
      assert.ok(paidPrize > 0n, 'This drill only returns unused credit after a winning closure');
      execute({ type: 'refund-credits', player: 'alice', amount: String(unusedBeforeReturn) });
      returned = unusedBeforeReturn;
    }
    assert.equal(balance('custody') + paidPrize + returned, 26000n);
    assert.equal(ledger.audit().balanced, true);
    const hypotheticalApiCost = BigInt(costPerCall * outcomes.length);
    return { name, passed: true, purchased: '1000', consumed: String(consumed),
      unusedBeforeReturn: String(unusedBeforeReturn), unusedReturned: String(returned),
      prizeContribution: String(prize), operatingAllocation: String(operations),
      continuity: String(continuity), prizePaid: String(paidPrize),
      hypotheticalApiCost: String(hypotheticalApiCost),
      operatingMarginBeforeOtherCosts: String(operations - hypotheticalApiCost),
      apiCostCoveredByRealizedOperations: operations >= hypotheticalApiCost };
  } finally { ledger.close(); }
}

const scenarios = [
  scenario('partial-use-and-technical-error', ['locked', 'error', 'locked']),
  scenario('all-credit-consumed', Array(20).fill('locked')),
  scenario('first-attempt-wins-and-unused-credit-returned', ['released'], { returnAtClosure: true }),
  scenario('all-technical-errors-require-own-operating-reserve', Array(5).fill('error')),
  scenario('expensive-model-rejects-candidate-margin', Array(20).fill('locked'), { costPerCall: 20 })
];
assert.equal(scenarios[3].apiCostCoveredByRealizedOperations, false);
assert.equal(scenarios[4].apiCostCoveredByRealizedOperations, false);
const report = { checkedAt: new Date().toISOString(), mode: 'local-simulation', realFundsEnabled: false,
  unit: 'synthetic cents, 100 units = 1 illustrative stablecoin unit',
  assumptions: { purchase: '1000', price: '50', seed: '25000', splitBps: [7000, 2000, 1000] },
  limitations: ['No real prices or provider execution', 'No bridge or gas charged in ledger',
    'API costs are hypothetical external comparisons, not transfers', 'No on-chain custody or fair execution proof',
    'No new cash-out restrictions implemented', 'Refund is a simulated ledger operation, not a real transfer'], scenarios };
await mkdir('output/payment-research', { recursive: true });
const path = 'output/payment-research/paid-beta-purchase-drill-20260915.json';
await writeFile(path, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ path, scenarios }, null, 2));
