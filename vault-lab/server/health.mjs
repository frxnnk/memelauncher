import { RULES } from './rules.mjs';

// Public aggregates only. This read does not probe a model, wallet or provider account.
export function readOperationalHealth({ service, limits, runtime, beta, now = Date.now }) {
  const base = { checkedAt:new Date(now()).toISOString(), mode:runtime.mode, paymentsEnabled:false,
    evidence:'operator-reported-aggregates', providerAvailability:'not-probed', independentExecutionProof:false };
  try {
    const configured = service.status().configured;
    const execution = service.operationalState();
    const usage = limits?.operationalState() ?? null;
    let state = 'requests-enabled';
    if (!configured) state = 'setup-required';
    else if (execution.receiptStore === 'failed') state = 'storage-failure';
    else if (usage?.unknown || (usage?.pending && usage.oldestPendingAgeMs > (RULES.limits.timeoutSeconds + 10) * 1000)) state = 'reconciliation-required';
    else if (usage?.pending || execution.busy) state = 'busy';
    else if (usage && usage.reportedCostUsd >= usage.budgetUsd) state = 'budget-exhausted';
    else if (usage && usage.globalRequestsToday >= usage.totalPerDay) state = 'daily-limit';
    else if (beta?.paused()) state = 'beta-paused';
    return { statusCode:state === 'storage-failure' ? 503 : 200,
      body:{ ...base, state, requestGateOpen:state === 'requests-enabled', closedBeta:Boolean(beta), execution, usage,
        meaning:'Local request gates and recorded observations. Enabled does not prove provider availability, model resistance or funded launch readiness.' } };
  } catch {
    return { statusCode:503, body:{ ...base, state:'storage-unavailable', requestGateOpen:false,
      execution:null, usage:null, meaning:'Current stored state could not be read. No model request was made.' } };
  }
}
