import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPublishedRoute, modelConfiguration, publicRules } from '../server/profiles.mjs';
import { validateCompletion } from '../server/upstream.mjs';
import { checkCandidates } from '../eval/check-models.mjs';

test('candidate profiles request explicit routes, no fallbacks, and reasoning off', () => {
  for (const [modelId, profile] of Object.entries(publicRules().profiles)) {
    assert.deepEqual(modelConfiguration(modelId), profile);
    assert.equal(profile.generation.provider.allow_fallbacks, false);
    assert.equal(profile.generation.provider.only.length, 1);
    assert.equal(profile.generation.reasoning.enabled, false);
    assert.equal(profile.status, 'candidate-not-qualified-for-prizes');
  }
  assert.equal(modelConfiguration('other/guard').routingScope, 'router');
  assert.equal(modelConfiguration('other/guard').generation.provider.only, undefined);
  assert.equal(hasPublishedRoute('anthropic/claude-opus-5'), true);
  assert.equal(hasPublishedRoute('other/guard'), false);
});

test('public profiles cannot be mutated by a caller to alter later requests', () => {
  const rules = publicRules(); rules.profiles['qwen/qwen3.5-9b'].generation.provider.only[0] = 'another-provider';
  assert.equal(modelConfiguration('qwen/qwen3.5-9b').generation.provider.only[0], 'deepinfra/bf16');
});

test('tool history retains original structured reasoning blocks without reordering or duplicating plaintext', () => {
  const details = [{ type: 'reasoning.encrypted', data: 'fixture-encrypted-block', index: 0 }, { type: 'reasoning.text', text: 'Fixture metadata only.', index: 1 }];
  const completion = { model: 'fixture/guard', choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
    reasoning: 'Not duplicated when structured blocks exist.', reasoning_details: details,
    tool_calls: [{ id: 'fixture-tool', type: 'function', function: { name: 'keep_locked', arguments: '{"explanation":"Still locked."}' } }] } }] };
  const result = validateCompletion(completion, 'fixture/guard');
  assert.deepEqual(result.message.reasoning_details, details);
  assert.equal(result.message.reasoning, undefined);
  result.message.reasoning_details[0].data = 'changed';
  assert.equal(details[0].data, 'fixture-encrypted-block');
});

test('metadata inspection makes GETs only and never upgrades advertised support to inference proof', async () => {
  const profiles = publicRules().profiles; const requests = [];
  const report = await checkCandidates({ fetchImpl: async (url, init) => {
    requests.push(init.method);
    if (url.endsWith('/models')) return Response.json({ data: Object.keys(profiles).map(id => ({ id, reasoning: { mandatory: false } })) });
    const modelId = url.split('/models/')[1].replace('/endpoints', '');
    return Response.json({ data: { endpoints: [{ tag: profiles[modelId].generation.provider.only[0], provider_name: 'Fixture', status: 0,
      supported_parameters: ['tools', 'tool_choice', 'reasoning', 'max_tokens', 'temperature'] }] } });
  } });
  assert.ok(requests.every(method => method === 'GET'));
  assert.equal(report.inferenceRequests, 0);
  assert.ok(report.candidates.every(c => c.status === 'request-compatible-by-metadata' && !c.inferenceTested && !c.fundedRoundEligible));
});
