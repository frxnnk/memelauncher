const PREFLIGHT_ERRORS = new Set(['MISSING_API_KEY', 'RECEIPT_STORAGE_UNAVAILABLE', 'INVALID_INPUT', 'INVALID_SESSION_SCOPE', 'ATTEMPT_BUSY', 'MODEL_NOT_ALLOWED',
  'SESSION_NOT_FOUND', 'SESSION_MODEL_MISMATCH', 'SESSION_ROUND_MISMATCH', 'SESSION_CONFIGURATION_CHANGED', 'SESSION_CLOSED',
  'TURN_LIMIT', 'SESSION_LIMIT', 'CONTEXT_LIMIT', 'CATALOG_UNAVAILABLE']);

import { receiptBilling } from './provider-billing.mjs';

// Both practice and account-credit play use the same persistent inference budget.
export async function meteredAttempt({ vault, limits, input, scope }) {
  if (scope.billing === 'x402') return vault.attempt(input, scope);
  const reservation = limits.reserve(scope.ownerId);
  let response;
  try {
    response = await vault.attempt(input, { ...scope, usageReservationId: reservation });
  } catch (error) {
    const billing = receiptBilling(error.receipt);
    if (billing?.policyUrl) limits.reconcile(error.receipt);
    else limits.settle(reservation, billing?.cost, !error.receipt && PREFLIGHT_ERRORS.has(error.code));
    throw error;
  }
  try { limits.settle(reservation, response.receipt?.usage?.cost); }
  catch (error) {
    // Preserve the already recorded model response for the job coordinator. This
    // private in-process property is not serialized into a public HTTP error.
    Object.defineProperty(error, 'completedResponse', { value: response });
    throw error;
  }
  return response;
}
