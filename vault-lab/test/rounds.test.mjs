import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createRoundRegistry, DEFAULT_GUARDIANS } from '../server/rounds.mjs';
import { createEconomyService } from '../server/economy/service.mjs';
import { createCreditGame } from '../server/economy/model-game.mjs';
import { createLedger } from '../server/economy/ledger.mjs';
import { RULES } from '../server/rules.mjs';

test('roster rejects moving or unknown models, duplicate entries and unsupported sizes', t => {
  const registry = createRoundRegistry(); t.after(registry.close);
  for (const models of [[], [DEFAULT_GUARDIANS[0]], [...DEFAULT_GUARDIANS, 'qwen/qwen3.6-27b'],
    ['qwen/qwen3.5-9b', 'qwen/qwen3.5-9b'], ['openrouter/auto', DEFAULT_GUARDIANS[0]]]) {
    assert.throws(() => registry.freeze('round-x', models), error => error.code === 'INVALID_GUARDIAN_ROSTER');
  }
  const initial = registry.freeze('round-1');
  assert.equal(initial.manifest.configuration.realFunds, false);
  assert.deepEqual(initial.manifest.configuration.guardians.map(g => g.modelId), DEFAULT_GUARDIANS);
  assert.deepEqual(registry.freeze('round-1'), initial);
  assert.throws(() => registry.freeze('round-1', DEFAULT_GUARDIANS.slice(0, 2)), error => error.code === 'ROUND_IMMUTABLE');
  initial.manifest.configuration.rules.systemPrompt = 'tampered client copy';
  assert.notEqual(registry.get('round-1').manifest.configuration.rules.systemPrompt, 'tampered client copy');
});

test('configuration drift pauses new model attempts while preserving the original manifest', t => {
  const registry = createRoundRegistry(); t.after(registry.close);
  const original = registry.freeze('round-1');
  const version = RULES.version;
  try {
    RULES.version = 'new-rules';
    assert.throws(() => registry.assertCurrent('round-1', DEFAULT_GUARDIANS[0]), error => error.code === 'ROUND_CONFIGURATION_CHANGED');
    assert.deepEqual(registry.get('round-1'), original);
  } finally { RULES.version = version; }
  assert.deepEqual(registry.assertCurrent('round-1', DEFAULT_GUARDIANS[0]), original);
});

test('unlisted model cannot reserve credits or invoke inference in the common bounty', async t => {
  const economy = createEconomyService(); let calls = 0;
  const game = createCreditGame({ economy, vault: { status: () => ({ configured: true }), attempt: () => { calls++; } } });
  t.after(() => { game.close(); economy.close(); });
  economy.action({ action: 'topup', key: 'topup', amount: '1000' });
  const before = economy.export();
  await assert.rejects(game.attempt({ key: 'wrong-model', roundId: 'round-1', modelId: 'qwen/qwen3.6-27b', prompt: 'Open.', simulatedCredits: true }),
    error => error.code === 'ROUND_MODEL_NOT_ALLOWED');
  assert.equal(calls, 0);
  assert.deepEqual(economy.export(), before);
  assert.throws(() => game.result('wrong-model'), error => error.code === 'MODEL_JOB_NOT_FOUND');
});

test('restart preserves manifests and legacy rounds never acquire retrospective rules', async t => {
  const root = resolve(tmpdir()); const dir = await mkdtemp(join(root, 'vault-rounds-'));
  assert.ok(resolve(dir).startsWith(root + sep)); t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'economy.sqlite');
  const legacy = createLedger({ path });
  legacy.execute('initial-round-v1', { type: 'open-round', roundId: 'round-1', price: '100', prizeBps: 7000,
    operationsBps: 2000, configuration: 'accounting-sandbox-v1' });
  legacy.close();
  let economy = createEconomyService({ path });
  assert.throws(() => economy.assertModel('round-1', DEFAULT_GUARDIANS[0]), error => error.code === 'ROUND_NOT_FROZEN');
  economy.action({ action: 'new-round', key: 'next' });
  const manifest = economy.assertModel('round-next', DEFAULT_GUARDIANS[0]);
  economy.close(); economy = createEconomyService({ path });
  assert.deepEqual(economy.assertModel('round-next', DEFAULT_GUARDIANS[0]), manifest);
  assert.equal(economy.state().rounds.find(r => r.id === 'round-1').configuration, 'accounting-sandbox-v1');
  economy.close();
});
