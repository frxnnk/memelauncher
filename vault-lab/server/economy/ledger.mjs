import { openDatabase } from '../storage/database.mjs';
import { createHash } from 'node:crypto';
import { SCHEMA, MAX_UNITS, units, id, playerAccount, migratePaidBetaRoundColumns } from './schema.mjs';
import { applyOperation, auditLedger } from './operations.mjs';
import { initializeLedgerAsset } from './ledger-asset.mjs';
import { createDepositOrders } from './deposit-orders.mjs';
import { depositAllocation } from './deposit-allocation.mjs';

const allowed = {
  'open-round': ['roundId', 'price', 'prizeBps', 'operationsBps', 'configuration',
    'winRetainBps', 'priceStep', 'maximumPrice', 'durationMonths', 'retireKey'],
  topup: ['player', 'amount'], 'refund-credits': ['player', 'amount'],
  contribution: ['roundId', 'amount', 'source', 'received'], 'seed-next-round': ['roundId', 'amount'],
  reserve: ['roundId', 'attemptId', 'player', 'recipient'], start: ['attemptId'], unknown: ['attemptId'],
  'cancel-reservation': ['attemptId'], settle: ['attemptId', 'outcome', 'receiptRef', 'reconciled'],
  payout: ['roundId'], 'record-payout': ['roundId', 'amount', 'recipient', 'transactionHash', 'logIndex'],
  'expire-round': ['roundId']
};

