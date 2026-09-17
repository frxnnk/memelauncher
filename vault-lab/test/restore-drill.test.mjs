import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreDrill } from '../audit/restore-drill.mjs';

test('stopped-writer backup restores ledger, jobs, private session and pending usage without replay charges', async () => {
  const result = await restoreDrill();
  assert.equal(result.status, 'passed');
  assert.equal(result.databaseChecks.length, 5);
  assert.equal(result.betaAdmissionRestored, true);
  assert.equal(result.betaRevocationRestored, true);
  assert.equal(result.betaPauseRestored, true);
  assert.equal(result.fixtureInferenceCalls, 4);
  assert.equal(result.realInferenceCalls, 0);
  assert.equal(result.realUserDataCopied, false);
});
