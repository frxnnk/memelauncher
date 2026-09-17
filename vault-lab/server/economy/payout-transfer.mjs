import { validateDepositAsset, TRANSFER_TOPIC, quantity } from './deposit.mjs';
import { units } from './schema.mjs';
import { verifiedWallet } from '../principal.mjs';

export const TESTNET_AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
export const HISTORICAL_AMZN_UNITS = '100000000000000000';

const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : (() => { throw new Error('Invalid EVM address.'); })();
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : (() => { throw new Error('Invalid transaction or block hash.'); })();
const topicAddress = value => typeof value === 'string' && /^0x0{24}[0-9a-f]{40}$/i.test(value) ? address('0x' + value.slice(-40)) : (() => { throw new Error('Invalid indexed address.'); })();
const topic = value => '0x' + address(value).slice(2).padStart(64, '0');

export function assertClaimPayoutSafe(claim) {
  const asset = claim?.asset;
  if (String(asset?.chainId) !== '46630' || typeof asset?.tokenAddress !== 'string') return;
  if (address(asset.tokenAddress) === TESTNET_AMZN && String(claim.amount) === HISTORICAL_AMZN_UNITS) {
    throw new Error('The 0.1 AMZN historical deposit must not be spent as a fake win.');
  }
}

export function preparePayoutTransfer(claim, principal, now = Date.now()) {
  const asset = validateDepositAsset(claim.asset);
  const amount = units(claim.amount);
  if (!amount) throw new Error('A positive payout amount is required.');
  assertClaimPayoutSafe({ ...claim, asset });
  const recipient = address(claim.recipient);
  if (recipient === asset.destination) throw new Error('The winner cannot be the treasury.');
  let reason = claim.state !== 'won' ? 'round-not-won'
    : claim.submittedTransactionHash || claim.transactionHash ? 'transaction-already-submitted' : null;
  try { verifiedWallet(principal, asset.destination); } catch { reason ??= 'treasury-wallet-not-verified'; }
  const transaction = reason ? null : {
    chainId: '0x' + BigInt(asset.chainId).toString(16), from: asset.destination, to: asset.tokenAddress, value: '0x0',
    data: '0xa9059cbb' + recipient.slice(2).padStart(64, '0') + amount.toString(16).padStart(64, '0')
  };
  return { kind: 'standard-erc20-transfer', paymentsEnabled: false, signingEnabled: Boolean(transaction),
    reason, amountBaseUnits: String(amount), recipient, treasury: asset.destination, decimals: asset.decimals,
    nativeGasFeeAdditional: true, transaction };
}

export function findPayoutTransfer(claim, evidence) {
  const transactionHash = claim.submittedTransactionHash ?? claim.transactionHash;
  if (!evidence.receipt) return { status: 'pending', reason: 'receipt-not-found' };
  if (!Array.isArray(evidence.receipt.logs)) throw new Error('Receipt logs are missing.');
  const asset = validateDepositAsset(claim.asset);
  const matches = evidence.receipt.logs.filter(log => log.address?.toLowerCase() === asset.tokenAddress &&
    Array.isArray(log.topics) && log.topics.length === 3 && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
    log.topics[1]?.toLowerCase() === topic(asset.destination) && log.topics[2]?.toLowerCase() === topic(claim.recipient));
  if (matches.length !== 1) throw new Error('A unique matching prize transfer is required.');
  return { ...validatePayout({ claim: { ...claim, transactionHash, logIndex: matches[0].logIndex }, evidence }),
    logIndex: matches[0].logIndex };
}

export function validatePayout({ claim, evidence } = {}) {
  if (!claim || !evidence) throw new Error('Claim and RPC evidence are required.');
  const asset = validateDepositAsset(claim.asset);
  const chainId = BigInt(asset.chainId), token = asset.tokenAddress, owner = asset.destination, destination = address(claim.recipient);
  const expectedHash = hash(claim.transactionHash), index = quantity(claim.logIndex);
  const expected = units(claim.amount);
  if (!expected || owner === destination) throw new Error('Invalid payout sender or amount.');
  if (quantity(evidence.chainId) !== chainId) throw new Error('RPC network does not match the configured asset.');
  const receipt = evidence.receipt;
  if (!receipt) return { status: 'pending', reason: 'receipt-not-found', roundId: claim.roundId };
  if (hash(receipt.transactionHash) !== expectedHash) throw new Error('Receipt transaction mismatch.');
  if (quantity(receipt.status) !== 1n) throw new Error('The transaction did not succeed.');
  const blockNumber = quantity(receipt.blockNumber), blockHash = hash(receipt.blockHash);
  if (!evidence.canonicalBlock || quantity(evidence.canonicalBlock.number) !== blockNumber || hash(evidence.canonicalBlock.hash) !== blockHash) {
    throw new Error('Receipt block is no longer canonical or could not be verified.');
  }
  const head = quantity(evidence.headBlockNumber);
  if (head < blockNumber) throw new Error('Head is behind the receipt block.');
  if (!Array.isArray(receipt.logs)) throw new Error('Receipt logs are missing.');
  const matches = receipt.logs.filter(log => quantity(log.logIndex) === index);
  if (matches.length !== 1) throw new Error('The selected transfer log is missing or ambiguous.');
  const log = matches[0];
  if (log.removed !== false || address(log.address) !== token || hash(log.transactionHash) !== expectedHash ||
    hash(log.blockHash) !== blockHash || quantity(log.blockNumber) !== blockNumber) throw new Error('Transfer log metadata does not match the confirmed payout.');
  if (!Array.isArray(log.topics) || log.topics.length !== 3 || hash(log.topics[0]) !== TRANSFER_TOPIC ||
    topicAddress(log.topics[1]) !== owner || topicAddress(log.topics[2]) !== destination) {
    throw new Error('Transfer token, sender or recipient does not match the recorded payable.');
  }
  const amount = BigInt(hash(log.data));
  if (amount !== expected) throw new Error('Payout amount must match the recorded payable.');
  const confirmations = head - blockNumber + 1n;
  if (confirmations < BigInt(asset.minimumConfirmations)) {
    return { status: 'pending', reason: 'confirmations', roundId: claim.roundId,
      confirmations: String(confirmations), requiredConfirmations: asset.minimumConfirmations };
  }
  return { status: 'verified-rpc-evidence', roundId: claim.roundId, chainId: String(chainId), tokenAddress: token,
    destination, owner, transactionHash: expectedHash, logIndex: String(index), blockHash, blockNumber: String(blockNumber),
    amount: String(amount), decimals: asset.decimals, confirmations: String(confirmations),
    evidence: 'trusted-rpc-standard-transfer', credited: false };
}
