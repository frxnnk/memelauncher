// Same connection as deposit orders/accounting. A worker takeover cannot commit
// between a permission check inside BEGIN IMMEDIATE and that deposit write.
export function createDepositMonitorStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS deposit_monitor_binding (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deposit_monitor_state (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL);`);
  const read = () => {
    const row = db.prepare('SELECT document FROM deposit_monitor_state WHERE id=1').get();
    if (!row) throw new Error('Deposit monitoring is not configured for this ledger.');
    return JSON.parse(row.document);
  };
  return {
    bind(binding) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const document = JSON.stringify(binding);
        const previous = db.prepare('SELECT document FROM deposit_monitor_binding WHERE id=1').get();
        if (previous && previous.document !== document) throw new Error('Deposit monitor belongs to another ledger, asset or frozen policy.');
        db.prepare('INSERT OR IGNORE INTO deposit_monitor_binding VALUES (1, ?)').run(document);
        db.prepare('INSERT OR IGNORE INTO deposit_monitor_state VALUES (1, ?)').run(JSON.stringify({ leaseOwner: null, leaseUntil: 0,
          sweep: null, lastVerifiedSince: null, lastCompletedAt: null, lastResult: null }));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    read,
    change(update) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const state = read(); update(state);
        db.prepare('UPDATE deposit_monitor_state SET document=? WHERE id=1').run(JSON.stringify(state));
        db.exec('COMMIT'); return state;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
}
