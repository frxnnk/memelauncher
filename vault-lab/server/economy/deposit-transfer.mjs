import { validateDeposit, validateDepositAsset, TRANSFER_TOPIC } from './deposit.mjs';
import { units } from './schema.mjs';
import { verifiedWallet } from '../principal.mjs';

// ERC-20 transfer(address,uint256), encoded per the Solidity ABI. No signing,
// approval, nonce, gas quote, RPC selection or generic calldata is accepted.
export function prepareDepositTransfer(order, principal, now = Date.now()) {
  const asset = validateDepositAsset(order.asset), amount = units(order.minimumReceived);
  if (!amount) throw new Error('A positive transfer amount is required.');
  let reason = order.credited ? 'credit-recorded' : order.transactionHash || order.submittedTransactionHash ? 'transaction-already-submitted'
    : now > order.expiresAt ? 'order-expired' : null;
  try { verifiedWallet(principal, order.owner); } catch { reason ??= 'wallet-not-currently-verified'; }
  return { kind: 'standard-erc20-transfer', paymentsEnabled: false, signingEnabled: false,
    reason: reason ?? 'launch-not-enabled', amountBaseUnits: order.minimumReceived,
    recipient: asset.destination, decimals: asset.decimals, nativeGasFeeAdditional: true,
    transaction: reason ? null : { chainId: '0x' + BigInt(asset.chainId).toString(16), from: order.owner,
      to: asset.tokenAddress, value: '0x0', data: '0xa9059cbb' + asset.destination.slice(2).padStart(64, '0') + amount.toString(16).padStart(64, '0') } };
}

// A wallet returns a transaction hash, not a trustworthy receipt or log selector.
// Inspect only the server reader's evidence and fail rather than guess among logs.
export function findDepositTransfer(order, evidence) {
  const transactionHash = order.submittedTransactionHash ?? order.transactionHash;
  if (!evidence.receipt) return { status: 'pending', reason: 'receipt-not-found' };
  if (!Array.isArray(evidence.receipt.logs)) throw new Error('Receipt logs are missing.');
  const topic = address => '0x' + address.slice(2).toLowerCase().padStart(64, '0');
  const matches = evidence.receipt.logs.filter(log => log.address?.toLowerCase() === order.asset.tokenAddress &&
    Array.isArray(log.topics) && log.topics.length === 3 && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
    log.topics[1]?.toLowerCase() === topic(order.owner) && log.topics[2]?.toLowerCase() === topic(order.asset.destination));
  if (matches.length !== 1) throw new Error('A unique matching deposit transfer is required.');
  const logIndex = matches[0].logIndex;
  const result = validateDeposit({ asset: order.asset, order: { ...order, transactionHash, logIndex }, evidence });
  return { ...result, logIndex };
}
