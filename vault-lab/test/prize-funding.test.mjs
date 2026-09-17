import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { depositFlowFixture, depositInput, transferReceipt } from './fixtures/deposit-flow.mjs';
import { address, hash, input, completion } from './fixtures/account-game.mjs';
import { createCreditHistory } from '../server/economy/credit-history.mjs';
import { createDepositMonitor } from '../server/economy/deposit-monitor.mjs';
import { verifyAssetLedgerExport } from '../audit/verify-asset-ledger.mjs';

const funding = (key = 'seed', source = 'seed') => ({ ...depositInput(key), source });
const balance = (f, account) => f.economy.state().balances.find(row => row.account === account)?.amount ?? '0';
async function setup(t) { const g = await depositFlowFixture(); t.after(g.close); return g; }
async function submit(g, order, transactionHash = hash('a')) {
  await g.deposits.submit(g.f.headers(), order.id, { transactionHash });
  g.control.receipt = transferReceipt(transactionHash); g.control.head = '0x66';
}

test('confirmed contributions survive restart and monitor replay without issuing player credits or double-counting a top-up', async t => {
  const g = await setup(t), f = g.f;
  const { order } = await g.deposits.preparePrizeFunding(f.headers(), funding('sponsor', 'sponsor'));
  const duplicate = (await g.deposits.prepare(f.headers(), depositInput('topup'))).order;
  await submit(g, order); g.control.head = '0x65';
  assert.equal((await g.deposits.check(f.headers(), order.id)).order.credited, false);
  assert.equal(balance(f, 'custody'), '0');
  g.control.head = '0x66';
  const posted = (await g.deposits.check(f.headers(), order.id)).order;
  assert.equal(posted.state, 'funding-recorded'); assert.equal(posted.accounting.playerCredits, '0');
  assert.equal(balance(f, 'treasury:next'), '1000'); assert.equal(f.economy.account(f.alice).available, '0');
  g.restart();
  const monitor = createDepositMonitor({ economy: f.economy, reader: g.reader, policy: { batchSize: 10, intervalMs: 1000, maxAgeMs: 30000 } });
  try { await monitor.runBatch(); assert.equal(monitor.status().fresh, true); } finally { await monitor.close(); }
  await g.deposits.submit(f.headers(), duplicate.id, { transactionHash: hash('a') });
  await assert.rejects(g.deposits.check(f.headers(), duplicate.id), e => e.code === 'DEPOSIT_REVIEW_REQUIRED');
  assert.equal(balance(f, 'custody'), '1000'); assert.equal(balance(f, 'treasury:next'), '1000');
  const history = createCreditHistory({ game: f.game, deposits: g.deposits });
  const record = await history.get(f.headers(), order.id);
  assert.equal(record.purpose, 'prize-reserve'); assert.equal(record.amountCreditedBaseUnits, '0');
  assert.equal(record.amountFundedBaseUnits, '1000'); assert.equal(record.allocation.source, 'sponsor');
  assert.equal((await history.summary(f.headers())).available, '0');
  assert.equal((await history.list(f.headers('bob'))).deposits.length, 0);
  assert.equal(verifyAssetLedgerExport(f.economy.export()).depositsChecked, 1);
});

test('authentication, owned wallet and immutable purpose prevent caller-controlled funding before RPC', async t => {
  const g = await setup(t), f = g.f;
  await assert.rejects(g.deposits.preparePrizeFunding({}, funding()), e => e.status === 401);
  await assert.rejects(g.deposits.preparePrizeFunding(f.headers(), { ...funding(), wallet: address('4') }));
  for (const source of [undefined, 'creator-fees', 'company', null]) {
    await assert.rejects(g.deposits.preparePrizeFunding(f.headers(), { ...funding('bad'), source }), e => e.code === 'INVALID_FUNDING_SOURCE');
  }
  await assert.rejects(g.deposits.preparePrizeFunding(f.headers(), { ...funding(), allocation: { kind: 'player-credits' } }), e => e.code === 'INVALID_DEPOSIT_INPUT');
  await assert.rejects(g.deposits.prepare(f.headers(), funding()), e => e.code === 'INVALID_DEPOSIT_INPUT');
  assert.equal(g.calls.length, 0);
  const prepared = await g.deposits.preparePrizeFunding(f.headers(), funding());
  const count = g.calls.length;
  for (const operation of [() => g.deposits.prepare(f.headers(), depositInput('seed')),
    () => g.deposits.preparePrizeFunding(f.headers(), funding('seed', 'sponsor'))]) {
    await assert.rejects(operation(), e => e.code === 'DEPOSIT_KEY_CONFLICT');
  }
  assert.equal((await g.deposits.preparePrizeFunding(f.headers(), funding())).order.id, prepared.order.id);
  assert.equal(g.calls.length, count);
  assert.throws(() => f.economy.ledger.execute('forged', { type: 'verified-prize-funding', amount: '1000' }), /Invalid accounting/);
});

