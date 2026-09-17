import { openDatabase } from '../storage/database.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { validateDeposit, validateDepositAsset } from './deposit.mjs';
import { units, id } from './schema.mjs';
import { verifiedAccountId, verifiedWallet } from '../principal.mjs';
import { apiError } from '../errors.mjs';
import { createDepositMonitorStore } from './deposit-monitor-store.mjs';
import { depositAllocation } from './deposit-allocation.mjs';

export const DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS = 15 * 60000;
export const TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS = 2 * 60 * 60000;

export function unsignedDepositLifetimeMs(config) {
  return config?.policy === 'paid-beta' && config?.environment === 'testnet'
    ? TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS
    : DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS;
}

function resolveUnsignedLifetimeMs(value) {
  if (value == null) return DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS;
  if (value === DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS || value === TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS) return value;
  throw new Error('Unsupported unsigned deposit lifetime.');
}

export function allowedUnsignedDepositLifetimesMs(asset) {
  const allowed = [DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS];
  if (asset?.chainId === '46630') allowed.push(TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS);
  return allowed;
}

// Preparation module only: no HTTP exposure, signing or transfers.
// Principals must come from server authentication; evidence comes from trusted RPC.
// A ledger can supply its connection and a synchronous posting function so evidence
// and credits share one transaction. The standalone form never credits balances.
export function createDepositOrders({ path = ':memory:', asset, now = Date.now, database, postDeposit, env = process.env,
  unsignedLifetimeMs } = {}) {
  const lifetimeMs = resolveUnsignedLifetimeMs(unsignedLifetimeMs);
  const configuredAsset = validateDepositAsset(asset);
  const assetHash = createHash('sha256').update(JSON.stringify(configuredAsset)).digest('hex');
  if (postDeposit && (!database || typeof postDeposit !== 'function')) throw new Error('Deposit posting requires the owning ledger connection.');
  const db = database ?? openDatabase(path, env);
  const ledgerSettings = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_settings'").get();
  if (ledgerSettings && !postDeposit) {
    if (!database) db.close();
    throw new Error('Use the owning ledger for deposit operations; standalone orders cannot consume its evidence.');
  }
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS deposit_orders (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, request_key TEXT NOT NULL,
      document TEXT NOT NULL, UNIQUE(account_id,request_key));
    CREATE TABLE IF NOT EXISTS deposit_evidence (deposit_key TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deposit_checks (sequence INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL,
      status TEXT NOT NULL, checked_at INTEGER NOT NULL, ledger_sequence INTEGER);
    CREATE TABLE IF NOT EXISTS inbound_observe_cursor (id INTEGER PRIMARY KEY CHECK(id=1), through_block TEXT NOT NULL);`);
  if (!db.prepare('PRAGMA table_info(deposit_checks)').all().some(column => column.name === 'ledger_sequence')) {
    // A missing historical position cannot be reconstructed from a timestamp.
    db.exec('ALTER TABLE deposit_checks ADD COLUMN ledger_sequence INTEGER');
  }
  const monitorStore = createDepositMonitorStore(db);
  const principalId = verifiedAccountId;
  function get(orderId, principal) {
    const row = db.prepare('SELECT * FROM deposit_orders WHERE id=? AND account_id=?').get(id(orderId), principalId(principal));
    if (!row) throw apiError(404, 'DEPOSIT_NOT_FOUND', 'Deposit order not found.');
    const order = JSON.parse(row.document);
    if (order.assetHash !== assetHash) throw new Error('This order belongs to another frozen asset configuration.');
    return order;
  }
  function byKey(key, principal) {
    const row = db.prepare('SELECT id FROM deposit_orders WHERE account_id=? AND request_key=?').get(principalId(principal), id(key));
    return row ? get(row.id, principal) : null;
  }
  function list(principal, { before } = {}) {
    const owner = principalId(principal);
    if (before !== undefined) get(before, principal); // Foreign and missing cursors look identical.
    const rows = before === undefined
      ? db.prepare('SELECT id FROM deposit_orders WHERE account_id=? ORDER BY rowid DESC LIMIT 21').all(owner)
      : db.prepare('SELECT id FROM deposit_orders WHERE account_id=? AND rowid < (SELECT rowid FROM deposit_orders WHERE id=?) ORDER BY rowid DESC LIMIT 21').all(owner, before);
    return { orders: rows.slice(0, 20).map(row => get(row.id, principal)), nextCursor: rows.length > 20 ? rows[19].id : null };
  }
  const save = order => db.prepare('UPDATE deposit_orders SET document=? WHERE id=?').run(JSON.stringify(order), order.id);
  const observe = (orderId, status) => db.prepare('INSERT INTO deposit_checks(order_id,status,checked_at,ledger_sequence) VALUES (?, ?, ?, ?)')
    .run(orderId, status, now(), postDeposit ? db.prepare('SELECT COALESCE(MAX(sequence),0) AS position FROM events').get().position : null);
  function create({ key, owner, minimumReceived, allocation, inboundObserve = false }, principal, { chainHead } = {}) {
    const accountId = principalId(principal); id(key);
    allocation = depositAllocation(allocation);
    owner = verifiedWallet(principal, owner);
    if (owner === configuredAsset.destination) throw new Error('The deposit sender cannot be the destination.');
    if (!units(minimumReceived)) throw new Error('A positive minimum amount in base units is required.');
    if (typeof chainHead !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(chainHead)) throw new Error('A fresh trusted RPC head is required to exclude earlier transfers.');
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db.prepare('SELECT id FROM deposit_orders WHERE account_id=? AND request_key=?').get(accountId, key);
      if (existing) {
        const previous = get(existing.id, principal);
        if (previous.owner !== owner || previous.minimumReceived !== minimumReceived || JSON.stringify(previous.allocation) !== JSON.stringify(allocation)) throw new Error('A deposit request key cannot change its sender, amount or allocation.');
        db.exec('COMMIT'); return previous;
      }
      const createdAt = now();
      const order = { id: randomUUID(), accountId, owner, minimumReceived, assetHash, asset: configuredAsset,
        createdAt, expiresAt: createdAt + lifetimeMs, earliestBlock: String(BigInt(chainHead) + 1n),
        state: 'awaiting-transaction', credited: false, mode: 'preparation-only',
        ...(allocation ? { allocation } : {}), ...(inboundObserve ? { inboundObserve: true } : {}) };
      db.prepare('INSERT INTO deposit_orders VALUES (?, ?, ?, ?)').run(order.id, accountId, key, JSON.stringify(order));
      db.exec('COMMIT'); return structuredClone(order);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function submit(orderId, principal, transactionHash) {
    if (typeof transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) throw new Error('An explicit transaction hash is required.');
    transactionHash = transactionHash.toLowerCase();
    db.exec('BEGIN IMMEDIATE');
    try {
      const order = get(orderId, principal), previous = order.submittedTransactionHash ?? order.transactionHash;
      if (previous) {
        if (previous !== transactionHash) throw new Error('A submitted transfer cannot be replaced.');
        db.exec('COMMIT'); return order;
      }
      const submittedAt = now();
      if (submittedAt < order.createdAt) throw new Error('Submission time precedes the deposit order.');
      if (submittedAt > order.expiresAt) throw new Error('Order expired. Late transfers require investigation; no credits were issued.');
      Object.assign(order, { submittedTransactionHash: transactionHash, submittedAt, state: 'awaiting-receipt' }); save(order);
      db.exec('COMMIT'); return order;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function attach(orderId, principal, { transactionHash, logIndex }, assertPermit = () => {}) {
    if (typeof transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(transactionHash) ||
        typeof logIndex !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(logIndex)) throw new Error('An explicit transaction hash and log index are required.');
    transactionHash = transactionHash.toLowerCase(); logIndex = '0x' + BigInt(logIndex).toString(16);
    db.exec('BEGIN IMMEDIATE');
    try {
      assertPermit();
      const order = get(orderId, principal);
      if (order.submittedTransactionHash && order.submittedTransactionHash !== transactionHash) throw new Error('A submitted transfer cannot be replaced.');
      if (order.transactionHash) {
        if (order.transactionHash !== transactionHash || order.logIndex !== logIndex) throw new Error('An attached transfer cannot be replaced.');
        db.exec('COMMIT'); return order;
      }
      const attachedAt = now();
      if ((order.submittedAt ?? attachedAt) > order.expiresAt) throw new Error('Order expired. Late transfers require investigation; no credits were issued.');
      if (attachedAt < (order.submittedAt ?? order.createdAt)) throw new Error('Attachment time precedes the deposit order or submission.');
      Object.assign(order, { transactionHash, logIndex, attachedAt, state: 'awaiting-evidence' }); save(order);
      db.exec('COMMIT'); return order;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function markUnavailable(orderId, principal, reason = 'rpc-unavailable', assertPermit = () => {}) {
    if (!['rpc-unavailable', 'reconciliation-error'].includes(reason)) throw new Error('Invalid deposit observation.');
    db.exec('BEGIN IMMEDIATE');
    try {
      assertPermit();
      const order = get(orderId, principal);
      if (order.credited) { order.accountingHold = true; save(order); observe(orderId, reason); }
      db.exec('COMMIT');
      return { credited: order.credited, accountingHold: Boolean(order.accountingHold) };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function reconcile(orderId, principal, evidence, assertPermit = () => {}) {
    db.exec('BEGIN IMMEDIATE');
    try {
      assertPermit();
      const order = get(orderId, principal);
      if (!order.transactionHash) throw new Error('Attach a transaction before reconciling it.');
      const result = validateDeposit({ asset: configuredAsset, order, evidence });
      if (result.status === 'pending') {
        if (order.credited) { order.accountingHold = true; save(order); }
        observe(orderId, order.credited ? 'credited-evidence-pending' : 'pending');
        db.exec('COMMIT');
        return { ...result, credited: order.credited, accountingHold: Boolean(order.accountingHold), realFundsEnabled: false };
      }
      if (BigInt(result.blockNumber) < BigInt(order.earliestBlock)) throw new Error('The transfer predates this deposit order.');
      const previous = db.prepare('SELECT * FROM deposit_evidence WHERE deposit_key=? OR order_id=?').all(result.depositKey, order.id);
      const stable = ['blockHash', 'blockNumber', 'amount', 'owner', 'destination', 'decimals'];
      if (previous.some(row => row.order_id !== order.id || row.deposit_key !== result.depositKey ||
        stable.some(field => JSON.parse(row.document)[field] !== result[field]))) {
        throw new Error('Transfer evidence is already claimed or changed after verification. No additional credits were issued.');
      }
      if (!previous.length) {
        db.prepare('INSERT INTO deposit_evidence VALUES (?, ?, ?)').run(result.depositKey, order.id, JSON.stringify({ ...result, rpcEvidence: evidence }));
        if (postDeposit) { order.accounting = postDeposit(order, result); order.credited = true; }
      }
      order.state = order.credited ? (order.allocation ? 'funding-recorded' : 'credit-recorded') : 'evidence-prepared'; order.accountingHold = false;
      save(order); observe(orderId, order.credited ? 'credit-verified' : 'evidence-verified'); db.exec('COMMIT');
      return { ...result, mode: order.credited ? 'rpc-credit-preparation' : 'preparation-only', credited: order.credited,
        accounting: order.accounting ?? null, accountingHold: false, realFundsEnabled: false, firstEvidence: previous.length === 0 };
    } catch (error) {
      db.exec('ROLLBACK');
      // Preserve credited obligations and pause spending instead of inventing a reversal.
      markUnavailable(orderId, principal, 'reconciliation-error', assertPermit);
      throw error;
    }
  }
  const holds = () => db.prepare('SELECT document FROM deposit_orders').all().map(row => JSON.parse(row.document))
    .filter(order => order.credited && order.accountingHold).map(order => order.id);
  // Internal worker enumeration only. No HTTP endpoint exposes these owner scopes.
  function monitorPage({ after = 0, through, limit = 10 } = {}) {
    through ??= db.prepare('SELECT COALESCE(MAX(rowid),0) AS last FROM deposit_orders').get().last;
    if (![after, through, limit].every(Number.isSafeInteger) || after < 0 || through < after || limit < 1 || limit > 50) throw new Error('Invalid deposit monitor page.');
    const rows = db.prepare(`SELECT rowid AS position, document FROM deposit_orders WHERE rowid > ? AND rowid <= ?
      AND (json_extract(document,'$.transactionHash') IS NOT NULL OR json_extract(document,'$.submittedTransactionHash') IS NOT NULL)
      ORDER BY rowid LIMIT ?`).all(after, through, limit + 1);
    return { through, records: rows.slice(0, limit).map(row => ({ position: row.position, order: JSON.parse(row.document) })),
      nextCursor: rows.length > limit ? rows[limit - 1].position : null };
  }
  // Operator export only: account IDs and wallet links are private, not public telemetry.
  const exportAll = () => ({ formatVersion: db.prepare('SELECT sequence FROM deposit_checks WHERE ledger_sequence IS NULL LIMIT 1').get() ? 'deposit-records-v1' : 'deposit-records-v2',
    orders: db.prepare('SELECT document FROM deposit_orders ORDER BY rowid').all().map(row => JSON.parse(row.document)),
    evidence: db.prepare('SELECT document FROM deposit_evidence ORDER BY rowid').all().map(row => JSON.parse(row.document)),
    checks: db.prepare('SELECT * FROM deposit_checks ORDER BY sequence').all() });
  const inboundThrough = () => db.prepare('SELECT through_block FROM inbound_observe_cursor WHERE id=1').get()?.through_block ?? null;
  function setInboundThrough(block) {
    if (typeof block !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(block)) throw new Error('Invalid inbound cursor.');
    db.prepare('INSERT INTO inbound_observe_cursor(id, through_block) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET through_block=excluded.through_block')
      .run(block.toLowerCase());
  }
  return { create, get, byKey, list, submit, attach, reconcile, markUnavailable, holds, monitorPage, monitorStore,
    inboundThrough, setInboundThrough, exportAll, close: () => { if (!database) db.close(); } };
}
