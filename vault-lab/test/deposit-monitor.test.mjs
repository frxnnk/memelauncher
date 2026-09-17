import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { depositFlowFixture, depositInput, transferReceipt } from './fixtures/deposit-flow.mjs';
import { address, hash, input, completion } from './fixtures/account-game.mjs';
import { createDepositMonitor } from '../server/economy/deposit-monitor.mjs';
import { createAuthenticatedCreditGame } from '../server/economy/authenticated-game.mjs';
import { verifyAssetLedgerExport } from '../audit/verify-asset-ledger.mjs';

async function setup(t, policy = { batchSize: 1, intervalMs: 1000, maxAgeMs: 30000 }) {
  const g = await depositFlowFixture(), monitors = [], closers = []; let now = Date.now();
  const path = g.f.jobsPath.replace('jobs.sqlite', 'credits.sqlite');
  const open = overrides => {
    const monitor = createDepositMonitor({ economy: g.f.economy, reader: g.reader, policy, now: () => now, ...overrides });
    monitors.push(monitor); return monitor;
  };
  t.after(async () => { for (const close of closers) await close(); for (const monitor of monitors) await monitor.close(); await g.close(); });
  const seed = (principal = g.f.alice, tx = 'a') => {
    const result = g.f.deposit(principal, '1000', tx); g.control.receipts ??= {};
    g.control.receipts[hash(tx)] = result.evidence.receipt; g.control.head = '0x66'; return result;
  };
  return { g, open, path, seed, closers, advance(ms) { now += ms; }, setTime(value) { now = value; } };
}

test('deposit worker is opt-in, freezes its binding and stays closed until a complete bounded sweep', async t => {
  const s = await setup(t), { g } = s; s.seed(); s.seed(g.f.bob, 'c');
  await g.deposits.prepare(g.f.headers(), depositInput('unsigned'));
  const before = g.calls.length, monitor = s.open();
  assert.equal(g.calls.length, before); assert.equal(monitor.status().fresh, false);
  assert.throws(() => s.open({ path: ':memory:' }), /shares the asset ledger/);
  assert.throws(monitor.assertFresh, e => e.code === 'DEPOSIT_MONITOR_UNREADY');
  const first = await monitor.runBatch(); assert.equal(first.state, 'checking'); assert.equal(first.checkedInSweep, 1);
  assert.equal(g.calls.length - before, 4);
  const second = await monitor.runBatch(); assert.equal(second.fresh, true); assert.equal(second.lastResult.checked, 2);
  assert.equal(g.calls.length - before, 8); assert.equal(second.realFundsEnabled, false);
  assert.doesNotThrow(monitor.assertFresh);
  assert.throws(() => s.open({ policy: { batchSize: 2, intervalMs: 1000, maxAgeMs: 30000 } }), /frozen policy/);
  assert.throws(() => s.open({ economy: { ...g.f.economy, state: () => ({ ...g.f.economy.state(), instanceId: 'another-ledger' }) } }), /another ledger/);
  assert.equal(g.f.calls.length, 0);
});

test('a new submitted order cannot starve a fixed sweep and is picked up by the next sweep', async t => {
  const s = await setup(t), { g } = s; s.seed(); s.seed(g.f.bob, 'c'); const monitor = s.open();
  await monitor.runBatch();
  const pending = await g.deposits.prepare(g.f.headers(), depositInput('pending'));
  await g.deposits.submit(g.f.headers(), pending.order.id, { transactionHash: hash('d') });
  assert.equal((await monitor.runBatch()).lastResult.checked, 2);
  await monitor.runBatch(); await monitor.runBatch(); const next = await monitor.runBatch();
  assert.equal(next.lastResult.checked, 3); assert.equal(next.lastResult.pending, 1); assert.equal(next.fresh, true);
  assert.equal((await g.deposits.get(g.f.headers(), pending.order.id)).order.credited, false);
  assert.equal(g.f.economy.state().audit.custody, '2000');
});

