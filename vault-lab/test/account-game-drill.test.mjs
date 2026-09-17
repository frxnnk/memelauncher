import test from 'node:test';
import assert from 'node:assert/strict';
import { accountGameDrill } from '../audit/account-game-drill.mjs';

test('complete account-credit drill links authenticated deposits, three guardians, recovery and a fixed winning wallet', async () => {
  const report = await accountGameDrill();
  assert.equal(report.status, 'passed'); assert.equal(report.fixtureInferenceCalls, 4);
  assert.equal(report.externalNetworkCalls + report.paidInferenceCalls + report.realWalletSignatures, 0);
  assert.equal(report.selectedGuardians.length, 3);
  assert.equal(report.ledger.audit.custody, '2000'); assert.equal(report.ledger.audit.balanced, true);
  assert.equal(report.receipts.at(-1).accounting.winnerPayable, '280');
  assert.equal(report.completedResponseSurvivedUsageFailureAndRestart, true);
  assert.equal(report.submittedWalletHashSurvivedRestart, true); assert.equal(report.fixtureRpcCalls, 16);
  assert.equal(report.depositPreparations.length, 2);
  assert.ok(report.depositPreparations.every(row => row.transfer.signingEnabled === false));
});
