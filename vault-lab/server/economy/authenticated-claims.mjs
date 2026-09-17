import { createHash } from 'node:crypto';
import { apiError } from '../errors.mjs';
import { verifiedAccountId, verifiedWallet } from '../principal.mjs';
import { units, id } from './schema.mjs';
import { quantity } from './deposit.mjs';
import { preparePayoutTransfer, findPayoutTransfer } from './payout-transfer.mjs';

const fields = (input, allowed) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) {
    throw apiError(400, 'INVALID_CLAIM_INPUT', 'Only the documented claim fields are accepted.');
  }
};

export function createAuthenticatedClaims({ economy, authentication, reader, now = Date.now } = {}) {
  const ledger = economy?.ledger;
  if (!ledger?.execute || !authentication?.authenticate || !reader?.evidence) {
    throw new Error('Claims require an asset ledger, server authentication and a fixed RPC reader.');
  }
  const { asset } = economy.state();
  if (!asset) throw new Error('An immutable payout asset is required.');
  const inFlight = new Map();
  const principal = async headers => {
    const account = await authentication.authenticate(headers); verifiedAccountId(account); return account;
  };

  function load(roundId) {
    id(roundId);
    const state = economy.state();
    const round = state.rounds.find(row => row.id === roundId);
    if (!round) throw apiError(404, 'CLAIM_NOT_FOUND', 'Prize claim not found.');
    const payable = state.balances.find(row => row.account === `round:${roundId}:payable`)?.amount ?? '0';
    const winnerAttempt = state.attempts.find(row => row.round_id === roundId && row.state === 'released');
    const stored = ledger.payoutClaim(round.id);
    return {
      roundId: round.id, state: round.state, winner: round.winner, amount: round.state === 'paid' ? stored?.amount ?? '0' : payable,
      recipient: winnerAttempt?.recipient ?? stored?.recipient ?? null, treasury: asset.destination, asset,
      submittedTransactionHash: stored?.submitted_transaction_hash ?? null,
      transactionHash: stored?.transaction_hash ?? null, logIndex: stored?.log_index ?? null
    };
  }

  function assertViewer(account, claim) {
    const owner = verifiedAccountId(account);
    const treasury = account.wallets?.some(wallet => wallet.chainType === 'ethereum' && wallet.address?.toLowerCase() === claim.treasury);
    if (owner !== claim.winner && !treasury) throw apiError(404, 'CLAIM_NOT_FOUND', 'Prize claim not found.');
  }

  function encoder(claim) {
    return {
      authenticated: true,
      accountId: 'player_claim_preview',
      walletOwnershipVerified: true,
      wallets: [{ address: claim.treasury, chainType: 'ethereum', kind: 'external' }]
    };
  }

  function present(account, claim) {
    let transfer;
    try {
      if (claim.state === 'won' && units(claim.amount)) transfer = preparePayoutTransfer(claim, account, now());
    } catch { transfer = null; }
    return { ...claim, environment: 'testnet', realFundsEnabled: false, testnetClaimsEnabled: true,
      broadcast: false,
      transfer: transfer ?? { kind: 'standard-erc20-transfer', paymentsEnabled: false, signingEnabled: false,
        reason: 'claim-not-payable', amountBaseUnits: claim.amount ?? '0', recipient: claim.recipient,
        treasury: claim.treasury, transaction: null },
      order: { id: claim.roundId, state: claim.state, paid: claim.state === 'paid' ? claim.amount : '0',
        recipient: claim.recipient, transactionHash: claim.transactionHash, submittedTransactionHash: claim.submittedTransactionHash } };
  }

  return {
    async get(headers, roundId) {
      const account = await principal(headers), claim = load(roundId);
      assertViewer(account, claim);
      return present(account, claim);
    },
    async getPublic(roundId) {
      const claim = load(roundId);
      return present(encoder(claim), claim);
    },
    async prepare(headers, roundId, input = {}) {
      const account = await principal(headers); fields(input, []);
      const claim = load(roundId);
      assertViewer(account, claim);
      try { verifiedWallet(account, claim.treasury); }
      catch { throw apiError(400, 'TREASURY_WALLET_REQUIRED', 'Prize transfers are signed by the disclosed treasury wallet.'); }
      if (claim.state !== 'won' || !units(claim.amount)) throw apiError(409, 'CLAIM_NOT_PAYABLE', 'This round has no unpaid prize.');
      return present(account, claim);
    },
    async preparePublic(roundId, input = {}) {
      fields(input, []);
      const claim = load(roundId);
      if (claim.state !== 'won' || !units(claim.amount)) throw apiError(409, 'CLAIM_NOT_PAYABLE', 'This round has no unpaid prize.');
      return present(encoder(claim), claim);
    },
    async submit(headers, roundId, input) {
      const account = await principal(headers); fields(input, ['transactionHash']);
      const claim = load(roundId);
      assertViewer(account, claim);
      verifiedWallet(account, claim.treasury);
      if (claim.state !== 'won') throw apiError(409, 'CLAIM_NOT_PAYABLE', 'This round has no unpaid prize.');
      ledger.submitPayoutClaim(claim.roundId, { transactionHash: input.transactionHash, recipient: claim.recipient, amount: claim.amount });
      return present(account, load(roundId));
    },
    async check(headers, roundId, input = {}) {
      const account = await principal(headers); fields(input, []);
      const claim = load(roundId);
      assertViewer(account, claim);
      verifiedWallet(account, claim.treasury);
      if (inFlight.has(claim.roundId)) return inFlight.get(claim.roundId);
      const work = (async () => {
        const current = load(roundId);
        const transactionHash = current.transactionHash ?? current.submittedTransactionHash;
        if (!transactionHash) throw apiError(409, 'CLAIM_NOT_SUBMITTED', 'No prize transfer has been recorded for this round.');
        let evidence;
        try { evidence = await reader.evidence({ ...current, transactionHash }); }
        catch { throw apiError(502, 'CLAIM_RPC_UNAVAILABLE', 'The transaction reference is saved. Its evidence could not be checked; do not send again.'); }
        if (quantity(evidence.chainId) !== BigInt(asset.chainId)) throw apiError(409, 'CLAIM_REVIEW_REQUIRED', 'Recorded transfer evidence does not satisfy this claim.');
        const selected = findPayoutTransfer({ ...current, submittedTransactionHash: transactionHash }, evidence);
        if (selected.status !== 'verified-rpc-evidence') return { ...present(account, current), verification: selected };
        const key = 'payout-' + createHash('sha256').update(current.roundId).digest('hex');
        const paid = ledger.execute(key, {
          type: 'record-payout', roundId: current.roundId, amount: current.amount, recipient: current.recipient,
          transactionHash: selected.transactionHash, logIndex: typeof selected.logIndex === 'string' && selected.logIndex.startsWith('0x')
            ? selected.logIndex : '0x' + BigInt(selected.logIndex).toString(16)
        });
        return { ...present(account, load(roundId)), order: { state: 'paid', paid: paid.paid, transactionHash: paid.transactionHash,
          recipient: paid.recipient }, verification: selected, realFundsEnabled: false };
      })();
      inFlight.set(claim.roundId, work);
      try { return await work; } finally { inFlight.delete(claim.roundId); }
    },
    async expire(headers, roundId, input = {}) {
      const account = await principal(headers); fields(input, []);
      const claim = load(roundId);
      try { verifiedWallet(account, claim.treasury); }
      catch { throw apiError(400, 'TREASURY_WALLET_REQUIRED', 'Round expiry is recorded by the disclosed treasury wallet.'); }
      try {
        const result = ledger.execute('expire-' + createHash('sha256').update(claim.roundId).digest('hex'), {
          type: 'expire-round', roundId: claim.roundId
        });
        return {
          roundId: result.roundId, state: result.state, broadcast: false, realFundsEnabled: false,
          environment: 'testnet', seedReturn: result.seedReturn, playerRefunds: result.playerRefunds,
          unassigned: result.unassigned
        };
      } catch (error) {
        if (error.status) throw error;
        if (/not expired|Only an open round can expire/i.test(error.message)) {
          throw apiError(409, 'ROUND_NOT_EXPIRED', error.message);
        }
        throw error;
      }
    }
  };
}
