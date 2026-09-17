import { equal } from './verify-ledger.mjs';
import { id, units } from '../server/economy/schema.mjs';
import { validateDeposit } from '../server/economy/deposit.mjs';
import { allowedUnsignedDepositLifetimesMs } from '../server/economy/deposit-orders.mjs';

const fail = message => { throw new Error(message); };
const time = value => {
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isFinite(new Date(value).getTime())) fail('Invalid deposit record timestamp.');
  return value;
};

// Only the verifier's newly created temporary database is accepted by the caller.
// Claimed account/wallet ownership is not authenticated by this offline replay.
export function prepareDepositReplay({ snapshot, ledger, db, setTime }) {
  const records = snapshot.depositRecords;
  if (records?.formatVersion !== 'deposit-records-v2' || !Array.isArray(records.orders) || records.orders.length > 10000 ||
      !Array.isArray(records.evidence) || records.evidence.length > 10000 || !Array.isArray(records.checks) || records.checks.length > 50000) {
    fail('A complete v2 deposit export with recorded accounting positions is required; missing historical positions cannot be invented.');
  }
  const orders = new Map(), evidence = new Map(), checks = new Map(), credited = new Set(), firstChecks = new Set();
  const principal = order => ({ authenticated: true, accountId: order.accountId, walletOwnershipVerified: true,
    wallets: [{ address: order.owner, chainType: 'ethereum' }] });
  for (const order of records.orders) {
    if (!order || orders.has(id(order.id))) fail('Duplicate deposit order.');
    time(order.createdAt);
    if (typeof order.credited !== 'boolean' || !units(order.earliestBlock)
        || !allowedUnsignedDepositLifetimesMs(snapshot.asset).includes(order.expiresAt - order.createdAt) ||
        order.assetHash !== snapshot.assetHash || !equal(order.asset, snapshot.asset)) fail('Deposit order configuration differs from the ledger.');
    setTime(order.createdAt);
    const created = ledger.deposits.create({ key: order.id, owner: order.owner, minimumReceived: order.minimumReceived, allocation: order.allocation }, principal(order),
      { chainHead: '0x' + (units(order.earliestBlock) - 1n).toString(16) });
    // The real order service chooses UUIDs. Remap only this temporary copy so the
    // replayed accounting references the source order; no production import API exists.
    const replayed = { ...created, id: order.id, expiresAt: order.expiresAt };
    db.prepare('UPDATE deposit_orders SET id=?, document=? WHERE id=?').run(order.id, JSON.stringify(replayed), created.id);
    if (order.submittedTransactionHash !== undefined) {
      setTime(time(order.submittedAt));
      if (order.submittedAt < order.createdAt) fail('Deposit submission precedes its order.');
      ledger.deposits.submit(order.id, principal(order), order.submittedTransactionHash);
    }
    if (order.transactionHash !== undefined) {
      setTime(time(order.attachedAt));
      ledger.deposits.attach(order.id, principal(order), { transactionHash: order.transactionHash, logIndex: order.logIndex });
    }
    orders.set(order.id, order);
  }
  for (const record of records.evidence) {
    const order = orders.get(record?.orderId);
    if (!order || evidence.has(order.id) || !order.credited || !record.rpcEvidence) fail('Missing, duplicate or uncredited deposit evidence.');
    const { rpcEvidence, ...reported } = record;
    const validated = validateDeposit({ asset: snapshot.asset, order, evidence: rpcEvidence });
    if (validated.status !== 'verified-rpc-evidence' || !equal(validated, reported) ||
        BigInt(validated.blockNumber) < units(order.earliestBlock)) fail('Reported deposit does not match supplied RPC evidence and order.');
    evidence.set(order.id, record);
  }
  let priorPosition = 0;
  for (const [index, check] of records.checks.entries()) {
    if (!check || check.sequence !== index + 1 || !orders.has(check.order_id) || !Number.isSafeInteger(check.ledger_sequence) ||
        check.ledger_sequence < priorPosition || check.ledger_sequence > snapshot.eventCount ||
        !['pending', 'credit-verified', 'credited-evidence-pending', 'rpc-unavailable', 'reconciliation-error'].includes(check.status)) {
      fail('Invalid deposit observation sequence, status or accounting position.');
    }
    time(check.checked_at); priorPosition = check.ledger_sequence;
    if (!checks.has(check.ledger_sequence)) checks.set(check.ledger_sequence, []);
    checks.get(check.ledger_sequence).push(check);
  }
  function credit(event) {
    const order = orders.get(event.request.orderId), record = order && evidence.get(order.id);
    if (!record || credited.has(order.id)) fail('Accounting references missing or already consumed deposit evidence.');
    const posted = ledger.deposits.reconcile(order.id, principal(order), record.rpcEvidence);
    if (!posted.credited || !posted.firstEvidence || posted.accounting.eventSequence !== event.sequence) fail('Deposit credit could not be reproduced once.');
    credited.add(order.id);
  }
  function observeAt(position) {
    for (const check of checks.get(position) ?? []) {
      const order = orders.get(check.order_id), account = principal(order), state = ledger.deposits.get(order.id, account);
      setTime(check.checked_at);
      if (check.status === 'credit-verified') {
        if (!state.credited) fail('A credit verification precedes its accounting event.');
        if (!firstChecks.has(order.id)) {
          if (state.accounting.eventSequence !== position) fail('The initial credit lacks its observation at the committed event.');
          firstChecks.add(order.id); // Already generated by the real credit transaction.
        } else ledger.deposits.reconcile(order.id, account, evidence.get(order.id).rpcEvidence);
      } else if (['pending', 'credited-evidence-pending'].includes(check.status)) {
        if (state.credited !== (check.status === 'credited-evidence-pending')) fail('Pending observation has the wrong credit state.');
        ledger.deposits.reconcile(order.id, account, { chainId: '0x' + BigInt(snapshot.asset.chainId).toString(16), receipt: null });
      } else {
        if (!state.credited) fail('An uncredited order cannot report an accounting hold.');
        ledger.deposits.markUnavailable(order.id, account, check.status);
      }
    }
  }
  function verifyFinal() {
    if (credited.size !== evidence.size || firstChecks.size !== credited.size) fail('Deposit evidence or its first accounting observation is missing.');
    const rebuilt = ledger.deposits.exportAll();
    if (!equal(rebuilt.orders, records.orders) || !equal(rebuilt.evidence, records.evidence)) {
      fail('Final deposit orders or raw evidence do not reproduce the export.');
    }
    // Timestamp provenance is not independently proved. First credit/check writes
    // may use different milliseconds; ordering is established by the event anchor.
    const positions = rows => rows.map(({ checked_at, ...row }) => ({ ...row }));
    if (!equal(positions(rebuilt.checks), positions(records.checks))) fail('Deposit hold transitions do not reproduce the recorded event positions.');
    return { depositsChecked: credited.size, observationsChecked: records.checks.length };
  }
  return { credit, observeAt, verifyFinal };
}
