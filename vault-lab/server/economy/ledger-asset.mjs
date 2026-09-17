import { createHash, randomUUID } from 'node:crypto';
import { validateDepositAsset } from './deposit.mjs';
import { UNIT } from './schema.mjs';

// A preparation ledger records RPC evidence; it is not a payment permission.
// Freeze the denomination before the first balance and never relabel TEST funds.
export function initializeLedgerAsset(db, asset) {
  const configured = asset === undefined ? null : validateDepositAsset(asset);
  const document = JSON.stringify({ mode: configured ? 'rpc-credit-preparation' : 'simulation', asset: configured });
  db.exec('PRAGMA busy_timeout=3000; BEGIN IMMEDIATE');
  try {
    const hasSettings = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_settings'").get();
    const previous = hasSettings && db.prepare('SELECT document FROM ledger_settings WHERE id=1').get();
    if (previous && previous.document !== document) throw new Error('Ledger denomination is frozen; use a separate database for another asset or TEST mode.');
    if (!previous && configured && db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('balances','deposit_orders')").get()) {
      throw new Error('An existing TEST or deposit-only database cannot be converted into token credits.');
    }
    db.exec('CREATE TABLE IF NOT EXISTS ledger_settings (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL)');
    db.prepare('INSERT OR IGNORE INTO ledger_settings VALUES (1, ?)').run(document);
    db.exec('CREATE TABLE IF NOT EXISTS ledger_identity (id INTEGER PRIMARY KEY CHECK(id=1), instance_id TEXT NOT NULL)');
    db.prepare('INSERT OR IGNORE INTO ledger_identity VALUES (1, ?)').run(randomUUID());
    // Earlier engines must not reinterpret a prize contribution as player credit.
    if (configured) db.exec('PRAGMA user_version=6');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const assetHash = configured && createHash('sha256').update(JSON.stringify(configured)).digest('hex');
  return { asset: configured, assetHash, instanceId: db.prepare('SELECT instance_id FROM ledger_identity WHERE id=1').get().instance_id,
    unit: configured ? { symbol: null, decimals: configured.decimals, mode: 'rpc-credit-preparation',
      chainId: configured.chainId, tokenAddress: configured.tokenAddress, creditBaseUnitsPerReceivedUnit: '1' } : UNIT };
}
