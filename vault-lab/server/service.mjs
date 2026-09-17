import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError, redact } from './errors.mjs';
import { createCatalog } from './catalog.mjs';
import { RULES } from './rules.mjs';
import { hasPublishedRoute, modelConfiguration, publicRules } from './profiles.mjs';
import { requestCompletion, validateCompletion } from './upstream.mjs';
import { requestPaidCompletion } from './x402-blockrun.mjs';
import { createSessionStore } from './sessions.mjs';
import { truncateAddress } from './economy/fairness-board.mjs';

export function createVaultService({ apiKey = '', payment = null, logDir, sessionsPath, evaluationPrompt = null, fetchImpl = fetch, now = Date.now,
  timeoutMs = RULES.limits.timeoutSeconds * 1000, env = process.env } = {}) {
  const effectiveRules = publicRules(evaluationPrompt);
  const models = createCatalog({ fetchImpl, now });
  const sessions = createSessionStore({ path: sessionsPath, env });
  let busy = false;
  const observed = { since:new Date(now()).toISOString(), persistedReceipts:0, validReplies:0, errors:0, releases:0,
    receiptWriteFailures:0, receiptStore:'not-observed', latencyTotalMs:0, latencyMaxMs:0, latencySamples:0 };
  const clean = value => redact(value, apiKey);

  async function persist(receipt, ownerId) {
    try {
      await mkdir(logDir, { recursive: true });
      await appendFile(join(logDir, 'attempts.jsonl'), `${JSON.stringify(clean(receipt))}\n`, { encoding: 'utf8', mode: 0o600 });
      sessions.storeReceipt(ownerId, clean(receipt));
    } catch {
      observed.receiptWriteFailures++; observed.receiptStore = 'failed';
      throw apiError(500, 'RECEIPT_WRITE_FAILED', 'Could not save the local receipt. The result is not confirmed or added to the session.');
    }
    // Aggregate instrumentation is presentation only; it cannot change the decision.
    observed.receiptStore = 'last-write-succeeded'; observed.persistedReceipts++;
    if (receipt.status === 'error') observed.errors++; else observed.validReplies++;
    if (receipt.decision === 'released') observed.releases++;
    if (Number.isFinite(receipt.inferenceDurationMs) && receipt.inferenceDurationMs >= 0) {
      observed.latencySamples++; observed.latencyTotalMs += receipt.inferenceDurationMs;
      observed.latencyMaxMs = Math.max(observed.latencyMaxMs, receipt.inferenceDurationMs);
    }
  }

  async function attempt(input, { ownerId = 'local-demo', roundId = null, usageReservationId = null, billing = null } = {}) {
    const useX402 = billing === 'x402';
    if (useX402 && !payment) throw apiError(503, 'X402_NOT_CONFIGURED', 'Funded inference requires an operating-box payer. No credits were reserved.');
    if (!useX402 && !apiKey.trim()) throw apiError(503, 'MISSING_API_KEY', 'Set OPENROUTER_API_KEY in the local .env file and restart the server. Live API calls may incur charges.');
    if (observed.receiptStore === 'failed') throw apiError(503, 'RECEIPT_STORAGE_UNAVAILABLE', 'Receipt storage needs repair and a server restart before new attempts can run.');
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['modelId', 'prompt', 'sessionId'].includes(key))) throw apiError(400, 'INVALID_INPUT', 'Only modelId, prompt, and an optional sessionId are accepted.');
    const { modelId, prompt, sessionId } = input;
    if (typeof ownerId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(ownerId) ||
        (roundId !== null && (typeof roundId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(roundId))) ||
        (usageReservationId !== null && (typeof usageReservationId !== 'string' || !/^[a-f0-9-]{36}$/.test(usageReservationId)))) throw apiError(400, 'INVALID_SESSION_SCOPE', 'Invalid server-side session scope.');
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > RULES.limits.maxPromptCharacters ||
      typeof modelId !== 'string' || modelId.length > 160 ||
      (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId.length > 80))) throw apiError(400, 'INVALID_INPUT', 'Enter a message of 1 to 2,000 characters and select a valid model.');
    if (busy) throw apiError(409, 'ATTEMPT_BUSY', 'An attempt is already being processed in this local lab. Wait for its result.');
    busy = true;
    try {
      const catalog = await models();
      if (!catalog.models.some(model => model.id === modelId) && !(useX402 && hasPublishedRoute(modelId))) {
        throw apiError(400, 'MODEL_NOT_ALLOWED', 'This model is not in the current lab catalog. Refresh the model selection.');
      }
      sessions.prune(now() - RULES.limits.sessionTtlMinutes * 60000);
      let session = sessionId ? sessions.get(sessionId) : null;
      if (sessionId && !session) throw apiError(404, 'SESSION_NOT_FOUND', 'This session does not exist or has expired. Start a new conversation.');
      if (session && session.ownerId !== ownerId) throw apiError(404, 'SESSION_NOT_FOUND', 'This session does not belong to your account.');
      if (session && session.roundId !== roundId) throw apiError(409, 'SESSION_ROUND_MISMATCH', 'Start a new conversation for this round. Practice history cannot be imported into a credit round.');
      if (session?.modelId !== undefined && session.modelId !== modelId) throw apiError(409, 'SESSION_MODEL_MISMATCH', 'The model cannot change within a session. Start a new conversation.');
      const configurationHash = createHash('sha256').update(JSON.stringify({ rules: effectiveRules, model: modelConfiguration(modelId) })).digest('hex');
      if (session && session.configurationHash !== configurationHash) throw apiError(409, 'SESSION_CONFIGURATION_CHANGED', 'This session uses a different configuration. Start a new conversation.');
      if (session?.closed) throw apiError(409, 'SESSION_CLOSED', 'The vault in this session has already been opened. Start a new conversation.');
      if (session?.turns >= RULES.limits.maxTurns) throw apiError(409, 'TURN_LIMIT', 'This session has reached its limit of 12 valid attempts. Start a new conversation.');
      if (!session) {
        if (sessions.size >= RULES.limits.maxSessions) throw apiError(429, 'SESSION_LIMIT', 'The lab has reached its session limit. Wait for sessions to expire or restart the server.');
        session = { id: randomUUID(), ownerId, roundId, configurationHash, modelId, turns: 0, messages: [], updatedAt: now(), closed: false };
      }
      const messages = [{ role: 'system', content: effectiveRules.systemPrompt }, ...session.messages, { role: 'user', content: prompt }];
      if (JSON.stringify(messages).length > RULES.limits.maxContextCharacters) throw apiError(409, 'CONTEXT_LIMIT', 'The full context would exceed 12,000 characters. Start a new conversation; context is not silently truncated.');
      const configuration = modelConfiguration(modelId);
      const receipt = {
        id: randomUUID(), createdAt: new Date(now()).toISOString(), sessionId: session.id, usageReservationId,
        modelRequested: modelId, modelReturned: null, provider: null, sessionScope: { roundId, configurationHash },
        promptVersion: effectiveRules.version, inputMessages: messages, tools: RULES.tools,
        configuration, generation: configuration.generation, toolCalls: [], usage: null, finishReason: null,
        evidence: 'operator-recorded', mode: useX402 ? 'x402-exact' : 'practice', bountyEnabled: Boolean(useX402),
        catalogFetchedAt: catalog.fetchedAt, modelSource: catalog.source,
        routingNote: configuration.note
      };
      let result;
      const inferenceStarted = performance.now();
      try {
        const paid = useX402 ? await requestPaidCompletion({ fetchImpl, payer: payment, modelId, messages, timeoutMs, generation: receipt.generation, tools: RULES.tools }) : null;
        const data = paid ? paid.data : await requestCompletion({ fetchImpl, apiKey, modelId, messages, timeoutMs, generation: receipt.generation });
        receipt.modelReturned = typeof data.model === 'string' ? data.model : null;
        receipt.provider = typeof data.provider === 'string' ? data.provider : null;
        receipt.upstreamId = typeof data.id === 'string' ? data.id : null;
        receipt.finishReason = data.choices?.[0]?.finish_reason ?? null;
        receipt.toolCalls = data.choices?.[0]?.message?.tool_calls ?? [];
        receipt.usage = paid ? { ...(data.usage ?? {}), cost: Number(paid.quote.amount) / 1e6, source: 'x402-exact-quote' } : data.usage ?? null;
        if (paid) receipt.payment = { network: paid.quote.network, asset: paid.quote.asset, amount: paid.quote.amount, settled: paid.payment.settled };
        receipt.outputMessage = data.choices?.[0]?.message ?? null;
        receipt.systemFingerprint = data.system_fingerprint ?? null;
        result = validateCompletion(data, modelId);
      } catch (error) {
        if (error.code === 'PAYMENT_UNCERTAIN') throw error;
        receipt.inferenceDurationMs = Math.max(0, performance.now() - inferenceStarted);
        const safe = error.status ? error : apiError(502, 'UPSTREAM_INVALID', 'The API response could not be validated.');
        Object.assign(receipt, { status: 'error', error: { code: safe.code, message: safe.message }, upstreamStatus: safe.upstreamStatus ?? null });
        await persist(receipt, ownerId);
        sessions.set(session.id, { ...session, updatedAt: now() });
        safe.receipt = clean(receipt);
        throw safe;
      }
      Object.assign(receipt, { status: 'complete', decision: result.decision, response: result.response,
        inferenceDurationMs: Math.max(0, performance.now() - inferenceStarted) });
      await persist(receipt, ownerId);
      const history = [...session.messages, { role: 'user', content: prompt }, result.message];
      if (result.toolCalls.length) history.push({ role: 'tool', tool_call_id: result.toolCalls[0].id,
        content: JSON.stringify({ practice: true, decision: result.decision, fundsTransferred: false }) });
      sessions.set(session.id, { ...session, messages: history, turns: session.turns + 1,
        updatedAt: now(), closed: result.decision === 'released' });
      return clean({ sessionId: session.id, attemptId: receipt.id, modelId, provider: receipt.provider,
        response: result.response, decision: result.decision, receipt });
    } finally { busy = false; }
  }

  const receiptId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  function checkReceiptOwner(ownerId) {
    if (typeof ownerId !== 'string' || !/^player_[a-zA-Z0-9_-]{1,70}$/.test(ownerId)) throw apiError(401, 'AUTH_REQUIRED', 'A verified account is required.');
  }
  function publicReceiptRecord(owner, receipt) {
    const messages = [];
    for (const message of receipt.inputMessages ?? []) {
      if (!message || typeof message !== 'object') continue;
      messages.push({
        role: typeof message.role === 'string' ? message.role : 'unknown',
        content: typeof message.content === 'string' ? message.content : null
      });
    }
    if (typeof receipt.response === 'string') messages.push({ role: 'assistant', content: receipt.response });
    const toolCalls = (Array.isArray(receipt.toolCalls) ? receipt.toolCalls : []).map(call => ({
      name: call?.function?.name ?? call?.name ?? null,
      arguments: call?.function?.arguments ?? null
    }));
    return {
      id: receipt.id,
      createdAt: receipt.createdAt,
      player: truncateAddress(owner),
      modelRequested: receipt.modelRequested ?? null,
      modelReturned: receipt.modelReturned ?? null,
      provider: receipt.provider ?? null,
      decision: receipt.decision ?? null,
      status: receipt.status ?? null,
      mode: receipt.mode ?? 'practice',
      promptVersion: receipt.promptVersion ?? null,
      messages,
      toolCalls,
      evidence: 'operator-records'
    };
  }
  return {
    receiptHistory(ownerId, before = null) {
      checkReceiptOwner(ownerId);
      if (before !== null && (typeof before !== 'string' || !receiptId.test(before))) throw apiError(400, 'INVALID_RECEIPT_CURSOR', 'Invalid receipt page.');
      const page = sessions.receiptPage(ownerId, before);
      if (!page) throw apiError(404, 'RECEIPT_NOT_FOUND', 'Receipt not found for this account.');
      return { records:page.records.map(({ id, createdAt, modelRequested, status, decision }) => ({ id, createdAt, modelRequested, status, decision })),
        nextCursor:page.nextCursor, evidence:'operator-records', realFunds:false,
        coverage:'Account receipts indexed by this version. Older unindexed server logs are not imported. This does not restore an active conversation.' };
    },
    receipt(ownerId, id) {
      checkReceiptOwner(ownerId);
      if (typeof id !== 'string' || !receiptId.test(id)) throw apiError(400, 'INVALID_RECEIPT_ID', 'Invalid receipt reference.');
      const record = sessions.receipt(ownerId, id);
      if (!record) throw apiError(404, 'RECEIPT_NOT_FOUND', 'Receipt not found for this account.');
      return { record, evidence:'operator-records', realFunds:false };
    },
    publicReceipts(before = null) {
      if (before !== null && (typeof before !== 'string' || !receiptId.test(before))) throw apiError(400, 'INVALID_RECEIPT_CURSOR', 'Invalid receipt page.');
      const page = sessions.publicReceiptPage(before);
      if (!page) throw apiError(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.');
      return {
        records: page.records.map(row => publicReceiptRecord(row.owner, row.receipt)),
        nextCursor: page.nextCursor,
        evidence: 'operator-records',
        realFunds: false,
        coverage: 'Every stored attempt transcript on this server. Operator records, not independent attestation.'
      };
    },
    models, attempt, close: sessions.close,
    status: () => {
      const rehearsal = payment?.kind === 'laptop-rehearsal';
      return {
        configured: Boolean(apiKey.trim() || payment),
        paidConfigured: Boolean(payment) && !rehearsal,
        ...(rehearsal ? { localRehearsalPayer: true } : {}),
        mode: payment && !rehearsal ? 'x402-exact' : 'practice',
        bountyEnabled: Boolean(payment) && !rehearsal,
        authentication: 'local-only'
      };
    },
    operationalState: () => ({ scope:'since-process-start', since:observed.since, busy, storedSessions:sessions.size,
      receiptStore:observed.receiptStore, persistedReceipts:observed.persistedReceipts, validReplies:observed.validReplies,
      errors:observed.errors, releases:observed.releases, receiptWriteFailures:observed.receiptWriteFailures,
      meanLatencyMs:observed.latencySamples ? observed.latencyTotalMs / observed.latencySamples : null,
      maxLatencyMs:observed.latencySamples ? observed.latencyMaxMs : null }),
    rules: () => structuredClone(effectiveRules)
  };
}
