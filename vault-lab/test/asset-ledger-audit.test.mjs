import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync, readFileSync, truncateSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { accountGameFixture, input, completion, address } from './fixtures/account-game.mjs';
import { verifyAssetLedgerExport, run } from '../audit/verify-asset-ledger.mjs';
import { verifyLedgerExport } from '../audit/verify-ledger.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
async function fixture({ win = false } = {}) {
  const f = await accountGameFixture();
  try {
    f.deposit(); if (win) f.controls.transport = body => completion(body.model, 'release_prize');
    await f.game.attempt(f.headers(), input()); return clone(f.economy.export());
  } finally { await f.close(); }
}

test('a JSON asset export reproduces raw deposits, fixed recipient, frozen terms and every balance offline', async () => {
  const snapshot = await fixture({ win: true }), original = JSON.stringify(snapshot), originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('The offline audit must not access a network.'); };
  try {
    const report = verifyAssetLedgerExport(snapshot);
    assert.equal(report.status, 'internally-consistent'); assert.equal(report.depositsChecked, 1);
    assert.equal(report.eventsChecked, snapshot.eventCount); assert.equal(report.custodyBaseUnits, '1000');
    assert.equal(report.reportedHoldTimelineReplayed, true); assert.equal(report.independentExecutionProof, false);
    assert.equal(report.externalNetworkCalls, 0); assert.equal(report.roundManifestsChecked, 1);
    assert.equal(JSON.stringify(snapshot), original);
    assert.throws(() => verifyLedgerExport(snapshot), /TEST simulation ledger only/);
  } finally { globalThis.fetch = originalFetch; }
});

test('editing reported amounts, RPC logs, asset identity, recipients, hashes or results fails replay', async () => {
  const source = await fixture({ win: true });
  const changes = [
    snapshot => { snapshot.balances.find(row => row.account === 'custody').amount = '2000'; },
    snapshot => { snapshot.depositRecords.evidence[0].amount = '2000'; },
    snapshot => { snapshot.depositRecords.evidence[0].rpcEvidence.receipt.logs[0].topics[2] = '0x' + '0'.repeat(24) + address('9').slice(2); },
    snapshot => { snapshot.asset.destination = address('9'); },
    snapshot => { snapshot.unit.decimals = 0; },
    snapshot => { snapshot.assetHash = '0'.repeat(64); },
    snapshot => { snapshot.attempts[0].recipient = address('9'); },
    snapshot => { snapshot.events.at(-1).result.winnerRecipient = address('9'); },
    snapshot => { snapshot.events[1].requestHash = '0'.repeat(64); },
    snapshot => { snapshot.events.at(-1).result.prizeContribution = '99'; },
    snapshot => { snapshot.depositRecords.orders[0].accounting.received = '2000'; }
  ];
  for (const change of changes) { const snapshot = clone(source); change(snapshot); assert.throws(() => verifyAssetLedgerExport(snapshot)); }
});

test('missing or duplicated events, evidence, initial checks and incomplete legacy records are rejected', async () => {
  const source = await fixture();
  for (const change of [
    snapshot => { snapshot.events.pop(); snapshot.eventCount--; },
    snapshot => { snapshot.events[1].key = snapshot.events[0].key; },
    snapshot => { snapshot.depositRecords.evidence = []; },
    snapshot => { snapshot.depositRecords.evidence.push(clone(snapshot.depositRecords.evidence[0])); },
    snapshot => { snapshot.depositRecords.orders.push(clone(snapshot.depositRecords.orders[0])); },
    snapshot => { snapshot.depositRecords.checks = []; },
    snapshot => { snapshot.depositRecords.formatVersion = 'deposit-records-v1'; },
    snapshot => { snapshot.depositRecords.checks[0].ledger_sequence = null; },
    snapshot => { delete snapshot.depositRecords.orders[0].attachedAt; },
    snapshot => { snapshot.depositRecords.orders[0].attachedAt = snapshot.depositRecords.orders[0].expiresAt + 1; }
  ]) { const snapshot = clone(source); change(snapshot); assert.throws(() => verifyAssetLedgerExport(snapshot)); }
});

test('an otherwise balanced export cannot spend after its own recorded deposit hold', async () => {
  const source = await fixture(), orderId = source.depositRecords.orders[0].id;
  source.depositRecords.checks.push({ sequence: 2, order_id: orderId, status: 'rpc-unavailable',
    checked_at: source.depositRecords.checks[0].checked_at, ledger_sequence: source.depositRecords.checks[0].ledger_sequence });
  assert.throws(() => verifyAssetLedgerExport(source), /reconciliation is required before spending/);
  const moved = await fixture(); moved.depositRecords.checks[0].ledger_sequence++;
  assert.throws(() => verifyAssetLedgerExport(moved), /initial credit lacks/);
});

