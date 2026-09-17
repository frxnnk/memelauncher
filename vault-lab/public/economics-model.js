// Planning arithmetic only. Not a token price quote, ledger or demand forecast.
export const ECONOMIC_DEFAULTS = Object.freeze({ attemptTokens: 100, validAttempts: 100, tokenUsd: 0.01,
  prizePercent: 70, operationsPercent: 20, errorPercent: 10, apiUsd: 0.01, fixedUsd: 1.5,
  conversionLossPercent: 30, seedTokens: 1000, sponsorTokens: 0, creatorTokens: 0 });

const range = (value, min, max, name, integer = false) => {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`Check ${name}.`);
  return value;
};
export function projectEconomy(input) {
  const p = { ...input };
  range(p.attemptTokens, 1, 1e8, 'tokens per attempt', true);
  range(p.validAttempts, 1, 1e6, 'valid attempts', true);
  range(p.tokenUsd, 0, 1e6, 'hypothetical token value');
  range(p.prizePercent, 0, 100, 'prize percentage', true);
  range(p.operationsPercent, 0, 100, 'operations percentage', true);
  if (p.prizePercent + p.operationsPercent > 100) throw new Error('Prize and operations cannot exceed 100%.');
  range(p.errorPercent, 0, 99, 'technical error rate');
  range(p.apiUsd, 0, 1e4, 'cost per API call');
  range(p.fixedUsd, 0, 1e9, 'other operating costs');
  range(p.conversionLossPercent, 0, 100, 'conversion loss');
  for (const name of ['seedTokens', 'sponsorTokens', 'creatorTokens']) range(p[name], 0, 1e12, name, true);
  // Match the sandbox: round each consumed attempt, give the exact remainder to the next round.
  const perAttempt = { prize: Math.floor(p.attemptTokens * p.prizePercent / 100),
    operations: Math.floor(p.attemptTokens * p.operationsPercent / 100) };
  perAttempt.next = p.attemptTokens - perAttempt.prize - perAttempt.operations;
  const consumed = p.attemptTokens * p.validAttempts;
  const operatingTokens = perAttempt.operations * p.validAttempts;
  const nextRoundTokens = perAttempt.next * p.validAttempts;
  const contributions = p.seedTokens + p.sponsorTokens + p.creatorTokens;
  const prizeTokens = contributions + perAttempt.prize * p.validAttempts;
  const expectedApiCalls = p.validAttempts / (1 - p.errorPercent / 100);
  const expectedErrorCalls = expectedApiCalls - p.validAttempts;
  const apiCostsUsd = expectedApiCalls * p.apiUsd;
  const costsUsd = apiCostsUsd + p.fixedUsd;
  const realization = 1 - p.conversionLossPercent / 100;
  const netOperationsUsd = operatingTokens * p.tokenUsd * realization;
  const operatingResultUsd = netOperationsUsd - costsUsd;
  const breakEvenTokenUsd = operatingTokens * realization > 0 ? costsUsd / (operatingTokens * realization) : null;
  return { perAttempt, consumed, contributions, prizeTokens, operatingTokens, nextRoundTokens,
    expectedApiCalls, expectedErrorCalls, apiCostsUsd, costsUsd, netOperationsUsd, operatingResultUsd,
    externalOperatingSupportUsd: Math.max(0, -operatingResultUsd), breakEvenTokenUsd,
    nextRoundSeedCoverage: p.seedTokens > 0 ? nextRoundTokens / p.seedTokens : null,
    allocatedTokens: prizeTokens + operatingTokens + nextRoundTokens,
    balanced: consumed + contributions === prizeTokens + operatingTokens + nextRoundTokens,
    assumptions: { synthetic: true, measuredModelCost: false, marketQuote: false, actualFeesOrSponsors: false,
      winningAttemptIncluded: true, errorCallsRefunded: true, feesAndSponsorsToPrize: true,
      apiCostAssumedEqualForValidAndErrorCalls: true, conversionExecutionVerified: false } };
}
