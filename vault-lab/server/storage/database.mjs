import { DatabaseSync } from 'node:sqlite';
import { basename } from 'node:path';
import { createLibsqlSync } from './libsql-sync.mjs';

// The `memory:` URL is an in-process stand-in for tests. Production uses
// `@libsql/client` on a worker so DatabaseSync call sites stay synchronous.
// One Turso database holds stores whose table names do not collide (sessions,
// beta, usage, funding credits/jobs). Boot keeps sandbox economy and model-job
// files on local sqlite because they reuse ledger/job table names. Never open
// web-funding-testnet on this adapter.

const backends = new Map();
const backendRefs = new Map();
const REHEARSAL = /web-funding-testnet|rh-test-amzn|[\\/]vault-beta[\\/]shared|\\vault-beta\\shared/i;

export function resetDurableBackends() {
  for (const db of backends.values()) {
    try { db.close(); } catch { /* already closed */ }
  }
  backends.clear();
  backendRefs.clear();
}

export function durableStore(env = {}) {
  if (env.VAULT_DURABLE_DATA !== 'true') return { enabled: false, driver: 'sqlite-file' };
  const url = env.VAULT_LIBSQL_URL?.trim();
  if (!url) throw new Error('VAULT_DURABLE_DATA requires VAULT_LIBSQL_URL (libsql://, https://, or memory: for tests).');
  if (url.startsWith('memory:')) {
    if (env.VERCEL === '1' || env.VAULT_HOSTING === 'vercel') {
      throw new Error('Vercel durable data cannot use a memory: libsql URL. Use a remote Turso database.');
    }
    return { enabled: true, driver: 'memory', url };
  }
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('VAULT_LIBSQL_URL must be a libsql or https Turso URL.'); }
  if (!['libsql:', 'https:'].includes(parsed.protocol)) {
    throw new Error('VAULT_LIBSQL_URL must use libsql:// or https://.');
  }
  const authToken = env.VAULT_LIBSQL_AUTH_TOKEN?.trim();
  if (!authToken) throw new Error('VAULT_LIBSQL_AUTH_TOKEN is required for a remote libsql database.');
  return { enabled: true, driver: 'libsql', url: parsed.href, authToken };
}

function storeName(path) {
  if (path === ':memory:') return 'memory';
  const base = basename(String(path)).replace(/\.sqlite$/i, '') || 'store';
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(base)) throw new Error('Invalid sqlite store name.');
  return base;
}

function isSandboxLedgerPath(path) {
  const base = basename(String(path)).replace(/\.sqlite$/i, '');
  return base === 'economy-sandbox' || base === 'model-jobs';
}

function assertNotRehearsal(path) {
  if (REHEARSAL.test(String(path))) {
    throw new Error('The durable store refuses the AMZN rehearsal ledger (web-funding-testnet). Use a new paid-beta data directory.');
  }
}

function retain(url, create) {
  if (!backends.has(url)) {
    backends.set(url, create());
    backendRefs.set(url, 0);
  }
  backendRefs.set(url, (backendRefs.get(url) ?? 0) + 1);
  return backends.get(url);
}

function rewriteExec(sql, store) {
  return sql
    .replace(/PRAGMA\s+journal_mode\s*=\s*WAL\s*;?/gi, '')
    .replace(/PRAGMA\s+busy_timeout\s*=\s*\d+\s*;?/gi, '')
    .replace(/PRAGMA\s+user_version\s*=\s*(\d+)/gi, (_, version) =>
      `INSERT INTO vault_store_meta(store, user_version) VALUES ('${store}', ${version}) ON CONFLICT(store) DO UPDATE SET user_version=excluded.user_version`);
}

function rewriteQuery(sql, store) {
  const trimmed = sql.trim();
  if (/^PRAGMA\s+user_version\s*$/i.test(trimmed)) {
    return `SELECT COALESCE((SELECT user_version FROM vault_store_meta WHERE store = '${store}'), 0) AS user_version`;
  }
  return sql;
}

function wrapRemote(backend, store, url) {
  return {
    exec(sql) {
      const next = rewriteExec(sql, store).trim();
      if (next) backend.exec(next);
    },
    prepare(sql) { return backend.prepare(rewriteQuery(sql, store)); },
    close() {
      const refs = (backendRefs.get(url) ?? 1) - 1;
      backendRefs.set(url, refs);
      if (refs <= 0) {
        try { backend.close(); } catch { /* already closed */ }
        backends.delete(url);
        backendRefs.delete(url);
      }
    }
  };
}

function prepareRemoteBackend(backend) {
  backend.exec('CREATE TABLE IF NOT EXISTS vault_store_meta (store TEXT PRIMARY KEY, user_version INTEGER NOT NULL DEFAULT 0)');
  return backend;
}

export function openDatabase(path, env = process.env, options = {}) {
  const remote = durableStore(env);
  if (!remote.enabled || isSandboxLedgerPath(path)) {
    return options.readOnly ? new DatabaseSync(path, { readOnly: true }) : new DatabaseSync(path);
  }
  assertNotRehearsal(path);
  if (remote.driver === 'memory') {
    const backend = retain(remote.url, () => prepareRemoteBackend(new DatabaseSync(':memory:')));
    return wrapRemote(backend, storeName(path), remote.url);
  }
  const backend = retain(remote.url, () => prepareRemoteBackend(createLibsqlSync({
    url: remote.url, authToken: remote.authToken
  })));
  return wrapRemote(backend, storeName(path), remote.url);
}
