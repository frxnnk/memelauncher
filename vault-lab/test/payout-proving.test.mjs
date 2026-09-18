import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoundRegistry } from '../server/rounds.mjs';
import { RULES } from '../server/rules.mjs';
import { publicFairnessBoard } from '../server/economy/fairness-board.mjs';
import { validateWebFundingConfiguration } from '../server/economy/web-funding-runtime.mjs';
import {
  PAYOUT_PROVING_KIND, PAYOUT_PROVING_VERSION, PAYOUT_PROVING_PROMPT, payoutProvingRules
} from '../server/economy/payout-proving.mjs';
import { PUBLIC_SOURCE_URL } from '../public/source.js';
import { creditPlayModels } from '../public/funding-network.js';
import { accountGameFixture, completion, input } from './fixtures/account-game.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const HAIKU = 'anthropic/claude-haiku-4.5';

test('payout proving is a published eval prompt and does not rewrite the game prompt', () => {
  const baseline = RULES.systemPrompt;
  const proving = payoutProvingRules();
  assert.equal(PAYOUT_PROVING_PROMPT.version, PAYOUT_PROVING_VERSION);
  assert.match(PAYOUT_PROVING_VERSION, /^eval-[a-z0-9-]{1,80}$/);
  assert.match(proving.systemPrompt, /payout-proving/i);
  assert.match(proving.systemPrompt, /release_prize/);
  assert.match(proving.systemPrompt, /any language/);
  assert.deepEqual(proving.tools, RULES.tools);
  assert.equal(RULES.systemPrompt, baseline);
  assert.match(baseline, /fictional practice vault/);
  assert.doesNotMatch(baseline, /payout-proving/);
});

test('a proving round freezes its own prompt; live rule drift does not pause it', t => {
  const registry = createRoundRegistry(); t.after(registry.close);
  const models = [HAIKU, 'google/gemini-2.5-flash'];
  const first = registry.freeze('rh-payout-prove-v1', models, payoutProvingRules());
  assert.equal(first.manifest.configuration.rules.version, PAYOUT_PROVING_VERSION);
  assert.deepEqual(registry.freeze('rh-payout-prove-v1', models, payoutProvingRules()), first);
  assert.throws(() => registry.freeze('rh-payout-prove-v1', models), error => error.code === 'ROUND_IMMUTABLE');
  const version = RULES.version;
  try {
    RULES.version = 'new-rules';
    assert.deepEqual(registry.assertCurrent('rh-payout-prove-v1', HAIKU), first);
  } finally { RULES.version = version; }
});

test('live Vercel config keeps Opus as the game and Haiku as a separate proving pot', () => {
  const vercelPaid = JSON.parse(readFileSync(join(root, 'config/paid-beta.vercel.json'), 'utf8'));
  const validated = validateWebFundingConfiguration(vercelPaid);
  assert.equal(validated.rounds.length, 2);
  assert.equal(validated.rounds[0].id, 'rh-paid-opus-v1');
  assert.deepEqual(validated.rounds[0].models, ['anthropic/claude-opus-5']);
  assert.equal(validated.rounds[0].kind, undefined);
  assert.equal(validated.rounds[1].id, 'rh-payout-prove-v1');
  assert.equal(validated.rounds[1].kind, PAYOUT_PROVING_KIND);
  assert.deepEqual(validated.rounds[1].models, [HAIKU]);
  assert.equal(validated.terms.price, '5000000000000000000');
  assert.throws(() => validateWebFundingConfiguration({
    ...vercelPaid,
    rounds: [...vercelPaid.rounds, { id: 'extra', models: [HAIKU], extra: true }]
  }), /id, models, and kind/i);
});

test('a proving release records a payable without changing the practice prompt', async t => {
  const f = await accountGameFixture({
    roundId: 'rh-payout-prove-v1', models: [HAIKU], rules: payoutProvingRules()
  });
  t.after(f.close);
  f.deposit();
  f.controls.transport = body => {
    assert.equal(body.messages[0].content, payoutProvingRules().systemPrompt);
    return completion(HAIKU, 'release_prize');
  };
  const result = await f.game.attempt(f.headers(), {
    ...input('prove-win'), roundId: 'rh-payout-prove-v1', modelId: HAIKU
  });
  assert.equal(result.decision, 'released');
  assert.equal(result.receipt.promptVersion, PAYOUT_PROVING_VERSION);
  assert.equal(f.economy.state().rounds[0].state, 'won');
  assert.ok(BigInt(f.economy.state().balances.find(row => row.account === 'round:rh-payout-prove-v1:payable')?.amount ?? '0') > 0n);
  const board = publicFairnessBoard(f.economy);
  assert.equal(board.sourceUrl, PUBLIC_SOURCE_URL);
  assert.equal(board.rounds[0].kind, PAYOUT_PROVING_KIND);
  assert.match(board.rounds[0].systemPrompt, /payout-proving/);
  assert.match(RULES.systemPrompt, /fictional practice vault/);
});

test('credit play labels the proving guardian without hiding Opus', () => {
  const catalog = [{ id: HAIKU, name: 'Haiku', company: 'anthropic' }];
  const funding = {
    rounds: [
      { state: 'open', kind: 'game', manifest: { manifest: { configuration: { guardians: [{ modelId: 'anthropic/claude-opus-5' }] } } } },
      { state: 'open', kind: PAYOUT_PROVING_KIND, manifest: { manifest: { configuration: { guardians: [{ modelId: HAIKU }] } } } }
    ]
  };
  const credited = creditPlayModels(catalog, funding, true);
  assert.deepEqual(credited.map(model => model.id), ['anthropic/claude-opus-5', HAIKU]);
  assert.equal(credited[0].playKind, 'game');
  assert.equal(credited[1].playKind, PAYOUT_PROVING_KIND);
  assert.match(credited[1].name, /payout proving/i);
});
