import { openDatabase } from './storage/database.mjs';
import { createHash } from 'node:crypto';
import { publicRules, modelConfiguration } from './profiles.mjs';
import { apiError } from './errors.mjs';
import { id, UNIT, roundTerms } from './economy/schema.mjs';

export const DEFAULT_GUARDIANS = ['qwen/qwen3.5-9b', 'google/gemini-2.5-flash', 'anthropic/claude-haiku-4.5'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function specification(modelIds, accounting) {
  if (!Array.isArray(modelIds) || modelIds.length < (accounting ? 1 : 2) || modelIds.length > 3 || new Set(modelIds).size !== modelIds.length ||
      modelIds.some(model => typeof model !== 'string' || !Object.hasOwn(publicRules().profiles, model))) {
    throw apiError(400, 'INVALID_GUARDIAN_ROSTER', 'Choose a supported guardian roster with published profiles.');
  }
  const base = { version: 'shared-vault-round-v1', mode: 'simulation', unit: UNIT, realFunds: false,
    qualification: 'Candidates only. No model is qualified for a funded round.',
    price: '100', prizeBps: 7000, operationsBps: 2000, nextRoundBps: 1000,
    guardians: modelIds.map(modelId => ({ modelId, configuration: modelConfiguration(modelId) })), rules: publicRules() };
  if (!accounting) return base;
  return { ...base, version: 'shared-vault-round-v2', mode: 'rpc-credit-preparation', unit: accounting.unit,
    assetHash: accounting.assetHash, ...roundTerms(accounting), pricingStatus: 'explicit-preparation-terms-not-approved-tokenomics' };
}

export function createRoundRegistry({ path = ':memory:', now = () => new Date().toISOString(), accounting, env = process.env } = {}) {
  accounting = accounting && structuredClone(accounting);
  if (accounting && (accounting.unit?.mode !== 'rpc-credit-preparation' || !/^[a-f0-9]{64}$/.test(accounting.assetHash))) throw new Error('Explicit asset accounting is required.');
  if (accounting) roundTerms(accounting);
  const db = openDatabase(path, env);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS round_manifests (round_id TEXT PRIMARY KEY, hash TEXT NOT NULL, document TEXT NOT NULL);`);

  function get(roundId) {
    id(roundId);
    const row = db.prepare('SELECT * FROM round_manifests WHERE round_id = ?').get(roundId);
    if (!row) return null;
    const manifest = JSON.parse(row.document);
    if (manifest.roundId !== roundId || digest(manifest) !== row.hash) throw apiError(409, 'ROUND_MANIFEST_INVALID', 'The recorded round configuration failed its consistency check.');
    return { hash: row.hash, manifest, evidence: 'operator-recorded-not-independent-attestation' };
  }
  function freeze(roundId, modelIds = DEFAULT_GUARDIANS) {
    id(roundId);
    const configuration = specification(modelIds, accounting);
    const previous = get(roundId);
    if (previous) {
      if (digest(previous.manifest.configuration) !== digest(configuration)) throw apiError(409, 'ROUND_IMMUTABLE', 'An existing round cannot change its guardian roster or configuration.');
      return previous;
    }
    const manifest = { roundId, createdAt: now(), configuration };
    db.prepare('INSERT INTO round_manifests(round_id, hash, document) VALUES (?, ?, ?)').run(roundId, digest(manifest), JSON.stringify(manifest));
    return get(roundId);
  }
  function assertCurrent(roundId, modelId) {
    const recorded = get(roundId);
    if (!recorded) throw apiError(409, 'ROUND_NOT_FROZEN', 'This legacy accounting round has no frozen guardians. Create a new sandbox round before model-linked play.');
    const { configuration } = recorded.manifest;
    const modelIds = configuration.guardians.map(guardian => guardian.modelId);
    if (!modelIds.includes(modelId)) throw apiError(400, 'ROUND_MODEL_NOT_ALLOWED', 'This model is not one of this round\'s published guardians. No credits were reserved.');
    if (digest(configuration) !== digest(specification(modelIds, accounting))) throw apiError(409, 'ROUND_CONFIGURATION_CHANGED', 'The running configuration differs from this round. Model play is paused; no credits were reserved.');
    return recorded;
  }
  return { get, freeze, assertCurrent, close: () => db.close() };
}
