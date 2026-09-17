import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const paths = [
  join(root, '.local/web-funding-testnet/credits.sqlite'),
  join(root, '.local/web-funding-paid-beta/credits.sqlite'),
  join(root, '.local/paid-beta-circuit-2026-09-16T21-15-07-178Z/credits.sqlite'),
  join(root, '.local/economy-sandbox.sqlite')
];

function inspect(path) {
  if (!existsSync(path)) return { path, present: false };
  const db = new DatabaseSync(path, { readOnly: true });
  const tables = db.prepare('SELECT name FROM sqlite_master WHERE type = ?').all('table').map(row => row.name);
  const pick = name => tables.includes(name) ? db.prepare(`SELECT * FROM ${name}`).all() : null;
  const rounds = pick('rounds');
  const balances = pick('balances');
  const available = (balances || []).filter(row => String(row.account || '').includes(':available'));
  db.close();
  return {
    path,
    present: true,
    tables,
    rounds: rounds?.map(row => ({
      id: row.id, state: row.state, price: row.price,
      prize_bps: row.prize_bps, operations_bps: row.operations_bps, next_round_bps: row.next_round_bps
    })),
    available
  };
}

console.log(JSON.stringify({ rehearsalLocal: existsSync(join(root, '.local/web-funding-testnet')), ledgers: paths.map(inspect) }, null, 2));
