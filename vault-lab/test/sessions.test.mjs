import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createVaultService } from '../server/service.mjs';
import { RULES } from '../server/rules.mjs';

const MODEL = 'qwen/qwen3.5-9b';
const OWNER = 'player_fixture';
async function setup(t) {
  const root = resolve(tmpdir()); const dir = await mkdtemp(join(root, 'vault-sessions-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  const posts = []; const services = [];
  const create = () => {
    const service = createVaultService({ apiKey: 'fixture-key', logDir: join(dir, 'receipts'), sessionsPath: join(dir, 'sessions.sqlite'),
      fetchImpl: async (url, init = {}) => {
        if (url.endsWith('/models')) return Response.json({ data: [{ id: MODEL, supported_parameters: ['tools'], pricing: { prompt: '0.00001', completion: '0.00001' } }] });
        posts.push(JSON.parse(init.body));
        return Response.json({ model: MODEL, choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Fixture: vault locked.' } }], usage: { cost: 0.001 } });
      } });
    services.push(service); return service;
  };
  // Explicit close before removing each SQLite file on Windows.
  t.after(async () => {
    for (const service of services) { try { service.close(); } catch {} }
    await rm(dir, { recursive: true, force: true });
  });
  return { create, posts };
}

test('sessions survive restart with actual previous messages and reject another account', async t => {
  const f = await setup(t); let service = f.create();
  const first = await service.attempt({ modelId: MODEL, prompt: 'First argument.' }, { ownerId: OWNER });
  service.close(); service = f.create();
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Read another player history.', sessionId: first.sessionId }, { ownerId: 'other-player' }),
    error => error.code === 'SESSION_NOT_FOUND');
  assert.equal(f.posts.length, 1);
  await service.attempt({ modelId: MODEL, prompt: 'Second argument.', sessionId: first.sessionId }, { ownerId: OWNER });
  assert.equal(f.posts[1].messages.length, 4);
  assert.equal(f.posts[1].messages[1].content, 'First argument.');
});

test('free practice and different credit rounds cannot share a persuasion history', async t => {
  const f = await setup(t); const service = f.create();
  const first = await service.attempt({ modelId: MODEL, prompt: 'Free practice setup.' });
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Use that setup in the bounty.', sessionId: first.sessionId }, { roundId: 'round-1' }),
    error => error.code === 'SESSION_ROUND_MISMATCH');
  const round = await service.attempt({ modelId: MODEL, prompt: 'Round one.' }, { roundId: 'round-1' });
  await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Round two.', sessionId: round.sessionId }, { roundId: 'round-2' }),
    error => error.code === 'SESSION_ROUND_MISMATCH');
  assert.equal(f.posts.length, 2);
});

test('configuration changes after restart refuse old sessions instead of silently changing the rival', async t => {
  const f = await setup(t); let service = f.create();
  const first = await service.attempt({ modelId: MODEL, prompt: 'Hello.' });
  const original = RULES.version;
  try {
    RULES.version = 'new-fixture-version';
    service.close(); service = f.create();
    await assert.rejects(service.attempt({ modelId: MODEL, prompt: 'Continue.', sessionId: first.sessionId }), error => error.code === 'SESSION_CONFIGURATION_CHANGED');
  } finally { RULES.version = original; }
  assert.equal(f.posts.length, 1);
});