export function createLedger({ path = ':memory:', now = () => new Date().toISOString(), asset, env = process.env,
  unsignedLifetimeMs } = {}) {
  const db = openDatabase(path, env);
  let denomination;
  try {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    const settings = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_settings'").get();
    const settingsDocument = settings && db.prepare('SELECT document FROM ledger_settings WHERE id=1').get()?.document;
    const recognizedAssetLedger = [2,3,4,5,6].includes(version) && settingsDocument && JSON.parse(settingsDocument).mode === 'rpc-credit-preparation';
    if (![0,1].includes(version) && !recognizedAssetLedger) throw new Error('Unsupported ledger schema. Use the matching application version; this file was not migrated.');
    denomination = initializeLedgerAsset(db, asset);
    db.exec(SCHEMA);
    migratePaidBetaRoundColumns(db);
    if (denomination.asset) db.exec('CREATE TABLE IF NOT EXISTS attempt_recipients (attempt_id TEXT PRIMARY KEY REFERENCES attempts(id), address TEXT NOT NULL)');
    db.exec(`CREATE TABLE IF NOT EXISTS payout_claims (
      round_id TEXT PRIMARY KEY, recipient TEXT NOT NULL, amount TEXT NOT NULL,
      submitted_transaction_hash TEXT, transaction_hash TEXT, log_index TEXT,
      state TEXT NOT NULL, created_at TEXT NOT NULL)`);
    if (!denomination.asset) db.exec('PRAGMA user_version=1');
  } catch(error) { db.close(); throw error; }
  const get = account => units(db.prepare('SELECT amount FROM balances WHERE account = ?').get(account)?.amount ?? '0');
  const add = (account, delta) => {
    const next = get(account) + delta;
    if (next < 0n) throw new Error('Insufficient available balance.');
    if (next > MAX_UNITS) throw new Error('Balance exceeds the supported amount.');
    db.prepare('INSERT INTO balances(account,amount) VALUES (?, ?) ON CONFLICT(account) DO UPDATE SET amount = excluded.amount').run(account, String(next));
  };
  const move = (from, to, amount) => { add(from, -amount); add(to, amount); };
  const audit = () => auditLedger(db, get);
  const recipient = attemptId => db.prepare('SELECT address FROM attempt_recipients WHERE attempt_id=?').get(attemptId)?.address ?? null;

  function record(key, request, result, createdAt = now()) {
    const serialized = JSON.stringify(request);
    const hash = createHash('sha256').update(serialized).digest('hex');
    const inserted = db.prepare('INSERT INTO events(key,request_hash,request,result,created_at) VALUES (?, ?, ?, ?, ?)')
      .run(key, hash, serialized, JSON.stringify(result), createdAt);
    return Number(inserted.lastInsertRowid);
  }
  const deposits = denomination.asset ? createDepositOrders({ database: db, asset: denomination.asset,
    now: () => new Date(now()).getTime(), unsignedLifetimeMs, postDeposit: (order, evidence) => {
      const amount = units(evidence.amount), allocation = depositAllocation(order.allocation);
      add('custody', amount); add(allocation ? 'treasury:next' : playerAccount(order.accountId, 'available'), amount);
      audit();
      const key = 'deposit-' + createHash('sha256').update(evidence.depositKey).digest('hex');
      const request = { type: allocation ? 'verified-prize-funding' : 'verified-deposit', orderId: order.id, depositKey: evidence.depositKey,
        assetHash: denomination.assetHash, ...(allocation ? { funder: order.accountId, allocation } : { player: order.accountId }), amount: evidence.amount };
      const result = { ...(allocation ? { funder: order.accountId, allocation, playerCredits: '0' } : { player: order.accountId }),
        received: evidence.amount, source: 'trusted-rpc-standard-transfer', realFundsEnabled: false };
      return { ...result, eventSequence: record(key, request, result) };
    } }) : null;

  function execute(key, input) {
    id(key);
    if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(allowed, input.type) ||
      Object.keys(input).some(k => k !== 'type' && !allowed[input.type].includes(k))) throw new Error('Invalid accounting request.');
    if (deposits && ['topup', 'refund-credits', 'contribution', 'payout'].includes(input.type)) {
      throw new Error('Simulated minting, contributions and transfers are disabled in the asset preparation ledger.');
    }
    if (input.type === 'record-payout') {
      if (typeof input.transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(input.transactionHash)) throw new Error('An explicit payout transaction hash is required.');
      if (typeof input.logIndex !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(input.logIndex)) throw new Error('An explicit payout log index is required.');
      input.transactionHash = input.transactionHash.toLowerCase();
      if (typeof input.recipient !== 'string' || !/^0x[0-9a-f]{40}$/.test(input.recipient)) throw new Error('Payout recipient must match the frozen winner wallet.');
    }
    if (input.type === 'reserve' && deposits && (typeof input.recipient !== 'string' || !/^0x[0-9a-f]{40}$/.test(input.recipient) || /^0x0{40}$/.test(input.recipient))) {
      throw new Error('An asset attempt requires its fixed payout recipient before reservation.');
    }
    if (!deposits && input.type !== 'record-payout' && Object.hasOwn(input, 'recipient')) throw new Error('TEST attempts do not configure wallet recipients.');
    const request = Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
    const serialized = JSON.stringify(request);
    const hash = createHash('sha256').update(serialized).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous = db.prepare('SELECT * FROM events WHERE key = ?').get(key);
      if (previous) {
        if (previous.request_hash !== hash) throw new Error('Idempotency key already belongs to a different request.');
        db.exec('COMMIT');
        return { ...JSON.parse(previous.result), replayed: true, eventSequence: previous.sequence };
      }
      if (deposits?.holds().length && ['reserve', 'start', 'settle', 'seed-next-round'].includes(input.type) &&
          !(input.type === 'settle' && input.outcome === 'error')) throw new Error('Deposit reconciliation is required before spending more credits.');
      if (deposits && input.type === 'settle' && input.outcome === 'released' && !recipient(input.attemptId)) {
        throw new Error('A legacy asset attempt without a fixed recipient cannot authorize a winning liability.');
      }
      if (deposits && input.type === 'record-payout') {
        const roundRow = db.prepare('SELECT state FROM rounds WHERE id = ?').get(input.roundId);
        if (roundRow?.state !== 'won') throw new Error('Only an unpaid winning round can be paid.');
        const released = db.prepare("SELECT id FROM attempts WHERE round_id = ? AND state = 'released'").get(input.roundId);
        const frozen = released && recipient(released.id);
        if (!frozen || frozen !== input.recipient) throw new Error('Payout recipient must match the frozen winner wallet.');
      }
      const clock = now();
      const result = applyOperation(db, { get, add, move }, request, clock);
      if (deposits && input.type === 'reserve') {
        db.prepare('INSERT INTO attempt_recipients VALUES (?, ?)').run(input.attemptId, input.recipient);
        result.recipient = input.recipient;
      }
      if (deposits && input.type === 'settle' && input.outcome === 'released') result.winnerRecipient = recipient(input.attemptId);
      if (input.type === 'record-payout') {
        db.prepare(`INSERT INTO payout_claims(round_id,recipient,amount,submitted_transaction_hash,transaction_hash,log_index,state,created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'paid', ?)
          ON CONFLICT(round_id) DO UPDATE SET transaction_hash=excluded.transaction_hash, log_index=excluded.log_index, state='paid'`)
          .run(input.roundId, input.recipient, input.amount, input.transactionHash, input.transactionHash, input.logIndex, clock);
      }
      audit();
      const eventSequence = record(key, request, result, clock);
      db.exec('COMMIT');
      return { ...result, replayed: false, eventSequence };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  function snapshot(allEvents = false) {
    // Keep all component reads in one consistent snapshot if another connection writes.
    db.exec('BEGIN');
    try {
      const result = {
        unit: denomination.unit, instanceId: denomination.instanceId, realFundsEnabled: false,
        evidence: deposits ? 'rpc-credit-preparation-not-independent-proof' : 'local-simulation-ledger',
        asset: denomination.asset, assetHash: denomination.assetHash, depositHolds: deposits?.holds() ?? [],
        ...(allEvents && deposits ? { depositRecords: deposits.exportAll() } : {}),
        audit: audit(), balances: db.prepare('SELECT account, amount FROM balances ORDER BY account').all(),
        rounds: db.prepare('SELECT * FROM rounds ORDER BY rowid DESC').all(),
        attempts: db.prepare('SELECT * FROM attempts ORDER BY position DESC').all().map(attempt => deposits ? { ...attempt, recipient: recipient(attempt.id) } : attempt),
        events: db.prepare(allEvents ? 'SELECT * FROM events ORDER BY sequence' : 'SELECT * FROM events ORDER BY sequence DESC LIMIT 60').all().map(row => ({
          sequence: row.sequence, key: row.key, requestHash: row.request_hash, createdAt: row.created_at, request: JSON.parse(row.request), result: JSON.parse(row.result)
        })), eventCount: db.prepare('SELECT COUNT(*) AS count FROM events').get().count
      };
      db.exec('COMMIT');
      return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  function payoutClaim(roundId) {
    return db.prepare('SELECT * FROM payout_claims WHERE round_id=?').get(id(roundId)) ?? null;
  }
  function submitPayoutClaim(roundId, { transactionHash, recipient, amount }) {
    if (typeof transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) throw new Error('An explicit transaction hash is required.');
    transactionHash = transactionHash.toLowerCase();
    const createdAt = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = payoutClaim(roundId);
      const previous = existing?.submitted_transaction_hash ?? existing?.transaction_hash;
      if (previous) {
        if (previous !== transactionHash) throw new Error('A submitted transfer cannot be replaced.');
        db.exec('COMMIT');
        return existing;
      }
      db.prepare(`INSERT INTO payout_claims(round_id,recipient,amount,submitted_transaction_hash,state,created_at)
        VALUES (?, ?, ?, ?, 'awaiting-receipt', ?)`)
        .run(roundId, recipient, amount, transactionHash, createdAt);
      const row = payoutClaim(roundId);
      db.exec('COMMIT');
      return row;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  return { execute, deposits, snapshot: () => snapshot(), exportAll: () => snapshot(true), audit, close: () => db.close(),
    payoutClaim, submitPayoutClaim };
}
