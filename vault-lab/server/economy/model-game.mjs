import { openDatabase } from '../storage/database.mjs';
import { createHash } from 'node:crypto';
import { apiError } from '../errors.mjs';
import { RULES } from '../rules.mjs';
import { verifiedAccountId, verifiedWallet } from '../principal.mjs';
import { bindJobLedger, assertRoundReceipt } from './model-job-policy.mjs';

const BEFORE_INFERENCE = new Set(['MISSING_API_KEY', 'RECEIPT_STORAGE_UNAVAILABLE', 'INVALID_INPUT', 'ATTEMPT_BUSY', 'MODEL_NOT_ALLOWED', 'SESSION_NOT_FOUND',
  'SESSION_MODEL_MISMATCH', 'SESSION_ROUND_MISMATCH', 'SESSION_CONFIGURATION_CHANGED', 'INVALID_SESSION_SCOPE',
  'SESSION_CLOSED', 'TURN_LIMIT', 'SESSION_LIMIT', 'CONTEXT_LIMIT', 'CATALOG_UNAVAILABLE',
  'AUTH_REQUIRED', 'USAGE_UNRECONCILED', 'APP_BUDGET_REACHED', 'DAILY_LIMIT_REACHED',
  'X402_NOT_CONFIGURED', 'INSUFFICIENT_OPERATING_FUNDS', 'X402_QUOTE_UNSUPPORTED', 'X402_PAYMENT_REJECTED']);
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,55}$/.test(value);

