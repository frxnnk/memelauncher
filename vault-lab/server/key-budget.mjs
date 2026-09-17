const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function validateKeyBudget(data, budgetUsd) {
  if (!positive(data?.limit) || data.limit > budgetUsd || !positive(data.limit_remaining) || data.limit_remaining > data.limit ||
      data.limit_reset !== null || data.include_byok_in_limit !== true || data.is_management_key === true || data.is_provisioning_key === true) {
    throw new Error('Use a dedicated inference key with a non-resetting limit no greater than the evaluation budget, remaining credit, and BYOK included in that limit.');
  }
  return { limit: data.limit, remaining: data.limit_remaining, reset: null, includesByok: true };
}