test('worker cursor and asset binding survive restart without counting a confirmed deposit twice', async t => {
  const s = await setup(t), { g } = s; s.seed(); s.seed(g.f.bob, 'c'); let monitor = s.open();
  await monitor.runBatch(); await monitor.close(); g.restart(); monitor = s.open();
  assert.equal(monitor.status().checkedInSweep, 1); assert.equal(monitor.status().fresh, false);
  const done = await monitor.runBatch(); assert.equal(done.lastResult.checked, 2); assert.equal(done.fresh, true);
  assert.equal(g.f.economy.export().events.filter(row => row.request.type === 'verified-deposit').length, 2);
  assert.equal(verifyAssetLedgerExport(g.f.economy.export()).custodyBaseUnits, '2000');
});

test('duplicate runs coalesce and a second worker cannot query while a live lease is held', async t => {
  const s = await setup(t), { g } = s; s.seed(); const one = s.open(), two = s.open();
  let release; g.control.gate = new Promise(resolve => { release = resolve; });
  const before = g.calls.length, pending = one.runBatch(); assert.equal(one.runBatch(), pending);
  await assert.rejects(two.runBatch(), e => e.code === 'DEPOSIT_MONITOR_BUSY');
  assert.equal(g.calls.length - before, 1); release(); delete g.control.gate;
  assert.equal((await pending).fresh, true); assert.equal(g.calls.length - before, 4);
  assert.equal((await two.runBatch()).fresh, true);
});

test('expired worker responses are fenced before writes and cannot undo a replacement worker result', async t => {
  const s = await setup(t), { g } = s;
  const prepared = await g.deposits.prepare(g.f.headers(), depositInput());
  await g.deposits.submit(g.f.headers(), prepared.order.id, { transactionHash: hash('a') });
  g.control.receipt = transferReceipt(); g.control.head = '0x66';
  const first = s.open(), replacement = s.open(); let release;
  g.control.gate = new Promise(resolve => { release = resolve; });
  const late = first.runBatch(); const rejected = assert.rejects(late, e => e.code === 'DEPOSIT_MONITOR_LEASE_LOST');
  s.advance(120001); delete g.control.gate;
  await replacement.runBatch(); release(); await rejected;
  assert.equal(g.f.economy.state().audit.custody, '1000');
  assert.equal(g.f.economy.export().depositRecords.checks.length, 1);
  // The resumed sweep began before lease expiry, so its evidence is too old to reopen admission.
  assert.equal(replacement.status().fresh, false); assert.equal(replacement.status().state, 'stale');
  assert.equal((await replacement.runBatch()).fresh, true);
});

test('RPC outage or disappearing credited evidence preserves balances, closes admission and recovers on recheck', async t => {
  const s = await setup(t), { g } = s; const deposit = s.seed(), monitor = s.open(); await monitor.runBatch();
  g.control.fail = true; const outage = await monitor.runBatch();
  assert.equal(outage.fresh, false); assert.equal(outage.lastResult.creditedFailures, 1);
  assert.equal(outage.state, 'reconciliation-required'); assert.equal(g.f.economy.state().audit.custody, '1000');
  g.control.fail = false; g.control.receipts[hash('a')] = null;
  const absent = await monitor.runBatch(); assert.equal(absent.lastResult.pending, 1); assert.equal(absent.fresh, false);
  g.control.receipts[hash('a')] = deposit.evidence.receipt; assert.equal((await monitor.runBatch()).fresh, true);
  s.advance(30001); assert.equal(monitor.status().state, 'stale'); assert.throws(monitor.assertFresh, e => e.code === 'DEPOSIT_MONITOR_UNREADY');
  await monitor.runBatch(); s.setTime(monitor.status().verifiedSince - 1); assert.equal(monitor.status().fresh, false);
  assert.equal(verifyAssetLedgerExport(g.f.economy.export()).depositsChecked, 1);
});

