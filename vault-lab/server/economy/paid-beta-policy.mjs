import { units } from './schema.mjs';

export const PAID_BETA_MONTHS = 5;
export const PAID_BETA_WIN_RETAIN_BPS = 2500;

export function paidBetaTerms() {
  return { prizeBps: 7000, operationsBps: 3000, nextRoundBps: 0, winRetainBps: PAID_BETA_WIN_RETAIN_BPS };
}

export function paidBetaPricePolicy(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Asset decimals are required.');
  const scale = 10n ** BigInt(decimals);
  return {
    basePrice: String(5n * scale),
    stepPrice: String(1n * scale),
    maximumPrice: String(25n * scale)
  };
}

export function paidBetaFundingTerms(decimals) {
  const prices = paidBetaPricePolicy(decimals);
  return { ...paidBetaTerms(), price: prices.basePrice, priceStep: prices.stepPrice, maximumPrice: prices.maximumPrice,
    durationMonths: PAID_BETA_MONTHS };
}

export function applyPaidBetaFundingConfig(config) {
  if (!config || config.policy !== 'paid-beta') return config;
  const expected = paidBetaFundingTerms(config.asset?.decimals);
  if (config.terms) {
    for (const [key, value] of Object.entries(expected)) {
      if (config.terms[key] != null && String(config.terms[key]) !== String(value)) {
        throw new Error('paid-beta policy requires the published 70/30, 5→25, 5-month terms.');
      }
    }
  }
  return { ...config, terms: { ...config.terms, ...expected } };
}

export function roundAttemptPrice(policy, completedValidAttempts) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).sort().join(',') !== 'basePrice,maximumPrice,stepPrice') {
    throw new Error('An explicit base, step and maximum price policy is required.');
  }
  if (!Number.isSafeInteger(completedValidAttempts) || completedValidAttempts < 0) {
    throw new Error('A trusted nonnegative completed-attempt counter is required.');
  }
  const base = units(policy.basePrice), step = units(policy.stepPrice), maximum = units(policy.maximumPrice);
  if (!base || maximum < base) throw new Error('The positive base price must fit within its ceiling.');
  const price = base + step * BigInt(completedValidAttempts);
  return String(price > maximum ? maximum : price);
}

export function splitWinPrize(bounty, winRetainBps = PAID_BETA_WIN_RETAIN_BPS) {
  if (!Number.isInteger(winRetainBps) || winRetainBps < 0 || winRetainBps > 10000) throw new Error('Invalid win retain split.');
  const total = units(bounty);
  const continuity = total * BigInt(winRetainBps) / 10000n;
  return { payable: String(total - continuity), continuity: String(continuity) };
}

export function addCalendarMonths(iso, months) {
  if (typeof iso !== 'string' || !Number.isInteger(months) || months < 0 || months > 120) {
    throw new Error('A UTC timestamp and calendar month count are required.');
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== iso) throw new Error('Opening time must be a UTC instant.');
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

export function expireDistribution({ prize, seedAmount, playerPrizeAmount, contributions } = {}) {
  if (!Array.isArray(contributions)) throw new Error('Attempt contributions are required.');
  const total = units(prize);
  const seed = units(seedAmount);
  const playerTarget = units(playerPrizeAmount);
  const playerPool = playerTarget < total ? playerTarget : total;
  const weights = new Map();
  for (const row of contributions) {
    const amount = units(row.prizeContribution);
    weights.set(row.player, (weights.get(row.player) ?? 0n) + amount);
  }
  const weightSum = [...weights.values()].reduce((sum, value) => sum + value, 0n);
  const playerRefunds = [];
  let allocated = 0n;
  const entries = [...weights.entries()];
  for (let index = 0; index < entries.length; index++) {
    const [player, weight] = entries[index];
    if (weightSum === 0n || playerPool === 0n) continue;
    const amount = index === entries.length - 1 ? playerPool - allocated : playerPool * weight / weightSum;
    allocated += amount;
    playerRefunds.push({ player, amount: String(amount) });
  }
  const seedReturn = seed < total - playerPool ? String(seed) : String(total - playerPool);
  const unassigned = String(total - playerPool - BigInt(seedReturn));
  return { playerRefunds, seedReturn, unassigned };
}
