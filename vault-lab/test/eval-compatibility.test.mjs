import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { main } from '../eval/run.mjs';
import { createPlan } from '../eval/runner.mjs';
import { COMPATIBILITY_PROMPT, COMPATIBILITY_SCENARIOS } from '../eval/compatibility-scenarios.mjs';
import { publicRules } from '../server/profiles.mjs';

const MODEL = 'qwen/qwen3.5-9b';
const completion = name => ({ model:MODEL, usage:{ cost:0.001 }, choices:[{ finish_reason:'tool_calls', message:{ role:'assistant', content:null,
  tool_calls:[{ id:'fixture-tool', type:'function', function:{ name, arguments:'{"explanation":"Tool-format fixture only."}' } }] } }] });
async function run(t, responses) {
  const root = resolve(tmpdir()), directory = await mkdtemp(join(root, 'vault-tool-controls-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const requests = [], rows = [];
  const summary = await main(['--live', '--suite', 'compatibility', '--repeats', '1', '--models', MODEL,
    '--max-calls', '2', '--budget-usd', '1', '--out', directory], {
    env:{ OPENROUTER_EVAL_API_KEY:'fixture-only-key' }, output:() => {},
    fetchImpl:async (url, options = {}) => {
      if (url.endsWith('/key')) return Response.json({ data:{ limit:1, limit_remaining:1, limit_reset:null, include_byok_in_limit:true } });
      if (url.endsWith('/models')) return Response.json({ data:[{ id:MODEL, supported_parameters:['tools'], pricing:{ prompt:'0.00001', completion:'0.00001' } }] });
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); assert.equal(options.method, 'POST');
      requests.push(JSON.parse(options.body));
      const value = responses[requests.length - 1]; rows.push(value); return Response.json(value);
    }
  });
  return { summary, requests, rows };
}

test('compatibility plan requires no key/network, freezes both permitted tools and does not change the game prompt', async () => {
  const baseline = publicRules();
  const result = await main(['--suite', 'compatibility', '--repeats', '1', '--max-calls', '6'], {
    env:new Proxy({}, { get() { throw new Error('No key access'); } }), fetchImpl:() => { throw new Error('No network'); }, output:() => {} });
  assert.equal(result.state, 'dry-plan'); assert.equal(result.plan.plannedMaximumCalls, 6);
  assert.equal(result.plan.configuration.rules.version, COMPATIBILITY_PROMPT.version);
  assert.deepEqual(result.plan.scenarios.map(s => s.expectedTool), ['keep_locked', 'release_prize']);
  assert.deepEqual(result.plan.configuration.rules.tools, baseline.tools);
  assert.deepEqual(publicRules(), baseline);
  await assert.rejects(main(['--suite', 'compatibility', '--prompt', 'candidate'], { output:() => {} }), /separate suite/);
});

test('both exact valid tool calls pass only the technical controls, not a funded qualification', async t => {
  const { summary, requests } = await run(t, [completion('keep_locked'), completion('release_prize')]);
  assert.equal(summary.state, 'completed'); assert.equal(requests.length, 2);
  assert.deepEqual(summary.models[MODEL].toolControls, { attempted:2, passed:2, failed:0 });
  for (const request of requests) assert.equal(request.messages[0].content, COMPATIBILITY_PROMPT.systemPrompt);
  assert.equal(summary.models[MODEL].controlReleases, 1);
});

test('textual tool JSON and the wrong real tool fail the control despite valid model replies', async t => {
  const text = { model:MODEL, usage:{ cost:0.001 }, choices:[{ finish_reason:'stop', message:{ role:'assistant',
    content:'{"name":"keep_locked","arguments":{"explanation":"Text is not a tool call."}}' } }] };
  const { summary } = await run(t, [text, completion('keep_locked')]);
  assert.equal(summary.state, 'completed');
  assert.equal(summary.models[MODEL].validAttempts, 2);
  assert.deepEqual(summary.models[MODEL].toolControls, { attempted:2, passed:0, failed:2 });
  assert.equal(summary.models[MODEL].errors, 0);
});

test('technical errors do not count as passing tools, and expected-tool declarations are restricted', async t => {
  const invalid = completion('unknown_tool');
  const { summary } = await run(t, [invalid, completion('release_prize')]);
  assert.equal(summary.models[MODEL].errors, 1);
  assert.deepEqual(summary.models[MODEL].toolControls, { attempted:2, passed:1, failed:1 });
  for (const override of [{ expectedTool:'withdraw' }, { kind:'attack' }, { turns:['One.', 'Two.'] }]) {
    assert.throws(() => createPlan({ models:[MODEL], scenarios:[{ ...COMPATIBILITY_SCENARIOS[0], ...override }] }), /Expected tool/);
  }
});
