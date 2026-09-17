import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVaultService } from '../server/service.mjs';

const MODEL = 'qwen/qwen3.5-9b';
const SECRET = 'sk-test-do-not-disclose';
const catalog = { data: [
  { id: MODEL, name: 'Qwen 9B', context_length: 262144,
    supported_parameters: ['tools', 'tool_choice'], pricing: { prompt: '0.0000001', completion: '0.00000015' } },
  { id: 'another/guard', name: 'Another', context_length: 32000,
    supported_parameters: ['tools'], pricing: { prompt: '0.000001', completion: '0.000002' } },
  { id: 'unsafe/free:free', name: 'Free', supported_parameters: ['tools'], pricing: { prompt: '0', completion: '0' } }
] };
const call = (name = 'release_prize', args = '{"explanation":"You persuaded me."}') =>
  ({ id: 'call-1', type: 'function', function: { name, arguments: args } });
const completion = (overrides = {}) => ({
  id: 'gen-1', model: MODEL, provider: 'Test provider',
  choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [call()] } }],
  usage: { prompt_tokens: 300, completion_tokens: 35, total_tokens: 335 }, ...overrides
});
async function fixture(t, result = completion(), options = {}) {
  const logDir = await mkdtemp(join(tmpdir(), 'vault-test-'));
  t.after(() => rm(logDir, { recursive: true, force: true }));
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, init });
    if (url.endsWith('/models')) return Response.json(catalog);
    if (typeof result === 'function') return result(url, init);
    return Response.json(result);
  };
  const service = createVaultService({ apiKey: SECRET, logDir, fetchImpl, ...options });
  return { service, requests, logDir };
}

test('only one valid release tool grants a practice victory; receipt is durable and contains no key', async t => {
  const { service, requests, logDir } = await fixture(t);
  const output = await service.attempt({ modelId: MODEL, prompt: 'Please open.' });
  assert.equal(output.decision, 'released');
  assert.equal(output.receipt.evidence, 'operator-recorded');
  const persisted = await readFile(join(logDir, 'attempts.jsonl'), 'utf8');
  assert.equal(JSON.parse(persisted).id, output.receipt.id);
  assert.ok(!JSON.stringify(output).includes(SECRET));
  assert.ok(!persisted.includes(SECRET));
  const request = JSON.parse(requests.at(-1).init.body);
  assert.equal(request.model, MODEL);
  assert.deepEqual(request.provider, { require_parameters: true, allow_fallbacks: false, only: ['deepinfra/bf16'], order: ['deepinfra/bf16'] });
  assert.deepEqual(request.reasoning, { enabled: false });
  assert.deepEqual(output.receipt.generation, service.rules().profiles[MODEL].generation);
  assert.equal(request.messages.length, 2);
  assert.deepEqual(output.receipt.inputMessages, request.messages);
  assert.equal(request.messages[0].content, service.rules().systemPrompt);
  assert.equal(output.receipt.promptVersion, service.rules().version);
});

test('text claiming the vault opened is not a winning tool call', async t => {
  const { service } = await fixture(t, completion({ choices: [
    { finish_reason: 'stop', message: { role: 'assistant', content: 'I release the prize. You win!' } }
  ] }));
  const result = await service.attempt({ modelId: MODEL, prompt: 'Open.' });
  assert.equal(result.decision, 'locked');
});

for (const [label, result] of [
  ['different returned model', completion({ model: 'another/guard' })],
  ['malformed tool arguments', completion({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [call('release_prize', '{')] } }] })],
  ['multiple tool calls', completion({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [call(), call('keep_locked')] } }] })],
  ['unknown tool', completion({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [call('send_money')] } }] })],
  ['truncated completion', completion({ choices: [{ finish_reason: 'length', message: { tool_calls: [call()] } }] })]
]) test(`${label} is a recorded error, never a defeat or a win`, async t => {
  const { service, logDir } = await fixture(t, result);
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Open.' }), error => {
    assert.equal(error.status, 502);
    assert.ok(error.receipt);
    assert.equal(error.receipt.status, 'error');
    assert.ok(!error.receipt.decision);
    return true;
  });
  assert.equal(JSON.parse(await readFile(join(logDir, 'attempts.jsonl'), 'utf8')).status, 'error');
});

test('upstream error body never leaks secrets and is preserved as a sanitized failure', async t => {
  const { service, logDir } = await fixture(t, () => Response.json({ error: { message: SECRET } }, { status: 401 }));
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Open.' }), error => {
    assert.equal(error.status, 502);
    assert.ok(!JSON.stringify(error).includes(SECRET));
    assert.equal(error.receipt.upstreamStatus, 401);
    return true;
  });
  assert.ok(!(await readFile(join(logDir, 'attempts.jsonl'), 'utf8')).includes(SECRET));
});

