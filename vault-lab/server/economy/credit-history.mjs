import { apiError } from '../errors.mjs';

// These read services authenticate every request. Project only account-owned
// records; do not expose operator exports, unsigned calldata or all ledger events.
export function createCreditHistory({ game, deposits } = {}) {
  if (!game?.account || !deposits?.get || !deposits?.list) throw new Error('Authenticated credit and deposit services are required.');
  const deposit = ({ order }) => ({ id: order.id, createdAt: order.createdAt, expiresAt: order.expiresAt,
    state: order.state, credited: order.credited, accountingHold: Boolean(order.accountingHold), owner: order.owner, asset: order.asset,
    purpose: order.allocation ? 'prize-reserve' : 'player-credits',
    ...(order.allocation ? { allocation: order.allocation, amountFundedBaseUnits: order.accounting?.received ?? '0' } : {}),
    amountRequestedBaseUnits: order.minimumReceived, amountCreditedBaseUnits: order.allocation ? '0' : order.accounting?.received ?? '0',
    transactionHash: order.submittedTransactionHash ?? order.transactionHash ?? null, logIndex: order.logIndex ?? null,
    submittedAt: order.submittedAt ?? null, attachedAt: order.attachedAt ?? null,
    evidence: 'operator-recorded-rpc-preparation', realFundsEnabled: false });
  const cursor = value => {
    if (value !== undefined && (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))) {
      throw apiError(400, 'INVALID_DEPOSIT_CURSOR', 'Choose an existing deposit page cursor.');
    }
    return value;
  };
  return {
    async summary(headers) {
      const account = await game.account(headers);
      return { unit: account.unit, accountingMode: account.accountingMode, available: account.available, reserved: account.reserved,
        prizePayable: String(account.prizes.reduce((sum, prize) => sum + BigInt(prize.payable), 0n)),
        spendingPaused: account.spendingPaused, attemptCount: account.attempts.length,
        realFundsEnabled: false, payoutsEnabled: false, evidence: 'operator-recorded-rpc-preparation' };
    },
    async list(headers, before) {
      const page = await deposits.list(headers, before === undefined ? {} : { before: cursor(before) });
      return { deposits: page.deposits.map(deposit), nextCursor: page.nextCursor, realFundsEnabled: false };
    },
    async get(headers, id) { return deposit(await deposits.get(headers, cursor(id))); }
  };
}