export function createCreditGame({ path = ':memory:', economy, vault, depositMonitor, env = process.env } = {}) {
  const ledgerState = economy.ledger.snapshot(), accountCredits = ledgerState.unit.mode === 'rpc-credit-preparation';
  const accounting = { unit: accountCredits ? 'TOKEN_BASE_UNITS' : 'TEST', mode: ledgerState.unit.mode,
    ...(accountCredits ? { assetHash: ledgerState.assetHash, decimals: ledgerState.unit.decimals } : {}),
    realFunds: false, chainTransaction: null, evidence: ledgerState.evidence };
  const db = openDatabase(path, env);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS model_jobs (key TEXT PRIMARY KEY, request_hash TEXT NOT NULL,
        request TEXT NOT NULL, state TEXT NOT NULL, outcome TEXT, created_at TEXT NOT NULL);`);
    bindJobLedger(db, ledgerState);
  } catch (error) { db.close(); throw error; }
  let busy = false;
  const getJob = key => db.prepare('SELECT * FROM model_jobs WHERE key = ?').get(key);
  const save = (key, state, outcome) => db.prepare('UPDATE model_jobs SET state = ?, outcome = ? WHERE key = ?').run(state, outcome ? JSON.stringify(outcome) : null, key);
  const record = (key, suffix, operation) => {
    if (accountCredits && depositMonitor && ['reserve', 'start', 'settle'].includes(operation.type) &&
        !(operation.type === 'settle' && operation.outcome === 'error')) depositMonitor.assertFresh();
    return economy.ledger.execute(`${key}-${suffix}`, operation);
  };
  const attemptIdFor = key => `model-${key}`;
  const pendingError = key => apiError(409, 'MODEL_JOB_UNCERTAIN', 'This model attempt needs reconciliation. Its reserved credits remain separate from the prize. Do not submit it again with a new key.', { modelAttemptKey: key });
  const ownerFor = principal => accountCredits ? verifiedAccountId(principal) : 'local-demo';
  const keyFor = (key, owner) => accountCredits ? 'asset-' + createHash('sha256').update(owner + '\0' + key).digest('hex') : key;

  function finalize(job) {
    const input = JSON.parse(job.request), outcome = JSON.parse(job.outcome);
    if (accountCredits && outcome.ok) assertRoundReceipt(outcome.value, input, economy.manifest(input.roundId), economy.sessionRound(input.roundId));
    if (job.state !== 'done') {
      if (outcome.usageRecoveryRequired) {
        if (!vault.assertUsageReconciled) throw apiError(503, 'USAGE_UNRECONCILED', 'Recover this response usage before settling its credits.');
        vault.assertUsageReconciled(outcome.value.receipt, input.ownerId);
      }
      const receiptRef = outcome.ok ? outcome.value.receipt.id : outcome.receipt?.id ?? `preflight-${job.key}`;
      const settlement = record(job.key, 'settle', { type: 'settle', attemptId: attemptIdFor(job.key),
        outcome: outcome.ok ? outcome.value.decision : 'error', receiptRef });
      outcome.accounting = { ...settlement, roundId: input.roundId, ...accounting };
      save(job.key, 'done', outcome);
    }
    if (outcome.ok) return { ...outcome.value, receipt: { ...outcome.value.receipt, accounting: outcome.accounting }, modelAttemptKey: input.key, accounting: outcome.accounting,
      replayed: job.state === 'done' };
    throw apiError(outcome.status, outcome.code, outcome.message, { ...(outcome.receipt ? { receipt: { ...outcome.receipt, accounting: outcome.accounting } } : {}),
      accounting: outcome.accounting, modelAttemptKey: input.key });
  }

  async function attempt(input, principal) {
    const ownerId = ownerFor(principal);
    const modeFields = accountCredits ? ['creditMode', 'payoutWallet'] : ['simulatedCredits'];
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (accountCredits ? input.creditMode !== 'asset-preparation' : input.simulatedCredits !== true) ||
      Object.keys(input).some(key => !['key', 'roundId', 'modelId', 'prompt', 'sessionId', ...modeFields].includes(key)) ||
      !validId(input.key) || typeof input.roundId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.roundId) ||
      typeof input.modelId !== 'string' || input.modelId.length > 160 || !input.modelId.includes('/') ||
      typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > RULES.limits.maxPromptCharacters ||
      (input.sessionId !== undefined && (typeof input.sessionId !== 'string' || input.sessionId.length > 80))) {
      throw apiError(400, 'INVALID_CREDIT_ATTEMPT', 'A model, prompt, round, unique key and explicit preparation mode are required. Real payments are disabled.');
    }
    const payoutWallet = accountCredits ? verifiedWallet(principal, input.payoutWallet) : null;
    const key = keyFor(input.key, ownerId);
    const canonical = { key: input.key, roundId: input.roundId, modelId: input.modelId, prompt: input.prompt,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(accountCredits ? { creditMode: 'asset-preparation', ownerId, payoutWallet } : { simulatedCredits: true }) };
    const serialized = JSON.stringify(canonical), requestHash = createHash('sha256').update(serialized).digest('hex');
    const existing = getJob(key);
    if (existing && existing.request_hash !== requestHash) throw apiError(409, 'MODEL_JOB_CONFLICT', 'This attempt key already belongs to a different message or round.');
    if (existing && ['inferred', 'done'].includes(existing.state)) return finalize(existing);
    if (existing) throw pendingError(input.key);
    if (!vault.status().configured) throw apiError(503, 'MISSING_API_KEY', 'Configure the model API before using test credits with real model replies. No credits were reserved.');
    const roundManifest = economy.assertModel(input.roundId, input.modelId);
    if (busy) throw apiError(409, 'ATTEMPT_BUSY', 'Another model attempt is being processed. No credits were reserved.');
    busy = true;
    try {
      db.prepare('INSERT INTO model_jobs(key,request_hash,request,state,created_at) VALUES (?, ?, ?, ?, ?)')
        .run(key, requestHash, serialized, 'accepted', new Date().toISOString());
      try {
        record(key, 'reserve', { type: 'reserve', roundId: input.roundId, attemptId: attemptIdFor(key), player: ownerId,
          ...(accountCredits ? { recipient: payoutWallet } : {}) });
        record(key, 'start', { type: 'start', attemptId: attemptIdFor(key) });
      } catch {
        const a = economy.state().attempts.find(row => row.id === attemptIdFor(key));
        if (a?.state === 'reserved') record(key, 'cancel', { type: 'cancel-reservation', attemptId: a.id });
        const outcome = { ok: false, status: 409, code: 'CREDIT_RESERVATION_REJECTED',
          message: 'Could not reserve this attempt. Check available credits, deposit reconciliation, the round and its queue. No model request was sent.',
          accounting: { ...accounting, roundId: input.roundId, status: 'not-charged', creditsConsumed: '0' } };
        save(key, 'done', outcome);
        return finalize(getJob(key));
      }
      save(key, 'processing');
      let outcome;
      try {
        const value = await vault.attempt({ modelId: input.modelId, prompt: input.prompt, ...(input.sessionId ? { sessionId: input.sessionId } : {}) },
          { ownerId, roundId: accountCredits ? economy.sessionRound(input.roundId) : input.roundId });
        if (accountCredits) assertRoundReceipt(value, input, roundManifest, economy.sessionRound(input.roundId));
        outcome = { ok: true, value: { ...value, receipt: { ...value.receipt,
          round: { id: input.roundId, manifestHash: roundManifest.hash, evidence: roundManifest.evidence } } } };
      } catch (error) {
        if (accountCredits && error.completedResponse) {
          assertRoundReceipt(error.completedResponse, input, roundManifest, economy.sessionRound(input.roundId));
          save(key, 'inferred', { ok: true, usageRecoveryRequired: true, value: { ...error.completedResponse,
            receipt: { ...error.completedResponse.receipt, round: { id: input.roundId, manifestHash: roundManifest.hash, evidence: roundManifest.evidence } } } });
          throw apiError(503, 'USAGE_UNRECONCILED', 'The model response is saved. Recover its usage record before settling credits; do not repeat the model request.', { modelAttemptKey: input.key });
        }
        if (error.receipt?.status === 'error' || BEFORE_INFERENCE.has(error.code) || error.code === 'ROUND_RECEIPT_MISMATCH') {
          outcome = { ok: false, status: error.status ?? 502, code: error.code ?? 'MODEL_ERROR',
            message: error.message, ...(error.receipt ? { receipt: error.receipt } : {}) };
        } else {
          record(key, 'unknown', { type: 'unknown', attemptId: attemptIdFor(key) });
          save(key, 'unknown');
          throw pendingError(input.key);
        }
      }
      // Persist inference before settlement. Replay can finish accounting without another API call.
      save(key, 'inferred', outcome);
      return finalize(getJob(key));
    } finally { busy = false; }
  }

  function result(key, principal) {
    const owner = ownerFor(principal);
    if (!validId(key)) throw apiError(400, 'INVALID_ATTEMPT_KEY', 'Invalid model attempt key.');
    const job = getJob(keyFor(key, owner));
    if (!job) throw apiError(404, 'MODEL_JOB_NOT_FOUND', 'No model attempt is recorded for this key.');
    if (job.state === 'done') return finalize(job);
    // A read never repeats inference or mutates accounting.
    return { modelAttemptKey: key, status: job.state, reconciliationRequired: true, realFunds: false };
  }
  function reconcile(key, principal) {
    const owner = ownerFor(principal);
    if (!validId(key)) throw apiError(400, 'INVALID_ATTEMPT_KEY', 'Invalid model attempt key.');
    const job = getJob(keyFor(key, owner));
    if (!job) throw apiError(404, 'MODEL_JOB_NOT_FOUND', 'No model attempt is recorded for this key.');
    if (['done', 'inferred'].includes(job.state)) return finalize(job);
    throw pendingError(key);
  }
  return { attempt, result, reconcile, close: () => db.close() };
}
