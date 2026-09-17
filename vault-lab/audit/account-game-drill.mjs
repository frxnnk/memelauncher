import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { input, completion, address, hash } from '../test/fixtures/account-game.mjs';
import { depositFlowFixture, depositInput, transferReceipt } from '../test/fixtures/deposit-flow.mjs';
import { DEFAULT_GUARDIANS } from '../server/rounds.mjs';

// Reuse the isolated fixture factory: generated JWT signing keys, synthetic chain
// evidence and intercepted provider requests. No live endpoint/path/key is accepted.
export async function accountGameDrill() {
  const deposits = await depositFlowFixture(), f = deposits.f;
  try {
    const depositPreparations = [];
    for (const [name, wallet, tx] of [['alice', address('2'), hash('a')], ['bob', address('4'), hash('c')]]) {
      deposits.control.head = '0x63'; deposits.control.receipt = null;
      const prepared = await deposits.deposits.prepare(f.headers(name), depositInput('funding', wallet));
      depositPreparations.push(prepared); assert.equal(prepared.transfer.signingEnabled, false);
      await deposits.deposits.submit(f.headers(name), prepared.order.id, { transactionHash: tx });
      deposits.restart();
      assert.equal((await deposits.deposits.list(f.headers(name))).deposits[0].order.submittedTransactionHash, tx);
      assert.equal((await deposits.deposits.check(f.headers(name), prepared.order.id)).verification.reason, 'receipt-not-found');
      deposits.control.receipt = transferReceipt(tx, wallet); deposits.control.head = '0x66';
      assert.equal((await deposits.deposits.check(f.headers(name), prepared.order.id)).order.credited, true);
    }
    const receipts = [], checkpoints = [];
    const checkpoint = async stage => {
      const alice = await f.game.account(f.headers()), bob = await f.game.account(f.headers('bob'));
      checkpoints.push({ stage, aliceAvailable: alice.available, aliceReserved: alice.reserved, bobAvailable: bob.available,
        custody: f.economy.state().audit.custody, usageUnresolved: f.limits.status(f.alice.accountId).unresolved });
    };
    receipts.push((await f.game.attempt(f.headers(), input('same-key'))).receipt);
    await assert.rejects(f.game.result(f.headers('bob'), 'same-key'), e => e.code === 'MODEL_JOB_NOT_FOUND');
    receipts.push((await f.game.attempt(f.headers('bob'), { ...input('same-key', address('4')), modelId: DEFAULT_GUARDIANS[1] })).receipt);
    assert.notEqual(receipts[0].id, receipts[1].id);
    assert.equal((await f.game.attempt(f.headers(), input('same-key'))).replayed, true);
    assert.equal(f.calls.length, 2); await checkpoint('two-private-accounts-one-bounty');

    f.limits.settle = () => { throw new Error('Fixture interrupted usage write'); };
    const interrupted = { ...input('third-model'), modelId: DEFAULT_GUARDIANS[2] };
    await assert.rejects(f.game.attempt(f.headers(), interrupted), e => e.code === 'USAGE_UNRECONCILED');
    assert.equal((await f.game.result(f.headers(), 'third-model')).status, 'inferred');
    const savedId = f.vault.receiptHistory(f.alice.accountId).records[0].id;
    const saved = f.vault.receipt(f.alice.accountId, savedId).record;
    await checkpoint('response-saved-usage-and-credits-pending');
    f.restart();
    await assert.rejects(f.game.reconcile(f.headers(), 'third-model'), e => e.code === 'USAGE_UNRECONCILED');
    f.limits.reconcile(saved);
    receipts.push((await f.game.reconcile(f.headers(), 'third-model')).receipt);
    assert.equal(f.calls.length, 3); await checkpoint('recovered-without-another-inference');

    f.controls.transport = body => completion(body.model, 'release_prize');
    const won = await f.game.attempt(f.headers(), input('winning-response'));
    receipts.push(won.receipt);
    assert.equal(won.accounting.winnerRecipient, address('2')); assert.equal(won.accounting.winnerPayable, '280');
    assert.equal((await f.game.result(f.headers('alice', [address('9')]), 'winning-response')).accounting.winnerRecipient, address('2'));
    assert.equal(won.accounting.chainTransaction, null); assert.equal(won.accounting.realFunds, false);
    await checkpoint('winner-bound-to-original-wallet-no-transfer');
    assert.equal(checkpoints.at(-1).aliceAvailable, '700'); assert.equal(checkpoints.at(-1).bobAvailable, '900');
    assert.equal(f.calls.length, 4);
    return { createdAt: new Date().toISOString(), status: 'passed', mode: 'isolated-authenticated-credit-preparation',
      externalNetworkCalls: 0, paidInferenceCalls: 0, realWalletSignatures: 0, realFunds: false,
      authentication: 'Official Privy verifier with generated fixture ES256 access/identity tokens; no real Privy app.',
      fixtureInferenceCalls: f.calls.length, selectedGuardians: [...new Set(f.calls.map(call => call.model))],
      fixtureRpcCalls: deposits.calls.length, submittedWalletHashSurvivedRestart: true, depositPreparations,
      sameRequestKeyIsolatedByOwner: true, fixedWinnerWalletSurvivedIdentityChange: true,
      completedResponseSurvivedUsageFailureAndRestart: true, checkpoints, receipts, ledger: f.economy.export(),
      limits: 'The core services ran with synthetic funds and intercepted model responses. No model resistance, real wallet, public HTTP credit flow, TEE/escrow or payout was verified.' };
  } finally { await f.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('This drill accepts no endpoints, paths, keys or live user data.');
  try {
    const report = await accountGameDrill(), output = fileURLToPath(new URL('../output/', import.meta.url));
    await mkdir(output, { recursive: true }); await writeFile(resolve(output, 'account-game-drill.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, receipts: report.receipts.map(receipt => ({ id: receipt.id, decision: receipt.decision, accounting: receipt.accounting })),
      ledger: { eventCount: report.ledger.eventCount, audit: report.ledger.audit } }, null, 2));
  } catch (error) { console.error('Account game drill failed: ' + error.message); process.exitCode = 1; }
}
