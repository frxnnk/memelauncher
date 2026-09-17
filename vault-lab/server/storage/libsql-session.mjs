const BEGIN = /^(?:PRAGMA\s+busy_timeout\s*=\s*\d+\s*;\s*)?BEGIN(?:\s+(IMMEDIATE|DEFERRED|EXCLUSIVE))?\s*;?\s*$/i;
const COMMIT = /^\s*COMMIT\s*;?\s*$/i;
const ROLLBACK = /^\s*ROLLBACK(?:\s+TO\s+\S+)?\s*;?\s*$/i;

function mapRows(rs) {
  return (rs.rows ?? []).map(row => {
    const object = {};
    for (const column of rs.columns ?? []) object[column] = row[column];
    return object;
  });
}

export function createLibsqlSession(client) {
  let tx = null;
  async function target() {
    return tx ?? client;
  }
  async function handle(message) {
    if (message.type === 'close') {
      if (tx) {
        try { await tx.rollback(); } catch { /* already closed */ }
        tx = null;
      }
      await client?.close?.();
      return { ok: true };
    }
    if (message.type === 'exec') {
      const sql = String(message.sql ?? '').trim();
      if (BEGIN.test(sql)) {
        if (tx) throw new Error('A libsql transaction is already open.');
        tx = await client.transaction('write');
        return { ok: true };
      }
      if (COMMIT.test(sql)) {
        if (!tx) throw new Error('cannot commit - no transaction is active');
        await tx.commit();
        tx = null;
        return { ok: true };
      }
      if (ROLLBACK.test(sql)) {
        if (!tx) return { ok: true };
        await tx.rollback();
        tx = null;
        return { ok: true };
      }
      await (await target()).executeMultiple(sql);
      return { ok: true };
    }
    const rs = await (await target()).execute({ sql: message.sql, args: message.args ?? [] });
    const rows = mapRows(rs);
    if (message.type === 'get') return { ok: true, row: rows[0] };
    if (message.type === 'all') return { ok: true, rows };
    return { ok: true, changes: Number(rs.rowsAffected ?? 0), lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
  }
  return { handle };
}
