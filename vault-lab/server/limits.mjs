import { openDatabase } from './storage/database.mjs';
import { randomUUID } from 'node:crypto';
import { apiError } from './errors.mjs';
import { receiptBilling } from './provider-billing.mjs';

export function createInferenceLimits({ path = ':memory:', perUserPerDay = 25, totalPerDay = 250, budgetUsd = 5, now = Date.now, env = process.env } = {}) {
  if (![perUserPerDay, totalPerDay].every(n => Number.isInteger(n) && n > 0 && n <= 10000) ||
      !Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 25) throw new Error('Invalid public inference limits.');
  const db = openDatabase(path, env);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS inference_usage (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created_at INTEGER NOT NULL,
      state TEXT NOT NULL, cost_micros INTEGER);
    CREATE TABLE IF NOT EXISTS usage_reconciliation (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, evidence TEXT NOT NULL);`);
  const dayStart = () => Math.floor(now() / 86400000) * 86400000;
  const spent = () => db.prepare("SELECT COALESCE(SUM(cost_micros),0) AS total FROM inference_usage WHERE state='known'").get().total;
  const count = owner => owner
    ? db.prepare('SELECT COUNT(*) AS count FROM inference_usage WHERE created_at >= ? AND owner = ?').get(dayStart(), owner).count
    : db.prepare('SELECT COUNT(*) AS count FROM inference_usage WHERE created_at >= ?').get(dayStart()).count;

  function reserve(owner) {
    if (typeof owner !== 'string' || !/^player_[a-zA-Z0-9_-]{1,70}$/.test(owner)) throw apiError(401, 'AUTH_REQUIRED', 'A verified account is required.');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (db.prepare("SELECT id FROM inference_usage WHERE state='unknown' LIMIT 1").get()) throw apiError(503, 'USAGE_UNRECONCILED', 'An earlier inference cost needs reconciliation. New requests are paused.');
      if (db.prepare("SELECT id FROM inference_usage WHERE state='pending' LIMIT 1").get()) throw apiError(409, 'ATTEMPT_BUSY', 'An inference is pending or needs recovery. No new model request was sent.');
      if (spent() >= Math.floor(budgetUsd * 1e6)) throw apiError(429, 'APP_BUDGET_REACHED', 'The public practice budget is exhausted.');
      if (count(owner) >= perUserPerDay || count() >= totalPerDay) throw apiError(429, 'DAILY_LIMIT_REACHED', 'The daily practice request limit has been reached.');
      const id = randomUUID();
      db.prepare('INSERT INTO inference_usage(id,owner,created_at,state) VALUES (?, ?, ?, ?)').run(id, owner, now(), 'pending');
      db.exec('COMMIT'); return id;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function settle(id, cost, notSent = false) {
    const known = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 && cost <= 1000000;
    const state = notSent ? 'not-sent' : known ? 'known' : 'unknown';
    const micros = notSent ? 0 : known ? Math.ceil(cost * 1e6) : null;
    const row = db.prepare('SELECT * FROM inference_usage WHERE id = ?').get(id);
    if (!row) throw new Error('Usage reservation not found.');
    if (row.state !== 'pending') {
      if (row.state === state && row.cost_micros === micros) return;
      throw new Error('Usage reservation is already settled.');
    }
    db.prepare('UPDATE inference_usage SET state=?, cost_micros=? WHERE id=? AND state=?').run(state, micros, id, 'pending');
  }
  function reconcile(receipt) {
    const billing = receiptBilling(receipt);
    if (!receipt || typeof receipt.usageReservationId !== 'string' || typeof receipt.id !== 'string' ||
        !['complete', 'error'].includes(receipt.status) || !billing) {
      throw new Error('An existing receipt with a reservation ID and verified billing evidence is required.');
    }
    const micros = Math.ceil(billing.cost * 1e6);
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT * FROM inference_usage WHERE id=?').get(receipt.usageReservationId);
      if (!row) throw new Error('Receipt does not reference an existing usage reservation.');
      const evidence = JSON.stringify({ receiptId: receipt.id, reservationId: row.id,
        ...(billing.policyUrl ? { accountedCostUsd: billing.cost, policyUrl: billing.policyUrl } : { reportedCostUsd: billing.cost }),
        upstreamId: receipt.upstreamId ?? null, source: billing.source });
      const previous = db.prepare('SELECT evidence FROM usage_reconciliation WHERE id=?').get(row.id);
      if (previous && previous.evidence !== evidence) throw new Error('Conflicting reconciliation evidence.');
      if (!['pending', 'unknown'].includes(row.state) && !(row.state === 'known' && row.cost_micros === micros)) throw new Error('Reconciliation cannot rewrite a settled cost.');
      if (!previous) db.prepare('INSERT INTO usage_reconciliation VALUES (?, ?, ?)').run(row.id, now(), evidence);
      db.prepare("UPDATE inference_usage SET state='known',cost_micros=? WHERE id=?").run(micros, row.id);
      db.exec('COMMIT'); return { reconciled: true, ...JSON.parse(evidence) };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function operationalState() {
    const rows = db.prepare('SELECT state,COUNT(*) AS count FROM inference_usage GROUP BY state').all();
    const states = Object.fromEntries(rows.map(row => [row.state, row.count]));
    const oldest = db.prepare("SELECT MIN(created_at) AS created FROM inference_usage WHERE state='pending'").get().created;
    return { scope:'persistent-public-practice', globalRequestsToday:count(), totalPerDay, budgetUsd,
      reportedCostUsd:spent() / 1e6, pending:states.pending ?? 0, unknown:states.unknown ?? 0,
      known:states.known ?? 0, notSent:states['not-sent'] ?? 0,
      oldestPendingAgeMs:oldest === null ? null : Math.max(0, now() - oldest), dailyWindow:'UTC' };
  }
  function assertReceiptSettled(receipt, owner) {
    const row = typeof receipt?.usageReservationId === 'string' && db.prepare('SELECT * FROM inference_usage WHERE id=?').get(receipt.usageReservationId);
    const cost = receipt?.usage?.cost;
    if (!row || row.owner !== owner || row.state !== 'known' || typeof cost !== 'number' || !Number.isFinite(cost) ||
        cost < 0 || row.cost_micros !== Math.ceil(cost * 1e6)) {
      throw apiError(503, 'USAGE_UNRECONCILED', 'This saved model response still needs usage reconciliation.');
    }
  }
  return { reserve, settle, reconcile, operationalState, assertReceiptSettled,
    status: owner => ({ perUserPerDay, totalPerDay, requestsToday: count(owner), globalRequestsToday: count(),
      budgetUsd, reportedCostUsd: spent() / 1e6,
      unresolved: db.prepare("SELECT COUNT(*) AS count FROM inference_usage WHERE state IN ('pending','unknown')").get().count,
      budgetMeaning: 'Post-response accounting. The provider key limit is the external spend control; this counter does not pre-authorize exact inference prices.' }),
    close: () => db.close() };
}
