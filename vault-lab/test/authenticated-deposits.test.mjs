import test from 'node:test';
import assert from 'node:assert/strict';
import { depositFlowFixture, depositInput, transferReceipt } from './fixtures/deposit-flow.mjs';
import { asset, address, hash, input } from './fixtures/account-game.mjs';
import { createDepositOrders } from '../server/economy/deposit-orders.mjs';
import { prepareDepositTransfer } from '../server/economy/deposit-transfer.mjs';
import { verifyAssetLedgerExport } from '../audit/verify-asset-ledger.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createLedger } from '../server/economy/ledger.mjs';

test('authenticated preparation fixes chain, sender, token, recipient and exact ABI amount without signing', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g;
  const prepared = await g.deposits.prepare(f.headers(), depositInput());
  assert.equal(g.calls.length, 2); const { transaction } = prepared.transfer;
  assert.deepEqual(transaction, { chainId: '0x539', from: address('2'), to: address('1'), value: '0x0',
    data: '0xa9059cbb' + '0000000000000000000000003333333333333333333333333333333333333333' +
      '00000000000000000000000000000000000000000000000000000000000003e8' });
  assert.equal(prepared.transfer.paymentsEnabled, false); assert.equal(prepared.transfer.signingEnabled, false);
  assert.equal(prepared.transfer.nativeGasFeeAdditional, true); assert.equal(prepared.order.credited, false);
  const large = String((1n << 200n) + 17n), big = await g.deposits.prepare(f.headers(), depositInput('big', address('2'), large));
  assert.equal(BigInt('0x' + big.transfer.transaction.data.slice(-64)).toString(), large);
  const before = g.calls.length;
  for (const extra of [{ amountBaseUnits: 1000 }, { amountBaseUnits: '1.5' }, { amountBaseUnits: '0' }, { amountBaseUnits: String(1n << 256n) },
    { wallet: address('4') }, { chainId: '1' }, { destination: address('9') }, { asset }, { receipt: {} }, { player: f.bob.accountId }, { key: '../x' }]) {
    await assert.rejects(g.deposits.prepare(f.headers(), { ...depositInput('invalid'), ...extra }));
  }
  await assert.rejects(g.deposits.prepare({}, depositInput()), e => e.code === 'AUTH_REQUIRED');
  assert.equal(g.calls.length, before); assert.equal((await g.deposits.list(f.headers())).deposits.length, 2);
  assert.equal(f.calls.length, 0);
});

test('a saved wallet hash survives restart, pending receipt and confirmations; retries credit once and fund an attempt', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g;
  const concurrent = await Promise.all(Array.from({ length: 5 }, () => g.deposits.prepare(f.headers(), depositInput())));
  assert.equal(new Set(concurrent.map(result => result.order.id)).size, 1);
  const orderId = concurrent[0].order.id, before = g.calls.length;
  g.control.fail = true;
  assert.equal((await g.deposits.prepare(f.headers(), depositInput())).order.id, orderId); assert.equal(g.calls.length, before);
  await assert.rejects(g.deposits.prepare(f.headers(), depositInput('deposit', address('2'), '999')), e => e.code === 'DEPOSIT_KEY_CONFLICT');
  const submitted = await g.deposits.submit(f.headers(), orderId, { transactionHash: hash('a') });
  assert.equal(submitted.order.state, 'awaiting-receipt'); assert.equal(submitted.transfer.transaction, null);
  assert.equal(g.calls.length, before); g.restart();
  assert.equal((await g.deposits.list(f.headers())).deposits[0].order.submittedTransactionHash, hash('a'));
  await assert.rejects(g.deposits.check(f.headers(), orderId), e => e.code === 'DEPOSIT_RPC_UNAVAILABLE');
  g.control.fail = false;
  assert.equal((await g.deposits.check(f.headers(), orderId)).verification.reason, 'receipt-not-found');
  assert.equal(verifyAssetLedgerExport(f.economy.export()).depositsChecked, 0);
  g.control.receipt = transferReceipt(); g.control.head = '0x65';
  const pending = await g.deposits.check(f.headers(), orderId); assert.equal(pending.verification.reason, 'confirmations');
  assert.equal(pending.order.logIndex, '0x0'); assert.equal((await f.game.account(f.headers())).available, '0');
  g.control.head = '0x66'; const credited = await g.deposits.check(f.headers(), orderId);
  assert.equal(credited.verification.firstEvidence, true); assert.equal(credited.order.credited, true);
  g.restart(); assert.equal((await g.deposits.check(f.headers(), orderId)).verification.firstEvidence, false);
  assert.equal((await f.game.account(f.headers())).available, '1000');
  assert.equal((await f.game.attempt(f.headers(), input())).accounting.prizeContribution, '70');
  assert.equal(verifyAssetLedgerExport(f.economy.export()).custodyBaseUnits, '1000');
});