test('a failed final evidence write rolls back contribution balances, event and order in one transaction', async t => {
  const g = await setup(t), f = g.f;
  const { order } = await g.deposits.preparePrizeFunding(f.headers(), funding()); await submit(g, order);
  const db = new DatabaseSync(f.jobsPath.replace('jobs.sqlite', 'credits.sqlite'));
  try {
    db.exec("CREATE TRIGGER fixture_funding_failure BEFORE INSERT ON deposit_checks WHEN NEW.status='credit-verified' BEGIN SELECT RAISE(ABORT, 'fixture funding write failure'); END");
    await assert.rejects(g.deposits.check(f.headers(), order.id), e => e.code === 'DEPOSIT_REVIEW_REQUIRED');
    assert.equal(balance(f, 'custody'), '0'); assert.equal(balance(f, 'treasury:next'), '0');
    const snapshot = f.economy.export();
    assert.equal(snapshot.events.filter(event => event.request.type === 'verified-prize-funding').length, 0);
    assert.equal(snapshot.depositRecords.evidence.length, 0); assert.equal(snapshot.depositRecords.checks.length, 0);
    assert.equal(snapshot.depositRecords.orders[0].credited, false);
    assert.equal(snapshot.depositRecords.orders[0].accounting, undefined);
    db.exec('DROP TRIGGER fixture_funding_failure');
    await g.deposits.check(f.headers(), order.id);
    assert.equal(balance(f, 'treasury:next'), '1000');
  } finally { db.close(); }
  assert.equal(verifyAssetLedgerExport(f.economy.export()).custodyBaseUnits, '1000');
});

test('offline replay rejects mismatched contribution purpose, source, funder and raw token evidence', async t => {
  const g = await setup(t), f = g.f;
  const { order } = await g.deposits.preparePrizeFunding(f.headers(), funding()); await submit(g, order);
  await g.deposits.check(f.headers(), order.id);
  const snapshot = f.economy.export();
  assert.equal(verifyAssetLedgerExport(snapshot).status, 'internally-consistent');
  for (const change of [data => { delete data.depositRecords.orders[0].allocation; },
    data => { data.depositRecords.orders[0].allocation.source = 'sponsor'; },
    data => { data.events.find(event => event.request.type === 'verified-prize-funding').request.funder = f.bob.accountId; },
    data => { data.depositRecords.evidence[0].rpcEvidence.receipt.logs[0].address = address('5'); }]) {
    const altered = structuredClone(snapshot); change(altered);
    assert.throws(() => verifyAssetLedgerExport(altered));
  }
});

test('a contribution hold blocks seeding; recovered funds can become a prize liability while later donations remain in reserve', async t => {
  const g = await setup(t), f = g.f;
  const { order } = await g.deposits.preparePrizeFunding(f.headers(), funding());
  const late = (await g.deposits.preparePrizeFunding(f.headers(), funding('later', 'sponsor'))).order;
  await submit(g, order); await g.deposits.check(f.headers(), order.id);
  g.control.receipt = null; await g.deposits.check(f.headers(), order.id); g.restart();
  assert.deepEqual(f.economy.state().depositHolds, [order.id]);
  const seed = () => f.economy.ledger.execute('seed-r1', { type: 'seed-next-round', roundId: 'r1', amount: '1000' });
  assert.throws(seed, /reconciliation/); assert.equal(balance(f, 'treasury:next'), '1000');
  g.control.receipt = transferReceipt(); await g.deposits.check(f.headers(), order.id);
  seed(); seed(); // Idempotent allocation cannot move the contribution twice.
  assert.equal(balance(f, 'treasury:next'), '0'); assert.equal(balance(f, 'round:r1:prize'), '1000');
  f.deposit(f.alice, '1000', 'c'); f.controls.transport = body => completion(body.model, 'release_prize');
  await f.game.attempt(f.headers(), input('funded-win'));
  assert.equal(balance(f, 'round:r1:payable'), '1070'); assert.equal(f.economy.account(f.alice).available, '900');
  await submit(g, late, hash('d')); await g.deposits.check(f.headers(), late.id);
  assert.equal(balance(f, 'round:r1:payable'), '1070'); assert.equal(balance(f, 'treasury:next'), '1010');
  assert.throws(() => f.economy.ledger.execute('too-late', { type: 'seed-next-round', roundId: 'r1', amount: '1000' }), /open round/);
  assert.equal(verifyAssetLedgerExport(f.economy.export()).custodyBaseUnits, '3000');
  assert.equal(f.calls.length, 1);
});
