import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { depositFlowFixture, depositInput, transferReceipt } from '../test/fixtures/deposit-flow.mjs';
import { address, hash, input, completion } from '../test/fixtures/account-game.mjs';
import { createDepositMonitor } from '../server/economy/deposit-monitor.mjs';
import { createAuthenticatedCreditGame } from '../server/economy/authenticated-game.mjs';
import { verifyAssetLedgerExport } from './verify-asset-ledger.mjs';

// Isolated fixture only: no live endpoints, private paths or credentials accepted.
export async function depositMonitorDrill() {
  const g = await depositFlowFixture(), f = g.f, checkpoints = [];
  let now = Date.now(), monitor, game;
  const policy = { batchSize: 1, intervalMs: 1000, maxAgeMs: 30000 };
  const openMonitor = () => createDepositMonitor({ economy: f.economy, reader: g.reader, policy, now: () => now });
  try {
    g.control.receipts = {};
    for (const [name, wallet, tx] of [['alice', address('2'), hash('a')], ['bob', address('4'), hash('c')]]) {
      const prepared = await g.deposits.prepare(f.headers(name), depositInput('monitor-funding', wallet));
      await g.deposits.submit(f.headers(name), prepared.order.id, { transactionHash: tx });
      g.control.receipts[tx] = transferReceipt(tx, wallet);
    }
    g.control.head = '0x66'; monitor = openMonitor();
    const snapshot = stage => checkpoints.push({ stage, monitoring: monitor.status(), accounting: f.economy.state().audit });
    snapshot('before-monitor'); assert.equal(monitor.status().fresh, false);
    await monitor.runBatch(); snapshot('first-batch'); assert.equal(monitor.status().fresh, false);
    await monitor.close(); g.restart(); monitor = openMonitor();
    assert.equal(monitor.status().checkedInSweep, 1);
    await monitor.runBatch(); snapshot('resumed-second-batch'); assert.equal(monitor.status().fresh, true);
    assert.equal(f.economy.state().audit.custody, '2000');
    game = createAuthenticatedCreditGame({ path: f.jobsPath.replace('jobs.sqlite', 'monitored-game.sqlite'), economy: f.economy,
      vault: f.vault, authentication: f.authentication, limits: f.limits, depositMonitor: monitor });
    f.controls.transport = body => { now += 30001; return completion(body.model); };
    await assert.rejects(game.attempt(f.headers(), input('monitor-expiry')), e => e.code === 'DEPOSIT_MONITOR_UNREADY');
    assert.equal((await game.result(f.headers(), 'monitor-expiry')).status, 'inferred');
    assert.equal((await game.account(f.headers())).reserved, '100'); snapshot('response-saved-checks-stale');
    await monitor.runBatch(); await monitor.runBatch();
    const result = await game.reconcile(f.headers(), 'monitor-expiry');
    assert.equal(result.accounting.prizeContribution, '70'); assert.equal(f.calls.length, 1);
    snapshot('settled-without-repeating-inference');
    g.control.fail = true; await monitor.runBatch(); await monitor.runBatch();
    assert.equal((await game.account(f.headers())).spendingPaused, true);
    assert.equal(f.economy.state().audit.custody, '2000'); snapshot('rpc-outage-balances-preserved');
    g.control.fail = false; await monitor.runBatch(); await monitor.runBatch();
    assert.equal(monitor.status().fresh, true); snapshot('evidence-restored');
    const ledger = f.economy.export(), audit = verifyAssetLedgerExport(ledger);
    assert.equal(audit.custodyBaseUnits, '2000');
    return { createdAt: new Date().toISOString(), status: 'passed', mode: 'isolated-periodic-deposit-monitor', policy,
      externalNetworkCalls: 0, paidInferenceCalls: 0, realWalletSignatures: 0, realFunds: false,
      fixtureRpcCalls: g.calls.length, fixtureInferenceCalls: f.calls.length, cursorSurvivedRestart: true,
      responseRecoveredWithoutResampling: true, checkpoints, receipt: result.receipt, ledger, audit,
      limits: 'Synthetic RPC and model replies. The optional monitor shares its lease and write guards with the asset ledger but is not wired into the normal server. No production scheduler, chain finality, custody or independent authority is proved.' };
  } finally { game?.close(); await monitor?.close(); await g.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('This drill accepts no endpoints, paths, keys or live user data.');
  try {
    const report = await depositMonitorDrill(), output = fileURLToPath(new URL('../output/', import.meta.url));
    await mkdir(output, { recursive: true }); await writeFile(resolve(output, 'deposit-monitor-drill.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, receipt: { id: report.receipt.id, decision: report.receipt.decision },
      ledger: { eventCount: report.ledger.eventCount, audit: report.ledger.audit } }, null, 2));
  } catch (error) { console.error('Deposit monitor drill failed: ' + error.message); process.exitCode = 1; }
}
