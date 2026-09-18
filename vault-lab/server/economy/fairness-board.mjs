import { splitAttemptPrice, units } from './schema.mjs';
import { roundKindFromRules } from './payout-proving.mjs';
import { PUBLIC_SOURCE_URL } from '../../public/source.js';

export function truncateAddress(value) {
  if (typeof value !== 'string' || !value) return 'player';
  const match = value.match(/0x[a-fA-F0-9]{40}/);
  if (match) {
    const address = match[0].toLowerCase();
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  if (value.startsWith('player_')) return value.length > 12 ? `${value.slice(0, 12)}…` : `${value}…`;
  return 'player';
}

function splitForAttempt(attempt, round) {
  if (!round || !['locked', 'released'].includes(attempt.state)) {
    return { prizeContribution: '0', operations: '0', nextRound: '0' };
  }
  const split = splitAttemptPrice({
    price: attempt.price, prizeBps: round.prize_bps, operationsBps: round.operations_bps
  });
  return { prizeContribution: split.prize, operations: split.operations, nextRound: split.nextRound };
}

export function publicFairnessBoard(economy) {
  const snapshot = economy.state();
  const orders = economy.ledger.deposits?.exportAll().orders ?? [];
  const deposits = orders.filter(order => order.credited && typeof order.transactionHash === 'string').map(order => ({
    transactionHash: order.transactionHash,
    amount: order.accounting?.received ?? order.minimumReceived,
    from: truncateAddress(order.owner),
    to: truncateAddress(order.asset?.destination),
    state: order.state,
    credited: true
  }));
  const rounds = snapshot.rounds.map(round => {
    const bounty = snapshot.balances.find(row => row.account === `round:${round.id}:prize`)?.amount ?? '0';
    const prizePayable = snapshot.balances.find(row => row.account === `round:${round.id}:payable`)?.amount ?? '0';
    const claim = economy.ledger.payoutClaim?.(round.id);
    const manifest = economy.manifest?.(round.id);
    const rules = manifest?.manifest?.configuration?.rules;
    return {
      id: round.id,
      state: round.state,
      kind: roundKindFromRules(rules),
      promptVersion: rules?.version ?? null,
      systemPrompt: typeof rules?.systemPrompt === 'string' ? rules.systemPrompt : null,
      tools: Array.isArray(rules?.tools) ? rules.tools : [],
      price: round.price,
      prizeBps: round.prize_bps,
      operationsBps: round.operations_bps,
      winRetainBps: round.win_retain_bps ?? 0,
      expiresAt: round.expires_at,
      bounty,
      prizePayable,
      winner: round.winner ? truncateAddress(round.winner) : null,
      prizeSent: claim?.state === 'paid',
      prizeTransactionHash: claim?.state === 'paid' ? claim.transaction_hash : null
    };
  }).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'payout-proving' ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
  const attempts = snapshot.attempts.map(attempt => {
    const round = snapshot.rounds.find(row => row.id === attempt.round_id);
    return {
      id: attempt.id,
      roundId: attempt.round_id,
      player: truncateAddress(attempt.player),
      state: attempt.state,
      price: attempt.price,
      receiptRef: attempt.receipt_ref ?? null,
      ...splitForAttempt(attempt, round)
    };
  });
  const prizeSent = rounds.some(round => round.prizeSent);
  const paidAttempt = attempts.some(attempt => ['locked', 'released'].includes(attempt.state));
  const bountyAccrued = rounds.some(round => units(round.bounty) > 0n || units(round.prizePayable) > 0n);
  return {
    custody: 'operator-controlled',
    attestation: 'operator-recorded-rpc-not-independent-attestation',
    sourceUrl: PUBLIC_SOURCE_URL,
    realFundsEnabled: false,
    payoutsEnabled: false,
    asset: snapshot.asset ? {
      chainId: snapshot.asset.chainId,
      tokenAddress: snapshot.asset.tokenAddress,
      destination: truncateAddress(snapshot.asset.destination),
      decimals: snapshot.asset.decimals
    } : null,
    demonstrated: {
      depositToTreasury: deposits.length > 0,
      paidAttempt,
      bountyAccrued,
      prizeSent,
      attestedExecutor: false
    },
    rounds,
    attempts,
    deposits
  };
}