test('deposit history is private, paginated and readable after wallet changes without suggesting a new transfer', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g;
  for (let index = 0; index < 23; index++) await g.deposits.prepare(f.headers(), depositInput('page-' + index));
  const other = (await g.deposits.prepare(f.headers('bob'), depositInput('other', address('4')))).order;
  const before = g.calls.length, first = await g.deposits.list(f.headers());
  const second = await g.deposits.list(f.headers(), { before: first.nextCursor });
  assert.equal(first.deposits.length, 20); assert.equal(second.deposits.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.deposits, ...second.deposits].map(row => row.order.id)).size, 23);
  assert.ok(!JSON.stringify(first).includes(f.bob.accountId)); assert.ok(!JSON.stringify(first).includes(other.id));
  for (const orderId of [other.id, 'missing']) {
    for (const action of [() => g.deposits.get(f.headers(), orderId), () => g.deposits.list(f.headers(), { before: orderId }),
      () => g.deposits.check(f.headers(), orderId), () => g.deposits.submit(f.headers(), orderId, { transactionHash: hash('a') })]) {
      await assert.rejects(action(), e => e.code === 'DEPOSIT_NOT_FOUND' && e.status === 404);
    }
  }
  await assert.rejects(g.deposits.list(f.headers(), { owner: f.bob.accountId }), e => e.code === 'INVALID_DEPOSIT_INPUT');
  const own = first.deposits[0].order.id;
  const changed = await g.deposits.get(f.headers('alice', [address('9')]), own);
  assert.equal(changed.transfer.transaction, null); assert.equal(changed.transfer.reason, 'wallet-not-currently-verified');
  assert.equal(g.calls.length, before);
  g.restart(); assert.equal((await g.deposits.list(f.headers())).deposits[0].order.id, own);
});

test('browser evidence, transaction substitutions and unrelated or ambiguous RPC logs cannot issue credit', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g;
  const { order } = await g.deposits.prepare(f.headers(), depositInput());
  for (const extra of [{ logIndex: '0x0' }, { receipt: transferReceipt() }, { chainId: '1337' }, { amount: '1000' }]) {
    await assert.rejects(g.deposits.submit(f.headers(), order.id, { transactionHash: hash('a'), ...extra }), e => e.code === 'INVALID_DEPOSIT_INPUT');
  }
  await g.deposits.submit(f.headers(), order.id, { transactionHash: hash('a') });
  await assert.rejects(g.deposits.submit(f.headers(), order.id, { transactionHash: hash('c') }), /replaced/);
  g.control.head = '0x66';
  for (const mutate of [r => { r.transactionHash = hash('c'); }, r => { r.status = '0x0'; }, r => { r.logs[0].address = address('9'); },
    r => { r.logs[0].data = '0x' + '0'.repeat(63) + '1'; }, r => { r.logs[0].topics[1] = '0x' + address('4').slice(2).padStart(64, '0'); },
    r => { r.logs[0].removed = true; }, r => { r.logs.push({ ...r.logs[0], logIndex: '0x1' }); }, r => { r.logs = []; }]) {
    g.control.receipt = transferReceipt(); mutate(g.control.receipt);
    await assert.rejects(g.deposits.check(f.headers(), order.id), e => e.code === 'DEPOSIT_REVIEW_REQUIRED');
    assert.equal((await f.game.account(f.headers())).available, '0');
    assert.equal((await g.deposits.get(f.headers(), order.id)).order.transactionHash, undefined);
  }
  g.control.receipt = transferReceipt(); assert.equal((await g.deposits.check(f.headers(), order.id)).order.credited, true);
});

test('expiry blocks a new submission while an accepted hash can confirm later and cannot be replaced', () => {
  let now = 1000;
  const account = { authenticated: true, accountId: 'player_expiry', walletOwnershipVerified: true, wallets: [{ address: address('2'), chainType: 'ethereum' }] };
  const orders = createDepositOrders({ asset, now: () => now });
  try {
    const order = orders.create({ key: 'first', owner: address('2'), minimumReceived: '1000' }, account, { chainHead: '0x63' });
    const expired = orders.create({ key: 'late', owner: address('2'), minimumReceived: '1000' }, account, { chainHead: '0x63' });
    now = order.expiresAt; orders.submit(order.id, account, hash('a')); now++;
    assert.throws(() => orders.submit(expired.id, account, hash('c')), /expired/);
    assert.equal(prepareDepositTransfer(expired, account, now).transaction, null);
    assert.throws(() => orders.attach(order.id, account, { transactionHash: hash('c'), logIndex: '0x0' }), /replaced/);
    orders.submit(order.id, account, hash('a'));
    const attached = orders.attach(order.id, account, { transactionHash: hash('a'), logIndex: '0x0' });
    assert.ok(attached.attachedAt > attached.expiresAt); assert.equal(attached.submittedAt, order.expiresAt);
    assert.equal(orders.reconcile(order.id, account, { chainId: '0x539', receipt: transferReceipt(),
      canonicalBlock: { number: '0x64', hash: hash('b') }, headBlockNumber: '0x66' }).status, 'verified-rpc-evidence');
  } finally { orders.close(); }
});

