import { randomUUID } from 'node:crypto';
import { quantity, TRANSFER_TOPIC, validateDepositAsset } from './deposit.mjs';
import { units } from './schema.mjs';

// Server-configured read-only EVM transport. No generic RPC method is exposed.
// Even though JSON-RPC uses HTTP POST, these methods cannot sign or send a transaction.
export function createDepositReader({ rpcUrl, expectedChainId, asset, fetchImpl = fetch, timeoutMs = 10000, maxBytes = 1024 * 1024 } = {}) {
  let endpoint;
  try { endpoint = new URL(rpcUrl); } catch { throw new Error('Configure a fixed HTTPS RPC endpoint.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Configure a fixed HTTPS RPC endpoint without userinfo or fragments.');
  if (!units(expectedChainId) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 ||
      !Number.isInteger(maxBytes) || maxBytes < 64 || maxBytes > 4 * 1024 * 1024) throw new Error('Invalid chain or RPC response limits.');
  const chain = BigInt(expectedChainId);
  const frozenAsset = asset ? validateDepositAsset(asset) : null;
  async function call(method, params) {
    const controller = new AbortController(), id = randomUUID(); let timer;
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetchImpl(endpoint.href, { method:'POST', redirect:'error', signal:controller.signal,
            headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ jsonrpc:'2.0', id, method, params }) });
          if (!response.ok || !response.body) throw new Error('RPC HTTP response rejected.');
          const reader = response.body.getReader(), chunks = []; let size = 0;
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > maxBytes) { controller.abort(); void reader.cancel().catch(() => {}); throw new Error('RPC response too large.'); }
            chunks.push(value);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!body || Array.isArray(body) || body.jsonrpc !== '2.0' || body.id !== id ||
              Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) throw new Error('RPC envelope rejected.');
          return body.result;
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('RPC timeout.')); }, timeoutMs); })
      ]);
      return result;
    } catch { controller.abort(); throw new Error('RPC evidence unavailable or invalid. No credits were issued.'); }
    finally { clearTimeout(timer); }
  }
  async function network() {
    const chainId = await call('eth_chainId', []);
    if (quantity(chainId) !== chain) throw new Error('RPC network differs from the configured chain.');
    return chainId;
  }
  async function head() {
    const chainId = await network();
    const chainHead = await call('eth_blockNumber', []); quantity(chainHead);
    return { chainId, chainHead };
  }
  async function evidence(order) {
    if (!order || typeof order.transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(order.transactionHash)) throw new Error('A stored transaction reference is required.');
    const chainId = await network();
    const receipt = await call('eth_getTransactionReceipt', [order.transactionHash]);
    if (receipt === null) return { chainId, receipt:null };
    if (typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error('Invalid RPC receipt.');
    quantity(receipt.blockNumber);
    const [canonicalBlock, headBlockNumber] = await Promise.all([
      call('eth_getBlockByNumber', [receipt.blockNumber, false]), call('eth_blockNumber', [])
    ]);
    quantity(headBlockNumber);
    return { chainId, receipt, canonicalBlock, headBlockNumber };
  }
  async function inboundTransfers({ fromBlock, toBlock } = {}) {
    if (!frozenAsset) throw new Error('Inbound log observation requires the frozen deposit asset.');
    const from = quantity(fromBlock), to = quantity(toBlock);
    if (from > to) return [];
    await network();
    const destinationTopic = '0x' + frozenAsset.destination.slice(2).padStart(64, '0');
    const logs = await call('eth_getLogs', [{
      fromBlock: fromBlock.toLowerCase(), toBlock: toBlock.toLowerCase(),
      address: frozenAsset.tokenAddress, topics: [TRANSFER_TOPIC, null, destinationTopic]
    }]);
    if (!Array.isArray(logs) || logs.length > 100) throw new Error('RPC evidence unavailable or invalid. No credits were issued.');
    const parsed = [];
    for (const log of logs) {
      if (!log || typeof log !== 'object' || Array.isArray(log)) continue;
      if (typeof log.transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(log.transactionHash)) continue;
      if (typeof log.address !== 'string' || log.address.toLowerCase() !== frozenAsset.tokenAddress) continue;
      if (!Array.isArray(log.topics) || log.topics.length !== 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      if (log.topics[2]?.toLowerCase() !== destinationTopic) continue;
      if (typeof log.topics[1] !== 'string' || !/^0x0{24}[0-9a-f]{40}$/i.test(log.topics[1])) continue;
      const owner = ('0x' + log.topics[1].slice(-40)).toLowerCase();
      if (owner === frozenAsset.destination || owner === '0x' + '0'.repeat(40)) continue;
      if (typeof log.data !== 'string' || !/^0x[0-9a-f]{64}$/i.test(log.data)) continue;
      const value = BigInt(log.data);
      if (!value) continue;
      try { quantity(log.blockNumber); quantity(log.logIndex); } catch { continue; }
      parsed.push({
        transactionHash: log.transactionHash.toLowerCase(), logIndex: log.logIndex,
        blockNumber: log.blockNumber, owner, destination: frozenAsset.destination, amount: String(value)
      });
    }
    return parsed;
  }
  return { head, evidence, inboundTransfers };
}

export async function reconcileDepositFromRpc({ orders, reader, orderId, principal }) {
  // Ownership is checked before any network request; the client supplies no receipt.
  const order = orders.get(orderId, principal);
  let evidence;
  try { evidence = await reader.evidence(order); }
  catch (error) { orders.markUnavailable(orderId, principal); throw error; }
  return orders.reconcile(orderId, principal, evidence);
}
