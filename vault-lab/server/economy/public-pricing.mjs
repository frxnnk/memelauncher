import { units, splitAttemptPrice } from './schema.mjs';

// Preparation only: the live ledger still has fixed round prices. Its eventual
// integration must atomically bind a trusted wallet counter to each reservation.
export function walletAttemptPrice(policy, completedWalletAttempts) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).sort().join(',') !== 'basePrice,maximumPrice,stepPrice') {
    throw new Error('An explicit base, step and maximum price policy is required.');
  }
  if (!Number.isSafeInteger(completedWalletAttempts) || completedWalletAttempts < 0) {
    throw new Error('A trusted nonnegative completed-attempt counter is required.');
  }
  const base = units(policy.basePrice), step = units(policy.stepPrice), maximum = units(policy.maximumPrice);
  if (!base || maximum < base) throw new Error('The positive base price must fit within its ceiling.');
  const price = base + step * BigInt(completedWalletAttempts);
  return String(price > maximum ? maximum : price);
}

// All costs must be conservative amounts in the ROUND ASSET's base units.
// inferenceAndConversion must come from a bounded conversion quote; this function
// cannot convert a USD/USDC quote into USDG or prove a provider's actual cost.
export function operatingCoverage(terms, costs) {
  if (!costs || typeof costs !== 'object' || Array.isArray(costs) ||
      Object.keys(costs).sort().join(',') !== 'errorAllowance,executionGas,inferenceAndConversion') {
    throw new Error('Explicit inference/conversion, execution gas and error budgets are required.');
  }
  const allocation = units(splitAttemptPrice(terms).operations);
  const required = units(costs.inferenceAndConversion) + units(costs.executionGas) + units(costs.errorAllowance);
  const covered = allocation >= required;
  return { covered, operatingAllocation: String(allocation), required: String(required),
    surplus: String(covered ? allocation - required : 0n), deficit: String(covered ? 0n : required - allocation) };
}
