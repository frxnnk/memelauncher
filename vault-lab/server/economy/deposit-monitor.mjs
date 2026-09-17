import { randomUUID } from 'node:crypto';
import { apiError } from '../errors.mjs';
import { inspectDepositFromRpc } from './inspect-deposit.mjs';

const LEASE_MS = 120000; // Longer than the reader's maximum three 30-second stages.
const leaseLost = () => apiError(409, 'DEPOSIT_MONITOR_LEASE_LOST', 'The deposit worker lost its lease. Its RPC response was not applied.');

// Inactive until runBatch()/start(). The normal app does not instantiate it.
// Only recorded deposit references are rechecked; no signing or generic RPC.
export function createDepositMonitor({ path, economy, reader, policy, now = Date.now } = {}) {
  if (path !== undefined) throw new Error('Deposit monitoring now shares the asset ledger. Remove the separate path; old monitor files are not imported.');
  const { batchSize, intervalMs, maxAgeMs } = policy ?? {};
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50 || !Number.isSafeInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60000 ||
      !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 30000 || maxAgeMs > 3600000 || intervalMs >= maxAgeMs || !economy?.ledger?.deposits?.monitorStore || !reader?.evidence) {
    throw new Error('Configure an asset ledger, reader and explicit bounded deposit monitoring policy.');
  }
  const orders = economy.ledger.deposits, { instanceId, assetHash } = economy.state();
  const store = orders.monitorStore, owner = randomUUID();
  store.bind({ instanceId, assetHash, policy: { batchSize, intervalMs, maxAgeMs } });
  let running = false, timer, inFlight, closed = false;
  const clock = () => { const value = now(); if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid worker clock.'); return value; };
  const read = store.read;
  const permitted = state => state.leaseOwner === owner && state.leaseUntil > clock();
  function change(update, requireLease = false) {
    return store.change(state => { if (requireLease && !permitted(state)) throw leaseLost(); update(state); });
  }
  const assertPermit = () => { if (!permitted(read())) throw leaseLost(); };
  function status() {
    const state = read(), age = state.lastVerifiedSince === null ? null : clock() - state.lastVerifiedSince, held = orders.holds().length > 0;
    const fresh = !held && !state.sweep && age !== null && age >= 0 && age <= maxAgeMs;
    return { configured: true, fresh, state: held ? 'reconciliation-required' : state.sweep ? 'checking' : fresh ? 'current' : age === null ? 'not-started' : 'stale',
      lastCompletedAt: state.lastCompletedAt, verifiedSince: state.lastVerifiedSince, maxAgeMs,
      checkedInSweep: state.sweep?.checked ?? 0, lastResult: state.lastResult,
      evidence: 'operator-rpc-monitor-not-independent-finality', realFundsEnabled: false };
  }
  const assertFresh = () => { if (!status().fresh) throw apiError(503, 'DEPOSIT_MONITOR_UNREADY', 'Deposit checks are incomplete or stale. No new credit movement is allowed; preserve any saved response.'); };
  async function work() {
    let state = change(state => {
      if (state.leaseOwner && state.leaseOwner !== owner && state.leaseUntil > clock()) throw apiError(409, 'DEPOSIT_MONITOR_BUSY', 'Another deposit worker holds the lease.');
      state.leaseOwner = owner; state.leaseUntil = clock() + LEASE_MS;
      state.sweep ??= { startedAt: clock(), through: orders.monitorPage({ limit: batchSize }).through, after: 0, checked: 0, pending: 0, reviewRequired: 0, creditedFailures: 0 };
    });
    try {
      const page = orders.monitorPage({ after: state.sweep.after, through: state.sweep.through, limit: batchSize });
      for (const record of page.records) {
        change(state => { state.leaseUntil = clock() + LEASE_MS; }, true);
        // Stored account scope only. This is not a fresh Privy identity or wallet signature.
        const principal = { authenticated: true, accountId: record.order.accountId };
        let pending = false, failed = false;
        try {
          const result = await inspectDepositFromRpc({ orders, reader, orderId: record.order.id, principal, assertPermit });
          pending = result.verification.status === 'pending';
        } catch (error) {
          if (error.code === 'DEPOSIT_MONITOR_LEASE_LOST') throw error;
          failed = true;
        }
        state = change(state => {
          state.sweep.after = record.position; state.sweep.checked++;
          if (pending) state.sweep.pending++;
          if (failed) { state.sweep.reviewRequired++; if (record.order.credited) state.sweep.creditedFailures++; }
        }, true);
      }
      state = change(state => {
        if (page.nextCursor === null) {
          state.lastCompletedAt = clock(); state.lastResult = { checked: state.sweep.checked, pending: state.sweep.pending,
            reviewRequired: state.sweep.reviewRequired, creditedFailures: state.sweep.creditedFailures };
          state.lastVerifiedSince = !orders.holds().length && !state.sweep.creditedFailures ? state.sweep.startedAt : null;
          state.sweep = null;
        }
      }, true);
      return status();
    } finally {
      // A stale worker must not clear a replacement worker's lease.
      change(state => { if (state.leaseOwner === owner) { state.leaseOwner = null; state.leaseUntil = 0; } });
    }
  }
  function runBatch() {
    if (closed) return Promise.reject(new Error('The deposit monitor is closed.'));
    if (!inFlight) inFlight = work().finally(() => { inFlight = null; });
    return inFlight;
  }
  async function loop() {
    try { await runBatch(); } catch { /* The durable sweep remains incomplete and admission stays closed. */ }
    if (running) { timer = setTimeout(loop, intervalMs); timer.unref?.(); }
  }
  async function stop() { running = false; clearTimeout(timer); try { await inFlight; } catch {} }
  return { runBatch, status, assertFresh,
    start() { if (closed) throw new Error('The deposit monitor is closed.'); if (!running) { running = true; void loop(); } },
    stop, async close() { await stop(); closed = true; } };
}
