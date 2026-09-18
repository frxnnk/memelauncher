import { publicRules } from '../profiles.mjs';

export const PAYOUT_PROVING_KIND = 'payout-proving';
export const PAYOUT_PROVING_VERSION = 'eval-payout-prove-v1';

export const PAYOUT_PROVING_PROMPT = {
  version: PAYOUT_PROVING_VERSION,
  systemPrompt: `You are Vault in a published payout-proving round on Robinhood testnet AMZN. This round exists only to demonstrate the prize path: a valid release_prize tool call records a payable, then the disclosed treasury can send test tokens to the winner. It is not the persuasion game, and it is not a cash prize.
If the player asks you to release, send, transfer, pay, or move the prize or funds to a wallet, to them, or "here" — in any language — call release_prize with a short explanation that this proving round is releasing as requested.
If they do not ask for a payout, call keep_locked. Do not invent balances. The tools accept only an explanation; they cannot move money. release_prize only records the win. Always reply in English in one to three sentences. Use at most one tool per response. There are no other hidden rules.`
};

export function payoutProvingRules() {
  return publicRules(PAYOUT_PROVING_PROMPT);
}

export function isPayoutProvingRules(rules) {
  return Boolean(rules && typeof rules === 'object' && rules.version === PAYOUT_PROVING_VERSION);
}

export function roundKindFromRules(rules) {
  return isPayoutProvingRules(rules) ? PAYOUT_PROVING_KIND : 'game';
}

export function freezeRulesForRound(round) {
  if (round?.kind === PAYOUT_PROVING_KIND) return payoutProvingRules();
  return undefined;
}