test('actual pending orders and hold-clear-hold transitions replay at their accounting positions', async t => {
  const f = await accountGameFixture(); t.after(f.close); const deposit = f.deposit();
  f.economy.ledger.deposits.markUnavailable(deposit.order.id, f.alice); deposit.reconcile();
  await f.game.attempt(f.headers(), input());
  f.economy.ledger.execute('queued', { type: 'reserve', roundId: 'r1', player: f.alice.accountId, attemptId: 'queued', recipient: address('2') });
  f.economy.ledger.deposits.markUnavailable(deposit.order.id, f.alice);
  const order = f.economy.ledger.deposits.create({ key: 'uncredited', owner: address('4'), minimumReceived: '200' }, f.bob, { chainHead: '0x63' });
  f.economy.ledger.deposits.attach(order.id, f.bob, { transactionHash: '0x' + 'c'.repeat(64), logIndex: '0x0' });
  f.economy.ledger.deposits.reconcile(order.id, f.bob, { chainId: '0x539', receipt: null });
  const source = clone(f.economy.export()), report = verifyAssetLedgerExport(source);
  assert.equal(report.depositsChecked, 1); assert.equal(report.observationsChecked, 5);
  assert.equal(source.depositHolds.length, 1); assert.equal(report.custodyBaseUnits, '1000');
});

test('manifest substitution, missing manifests, price mismatch or unbound guardian profiles are rejected', async () => {
  const source = await fixture();
  for (const change of [
    snapshot => { snapshot.roundManifests = []; },
    snapshot => { snapshot.roundManifests[0].manifest.configuration.rules.systemPrompt = 'replacement'; },
    snapshot => {
      const entry = snapshot.roundManifests[0]; entry.manifest.configuration.price = '50';
      entry.hash = createHash('sha256').update(JSON.stringify(entry.manifest)).digest('hex'); snapshot.rounds[0].configuration = entry.hash;
    },
    snapshot => {
      const entry = snapshot.roundManifests[0]; entry.manifest.configuration.guardians[0].configuration = {};
      entry.hash = createHash('sha256').update(JSON.stringify(entry.manifest)).digest('hex'); snapshot.rounds[0].configuration = entry.hash;
    }
  ]) { const snapshot = clone(source); change(snapshot); assert.throws(() => verifyAssetLedgerExport(snapshot)); }
});

test('legacy observation migration preserves missing anchors instead of assigning them a guessed event', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit();
  const path = resolve(f.jobsPath, '..', 'credits.sqlite'), db = new DatabaseSync(path);
  db.exec(`ALTER TABLE deposit_checks RENAME TO prior_checks;
    CREATE TABLE deposit_checks(sequence INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, status TEXT NOT NULL, checked_at INTEGER NOT NULL);
    INSERT INTO deposit_checks SELECT sequence,order_id,status,checked_at FROM prior_checks;
    DROP TABLE prior_checks;`); db.close();
  f.restart(); const snapshot = clone(f.economy.export());
  assert.equal(snapshot.depositRecords.formatVersion, 'deposit-records-v1');
  assert.equal(snapshot.depositRecords.checks[0].ledger_sequence, null);
  assert.throws(() => verifyAssetLedgerExport(snapshot), /missing historical positions cannot be invented/);
});

test('offline replay keeps 15-minute orders and accepts the two-hour testnet paid-beta lifetime on Robinhood testnet', async () => {
  const source = await fixture();
  source.depositRecords.orders[0].expiresAt = source.depositRecords.orders[0].createdAt + 2 * 60 * 60000;
  assert.throws(() => verifyAssetLedgerExport(source), /configuration differs/);
  const f = await accountGameFixture({
    asset: {
      chainId: '46630', tokenAddress: address('1'), destination: address('3'), decimals: 18,
      minimumConfirmations: 3, standardTransferVerified: true
    },
    unsignedLifetimeMs: 2 * 60 * 60000
  });
  try {
    f.deposit();
    const snapshot = clone(f.economy.export());
    assert.equal(snapshot.depositRecords.orders[0].expiresAt - snapshot.depositRecords.orders[0].createdAt, 2 * 60 * 60000);
    const report = verifyAssetLedgerExport(snapshot);
    assert.equal(report.status, 'internally-consistent');
    assert.equal(report.depositsChecked, 1);
  } finally { await f.close(); }
});

test('CLI hashes a bounded source file without modifying it and makes wrapper selection explicit', async () => {
  const snapshot = await fixture(), root = resolve(tmpdir()), directory = mkdtempSync(join(root, 'vault-audit-cli-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  try {
    const path = join(directory, 'report.json'), raw = JSON.stringify({ ledger: snapshot }); writeFileSync(path, raw);
    let output; const report = run(['--report', path], value => { output = value; });
    assert.equal(report.fileSha256, createHash('sha256').update(raw).digest('hex'));
    assert.equal(JSON.parse(output).inputFormat, 'report-wrapper'); assert.equal(readFileSync(path, 'utf8'), raw);
    assert.throws(() => run([path], () => {}), /complete asset preparation export/);
    assert.throws(() => run([], () => {}), /Usage/); assert.throws(() => run([directory], () => {}), /regular JSON/);
    const large = join(directory, 'oversize.json'); writeFileSync(large, ''); truncateSync(large, 65 * 1024 * 1024);
    assert.throws(() => run([large], () => {}), /64 MiB/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
