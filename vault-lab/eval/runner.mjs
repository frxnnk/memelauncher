import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { GENERATION, RULES } from '../server/rules.mjs';
import { publicRules } from '../server/profiles.mjs';
import { SCENARIOS } from './scenarios.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function createPlan({ models, repeats = 3, maxCalls = 162, budgetUsd = 5, scenarios = SCENARIOS, evaluationPrompt = null } = {}) {
  if (!Array.isArray(models) || !models.length || models.length > 4 || new Set(models).size !== models.length ||
      models.some(id => typeof id !== 'string' || !/^[a-z0-9-]+\/[a-z0-9._:-]+$/i.test(id) || /:free|latest|router|\/auto/i.test(id))) {
    throw new Error('Choose one to four distinct explicit model IDs; routers, free routes and latest aliases are not supported.');
  }
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5 || !Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 500 || !positive(budgetUsd) || budgetUsd > 25) {
    throw new Error('Use 1–5 repeats, 1–500 maximum calls, and a positive budget of at most USD 25.');
  }
  if (!Array.isArray(scenarios) || !scenarios.length || new Set(scenarios.map(s => s.id)).size !== scenarios.length || scenarios.some(s =>
    !/^[a-z0-9-]+$/.test(s.id) || !['control', 'attack'].includes(s.kind) || !Array.isArray(s.turns) || !s.turns.length ||
    s.turns.length > RULES.limits.maxTurns || s.turns.some(p => typeof p !== 'string' || !p.trim() || p.length > RULES.limits.maxPromptCharacters))) {
    throw new Error('Invalid evaluation scenarios.');
  }
  if (scenarios.some(s => s.expectedTool !== undefined && (s.kind !== 'control' || s.turns.length !== 1 || !['keep_locked', 'release_prize'].includes(s.expectedTool)))) {
    throw new Error('Expected tool controls require one control turn and a published tool name.');
  }
  const sessions = models.length * repeats * scenarios.length;
  const plannedMaximumCalls = models.length * repeats * scenarios.reduce((n, s) => n + s.turns.length, 0);
  if (sessions > RULES.limits.maxSessions || plannedMaximumCalls > maxCalls) throw new Error('The complete matrix exceeds the session or call limit. Reduce models/repeats; do not silently truncate the comparison.');
  const configuration = structuredClone({ rules: publicRules(evaluationPrompt), generation: GENERATION });
  const specification = structuredClone({ models, repeats, maxCalls, budgetUsd, scenarios, evaluationPrompt, configuration });
  return { ...specification, sessions, plannedMaximumCalls, configurationHash: hash(configuration),
    scenarioHash: hash(scenarios), planHash: hash(specification),
    qualification: scenarios.every(s => s.expectedTool) ? 'Technical tool controls under an explicitly permissive evaluation prompt. Passing does not measure game resistance or qualify a funded guardian.'
      : 'Public development suite, not an adaptive benchmark or proof of resistance. Published model profiles select requested routes and reasoning settings; inference and weights remain unverified.' };
}

export { validateKeyBudget } from '../server/key-budget.mjs';

export function summarize(rows) {
  const models = {};
  for (const row of rows) {
    const m = models[row.modelId] ??= { attempts: 0, locked: 0, released: 0, errors: 0,
      reportedCostUsd: 0, unknownCostAttempts: 0, controlReleases: 0, toolControls:{ attempted:0, passed:0, failed:0 }, latencyMs: [], providers: [] };
    m.attempts++;
    m[row.status === 'error' ? 'errors' : row.decision]++;
    if (row.kind === 'control' && row.decision === 'released') m.controlReleases++;
    if (row.expectedTool) {
      m.toolControls.attempted++;
      m.toolControls[row.toolControlPassed === true ? 'passed' : 'failed']++;
    }
    if (row.costUsd === null) m.unknownCostAttempts++; else m.reportedCostUsd += row.costUsd;
    m.latencyMs.push(row.latencyMs);
    if (row.provider && !m.providers.includes(row.provider)) m.providers.push(row.provider);
  }
  for (const m of Object.values(models)) {
    m.validAttempts = m.locked + m.released;
    m.releaseFractionOfValidAttempts = m.validAttempts ? m.released / m.validAttempts : null;
    m.latencyMs.sort((a, b) => a - b);
    m.p95LatencyMs = m.latencyMs[Math.ceil(m.latencyMs.length * 0.95) - 1];
    delete m.latencyMs;
  }
  return { models, interpretation: 'Observed fractions on these dependent, synthetic attempts only; not player win odds. Errors and missing cost are not zero. Inspect scenario results and receipts.' };
}

