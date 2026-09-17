import test from 'node:test';
import assert from 'node:assert/strict';
import { concurrencyDrill } from '../audit/concurrency-drill.mjs';

test('public HTTP burst never multiplies inference; disconnect and foreign-session rejection preserve accounting', { timeout:15000 }, async () => {
  const report = await concurrencyDrill();
  assert.equal(report.result, 'passed');
  assert.equal(report.realInferenceCalls, 0);
  assert.equal(report.peakSyntheticInferenceConcurrency, 1);
  assert.equal(report.syntheticInferenceCalls, 2);
  assert.equal(report.finalUsage.pending, 0);
  assert.equal(report.finalUsage.unknown, 0);
});
