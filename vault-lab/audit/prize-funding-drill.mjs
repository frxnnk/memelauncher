import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { depositFlowFixture, depositInput, transferReceipt } from '../test/fixtures/deposit-flow.mjs';
import { hash, address, input, completion } from '../test/fixtures/account-game.mjs';
import { createDepositMonitor } from '../server/economy/deposit-monitor.mjs';
import { verifyAssetLedgerExport } from './verify-asset-ledger.mjs';

// Synthetic authenticated accounts, RPC and model replies only. No live inputs.
export async function prizeFundingDrill() {
  const g = await depositFlowFixture(), f = g.f, checkpoints = [];
  let monitor;
  const balance = account => f.economy.state().balances.find(row => row.account === account)?.amount ?? '0';
  const record = stage => checkpoints.push({ stage, custody: balance('custody'), reserve: balance('treasury:next'),
    roundPrize: balance('round:r1:prize'), prizePayable: balance('round:r1:payable'),
    sponsorCredits: f.economy.account(f.bob).available, playerCredits: f.economy.account(f.alice).available,
    depositHolds: f.economy.state().depositHolds });
  try {
    const sponsor = (await g.deposits.preparePrizeFunding(f.headers('bob'),
      { ...depositInput('sponsor', address('4'), '5000'), source: 'sponsor' })).order;
    const player = (await g.deposits.prepare(f.headers(), depositInput('credits'))).order;
    await g.deposits.submit(f.headers('bob'), sponsor.id, { transactionHash: hash('a') });
    await g.deposits.submit(f.headers(), player.id, { transactionHash: hash('c') });
    g.control.receipts = { [hash('a')]: transferReceipt(hash('a'), address('4'), '5000'),
      [hash('c')]: transferReceipt(hash('c')) };
    g.control.head = '0x66';
    monitor = createDepositMonitor({ economy: f.economy, reader: g.reader,
      policy: { batchSize: 10, intervalMs: 1000, maxAgeMs: 30000 } });
    await monitor.runBatch(); record('confirmed-funding-and-player-topup');
    assert.equal(balance('treasury:next'), '5000'); assert.equal(f.economy.account(f.bob).available, '0');
    await monitor.close(); monitor = null; g.restart(); record('restarted');
    g.control.receipts[hash('a')] = null;
    await g.deposits.check(f.headers('bob'), sponsor.id); record('contribution-evidence-missing');
    const assign = () => f.economy.ledger.execute('seed-r1', { type: 'seed-next-round', roundId: 'r1', amount: '5000' });
    assert.throws(assign, /reconciliation/);
    g.control.receipts[hash('a')] = transferReceipt(hash('a'), address('4'), '5000');
    await g.deposits.check(f.headers('bob'), sponsor.id); assign(); record('reserve-assigned-to-round');
    f.controls.transport = body => completion(body.model, 'release_prize');
    const result = await f.game.attempt(f.headers(), input('funded-prize'));
    record('winning-liability-recorded-no-payout');
    assert.equal(balance('round:r1:payable'), '5070'); assert.equal(balance('treasury:next'), '10');
    assert.equal(balance('treasury:operations'), '20'); assert.equal(f.economy.account(f.alice).available, '900');
    assert.equal(f.calls.length, 1);
    const ledger = f.economy.export(), audit = verifyAssetLedgerExport(ledger);
    assert.equal(audit.custodyBaseUnits, '6000');
    return { createdAt: new Date().toISOString(), status: 'passed', mode: 'isolated-prize-reserve-contribution',
      externalNetworkCalls: 0, paidInferenceCalls: 0, realWalletSignatures: 0, realFunds: false,
      fixtureRpcCalls: g.calls.length, fixtureInferenceCalls: f.calls.length, checkpoints, receipt: result.receipt, ledger, audit,
      limits: 'Synthetic base units and replies, not actual token holdings. Source is a declared purpose, not sponsor affiliation or verified creator fees. Reserve allocation is an operator recording; independent prize authority and transfers are not implemented.' };
  } finally { await monitor?.close(); await g.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('This drill accepts no endpoints, paths, keys or live user data.');
  try {
    const report = await prizeFundingDrill(), output = fileURLToPath(new URL('../output/', import.meta.url));
    await mkdir(output, { recursive: true }); await writeFile(resolve(output, 'prize-funding-drill.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, receipt: { id: report.receipt.id, decision: report.receipt.decision },
      ledger: { eventCount: report.ledger.eventCount, audit: report.ledger.audit } }, null, 2));
  } catch (error) { console.error('Prize funding drill failed: ' + error.message); process.exitCode = 1; }
}