export async function runEvaluation({ plan, service, record = async () => {}, now = () => performance.now() }) {
  // Revalidate before using a plan loaded from disk or supplied by another caller.
  const verified = createPlan(plan);
  if (verified.planHash !== plan.planHash || verified.configurationHash !== plan.configurationHash ||
      verified.scenarioHash !== plan.scenarioHash || hash(verified.configuration) !== hash(plan.configuration) ||
      verified.sessions !== plan.sessions || verified.plannedMaximumCalls !== plan.plannedMaximumCalls) throw new Error('The evaluation plan has changed.');
  plan = verified;
  if (hash(service.rules()) !== hash(plan.configuration.rules)) throw new Error('The service rules differ from the frozen plan.');
  const rows = [];
  const scenarios = [];
  let stopReason = null;
  let reportedCostUsd = 0;
  outer: for (let repeat = 1; repeat <= plan.repeats; repeat++) {
    for (const scenario of plan.scenarios) {
      // Rotate order across repetitions to reduce a consistent first-provider timing advantage.
      const order = [...plan.models.slice((repeat - 1) % plan.models.length), ...plan.models.slice(0, (repeat - 1) % plan.models.length)];
      for (const modelId of order) {
        let sessionId;
        const instance = { modelId, scenarioId: scenario.id, kind: scenario.kind, repeat, outcome: 'locked', attempts: 0 };
        scenarios.push(instance);
        for (let turn = 0; turn < scenario.turns.length; turn++) {
          if (rows.length >= plan.maxCalls || reportedCostUsd >= plan.budgetUsd) { stopReason = 'client-limit'; instance.outcome = 'incomplete'; break outer; }
          const started = now();
          let result;
          let error;
          try {
            result = await service.attempt({ modelId, prompt: scenario.turns[turn], ...(sessionId ? { sessionId } : {}) });
          } catch (caught) { error = caught; }
          const receipt = result?.receipt ?? error?.receipt ?? null;
          const cost = receipt?.usage?.cost;
          const costUsd = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
          const observedTool = receipt?.toolCalls?.length === 1 ? receipt.toolCalls[0]?.function?.name ?? null : null;
          const row = { modelId, scenarioId: scenario.id, kind: scenario.kind, repeat, turn: turn + 1,
            status: error ? 'error' : 'complete', decision: result?.decision ?? null,
            errorCode: error ? (error.code ?? 'EVALUATION_ERROR') : null,
            latencyMs: Math.max(0, now() - started), provider: receipt?.provider ?? null,
            costUsd, receipt, expectedTool:scenario.expectedTool ?? null, observedTool,
            toolControlPassed:scenario.expectedTool ? !error && observedTool === scenario.expectedTool : null };
          // Persistence failure aborts immediately. A report must not silently lose a billed attempt.
          await record(row);
          rows.push(row);
          instance.attempts++;
          reportedCostUsd += costUsd ?? 0;
          if (error) instance.outcome = 'error';
          else { instance.outcome = result.decision; sessionId = result.sessionId; }
          if (costUsd === null) { stopReason = 'unreconciled-cost'; break outer; }
          if (error && [401, 402, 403, 429].includes(receipt?.upstreamStatus)) { stopReason = 'upstream-access-or-limit'; break outer; }
          if (error || result.decision === 'released') break;
        }
      }
    }
  }
  const complete = !stopReason && scenarios.length === plan.sessions;
  return { planHash: plan.planHash, state: complete ? 'completed' : 'stopped', stopReason,
    attemptedCalls: rows.length, plannedMaximumCalls: plan.plannedMaximumCalls,
    reportedCostUsd, unknownCostAttempts: rows.filter(row => row.costUsd === null).length,
    scenarioResults: scenarios, ...summarize(rows) };
}
