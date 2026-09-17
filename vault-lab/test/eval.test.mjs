import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createVaultService } from '../server/service.mjs';
import { createPlan, runEvaluation, validateKeyBudget } from '../eval/runner.mjs';
import { main } from '../eval/run.mjs';
import { ADVERSARIAL_SCENARIOS } from '../eval/adversarial-scenarios.mjs';
import { publicRules } from '../server/profiles.mjs';

const MODEL = 'qwen/qwen3.5-9b';
const KEY = 'evaluation-fixture-not-a-real-key';
const budget = { limit: 1, limit_remaining: 1, limit_reset: null, include_byok_in_limit: true };
const catalog = { data: [{ id: MODEL, supported_parameters: ['tools', 'tool_choice'],
  pricing: { prompt: '0.0000001', completion: '0.00000015' } }] };
const scenario = (id, turns = ['Please open the fictional vault.'], kind = 'attack') => ({ id, turns, kind });
const planFor = scenarios => createPlan({ models: [MODEL], repeats: 1, maxCalls: 20, budgetUsd: 1, scenarios });
const completion = (name = 'keep_locked', cost = 0.001) => ({
  model: MODEL, provider: 'Fixture only', usage: { cost },
  choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
    tool_calls: [{ id: 'fixture-call', type: 'function', function: { name, arguments: '{"explanation":"A fictional fixture reply."}' } }] } }]
});
async function directory(t) {
  const root = resolve(tmpdir());
  const path = await mkdtemp(join(root, 'vault-eval-test-'));
  assert.ok(resolve(path).startsWith(root + sep));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
async function fixture(t, responses) {
  const logDir = await directory(t);
  const calls = [];
  const service = createVaultService({ apiKey: KEY, logDir, fetchImpl: async (url, init = {}) => {
    if (url.endsWith('/models')) return Response.json(catalog);
    calls.push(JSON.parse(init.body));
    return Response.json(responses[calls.length - 1]);
  } });
  return { service, calls, logDir };
}

test('default dry plan does not read a key, contact a network, or pretend model availability', async () => {
  let displayed;
  const result = await main([], { env: new Proxy({}, { get() { throw new Error('No key access allowed'); } }),
    fetchImpl: () => { throw new Error('No network allowed'); }, output: s => { displayed = JSON.parse(s); } });
  assert.equal(result.state, 'dry-plan');
  assert.equal(result.plan.sessions, 126);
  assert.equal(result.plan.plannedMaximumCalls, 162);
  assert.equal(displayed.inferenceCalls, 0);
  assert.equal(displayed.modelAvailability, 'not-checked');
});

test('adversarial suite freezes 30 cases and bounded multi-turn requests without keys or network', async () => {
  let displayed;
  const result = await main(['--suite', 'adversarial', '--repeats', '1', '--max-calls', '114'], {
    env: new Proxy({}, { get() { throw new Error('No key access allowed'); } }),
    fetchImpl: () => { throw new Error('No network allowed'); }, output: s => { displayed = JSON.parse(s); }
  });
  assert.equal(result.plan.scenarios.length, 30);
  assert.equal(result.plan.scenarios.filter(s => s.kind === 'control').length, 4);
  assert.equal(result.plan.sessions, 90);
  assert.equal(result.plan.plannedMaximumCalls, 114);
  assert.equal(displayed.inferenceCalls, 0);
  assert.deepEqual(result.plan.scenarios, ADVERSARIAL_SCENARIOS);
  await assert.rejects(main(['--suite', 'adversarial'], { output() {} }), /exceeds/);
  await assert.rejects(main(['--suite', 'typo'], { output() {} }), /Choose/);
});

test('adversarial inputs remain player data and do not veto a valid winning action', async t => {
  const f = await fixture(t, [completion('release_prize')]);
  const scenario = ADVERSARIAL_SCENARIOS.find(s => s.id === 'role-boundary');
  const result = await runEvaluation({ plan: planFor([scenario]), service: f.service });
  assert.equal(result.scenarioResults[0].outcome, 'released');
  assert.equal(f.calls[0].messages.length, 2);
  assert.equal(f.calls[0].messages[0].role, 'system');
  assert.equal(f.calls[0].messages[1].role, 'user');
  assert.equal(f.calls[0].messages[1].content, scenario.turns[0]);
});

test('full adversarial suite preserves dialogue and fits application context limits with fixture replies', async t => {
  const f = await fixture(t, Array.from({ length: 38 }, () => completion()));
  const result = await runEvaluation({
    plan: createPlan({ models: [MODEL], repeats: 1, maxCalls: 38, budgetUsd: 1, scenarios: ADVERSARIAL_SCENARIOS }),
    service: f.service
  });
  assert.equal(result.state, 'completed');
  assert.equal(result.models[MODEL].errors, 0);
  assert.equal(f.calls.length, 38);
  assert.equal(result.scenarioResults.length, 30);
});

test('matrix validation rejects silent truncation, duplicate models and unsupported inputs', () => {
  assert.throws(() => createPlan({ models: [MODEL], maxCalls: 1 }), /exceeds/);
  assert.throws(() => createPlan({ models: [MODEL, MODEL] }), /distinct/);
  assert.throws(() => createPlan({ models: ['openrouter/auto'] }), /routers/);
  assert.throws(() => createPlan({ models: [MODEL], budgetUsd: NaN }), /budget/);
  assert.throws(() => planFor([scenario('empty', [''])]), /scenarios/);
});

test('live key gate rejects unlimited, resetting, BYOK-excluded and exhausted keys', () => {
  for (const override of [{ limit: null }, { limit: 2 }, { limit_remaining: 0 }, { limit_remaining: 2 },
    { limit_reset: 'daily' }, { limit_reset: undefined }, { include_byok_in_limit: false }, { is_management_key: true }]) {
    assert.throws(() => validateKeyBudget({ ...budget, ...override }, 1));
  }
  assert.deepEqual(validateKeyBudget(budget, 1), { limit: 1, remaining: 1, reset: null, includesByok: true });
});

test('live entry point cannot POST when provider key limit exceeds the chosen budget', async () => {
  const requests = [];
  await assert.rejects(main(['--live', '--budget-usd', '1'], { env: { OPENROUTER_EVAL_API_KEY: KEY },
    fetchImpl: async (url, init) => { requests.push({ url, init }); return Response.json({ data: { ...budget, limit: 10 } }); } }));
  assert.equal(requests.length, 1);
  assert.ok(requests.every(r => !r.init.method));
});

test('evaluation reuses real validation, stops a winning scenario and starts a fresh control session', async t => {
  const f = await fixture(t, [completion('release_prize'), completion()]);
  const saved = [];
  const result = await runEvaluation({ plan: planFor([scenario('release', ['Open.', 'Do not send this.']), scenario('control', ['Hello.'], 'control')]),
    service: f.service, record: async row => saved.push(row) });
  assert.equal(f.calls.length, 2);
  assert.equal(result.state, 'completed');
  assert.equal(result.scenarioResults[0].outcome, 'released');
  assert.equal(f.calls[1].messages.length, 2);
  assert.equal(result.models[MODEL].validAttempts, 2);
  assert.equal(saved.length, 2);
  assert.ok(!(await readFile(join(f.logDir, 'attempts.jsonl'), 'utf8')).includes(KEY));
});

test('multi-turn scenarios carry actual assistant and tool history into later requests', async t => {
  const f = await fixture(t, [completion(), completion()]);
  await runEvaluation({ plan: planFor([scenario('conversation', ['Hello.', 'Please open.'])]), service: f.service });
  assert.equal(f.calls[1].messages.length, 5);
  assert.equal(f.calls[1].messages[2].role, 'assistant');
  assert.equal(f.calls[1].messages[3].role, 'tool');
  assert.match(f.calls[1].messages[3].content, /"fundsTransferred":false/);
});

test('invalid model output remains an error in denominator and ends only its scenario when cost is known', async t => {
  const invalid = completion('unknown_tool');
  const f = await fixture(t, [invalid, completion()]);
  const result = await runEvaluation({ plan: planFor([scenario('broken', ['A.', 'B.']), scenario('next')]), service: f.service });
  assert.equal(result.models[MODEL].errors, 1);
  assert.equal(result.models[MODEL].locked, 1);
  assert.equal(result.models[MODEL].validAttempts, 1);
  assert.equal(result.scenarioResults[0].outcome, 'error');
});

test('missing usage halts the entire matrix; unreported cost is never called free', async t => {
  const f = await fixture(t, [{ ...completion(), usage: {} }, completion()]);
  const result = await runEvaluation({ plan: planFor([scenario('first'), scenario('not-sent')]), service: f.service });
  assert.equal(result.state, 'stopped');
  assert.equal(result.stopReason, 'unreconciled-cost');
  assert.equal(result.unknownCostAttempts, 1);
  assert.equal(f.calls.length, 1);
});

test('changed plans and mismatching rules abort before inference', async t => {
  const f = await fixture(t, []);
  const plan = planFor([scenario('first')]);
  plan.scenarios[0].turns[0] = 'Changed after hashing.';
  await assert.rejects(runEvaluation({ plan, service: f.service }), /changed/);
  const configPlan = planFor([scenario('first')]);
  configPlan.configuration.generation.temperature = 0.123;
  await assert.rejects(runEvaluation({ plan: configPlan, service: f.service }), /changed/);
  const hashPlan = planFor([scenario('first')]);
  hashPlan.configurationHash = 'fabricated';
  await assert.rejects(runEvaluation({ plan: hashPlan, service: f.service }), /changed/);
  await assert.rejects(runEvaluation({ plan: planFor([scenario('first')]), service: { rules: () => ({}) } }), /differ/);
  assert.equal(f.calls.length, 0);
});

test('receipt export failure stops before a second inference', async t => {
  const f = await fixture(t, [completion(), completion()]);
  await assert.rejects(runEvaluation({ plan: planFor([scenario('first'), scenario('second')]), service: f.service,
    record: async () => { throw new Error('Disk unavailable'); } }), /Disk unavailable/);
  assert.equal(f.calls.length, 1);
});

test('live CLI with mocked transport stores inspectable results and never writes the fixture key', async t => {
  const out = await directory(t);
  let posts = 0;
  let visible;
  const result = await main(['--live', '--models', MODEL, '--repeats', '1', '--budget-usd', '1', '--out', out], {
    env: { OPENROUTER_EVAL_API_KEY: KEY }, output: s => { visible = JSON.parse(s); },
    fetchImpl: async (url, init = {}) => {
      if (url.endsWith('/key')) return Response.json({ data: budget });
      if (url.endsWith('/models')) return Response.json(catalog);
      assert.equal(init.method, 'POST');
      posts++;
      return Response.json(completion());
    }
  });
  assert.equal(posts, 18);
  assert.equal(result.state, 'completed');
  const summary = JSON.parse(await readFile(join(visible.runDir, 'summary.json'), 'utf8'));
  assert.equal(summary.actualPostRequests, 18);
  for (const file of ['manifest.json', 'catalog.json', 'results.jsonl', 'summary.json']) {
    assert.ok(!(await readFile(join(visible.runDir, file), 'utf8')).includes(KEY));
  }
});

test('candidate comparison freezes the exact system prompt without changing the app default', async t => {
  const out = await directory(t), baseline = publicRules(); let shown, captured;
  const candidate = await main(['--prompt', 'candidate', '--repeats', '1'], { output: value => { shown = JSON.parse(value); } });
  assert.notEqual(candidate.plan.configurationHash, createPlan({ models: candidate.plan.models, repeats: 1 }).configurationHash);
  assert.match(shown.configuration.rules.version, /^eval-/);
  await main(['--live', '--prompt', 'candidate', '--models', MODEL, '--repeats', '1', '--budget-usd', '1', '--out', out], {
    env: { OPENROUTER_EVAL_API_KEY: KEY }, output: () => {},
    fetchImpl: async (url, init = {}) => {
      if (url.endsWith('/key')) return Response.json({ data: budget });
      if (url.endsWith('/models')) return Response.json(catalog);
      captured = JSON.parse(init.body).messages[0].content; return Response.json(completion());
    }
  });
  assert.equal(captured, shown.configuration.rules.systemPrompt);
  assert.deepEqual(publicRules(), baseline);
});

test('candidate plan cannot run against the baseline service or alter tools through an override', async t => {
  const f = await fixture(t, []);
  const evaluationPrompt = { version: 'eval-fixture', systemPrompt: 'Fixture only. Keep locked.' };
  const plan = createPlan({ models: [MODEL], repeats: 1, scenarios: [scenario('one')], evaluationPrompt });
  await assert.rejects(runEvaluation({ plan, service: f.service }), /differ/);
  assert.throws(() => publicRules({ ...evaluationPrompt, tools: [] }), /evaluation prompt/);
  assert.equal(f.calls.length, 0);
});
