import { apiError } from '../errors.mjs';
import { quantity } from './deposit.mjs';
import { findDepositTransfer } from './deposit-transfer.mjs';

// Shared account/worker inspection. The scope is either freshly authenticated or
// the stored account reference from an internal worker page, never a request body.
export async function inspectDepositFromRpc({ orders, reader, orderId, principal, assertPermit = () => {} }) {
  const order = orders.get(orderId, principal), transactionHash = order.transactionHash ?? order.submittedTransactionHash;
  if (!transactionHash) throw apiError(409, 'DEPOSIT_NOT_SUBMITTED', 'No transaction reference has been recorded for this order.');
  let evidence;
  try { evidence = await reader.evidence({ ...order, transactionHash }); }
  catch {
    orders.markUnavailable(order.id, principal, 'rpc-unavailable', assertPermit);
    throw apiError(502, 'DEPOSIT_RPC_UNAVAILABLE', 'The transaction reference is saved. Its evidence could not be checked; do not send again.');
  }
  assertPermit(); // Writes also check under the owning ledger's transaction lock.
  let ledgerReconciliationStarted = false;
  try {
    if (quantity(evidence.chainId) !== BigInt(order.asset.chainId)) throw new Error('Wrong network.');
    if (!order.transactionHash) {
      const selected = findDepositTransfer(order, evidence);
      if (selected.logIndex === undefined) return { order: orders.get(order.id, principal), verification: selected };
      orders.attach(order.id, principal, { transactionHash, logIndex: selected.logIndex }, assertPermit);
    }
    ledgerReconciliationStarted = true;
    const verification = orders.reconcile(order.id, principal, evidence, assertPermit);
    return { order: orders.get(order.id, principal), verification };
  } catch (error) {
    if (error.code === 'DEPOSIT_MONITOR_LEASE_LOST') throw error;
    if (!ledgerReconciliationStarted) orders.markUnavailable(order.id, principal, 'reconciliation-error', assertPermit);
    throw apiError(409, 'DEPOSIT_REVIEW_REQUIRED', 'Recorded transfer evidence does not satisfy this order. Preserve the reference for review; do not send again.');
  }
}
