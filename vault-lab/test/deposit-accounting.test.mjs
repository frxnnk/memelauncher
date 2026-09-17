import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createLedger } from '../server/economy/ledger.mjs';
import { createDepositOrders } from '../server/economy/deposit-orders.mjs';
import { reconcileDepositFromRpc } from '../server/economy/deposit-rpc.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { MAX_UNITS } from '../server/economy/schema.mjs';

const address = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
const asset = { chainId: '1337', tokenAddress: address('1'), destination: address('3'), decimals: 18,
  minimumConfirmations: 3, standardTransferVerified: true };
const identity = (name = 'alice', wallet = '2') => ({ authenticated: true, accountId: 'player_' + name,
  walletOwnershipVerified: true, wallets: [{ address: address(wallet), chainType: 'ethereum' }] });
const opening = { type: 'open-round', roundId: 'r1', price: '100', prizeBps: 7000, operationsBps: 2000, configuration: 'fixture-rules' };
const balance = (ledger, account) => ledger.snapshot().balances.find(row => row.account === account)?.amount ?? '0';
function intent(ledger, key = 'one', principal = identity(), amount = '1000', tx = 'a') {
  const owner = principal.wallets[0].address;
  const order = ledger.deposits.create({ key, owner, minimumReceived: amount }, principal, { chainHead: '0x63' });
  const transfer = { transactionHash: hash(tx), logIndex: '0x0' };
  ledger.deposits.attach(order.id, principal, transfer);
  const log = { ...transfer, address: asset.tokenAddress, blockHash: hash('b'), blockNumber: '0x64', removed: false,
    topics: [TRANSFER_TOPIC, '0x' + '0'.repeat(24) + owner.slice(2), '0x' + '0'.repeat(24) + asset.destination.slice(2)],
    data: '0x' + BigInt(amount).toString(16).padStart(64, '0') };
  const evidence = { chainId: '0x539', headBlockNumber: '0x66', canonicalBlock: { hash: hash('b'), number: '0x64' },
    receipt: { ...transfer, status: '0x1', blockHash: hash('b'), blockNumber: '0x64', logs: [log] } };
  return { order, evidence, principal, reconcile: () => ledger.deposits.reconcile(order.id, principal, evidence) };
}
async function temporary() {
  const root = resolve(tmpdir()), dir = await mkdtemp(join(root, 'vault-credit-accounting-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  return { path: join(dir, 'credits.sqlite'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('only confirmed evidence credits its owner, at exact integer received units; no public money capability', t => {
  const ledger = createLedger({ asset }); t.after(ledger.close);
  const a = intent(ledger, 'large', identity(), String(1n << 100n));
  a.evidence.receipt.logs[0].data = '0x' + ((1n << 100n) + 7n).toString(16).padStart(64, '0');
  const pending = structuredClone(a.evidence); pending.headBlockNumber = '0x65';
  assert.equal(ledger.deposits.reconcile(a.order.id, a.principal, pending).credited, false);
  assert.equal(ledger.snapshot().eventCount, 0);
  assert.throws(() => ledger.deposits.reconcile(a.order.id, identity('bob', '4'), a.evidence), /not found/);
  const posted = a.reconcile();
  assert.equal(posted.credited, true); assert.equal(posted.realFundsEnabled, false);
  assert.equal(posted.accounting.received, String((1n << 100n) + 7n));
  assert.equal(balance(ledger, 'player:player_alice:available'), posted.accounting.received);
  assert.equal(balance(ledger, 'player:player_bob:available'), '0');
  assert.equal(balance(ledger, 'round:r1:prize'), '0');
  assert.equal(ledger.snapshot().unit.creditBaseUnitsPerReceivedUnit, '1');
  assert.equal(ledger.snapshot().events[0].request.assetHash, ledger.snapshot().assetHash);
  assert.deepEqual(ledger.exportAll().depositRecords.evidence[0].rpcEvidence, a.evidence);
  assert.equal(ledger.audit().balanced, true);
  for (const type of ['topup', 'refund-credits', 'contribution', 'payout']) {
    assert.throws(() => ledger.execute(type, { type }), /disabled/);
  }
  assert.throws(() => ledger.execute('forge', { type: 'verified-deposit' }), /Invalid accounting/);
});

test('an event-write failure rolls back deposit evidence, both balances and order state together', async t => {
  const { path, cleanup } = await temporary(), ledger = createLedger({ path, asset });
  const db = new DatabaseSync(path); t.after(() => { db.close(); ledger.close(); return cleanup(); });
  const a = intent(ledger);
  db.exec("CREATE TRIGGER fixture_disk_failure BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'fixture storage failure'); END");
  assert.throws(a.reconcile, /fixture storage failure/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM deposit_evidence').get().n, 0);
  assert.equal(ledger.snapshot().eventCount, 0); assert.equal(balance(ledger, 'custody'), '0');
  assert.equal(ledger.deposits.get(a.order.id, a.principal).state, 'awaiting-evidence');
  assert.equal(ledger.deposits.get(a.order.id, a.principal).credited, false);
  db.exec('DROP TRIGGER fixture_disk_failure');
  assert.equal(a.reconcile().credited, true); assert.equal(a.reconcile().firstEvidence, false);
  assert.equal(balance(ledger, 'custody'), '1000'); assert.equal(ledger.snapshot().eventCount, 1);
});

test('restarting after commit and duplicate orders/connections cannot mint the same transfer twice', async t => {
  const { path, cleanup } = await temporary(); let ledger = createLedger({ path, asset });
  let other; t.after(() => { other?.close(); ledger.close(); return cleanup(); });
  const a = intent(ledger); const posted = a.reconcile(); ledger.close(); ledger = createLedger({ path, asset });
  other = createLedger({ path, asset });
  const later = structuredClone(a.evidence); later.headBlockNumber = '0x99';
  assert.equal(other.deposits.reconcile(a.order.id, a.principal, later).accounting.eventSequence, posted.accounting.eventSequence);
  assert.equal(ledger.deposits.reconcile(a.order.id, a.principal, later).firstEvidence, false);
  const duplicate = intent(other, 'duplicate');
  assert.throws(duplicate.reconcile, /already claimed/);
  assert.equal(ledger.snapshot().eventCount, 1); assert.equal(balance(ledger, 'custody'), '1000');
  assert.equal(other.deposits.get(a.order.id, a.principal).credited, true);
  const inspected = new DatabaseSync(path);
  assert.equal(inspected.prepare('PRAGMA user_version').get().user_version, 6); inspected.close();
});

test('failure after updating the credited order still rolls back every accounting write', async t => {
  const { path, cleanup } = await temporary(), ledger = createLedger({ path, asset });
  const db = new DatabaseSync(path); t.after(() => { db.close(); ledger.close(); return cleanup(); });
  const a = intent(ledger);
  db.exec("CREATE TRIGGER fixture_last_write BEFORE INSERT ON deposit_checks WHEN NEW.status='credit-verified' BEGIN SELECT RAISE(ABORT, 'fixture final write'); END");
  assert.throws(a.reconcile, /fixture final write/);
  assert.equal(ledger.deposits.get(a.order.id, a.principal).credited, false);
  assert.equal(ledger.snapshot().eventCount, 0); assert.equal(balance(ledger, 'custody'), '0');
  assert.equal(ledger.exportAll().depositRecords.evidence.length, 0);
  assert.equal(ledger.exportAll().depositRecords.checks.length, 0);
  db.exec('DROP TRIGGER fixture_last_write');
  assert.equal(a.reconcile().accounting.eventSequence, 1);
});

test('TEST and token denominations cannot be converted or reopened with changed asset policies', async t => {
  const { path, cleanup } = await temporary(); t.after(cleanup); let ledger = createLedger({ path });
  ledger.execute('test', { type: 'topup', player: 'alice', amount: '1000' }); ledger.close();
  assert.throws(() => createLedger({ path, asset }), /frozen/);
  ledger = createLedger({ path }); assert.equal(balance(ledger, 'custody'), '1000'); ledger.close();
  const tokenPath = path + '.token'; ledger = createLedger({ path: tokenPath, asset }); ledger.close();
  assert.throws(() => createDepositOrders({ path: tokenPath, asset }), /owning ledger/);
  assert.throws(() => createLedger({ path: tokenPath }), /frozen/);
  for (const changed of [{ tokenAddress: address('5') }, { destination: address('6') }, { minimumConfirmations: 1 }, { decimals: 0 }]) {
    assert.throws(() => createLedger({ path: tokenPath, asset: { ...asset, ...changed } }), /frozen/);
  }
  const legacyPath = path + '.legacy', old = new DatabaseSync(legacyPath);
  old.exec('CREATE TABLE balances(account TEXT PRIMARY KEY,amount TEXT); INSERT INTO balances VALUES (\'custody\',\'0\')'); old.close();
  assert.throws(() => createLedger({ path: legacyPath, asset }), /cannot be converted/);
});

test('deposits fund per-user attempts; errors refund, valid responses allocate and a win becomes payable only', t => {
  const ledger = createLedger({ asset }); t.after(ledger.close);
  intent(ledger).reconcile(); intent(ledger, 'bob', identity('bob', '4'), '200', 'c').reconcile();
  let sequence = 0; const execute = request => ledger.execute('flow-' + ++sequence, request);
  execute(opening);
  for (const [attemptId, outcome] of [['a1', 'locked'], ['a2', 'error'], ['a3', 'released']]) {
    execute({ type: 'reserve', player: 'player_alice', roundId: 'r1', attemptId, recipient: address('2') });
    execute({ type: 'start', attemptId });
    if (outcome === 'released') execute({ type: 'reserve', player: 'player_bob', roundId: 'r1', attemptId: 'b1', recipient: address('4') });
    execute({ type: 'settle', attemptId, outcome, receiptRef: 'fixture-' + attemptId });
  }
  assert.equal(balance(ledger, 'player:player_alice:available'), '800');
  assert.equal(balance(ledger, 'player:player_bob:available'), '200');
  assert.equal(balance(ledger, 'round:r1:payable'), '140');
  assert.equal(balance(ledger, 'round:r1:prize'), '0');
  assert.equal(balance(ledger, 'treasury:operations'), '40'); assert.equal(balance(ledger, 'treasury:next'), '20');
  assert.equal(ledger.audit().custody, '1200'); assert.equal(ledger.snapshot().rounds[0].winner, 'player_alice');
  assert.throws(() => execute({ type: 'payout', roundId: 'r1' }), /disabled/);
  assert.equal(ledger.snapshot().rounds[0].state, 'won');
});

test('a reorg or unavailable credited evidence durably holds spending without erasing the owner claim', async t => {
  const { path, cleanup } = await temporary(); let ledger = createLedger({ path, asset });
  t.after(() => { ledger.close(); return cleanup(); });
  const a = intent(ledger); a.reconcile(); ledger.execute('round', opening);
  ledger.execute('reserved', { type: 'reserve', player: 'player_alice', roundId: 'r1', attemptId: 'a0', recipient: address('2') });
  const reorg = structuredClone(a.evidence); reorg.canonicalBlock.hash = hash('c');
  assert.throws(() => ledger.deposits.reconcile(a.order.id, a.principal, reorg), /canonical/);
  ledger.close(); ledger = createLedger({ path, asset });
  assert.deepEqual(ledger.snapshot().depositHolds, [a.order.id]);
  assert.throws(() => ledger.execute('blocked', { type: 'start', attemptId: 'a0' }), /reconciliation/);
  ledger.execute('cancel', { type: 'cancel-reservation', attemptId: 'a0' });
  assert.equal(balance(ledger, 'player:player_alice:available'), '1000');
  const changed = structuredClone(a.evidence); changed.receipt.logs[0].data = '0x' + (1001n).toString(16).padStart(64, '0');
  assert.throws(() => ledger.deposits.reconcile(a.order.id, a.principal, changed), /changed/);
  assert.equal(ledger.snapshot().depositHolds.length, 1);
  ledger.deposits.reconcile(a.order.id, a.principal, a.evidence);
  assert.deepEqual(ledger.snapshot().depositHolds, []);
  await assert.rejects(reconcileDepositFromRpc({ orders: ledger.deposits, orderId: a.order.id, principal: a.principal,
    reader: { evidence: async () => { throw new Error('RPC unavailable'); } } }), /unavailable/);
  assert.equal(ledger.snapshot().depositHolds.length, 1);
  const pending = ledger.deposits.reconcile(a.order.id, a.principal, { chainId: '0x539', receipt: null });
  assert.equal(pending.credited, true); assert.equal(pending.accountingHold, true);
  assert.equal(balance(ledger, 'custody'), '1000');
  assert.equal(ledger.snapshot().events.filter(e => e.request.type === 'verified-deposit').length, 1);
  assert.deepEqual(ledger.exportAll().depositRecords.checks.map(check => check.status),
    ['credit-verified', 'reconciliation-error', 'reconciliation-error', 'credit-verified', 'rpc-unavailable', 'credited-evidence-pending']);
});

test('custody overflow cannot consume new deposit evidence or leave an unbalanced credit', t => {
  const ledger = createLedger({ asset }); t.after(ledger.close);
  intent(ledger, 'max', identity(), String(MAX_UNITS)).reconcile();
  const extra = intent(ledger, 'overflow', identity('bob', '4'), '1', 'c');
  assert.throws(extra.reconcile, /exceeds/);
  assert.equal(ledger.deposits.get(extra.order.id, extra.principal).credited, false);
  assert.equal(balance(ledger, 'player:player_bob:available'), '0');
  assert.equal(ledger.snapshot().eventCount, 1); assert.equal(ledger.audit().custody, String(MAX_UNITS));
});

test('migrating a v2 asset ledger cannot invent the missing recipient of an existing attempt', async t => {
  const { path, cleanup } = await temporary(); let ledger = createLedger({ path, asset });
  t.after(() => { ledger.close(); return cleanup(); }); intent(ledger).reconcile();
  ledger.execute('round', opening);
  ledger.execute('reserve', { type: 'reserve', roundId: 'r1', attemptId: 'legacy', player: 'player_alice', recipient: address('2') });
  ledger.execute('start', { type: 'start', attemptId: 'legacy' }); ledger.close();
  const old = new DatabaseSync(path); old.exec('DROP TABLE attempt_recipients; PRAGMA user_version=2'); old.close();
  ledger = createLedger({ path, asset });
  assert.equal(ledger.snapshot().attempts[0].recipient, null);
  assert.throws(() => ledger.execute('win', { type: 'settle', attemptId: 'legacy', outcome: 'released', receiptRef: 'fixture-win' }), /legacy asset attempt/);
  assert.equal(balance(ledger, 'player:player_alice:reserved'), '100');
  ledger.execute('error', { type: 'settle', attemptId: 'legacy', outcome: 'error', receiptRef: 'fixture-error' });
  assert.equal(balance(ledger, 'player:player_alice:available'), '1000');
});
