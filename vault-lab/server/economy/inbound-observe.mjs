import { inspectDepositFromRpc } from './inspect-deposit.mjs';
import { quantity } from './deposit.mjs';
import { units } from './schema.mjs';
import { localOperatorAccountId } from '../local-operator.mjs';

export const BLOCKED_INBOUND_HASHES = new Set([
  '0x2df3f5c1c1b97c0e89011daaa436bb4fa165056dd5bcda3a98f42423eaa2ba31'
]);
const LOOKBACK = 8192n;
const hex = value => '0x' + BigInt(value).toString(16);

export function inboundPrincipal(owner) {
  if (typeof owner !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(owner) || /^0x0{40}$/i.test(owner)) {
    throw new Error('Inbound observe requires a non-zero sender.');
  }
  const address = owner.toLowerCase();
  return {
    authenticated: true, accountId: localOperatorAccountId(address),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    wallets: [{ address, chainType: 'ethereum', kind: 'external' }],
    walletOwnershipVerified: true, realFunds: false, localOperatorObserve: true
  };
}

export function createInboundObserver({ economy, reader, amount, enabled, intervalMs = 15000, onCredited } = {}) {
  if (!enabled) return null;
  units(amount);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60000) throw new Error('Invalid inbound observe interval.');
  const orders = economy?.ledger?.deposits;
  if (!orders?.create || !reader?.inboundTransfers || !reader?.head || !reader?.evidence) {
    throw new Error('Inbound observe requires an asset ledger and a constrained log reader.');
  }
  let running = false, timer, inFlight, closed = false;
  async function notifyCredited(order, principal) {
    if (!order?.credited || typeof onCredited !== 'function') return;
    try { await onCredited(order, principal); }
    catch { /* Autoplay retries on the next sweep; posted credits stay. */ }
  }
  async function credit(item) {
    const transactionHash = item.transactionHash.toLowerCase();
    if (BLOCKED_INBOUND_HASHES.has(transactionHash) || item.amount !== amount) return;
    const principal = inboundPrincipal(item.owner);
    const key = 'obs-' + transactionHash.slice(2);
    const block = quantity(item.blockNumber);
    const chainHead = block === 0n ? '0x0' : hex(block - 1n);
    let order = orders.byKey(key, principal);
    if (!order) order = orders.create({ key, owner: item.owner, minimumReceived: amount, inboundObserve: true }, principal, { chainHead });
    if (!order.submittedTransactionHash && !order.transactionHash) order = orders.submit(order.id, principal, transactionHash);
    if (!order.credited) await inspectDepositFromRpc({ orders, reader, orderId: order.id, principal });
    await notifyCredited(orders.get(order.id, principal), principal);
  }
  async function retryPending() {
    for (const order of orders.exportAll().orders) {
      if (!order.inboundObserve || !(order.submittedTransactionHash || order.transactionHash)) continue;
      const principal = inboundPrincipal(order.owner);
      try {
        if (!order.credited) await inspectDepositFromRpc({ orders, reader, orderId: order.id, principal });
        await notifyCredited(orders.get(order.id, principal), principal);
      } catch { /* Leave pending inbound orders for the next sweep. */ }
    }
  }
  async function sweep() {
    await retryPending();
    const head = await reader.head();
    const headBlock = quantity(head.chainHead);
    const previous = orders.inboundThrough();
    const fromBlock = previous == null ? (headBlock > LOOKBACK ? headBlock - LOOKBACK : 0n) : quantity(previous) + 1n;
    if (fromBlock <= headBlock) {
      const logs = await reader.inboundTransfers({ fromBlock: hex(fromBlock), toBlock: hex(headBlock) });
      for (const item of logs) {
        try { await credit(item); } catch { /* Keep scanning; a bad log must not block later matches. */ }
      }
      orders.setInboundThrough(hex(headBlock));
    }
  }
  function run() {
    if (closed) return Promise.reject(new Error('The inbound observer is closed.'));
    if (!inFlight) inFlight = sweep().finally(() => { inFlight = null; });
    return inFlight;
  }
  async function loop() {
    try { await run(); } catch { /* The next sweep retries; admission stays on the existing ledger. */ }
    if (running) { timer = setTimeout(loop, intervalMs); timer.unref?.(); }
  }
  async function stop() { running = false; clearTimeout(timer); try { await inFlight; } catch {} }
  return {
    enabled: true, sweep: run,
    start() { if (closed) throw new Error('The inbound observer is closed.'); if (!running) { running = true; void loop(); } },
    stop, async close() { await stop(); closed = true; }
  };
}
