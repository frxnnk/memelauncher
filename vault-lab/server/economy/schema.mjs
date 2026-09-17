export const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 3000;
CREATE TABLE IF NOT EXISTS balances (account TEXT PRIMARY KEY, amount TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY, state TEXT NOT NULL, price TEXT NOT NULL,
  prize_bps INTEGER NOT NULL, operations_bps INTEGER NOT NULL,
  configuration TEXT NOT NULL, winner TEXT,
  win_retain_bps INTEGER NOT NULL DEFAULT 0, price_step TEXT NOT NULL DEFAULT '0',
  maximum_price TEXT, opened_at TEXT, expires_at TEXT,
  seed_amount TEXT NOT NULL DEFAULT '0', player_prize_amount TEXT NOT NULL DEFAULT '0',
  retire_key TEXT
);
CREATE TABLE IF NOT EXISTS retired_configurations (
  configuration TEXT PRIMARY KEY, round_id TEXT NOT NULL, retired_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  position INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(id), player TEXT NOT NULL,
  state TEXT NOT NULL, price TEXT NOT NULL, receipt_ref TEXT
);
CREATE TABLE IF NOT EXISTS events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL,
  request_hash TEXT NOT NULL, request TEXT NOT NULL, result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO balances(account, amount) VALUES ('custody', '0');
`;

export function migratePaidBetaRoundColumns(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(rounds)').all().map(row => row.name));
  const add = (name, definition) => { if (!columns.has(name)) db.exec(`ALTER TABLE rounds ADD COLUMN ${definition}`); };
  add('win_retain_bps', 'win_retain_bps INTEGER NOT NULL DEFAULT 0');
  add('price_step', "price_step TEXT NOT NULL DEFAULT '0'");
  add('maximum_price', 'maximum_price TEXT');
  add('opened_at', 'opened_at TEXT');
  add('expires_at', 'expires_at TEXT');
  add('seed_amount', "seed_amount TEXT NOT NULL DEFAULT '0'");
  add('player_prize_amount', "player_prize_amount TEXT NOT NULL DEFAULT '0'");
  add('retire_key', 'retire_key TEXT');
  db.exec(`CREATE TABLE IF NOT EXISTS retired_configurations (
    configuration TEXT PRIMARY KEY, round_id TEXT NOT NULL, retired_at TEXT NOT NULL)`);
}

export const UNIT = { symbol: 'TEST', decimals: 0, mode: 'simulation', chainId: null, tokenAddress: null };
export const MAX_UNITS = (1n << 256n) - 1n;
export const PENDING = ['reserved', 'processing', 'unknown'];

export function units(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value) || BigInt(value) > MAX_UNITS) throw new Error('Amount must be an unsigned integer string within 256 bits.');
  return BigInt(value);
}
export function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('Invalid accounting identifier.');
  return value;
}
export const playerAccount = (player, bucket) => `player:${id(player)}:${bucket}`;
export const roundAccount = (round, bucket) => `round:${id(round)}:${bucket}`;

export function roundTerms({ price, prizeBps, operationsBps } = {}) {
  if (!units(price)) throw new Error('Amount must be positive.');
  if (![prizeBps, operationsBps].every(n => Number.isInteger(n) && n >= 0 && n <= 10000) || prizeBps + operationsBps > 10000) {
    throw new Error('Invalid round split.');
  }
  return { price, prizeBps, operationsBps, nextRoundBps: 10000 - prizeBps - operationsBps };
}

export function splitAttemptPrice(input) {
  const terms = roundTerms(input), price = units(terms.price);
  const prize = price * BigInt(terms.prizeBps) / 10000n;
  const operations = price * BigInt(terms.operationsBps) / 10000n;
  const remainder = price - prize - operations;
  if (!terms.nextRoundBps && remainder) {
    return { prize: String(prize), operations: String(operations + remainder), nextRound: '0' };
  }
  return { prize: String(prize), operations: String(operations), nextRound: String(remainder) };
}
