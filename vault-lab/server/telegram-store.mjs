import { DatabaseSync } from 'node:sqlite';

export function createTelegramStore(path = ':memory:', now = Date.now) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS telegram_updates(bot TEXT, id INTEGER, owner TEXT, reply TEXT, PRIMARY KEY(bot,id));
    CREATE TABLE IF NOT EXISTS telegram_players(owner TEXT PRIMARY KEY, profile TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS telegram_cursor(bot TEXT PRIMARY KEY, id INTEGER, seen INTEGER);`);
  const profile = owner => JSON.parse(db.prepare('SELECT profile FROM telegram_players WHERE owner=?').get(owner)?.profile || '{}');
  const save = (owner, value) => db.prepare('INSERT INTO telegram_players VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET profile=excluded.profile').run(owner, JSON.stringify(value));
  return {
    profile,
    offset(bot) {
      const cursor = db.prepare('SELECT * FROM telegram_cursor WHERE bot=?').get(String(bot));
      // Telegram can randomize update IDs after a week without updates.
      return cursor && now() - cursor.seen < 6 * 86400000 ? cursor.id + 1 : 0;
    },
    claim(bot, id, owner) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const inserted = db.prepare('INSERT OR IGNORE INTO telegram_updates(bot,id,owner) VALUES (?,?,?)').run(String(bot), id, owner).changes;
        db.prepare('INSERT INTO telegram_cursor VALUES (?,?,?) ON CONFLICT(bot) DO UPDATE SET id=excluded.id,seen=excluded.seen').run(String(bot), id, now());
        db.exec('COMMIT'); return Boolean(inserted);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    pending(owner) { save(owner, { ...profile(owner), pending: true }); },
    finish(bot, id, owner, reply, value) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare('SELECT owner,reply FROM telegram_updates WHERE bot=? AND id=?').get(String(bot), id);
        if (!row || row.owner !== owner || row.reply !== null) throw new Error('Telegram update is not pending.');
        if (value) save(owner, value);
        db.prepare('UPDATE telegram_updates SET reply=? WHERE bot=? AND id=?').run(reply, String(bot), id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close: () => db.close()
  };
}
