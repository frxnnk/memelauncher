import { openDatabase } from './storage/database.mjs';

export function createSessionStore({ path = ':memory:', env = process.env } = {}) {
  const db = openDatabase(path, env);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS vault_sessions (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS vault_receipts (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
      owner TEXT NOT NULL, document TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS vault_receipts_owner_sequence ON vault_receipts(owner, sequence);`);
  return {
    get(id) {
      const row = db.prepare('SELECT document FROM vault_sessions WHERE id = ?').get(id);
      return row ? JSON.parse(row.document) : null;
    },
    set(id, session) {
      db.prepare('INSERT INTO vault_sessions(id,updated_at,document) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, document=excluded.document')
        .run(id, session.updatedAt, JSON.stringify(session));
    },
    prune(before) { db.prepare('DELETE FROM vault_sessions WHERE updated_at < ?').run(before); },
    storeReceipt(owner, receipt) {
      db.prepare('INSERT INTO vault_receipts(id,owner,document) VALUES (?, ?, ?)').run(receipt.id, owner, JSON.stringify(receipt));
    },
    receipt(owner, id) {
      const row = db.prepare('SELECT document FROM vault_receipts WHERE owner=? AND id=?').get(owner, id);
      return row ? JSON.parse(row.document) : null;
    },
    receiptPage(owner, before) {
      const cursor = before ? db.prepare('SELECT sequence FROM vault_receipts WHERE owner=? AND id=?').get(owner, before) : null;
      if (before && !cursor) return null;
      const rows = db.prepare('SELECT document FROM vault_receipts WHERE owner=? AND sequence<? ORDER BY sequence DESC LIMIT 21')
        .all(owner, cursor?.sequence ?? Number.MAX_SAFE_INTEGER);
      const records = rows.slice(0, 20).map(row => JSON.parse(row.document));
      return { records, nextCursor:rows.length > 20 ? records.at(-1).id : null };
    },
    publicReceiptPage(before) {
      const cursor = before ? db.prepare('SELECT sequence FROM vault_receipts WHERE id=?').get(before) : null;
      if (before && !cursor) return null;
      const rows = db.prepare('SELECT owner, document FROM vault_receipts WHERE sequence<? ORDER BY sequence DESC LIMIT 21')
        .all(cursor?.sequence ?? Number.MAX_SAFE_INTEGER);
      const records = rows.slice(0, 20).map(row => ({ owner: row.owner, receipt: JSON.parse(row.document) }));
      return { records, nextCursor: rows.length > 20 ? records.at(-1).receipt.id : null };
    },
    get size() { return db.prepare('SELECT COUNT(*) AS count FROM vault_sessions').get().count; },
    close() { db.close(); }
  };
}