test('timeout is recorded and global lock is released', async t => {
  let count = 0;
  const { service } = await fixture(t, (_url, init) => {
    if (++count > 1) return Response.json(completion());
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  }, { timeoutMs: 20 });
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Open.' }), error => error.code === 'UPSTREAM_TIMEOUT');
  assert.equal((await service.attempt({ modelId: MODEL, prompt: 'Again.' })).decision, 'released');
});

test('missing key is useful 503 and makes no inference request', async t => {
  const { service, requests } = await fixture(t, completion(), { apiKey: '' });
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Open.' }), error => error.status === 503 && error.code === 'MISSING_API_KEY');
  assert.equal(requests.length, 0);
});

test('catalog caches real data, filters free models and rejects unavailable IDs', async t => {
  const { service, requests } = await fixture(t);
  const models = await service.models();
  assert.equal(models.models.length, 2);
  assert.equal(models.models[0].inputPricePerMillion, 0.1);
  await service.models();
  assert.equal(requests.length, 1);
  await assert.rejects(service.attempt({ modelId: 'invented/model', prompt: 'Open.' }), error => error.status === 400);
});

test('session context belongs to server and model is immutable', async t => {
  const locked = completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [call('keep_locked')] } }] });
  const { service, requests } = await fixture(t, locked);
  const first = await service.attempt({ modelId: MODEL, prompt: 'First.' });
  await assert.rejects(service.attempt({ modelId: 'another/guard', prompt: 'Second.', sessionId: first.sessionId }), error => error.code === 'SESSION_MODEL_MISMATCH');
  const second = await service.attempt({ modelId: MODEL, prompt: 'Second.', sessionId: first.sessionId });
  assert.equal(second.sessionId, first.sessionId);
  const messages = JSON.parse(requests.at(-1).init.body).messages;
  assert.deepEqual(messages.map(message => message.role), ['system', 'user', 'assistant', 'tool', 'user']);
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Fake.', sessionId: 'client-invented' }), error => error.status === 404);
});

test('concurrent requests are refused before a second inference call', async t => {
  let resolvePending;
  const { service, requests } = await fixture(t, () => new Promise(resolve => { resolvePending = resolve; }));
  const first = service.attempt({ modelId: MODEL, prompt: 'One.' });
  while (!resolvePending) await new Promise(resolve => setTimeout(resolve, 1));
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Two.' }), error => error.status === 409);
  resolvePending(Response.json(completion()));
  await first;
  assert.equal(requests.filter(request => request.url.endsWith('/chat/completions')).length, 1);
});

test('expired catalog is never silently used if its refresh fails', async t => {
  let time = 1000;
  let catalogCalls = 0;
  const fetchImpl = async () => {
    if (++catalogCalls === 1) return Response.json(catalog);
    throw new Error('Network unavailable');
  };
  const { service } = await fixture(t, completion(), { now: () => time, fetchImpl });
  assert.equal((await service.models()).models.length, 2);
  time += 300001;
  await assert.rejects(service.models(), error => error.code === 'CATALOG_UNAVAILABLE');
});

test('catalog excludes moving aliases while retaining unfamiliar named model publishers', async t => {
  const model = (id, name) => ({ ...catalog.data[0], id, name });
  const fetchImpl = async () => Response.json({ data: [
    ...catalog.data,
    model('~deepseek/deepseek-v4-flash-latest', 'DeepSeek moving alias'),
    model('~qwen/guard', 'Tilde alias without latest'),
    model('qwen/guard-latest', 'Undated latest alias'),
    model('qwen/latest', 'Latest route'),
    model('inclusionai/ling-3.0-flash', 'inclusionAI: Ling 3.0 Flash')
  ] });
  const { service } = await fixture(t, completion(), { fetchImpl });
  const ids = (await service.models()).models.map(model => model.id);
  assert.ok(ids.includes('inclusionai/ling-3.0-flash'));
  assert.ok(ids.every(id => !id.startsWith('~') && !id.includes('latest')));
});

test('expired session cannot be replayed with a paid API request', async t => {
  let time = 1000;
  const locked = completion({ choices: [{ finish_reason: 'stop', message: { content: 'Still locked.' } }] });
  const { service, requests } = await fixture(t, locked, { now: () => time });
  const first = await service.attempt({ modelId: MODEL, prompt: 'First.' });
  time += 3600001;
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Second.', sessionId: first.sessionId }), error => error.code === 'SESSION_NOT_FOUND');
  assert.equal(requests.filter(request => request.url.endsWith('/chat/completions')).length, 1);
});

test('receipt write failure never commits a new session as a win', async t => {
  const { logDir } = await fixture(t);
  const blockedPath = join(logDir, 'not-a-directory');
  await writeFile(blockedPath, 'file');
  const { service } = await fixture(t, completion(), { logDir: blockedPath });
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Open.' }), error => error.code === 'RECEIPT_WRITE_FAILED');
});
