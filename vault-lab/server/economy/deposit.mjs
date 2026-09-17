// Pure verification of trusted RPC evidence for a previously configured standard ERC-20.
// This module does not fetch, credit balances, authenticate a wallet, sign, or move funds.
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const fail = message => { throw new Error(message); };
const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : fail('Invalid EVM address.');
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : fail('Invalid transaction or block hash.');
export const quantity = value => typeof value === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(value) ? BigInt(value) : fail('Invalid RPC quantity.');
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < (1n << 256n) ? BigInt(value) : fail('Invalid integer amount.');
const topicAddress = value => typeof value === 'string' && /^0x0{24}[0-9a-f]{40}$/i.test(value) ? address('0x' + value.slice(-40)) : fail('Invalid indexed address.');

export function validateDepositAsset(asset) {
  if (!asset) fail('An explicit deposit asset is required.');
  const chainId = decimal(asset.chainId), tokenAddress = address(asset.tokenAddress), destination = address(asset.destination);
  if (!chainId || asset.standardTransferVerified !== true || !Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 255 ||
      !Number.isSafeInteger(asset.minimumConfirmations) || asset.minimumConfirmations < 1 || tokenAddress === '0x' + '0'.repeat(40) || destination === '0x' + '0'.repeat(40)) {
    fail('A configured standard-transfer asset, destination, decimals and positive confirmation policy are required.');
  }
  return { chainId: String(chainId), tokenAddress, destination, decimals: asset.decimals,
    minimumConfirmations: asset.minimumConfirmations, standardTransferVerified: true };
}

export function validateDeposit({ asset, order, evidence } = {}) {
  if (!asset || !order || !evidence) fail('Asset, deposit order and RPC evidence are required.');
  asset = validateDepositAsset(asset);
  const chainId = decimal(asset.chainId), token = asset.tokenAddress, destination = asset.destination;
  if (typeof order.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(order.id)) fail('A stored deposit order is required.');
  const owner = address(order.owner), expectedHash = hash(order.transactionHash), index = quantity(order.logIndex);
  const minimum = decimal(order.minimumReceived);
  if (!minimum || owner === destination || /^0x0{40}$/.test(owner)) fail('Invalid deposit sender or minimum.');
  if (quantity(evidence.chainId) !== chainId) fail('RPC network does not match the configured asset.');
  const receipt = evidence.receipt;
  if (!receipt) return { status: 'pending', reason: 'receipt-not-found', orderId: order.id };
  if (hash(receipt.transactionHash) !== expectedHash) fail('Receipt transaction mismatch.');
  if (quantity(receipt.status) !== 1n) fail('The transaction did not succeed.');
  const blockNumber = quantity(receipt.blockNumber), blockHash = hash(receipt.blockHash);
  if (!evidence.canonicalBlock || quantity(evidence.canonicalBlock.number) !== blockNumber || hash(evidence.canonicalBlock.hash) !== blockHash) fail('Receipt block is no longer canonical or could not be verified.');
  const head = quantity(evidence.headBlockNumber);
  if (head < blockNumber) fail('Head is behind the receipt block.');
  if (!Array.isArray(receipt.logs)) fail('Receipt logs are missing.');
  const matches = receipt.logs.filter(log => quantity(log.logIndex) === index);
  if (matches.length !== 1) fail('The selected transfer log is missing or ambiguous.');
  const log = matches[0];
  if (log.removed !== false || address(log.address) !== token || hash(log.transactionHash) !== expectedHash ||
    hash(log.blockHash) !== blockHash || quantity(log.blockNumber) !== blockNumber) fail('Transfer log metadata does not match the confirmed deposit.');
  if (!Array.isArray(log.topics) || log.topics.length !== 3 || hash(log.topics[0]) !== TRANSFER_TOPIC ||
    topicAddress(log.topics[1]) !== owner || topicAddress(log.topics[2]) !== destination) fail('Transfer token, sender or recipient does not match the stored order.');
  const value = hash(log.data);
  const amount = BigInt(value);
  if (amount < minimum) fail('Received units are below the quoted minimum.');
  const confirmations = head - blockNumber + 1n;
  if (confirmations < BigInt(asset.minimumConfirmations)) return { status: 'pending', reason: 'confirmations', orderId: order.id,
    confirmations: String(confirmations), requiredConfirmations: asset.minimumConfirmations };
  return { status: 'verified-rpc-evidence', orderId: order.id, chainId: String(chainId), tokenAddress: token,
    destination, owner, transactionHash: expectedHash, logIndex: String(index), blockHash, blockNumber: String(blockNumber),
    amount: String(amount), decimals: asset.decimals, confirmations: String(confirmations),
    depositKey: `${chainId}:${token}:${expectedHash}:${index}`,
    evidence: 'trusted-rpc-standard-transfer', finality: 'configured-block-confirmations-not-L1-finality', credited: false };
}
