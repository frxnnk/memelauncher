import test from 'node:test';
import assert from 'node:assert/strict';
import { walletAttemptPrice, operatingCoverage } from '../server/economy/public-pricing.mjs';
import { splitAttemptPrice } from '../server/economy/schema.mjs';

const policy = { basePrice: '5000000', stepPrice: '1000000', maximumPrice: '20000000' };
const terms = { price: '5000000', prizeBps: 7000, operationsBps: 2000 };
const costs = { inferenceAndConversion: '500000', executionGas: '100000', errorAllowance: '100000' };

test('wallet price starts at five and rises with completed attempts to a fixed cap', () => {
  assert.deepEqual([0, 1, 2, 14, 15, 16, 1000000].map(n => walletAttemptPrice(policy, n)),
    ['5000000', '6000000', '7000000', '19000000', '20000000', '20000000', '20000000']);
});
test('pricing rejects invalid state rather than silently resetting the counter', () => {
  for (const count of [-1, 1.5, NaN, Infinity, '1', undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => walletAttemptPrice(policy, count));
  }
  for (const bad of [{ ...policy, basePrice: '0' }, { ...policy, maximumPrice: '4999999' },
    { ...policy, stepPrice: '-1' }, { ...policy, stepPrice: '01' }]) {
    assert.throws(() => walletAttemptPrice(bad, 0));
  }
});
test('pricing stays exact above JS number precision and supports a fixed price', () => {
  assert.equal(walletAttemptPrice({ basePrice: '9007199254740993', stepPrice: '3',
    maximumPrice: '9007199254741993' }, 2), '9007199254740999');
  assert.equal(walletAttemptPrice({ ...policy, stepPrice: '0' }, 200), '5000000');
});
test('the price ceiling includes every declared operating cost, not the whole user payment', () => {
  assert.deepEqual(operatingCoverage(terms, costs), { covered: true, operatingAllocation: '1000000',
    required: '700000', surplus: '300000', deficit: '0' });
  const result = operatingCoverage(terms, { ...costs, inferenceAndConversion: '1000000' });
  assert.equal(result.covered, false);
  assert.equal(result.deficit, '200000');
  assert.equal(result.surplus, '0');
});
test('coverage accepts an exact bound and rejects unknown cost inputs', () => {
  assert.equal(operatingCoverage(terms, { ...costs, inferenceAndConversion: '800000' }).covered, true);
  assert.throws(() => operatingCoverage(terms, { ...costs, executionGas: undefined }));
  assert.throws(() => operatingCoverage(terms, { ...costs, executionGas: '-1' }));
  assert.throws(() => operatingCoverage(terms, { ...costs, ignoredFee: '99999' }));
});
test('shared split preserves integer rounding and assigns all remainder to continuity', () => {
  assert.deepEqual(splitAttemptPrice({ ...terms, price: '1' }), { prize: '0', operations: '0', nextRound: '1' });
  assert.deepEqual(splitAttemptPrice(terms), { prize: '3500000', operations: '1000000', nextRound: '500000' });
  assert.throws(() => splitAttemptPrice({ ...terms, operationsBps: 4000 }));
});
