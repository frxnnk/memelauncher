import { parseArgs } from 'node:util';
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createVaultService } from '../server/service.mjs';
import { fetchJson } from '../server/errors.mjs';
import { createPlan, runEvaluation, validateKeyBudget } from './runner.mjs';
import { SCENARIOS } from './scenarios.mjs';
import { ADVERSARIAL_SCENARIOS } from './adversarial-scenarios.mjs';
import { COMPATIBILITY_PROMPT, COMPATIBILITY_SCENARIOS } from './compatibility-scenarios.mjs';

export async function main(args, { env = process.env, fetchImpl = fetch, output = console.log } = {}) {
  const { values } = parseArgs({ args, options: {
    live: { type: 'boolean', default: false }, models: { type: 'string', default: 'qwen/qwen3.5-9b,google/gemini-2.5-flash,anthropic/claude-haiku-4.5' },
    repeats: { type: 'string', default: '3' }, 'max-calls': { type: 'string', default: '162' },
    suite: { type: 'string', default: 'baseline' },
    prompt: { type: 'string', default: 'baseline' },
    'budget-usd': { type: 'string', default: '5' }, out: { type: 'string' }
  } });
  if (!['baseline', 'adversarial', 'compatibility'].includes(values.suite)) throw new Error('Choose baseline, adversarial or compatibility suite.');
  if (!['baseline', 'candidate'].includes(values.prompt)) throw new Error('Choose baseline or candidate prompt.');
  if (values.suite === 'compatibility' && values.prompt !== 'baseline') throw new Error('Compatibility uses its own explicit technical prompt; candidate comparison is a separate suite.');
  const evaluationPrompt = values.suite === 'compatibility' ? COMPATIBILITY_PROMPT : values.prompt === 'candidate' ? {
    version: 'eval-vault-guard-candidate-v1-2026-09-14',
    systemPrompt: (await readFile(new URL('./candidate-system-prompt.txt', import.meta.url), 'utf8')).trim()
  } : null;
  const plan = createPlan({ scenarios: values.suite === 'compatibility' ? COMPATIBILITY_SCENARIOS : values.suite === 'adversarial' ? ADVERSARIAL_SCENARIOS : SCENARIOS,
    models: values.models.split(','), repeats: Number(values.repeats),
    maxCalls: Number(values['max-calls']), budgetUsd: Number(values['budget-usd']), evaluationPrompt });
  if (!values.live) {
    output(JSON.stringify({ state: 'dry-plan', inferenceCalls: 0, modelAvailability: 'not-checked', ...plan }, null, 2));
    return { state: 'dry-plan', plan };
  }
  const apiKey = env.OPENROUTER_EVAL_API_KEY?.trim();
  if (!apiKey) throw new Error('Set OPENROUTER_EVAL_API_KEY locally to a dedicated limited inference key. The app key is never reused automatically.');
  const budget = validateKeyBudget((await fetchJson(fetchImpl, 'https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${apiKey}` }
  }, 15000)).data, plan.budgetUsd);
  const runDir = resolve(values.out ?? '.local/evaluations', randomUUID());
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'manifest.json'), JSON.stringify({ state: 'started', createdAt: new Date().toISOString(),
    budget, ...plan, evidence: 'operator-recorded', mode: 'practice', bountyEnabled: false }, null, 2), { mode: 0o600 });
  let calls = 0;
  const boundedFetch = (url, init = {}) => {
    if (init.method === 'POST') {
      if (url !== 'https://openrouter.ai/api/v1/chat/completions' || calls >= plan.maxCalls) throw new Error('Evaluation request limit reached.');
      calls++;
    }
    return fetchImpl(url, init);
  };
  const service = createVaultService({ apiKey, fetchImpl: boundedFetch, logDir: join(runDir, 'receipts'), evaluationPrompt });
  try {
  const catalog = await service.models();
  await writeFile(join(runDir, 'catalog.json'), JSON.stringify(catalog, null, 2), { mode: 0o600 });
  if (plan.models.some(id => !catalog.models.some(model => model.id === id))) throw new Error('A requested model is not in the current app catalog. No inference was started.');
  const summary = await runEvaluation({ plan, service,
    record: row => appendFile(join(runDir, 'results.jsonl'), JSON.stringify(row) + '\n', { mode: 0o600 }) });
  await writeFile(join(runDir, 'summary.json'), JSON.stringify({ ...summary, actualPostRequests: calls }, null, 2), { mode: 0o600 });
  output(JSON.stringify({ runDir, ...summary, actualPostRequests: calls }, null, 2));
  return summary;
  } finally { service.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(result => { if (result.state === 'stopped') process.exitCode = 2; }).catch(() => {
    // Avoid accidental key exposure through unexpected provider/filesystem error text.
    console.error('Evaluation did not complete. Check arguments, dedicated key limits, current catalog and local run artifacts. No automatic retry was made.');
    process.exitCode = 1;
  });
}
