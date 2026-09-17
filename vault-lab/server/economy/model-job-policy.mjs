import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { apiError } from '../errors.mjs';
import { validateCompletion } from '../upstream.mjs';

export function bindJobLedger(db, state) {
  const expected = JSON.stringify({ instanceId: state.instanceId, mode: state.unit.mode, assetHash: state.assetHash });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('CREATE TABLE IF NOT EXISTS model_job_ledger (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL)');
    const previous = db.prepare('SELECT document FROM model_job_ledger WHERE id=1').get();
    if (previous && previous.document !== expected) throw new Error('Model jobs belong to another ledger instance or denomination.');
    if (!previous && state.assetHash && db.prepare('SELECT key FROM model_jobs LIMIT 1').get()) {
      throw new Error('Existing unbound jobs cannot be adopted by an asset ledger.');
    }
    db.prepare('INSERT OR IGNORE INTO model_job_ledger VALUES (1, ?)').run(expected);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function assertRoundReceipt(value, input, recorded, sessionRound) {
  const receipt = value?.receipt, configuration = recorded?.manifest?.configuration;
  const profile = configuration?.guardians.find(guardian => guardian.modelId === input.modelId)?.configuration;
  try {
    const configurationHash = createHash('sha256').update(JSON.stringify({ rules: configuration.rules, model: profile })).digest('hex');
    if (!receipt || receipt.status !== 'complete' || !/^[a-zA-Z0-9_-]{1,80}$/.test(receipt.id) ||
        receipt.sessionScope?.roundId !== sessionRound || receipt.sessionScope.configurationHash !== configurationHash ||
        receipt.modelRequested !== input.modelId || receipt.promptVersion !== configuration.rules.version ||
        !isDeepStrictEqual(receipt.configuration, profile) || !isDeepStrictEqual(receipt.generation, profile.generation) ||
        !isDeepStrictEqual(receipt.tools, configuration.rules.tools) ||
        (receipt.round && (receipt.round.id !== input.roundId || receipt.round.manifestHash !== recorded.hash)) ||
        receipt.inputMessages?.[0]?.role !== 'system' || receipt.inputMessages[0].content !== configuration.rules.systemPrompt ||
        receipt.inputMessages.at(-1)?.role !== 'user' || receipt.inputMessages.at(-1).content !== input.prompt ||
        value.sessionId !== receipt.sessionId || (input.sessionId && input.sessionId !== receipt.sessionId)) throw new Error('Frozen configuration mismatch');
    const validated = validateCompletion({ model: receipt.modelReturned,
      choices: [{ finish_reason: receipt.finishReason, message: receipt.outputMessage }] }, input.modelId);
    if (validated.decision !== value.decision || validated.decision !== receipt.decision ||
        validated.response !== value.response || validated.response !== receipt.response ||
        !isDeepStrictEqual(validated.toolCalls, receipt.toolCalls)) throw new Error('Decision mismatch');
  } catch {
    throw apiError(502, 'ROUND_RECEIPT_MISMATCH', 'The saved response does not match this round or its published decision rules. Credits are returned; no prize is released.',
      receipt ? { receipt } : {});
  }
}
