import test from 'node:test';
import assert from 'node:assert/strict';
import { depositDrill } from '../audit/deposit-drill.mjs';

test('isolated RPC-to-credit drill preserves owner balances and holds across a stopped-writer restore', async () => {
  const report = await depositDrill();
  assert.equal(report.status, 'passed');
  assert.equal(report.externalNetworkCalls + report.modelCalls + report.walletSignatures, 0);
  assert.equal(report.recovery.evidenceAndBalancesRestored, true); assert.equal(report.recovery.duplicateCredits, false);
  assert.equal(report.recovery.foreignOwnerQueriedRpc, false);
  assert.equal(report.checkpoints.find(point => point.stage === 'reorg-hold').depositHolds, 1);
  assert.equal(report.ledger.realFundsEnabled, false);
  assert.equal(report.ledger.depositRecords.evidence.length, 2);
  assert.ok(report.checkpoints.every(point => point.balanced));
});
