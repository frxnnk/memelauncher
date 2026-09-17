import { apiError } from '../errors.mjs';
import { verifiedAccountId, verifiedWallet } from '../principal.mjs';
import { units, id } from './schema.mjs';
import { quantity } from './deposit.mjs';
import { prepareDepositTransfer } from './deposit-transfer.mjs';
import { inspectDepositFromRpc } from './inspect-deposit.mjs';
import { prizeAllocation } from './deposit-allocation.mjs';

const fields = (input, allowed) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) {
    throw apiError(400, 'INVALID_DEPOSIT_INPUT', 'Only the documented deposit fields are accepted.');
  }
};

// Server composition for the future funding flow. No public HTTP route or wallet
// signing is wired here; the only transport is a server-configured read-only RPC.
export function createAuthenticatedDeposits({ economy, authentication, reader, now = Date.now } = {}) {
  const orders = economy?.ledger.deposits;
  if (!orders || !authentication?.authenticate || !reader?.head || !reader?.evidence) {
    throw new Error('Deposits require an asset ledger, server authentication and a fixed RPC reader.');
  }
  const { asset, assetHash } = economy.state(), inFlight = new Map();
  if (!assetHash) throw new Error('An immutable deposit asset is required.');
  const principal = async headers => {
    const account = await authentication.authenticate(headers); verifiedAccountId(account); return account;
  };
  const view = (order, account) => ({ order, transfer: prepareDepositTransfer(order, account, now()), realFundsEnabled: false });
  async function prepare(headers, input, funding = false) {
    const account = await principal(headers); fields(input, ['key', 'wallet', 'amountBaseUnits', ...(funding ? ['source'] : [])]);
    let allocation;
    try { allocation = funding ? prizeAllocation(input.source) : undefined; }
    catch { throw apiError(400, 'INVALID_FUNDING_SOURCE', 'Choose seed or sponsor as the declared contribution purpose.'); }
    const owner = verifiedWallet(account, input.wallet); id(input.key);
    if (!units(input.amountBaseUnits)) throw apiError(400, 'INVALID_DEPOSIT_AMOUNT', 'Choose a positive integer amount in token base units.');
    if (owner === asset.destination) throw apiError(400, 'INVALID_DEPOSIT_SENDER', 'The sender cannot be the deposit destination.');
    const existing = orders.byKey(input.key, account);
    if (existing) {
      if (existing.owner !== owner || existing.minimumReceived !== input.amountBaseUnits || JSON.stringify(existing.allocation) !== JSON.stringify(allocation)) throw apiError(409, 'DEPOSIT_KEY_CONFLICT', 'This key already belongs to another deposit amount, wallet or purpose.');
      return view(existing, account);
    }
    let head;
    try { head = await reader.head(); if (quantity(head.chainId) !== BigInt(asset.chainId)) throw new Error(); }
    catch { throw apiError(502, 'DEPOSIT_RPC_UNAVAILABLE', 'A deposit order could not be prepared from the configured network.'); }
    return view(orders.create({ key: input.key, owner, minimumReceived: input.amountBaseUnits, allocation }, account, head), account);
  }
  async function inspect(order, account) {
    const result = await inspectDepositFromRpc({ orders, reader, orderId: order.id, principal: account });
    return { ...view(result.order, account), verification: result.verification };
  }
  return {
    prepare: (headers, input) => prepare(headers, input),
    preparePrizeFunding: (headers, input) => prepare(headers, input, true),
    async get(headers, orderId) { const account = await principal(headers); return view(orders.get(orderId, account), account); },
    async list(headers, input = {}) {
      const account = await principal(headers); fields(input, ['before']);
      const page = orders.list(account, input);
      return { deposits: page.orders.map(order => view(order, account)), nextCursor: page.nextCursor, realFundsEnabled: false };
    },
    async submit(headers, orderId, input) {
      const account = await principal(headers); orders.get(orderId, account); fields(input, ['transactionHash']);
      return view(orders.submit(orderId, account, input.transactionHash), account);
    },
    async check(headers, orderId) {
      const account = await principal(headers), order = orders.get(orderId, account);
      if (inFlight.has(order.id)) return inFlight.get(order.id);
      if (inFlight.size >= 4) throw apiError(429, 'DEPOSIT_CHECK_BUSY', 'Deposit checks are busy. Retry checking the same reference later.');
      const pending = inspect(order, account); inFlight.set(order.id, pending);
      try { return await pending; } finally { inFlight.delete(order.id); }
    }
  };
}