test('stale monitoring rejects a new attempt and preserves a completed response until fresh settlement', async t => {
  const s = await setup(t), { g } = s; s.seed(); const monitor = s.open();
  const game = createAuthenticatedCreditGame({ path: g.f.jobsPath.replace('jobs.sqlite', 'monitored-jobs.sqlite'), economy: g.f.economy,
    vault: g.f.vault, authentication: g.f.authentication, limits: g.f.limits, depositMonitor: monitor });
  s.closers.push(game.close);
  assert.equal((await game.account(g.f.headers())).spendingPaused, true);
  await assert.rejects(game.attempt(g.f.headers(), input('before-sweep')), e => e.code === 'CREDIT_RESERVATION_REJECTED');
  assert.equal(g.f.calls.length, 0); await monitor.runBatch();
  g.f.controls.transport = body => { s.advance(30001); return completion(body.model); };
  await assert.rejects(game.attempt(g.f.headers(), input('expires-during-inference')), e => e.code === 'DEPOSIT_MONITOR_UNREADY');
  assert.equal((await game.result(g.f.headers(), 'expires-during-inference')).status, 'inferred');
  assert.equal((await game.account(g.f.headers())).reserved, '100');
  assert.equal(g.f.calls.length, 1); await monitor.runBatch();
  const result = await game.reconcile(g.f.headers(), 'expires-during-inference');
  assert.equal(result.accounting.prizeContribution, '70'); assert.equal(g.f.calls.length, 1);
  assert.equal((await game.account(g.f.headers())).available, '900');
  assert.equal((await game.result(g.f.headers(), 'expires-during-inference')).replayed, true);
});

test('stopping a scheduled worker joins its active read and closes without a second check', async t => {
  const s = await setup(t), { g } = s; s.seed(); const monitor = s.open();
  let release; g.control.gate = new Promise(resolve => { release = resolve; }); const before = g.calls.length;
  monitor.start(); monitor.start(); const stop = monitor.stop();
  assert.equal(g.calls.length - before, 1); release(); delete g.control.gate; await stop;
  assert.equal(g.calls.length - before, 4); assert.equal(monitor.status().fresh, true);
  await monitor.close(); assert.throws(monitor.start, /closed/); await assert.rejects(monitor.runBatch(), /closed/);
});

for (const operation of ['attach', 'reconcile', 'markUnavailable']) {
  test(`a takeover immediately before ${operation} cannot apply stale evidence or an error hold`, async t => {
    const s = await setup(t), { g } = s;
    if (operation === 'attach') {
      const prepared = await g.deposits.prepare(g.f.headers(), depositInput());
      await g.deposits.submit(g.f.headers(), prepared.order.id, { transactionHash: hash('a') });
      g.control.receipt = transferReceipt(); g.control.head = '0x66';
    } else s.seed();
    const orders = g.f.economy.ledger.deposits, monitor = s.open(), original = orders[operation];
    const before = orders.exportAll();
    orders[operation] = (...args) => {
      orders.monitorStore.change(state => { state.leaseOwner = 'replacement-worker'; });
      return original(...args);
    };
    if (operation === 'markUnavailable') g.control.fail = true;
    await assert.rejects(monitor.runBatch(), e => e.code === 'DEPOSIT_MONITOR_LEASE_LOST');
    assert.deepEqual(orders.exportAll(), before);
    assert.equal(orders.monitorStore.read().leaseOwner, 'replacement-worker');
    assert.equal(monitor.status().fresh, false);
  });
}

test('another process cannot take the lease between the transactional guard and deposit writes', async t => {
  const s = await setup(t), { g } = s; s.open();
  const prepared = await g.deposits.prepare(g.f.headers(), depositInput());
  const orders = g.f.economy.ledger.deposits;
  const code = `import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync(process.argv[1]); db.exec('PRAGMA busy_timeout=50');
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare("UPDATE deposit_monitor_state SET document=json_set(document,'$.leaseOwner','competing-process') WHERE id=1").run();
      db.exec('COMMIT'); console.log(JSON.stringify({blocked:false}));
    } catch(error) { console.log(JSON.stringify({blocked:error.errcode === 5})); }
    finally { db.close(); }`;
  let probes = 0;
  const guarded = () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code, s.path], {encoding:'utf8', timeout:10000, windowsHide:true});
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).blocked, true); probes++;
  };
  orders.attach(prepared.order.id, g.f.alice, {transactionHash:hash('a'),logIndex:'0x0'}, guarded);
  const evidence = {chainId:'0x539',headBlockNumber:'0x66',canonicalBlock:g.control.block,receipt:transferReceipt()};
  orders.reconcile(prepared.order.id, g.f.alice, evidence, guarded);
  orders.markUnavailable(prepared.order.id, g.f.alice, 'rpc-unavailable', guarded);
  assert.equal(probes, 3); assert.equal(g.f.economy.state().audit.custody, '1000');
  assert.equal(orders.monitorStore.read().leaseOwner, null);
  assert.equal(verifyAssetLedgerExport(g.f.economy.export()).custodyBaseUnits, '1000');
});