test('concurrent checks coalesce and an unavailable credited receipt preserves credits while blocking play', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g;
  const { order } = await g.deposits.prepare(f.headers(), depositInput());
  await g.deposits.submit(f.headers(), order.id, { transactionHash: hash('a') }); g.control.receipt = transferReceipt(); g.control.head = '0x66';
  let release; g.control.gate = new Promise(resolve => { release = resolve; });
  let authenticated = 0, allAuthenticated;
  const arrived = new Promise(resolve => { allAuthenticated = resolve; }), originalAuthenticate = f.authentication.authenticate;
  f.authentication.authenticate = async headers => {
    const account = await originalAuthenticate(headers); if (++authenticated === 8) allAuthenticated(); return account;
  };
  const before = g.calls.length, promises = Array.from({ length: 8 }, () => g.deposits.check(f.headers(), order.id));
  await arrived; await new Promise(resolve => setImmediate(resolve)); release();
  const results = await Promise.all(promises); delete g.control.gate;
  f.authentication.authenticate = originalAuthenticate;
  assert.equal(g.calls.length - before, 4); assert.ok(results.every(row => row.order.credited));
  g.control.fail = true;
  await assert.rejects(g.deposits.check(f.headers(), order.id), e => e.code === 'DEPOSIT_RPC_UNAVAILABLE');
  assert.equal((await f.game.account(f.headers())).available, '1000'); assert.equal((await f.game.account(f.headers())).spendingPaused, true);
  await assert.rejects(f.game.attempt(f.headers(), input()), e => e.code === 'CREDIT_RESERVATION_REJECTED');
  assert.equal(f.calls.length, 0); g.restart(); g.control.fail = false;
  await g.deposits.check(f.headers(), order.id); assert.equal((await f.game.account(f.headers())).spendingPaused, false);
  const previousChecks = f.economy.export().depositRecords.checks.length;
  g.control.block = { number: '0x64', hash: hash('c') };
  await assert.rejects(g.deposits.check(f.headers(), order.id), e => e.code === 'DEPOSIT_REVIEW_REQUIRED');
  assert.equal(f.economy.export().depositRecords.checks.length, previousChecks + 1);
  assert.equal(verifyAssetLedgerExport(f.economy.export()).depositsChecked, 1);
});

test('bounded concurrent RPC checks reject overflow before transport and recover after a slot finishes', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g, ids = [];
  for (let index = 0; index < 5; index++) {
    const { order } = await g.deposits.prepare(f.headers(), depositInput('busy-' + index));
    await g.deposits.submit(f.headers(), order.id, { transactionHash: hash('a') }); ids.push(order.id);
  }
  let release, arrived; const waiting = new Promise(resolve => { arrived = resolve; });
  g.control.gate = new Promise(resolve => { release = resolve; });
  const original = f.authentication.authenticate; let authenticated = 0;
  f.authentication.authenticate = async headers => { const account = await original(headers); if (++authenticated === 4) arrived(); return account; };
  const before = g.calls.length, pending = ids.slice(0, 4).map(orderId => g.deposits.check(f.headers(), orderId));
  await waiting; await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(g.deposits.check(f.headers(), ids[4]), e => e.code === 'DEPOSIT_CHECK_BUSY');
  assert.equal(g.calls.length - before, 4); release(); await Promise.all(pending); delete g.control.gate;
  f.authentication.authenticate = original;
  assert.equal((await g.deposits.check(f.headers(), ids[4])).verification.reason, 'receipt-not-found');
});

test('offline replay rejects inconsistent submission history and a v3 ledger upgrades without rewriting old orders', async t => {
  const g = await depositFlowFixture(); t.after(g.close); const { f } = g;
  const { order } = await g.deposits.prepare(f.headers(), depositInput());
  await g.deposits.submit(f.headers(), order.id, { transactionHash: hash('a') });
  g.control.receipt = transferReceipt(); g.control.head = '0x66'; await g.deposits.check(f.headers(), order.id);
  const snapshot = JSON.parse(JSON.stringify(f.economy.export()));
  for (const change of [o => { o.submittedTransactionHash = hash('c'); }, o => { delete o.submittedAt; },
    o => { o.submittedAt = o.createdAt - 1; }, o => { o.submittedAt = o.expiresAt + 1; }, o => { o.attachedAt = o.submittedAt - 1; }]) {
    const changed = structuredClone(snapshot); change(changed.depositRecords.orders[0]);
    assert.throws(() => verifyAssetLedgerExport(changed));
  }
  const path = f.jobsPath.replace('jobs.sqlite', 'credits.sqlite');
  // A stopped-writer fixture models a legacy database; actual records stay untouched.
  f.economy.close(); f.economy.close = () => {};
  const db = new DatabaseSync(path); db.exec('PRAGMA user_version=3'); db.close();
  const migrated = createLedger({ path, asset });
  try { assert.deepEqual(JSON.parse(JSON.stringify(migrated.exportAll().depositRecords)), snapshot.depositRecords); }
  finally { migrated.close(); }
  const inspected = new DatabaseSync(path); assert.equal(inspected.prepare('PRAGMA user_version').get().user_version, 6); inspected.close();
});
