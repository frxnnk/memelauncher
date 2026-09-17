import { openDatabase } from './storage/database.mjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { apiError } from './errors.mjs';

// Qwen remains in the local lab: two live evaluations observed provider 429s.
export const BETA_MODELS = Object.freeze(['google/gemini-2.5-flash', 'anthropic/claude-haiku-4.5']);
const hash = code => createHash('sha256').update(code).digest('hex');
const ownerCheck = owner => {
  if (typeof owner !== 'string' || !/^player_[a-zA-Z0-9_-]{1,70}$/.test(owner)) throw apiError(401, 'AUTH_REQUIRED', 'Sign in to verify your account.');
};

export function createBetaAccess({ path = ':memory:', now = Date.now, publicAdmission = false, env = process.env } = {}) {
  const db = openDatabase(path, env);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS beta_invites (id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, owner TEXT, claimed_at INTEGER);
    CREATE INDEX IF NOT EXISTS beta_member ON beta_invites(owner);
    CREATE TABLE IF NOT EXISTS beta_redemption_limits (owner TEXT PRIMARY KEY, started_at INTEGER NOT NULL, attempts INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS beta_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT OR IGNORE INTO beta_settings VALUES ('paused','false');`);
  const paused = () => db.prepare("SELECT value FROM beta_settings WHERE name='paused'").get().value === 'true';

  function status(owner) {
    ownerCheck(owner);
    const row = db.prepare('SELECT expires_at FROM beta_invites WHERE owner=? AND revoked=0 AND expires_at>? ORDER BY expires_at DESC LIMIT 1').get(owner, now());
    return { required:!publicAdmission, admitted:publicAdmission || Boolean(row), expiresAt:publicAdmission ? null : row ? new Date(row.expires_at).toISOString() : null, paused:paused(), publicAdmission };
  }
  function assertAccess(owner, { write = false, modelId } = {}) {
    const membership = status(owner);
    if (membership.required && !membership.admitted) throw apiError(403, 'BETA_INVITE_REQUIRED', 'This closed beta needs an active invitation. Open Account to enter your code.');
    if (write && membership.paused) throw apiError(503, 'BETA_PAUSED', 'The beta is paused. Your receipts remain available.');
    if (write && !BETA_MODELS.includes(modelId)) throw apiError(400, 'BETA_MODEL_NOT_ALLOWED', 'Choose one of the available closed-beta models.');
    return membership;
  }
  function issue({ label, days = 7 }) {
    if (typeof label !== 'string' || !label.trim() || label.length > 80 || !Number.isInteger(days) || days < 1 || days > 30) throw new Error('Use a label of 1–80 characters and 1–30 days of beta access.');
    if (db.prepare('SELECT COUNT(*) AS n FROM beta_invites WHERE revoked=0 AND expires_at>?').get(now()).n >= 250) throw new Error('The closed beta supports at most 250 active invitations.');
    const code = 'vault_' + randomBytes(24).toString('base64url');
    const id = randomUUID(), createdAt = now(), expiresAt = createdAt + days * 86400000;
    db.prepare('INSERT INTO beta_invites(id,code_hash,label,created_at,expires_at) VALUES (?,?,?,?,?)').run(id, hash(code), label.trim(), createdAt, expiresAt);
    return { id, label:label.trim(), code, expiresAt:new Date(expiresAt).toISOString() };
  }
  function redeem(owner, code) {
    ownerCheck(owner);
    db.exec('BEGIN IMMEDIATE');
    let failure, result;
    try {
      const time = now();
      const throttle = db.prepare('SELECT * FROM beta_redemption_limits WHERE owner=?').get(owner);
      const current = throttle && time - throttle.started_at < 60000;
      if (current && throttle.attempts >= 10) failure = apiError(429, 'BETA_REDEMPTION_LIMIT', 'Too many invitation attempts. Try again in one minute.');
      else {
        db.prepare(`INSERT INTO beta_redemption_limits VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET started_at=excluded.started_at,attempts=excluded.attempts`).run(owner, current ? throttle.started_at : time, current ? throttle.attempts + 1 : 1);
        const row = typeof code === 'string' && /^vault_[a-zA-Z0-9_-]{32}$/.test(code)
          ? db.prepare('SELECT * FROM beta_invites WHERE code_hash=?').get(hash(code)) : null;
        if (!row || row.revoked || row.expires_at <= time || (row.owner && row.owner !== owner)) failure = apiError(403, 'BETA_INVITE_INVALID', 'That invitation is invalid, expired or already used.');
        else {
          if (!status(owner).admitted) db.prepare('UPDATE beta_invites SET owner=?,claimed_at=? WHERE id=?').run(owner, time, row.id);
          result = status(owner);
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (failure) throw failure;
    return result;
  }
  return { status, assertAccess, issue, redeem, paused, publicAdmission,
    revoke(id) {
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Use an invitation ID from the list.');
      if (!db.prepare('UPDATE beta_invites SET revoked=1 WHERE id=?').run(id).changes) throw new Error('Invitation not found.');
      return { revoked:true, id };
    },
    setPaused(value) { if (typeof value !== 'boolean') throw new Error('Pause requires a boolean.'); db.prepare("UPDATE beta_settings SET value=? WHERE name='paused'").run(String(value)); return { paused:value }; },
    list:() => db.prepare('SELECT id,label,created_at,expires_at,revoked,owner,claimed_at FROM beta_invites ORDER BY created_at DESC LIMIT 500').all(),
    close:() => db.close() };
}
