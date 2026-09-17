import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createVaultService } from '../server/service.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createTelegramStore } from '../server/telegram-store.mjs';
import { createTelegramGame, telegramOwner } from '../server/telegram-game.mjs';
import { createTelegramApi, startTelegram } from '../server/telegram.mjs';

const MODEL = 'google/gemini-2.5-flash';
const BOT = 123456;
const update = (id, text, user = 42) => ({ update_id: id, message: { text, chat: { id: user, type: 'private' }, from: { id: user, is_bot: false } } });
async function fixture(t, { cost = .002, decision = 'keep_locked', budgetUsd = 5 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vault-telegram-'));
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  const requests = [], delivered = [];
  const vault = createVaultService({ apiKey: 'fixture-key', logDir: root, sessionsPath: join(root, 'sessions.sqlite'), fetchImpl: async (url, init) => {
    if (url.endsWith('/models')) return Response.json({ data: [{ id: MODEL, name: 'Gemini Flash', supported_parameters: ['tools', 'tool_choice'], pricing: { prompt: '0.000001', completion: '0.000001' } }] });
    requests.push(JSON.parse(init.body));
    return Response.json({ id: 'gen-fixture', model: MODEL, provider: 'Fixture', usage: { cost }, choices: [{ finish_reason: 'tool_calls', message: {
      role: 'assistant', content: null, tool_calls: [{ id: 'call-fixture', type: 'function', function: { name: decision, arguments: JSON.stringify({ explanation: 'Nice try. Still locked.' }) } }]
    } }] });
  } });
  const limits = createInferenceLimits({ path: join(root, 'usage.sqlite'), budgetUsd });
  let store = createTelegramStore(join(root, 'telegram.sqlite'));
  let failSend = false;
  const send = async (chat, text) => { if (failSend) throw new Error('Uncertain send'); delivered.push({ chat, text }); };
  const createGame = () => createTelegramGame({ botId: BOT, username: 'vault_test_bot', vault, limits, store, send, defaultModel: MODEL });
  t.after(async () => { store.close(); vault.close(); limits.close(); await rm(root, { recursive: true, force: true }); });
  return { vault, limits, requests, delivered, createGame, store: () => store,
    failSend: value => { failSend = value; }, restart: () => { store.close(); store = createTelegramStore(join(root, 'telegram.sqlite')); return createGame(); } };
}

test('Telegram uses actual engine, bound model sessions and validated winning tool, then closes play', async t => {
  const f = await fixture(t, { decision: 'release_prize' }); const game = f.createGame();
  await game.process(update(1, 'Open it.'));
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].messages[0].content, f.vault.rules().systemPrompt);
  assert.match(f.delivered[0].text, /Practice win/);
  assert.equal(f.store().profile(telegramOwner(BOT, 42)).closed, true);
  await game.process(update(2, 'Again')); assert.equal(f.requests.length, 1);
  await game.process(update(3, '/new')); await game.process(update(4, 'Try again'));
  assert.equal(f.requests.length, 2); assert.equal(f.requests[1].messages.length, 2);
  assert.equal(f.limits.status(telegramOwner(BOT, 42)).reportedCostUsd, .004);
});

test('lost Telegram delivery survives restart and /last recovers without a second paid request', async t => {
  const f = await fixture(t); let game = f.createGame(); f.failSend(true);
  await assert.rejects(game.process(update(10, 'Please.')), /Uncertain send/);
  assert.equal(f.requests.length, 1); assert.equal(game.offset(), 11);
  game = f.restart(); f.failSend(false);
  await game.process(update(10, 'Please.')); assert.equal(f.delivered.length, 0);
  await game.process(update(11, '/last')); assert.match(f.delivered[0].text, /Nice try/);
  assert.equal(f.requests.length, 1); assert.equal(f.limits.status(telegramOwner(BOT, 42)).requestsToday, 1);
});

test('only private human text can reach inference; owner scopes and receipts cannot cross accounts', async t => {
  const f = await fixture(t); const game = f.createGame();
  const group = update(1, 'Please'); group.message.chat.type = 'group';
  const bot = update(2, 'Please'); bot.message.from.is_bot = true;
  const forged = update(3, 'Please'); forged.message.chat.id = 99;
  for (const input of [group, bot, forged, { update_id: 4, edited_message: update(0, 'edited').message }, update(5, 'x'.repeat(2001))]) await game.process(input);
  assert.equal(f.requests.length, 0);
  await game.process(update(6, 'Argument A', 42)); await game.process(update(7, 'Argument B', 43));
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].messages.length, 2);
  await game.process(update(8, '/receipt', 44)); assert.equal(f.delivered.at(-1).text, 'No result yet.');
  assert.notEqual(telegramOwner(BOT, 42), telegramOwner(BOT + 1, 42));
});

test('commands expose rules and exact model selection without inference; invalid model cannot replace session', async t => {
  const f = await fixture(t); const game = f.createGame();
  for (const [i, text] of ['/start', '/models', '/rules', '/model nonexistent', '/model ' + MODEL, '/new', '/help@different_bot'].entries()) await game.process(update(i, text));
  assert.equal(f.requests.length, 0);
  assert.ok(f.delivered.some(row => row.text.includes(f.vault.rules().systemPrompt)));
  assert.equal(f.store().profile(telegramOwner(BOT, 42)).modelId, MODEL);
  assert.equal(f.limits.status(telegramOwner(BOT, 42)).globalRequestsToday, 0);
});

test('crash with a pending usage reservation cannot reinfer or bypass the shared web budget', async t => {
  const f = await fixture(t); const owner = telegramOwner(BOT, 42);
  f.store().claim(BOT, 1, owner); f.store().pending(owner); f.limits.reserve(owner);
  const game = f.restart(); await game.process(update(1, 'Interrupted')); await game.process(update(2, 'Again'));
  assert.equal(f.requests.length, 0); assert.match(f.delivered.at(-1).text, /fresh start/);
  await game.process(update(3, '/new')); await game.process(update(4, 'Again'));
  assert.equal(f.requests.length, 0);
  assert.throws(() => f.limits.reserve('player_web_user'), error => error.code === 'ATTEMPT_BUSY');
});

test('unknown model cost pauses both channels, preserving the reply; budget exhaustion makes no second call', async t => {
  const f = await fixture(t, { cost: null }); const game = f.createGame();
  await game.process(update(1, 'Please')); assert.match(f.delivered.at(-1).text, /Nice try/);
  await game.process(update(2, 'Again')); assert.equal(f.requests.length, 1);
  assert.throws(() => f.limits.reserve('player_web_user'), error => error.code === 'USAGE_UNRECONCILED');
  const limited = await fixture(t, { budgetUsd: .002 }); const another = limited.createGame();
  await another.process(update(1, 'One')); await another.process(update(2, 'Two'));
  assert.equal(limited.requests.length, 1); assert.match(limited.delivered.at(-1).text, /budget is exhausted/);
});

test('Telegram cursor supports a new random update range after inactivity without replaying old work', t => {
  let time = 0; const store = createTelegramStore(':memory:', () => time); t.after(store.close);
  assert.equal(store.offset(BOT), 0); store.claim(BOT, 100000, 'ignored'); assert.equal(store.offset(BOT), 100001);
  time += 7 * 86400000; assert.equal(store.offset(BOT), 0);
  store.claim(BOT, 300, 'ignored'); assert.equal(store.offset(BOT), 301);
  assert.equal(store.claim(BOT, 300, 'ignored'), false);
});

test('Telegram transport uses plain text, blocks redirects and sanitizes token-bearing failures', async () => {
  const token = '123456:abcdefghijklmnopqrstuvwxyz'; const requests = [];
  const api = createTelegramApi({ token, fetchImpl: async (url, init) => { requests.push({ url, init }); return Response.json({ ok: true, result: { message_id: 1 } }); } });
  await api.send(42, '<script>hello</script>');
  assert.equal(requests.length, 1); assert.equal(requests[0].init.redirect, 'error');
  assert.equal(JSON.parse(requests[0].init.body).parse_mode, undefined);
  const failed = createTelegramApi({ token, fetchImpl: async () => { throw new Error(token); } });
  await assert.rejects(failed.call('getMe'), error => !error.message.includes(token));
  await assert.rejects(api.call('deleteWebhook'), /Unsupported/);
});

test('worker verifies bot identity and hides channel link after transport stops', async t => {
  const f = await fixture(t); const warnings = [];
  const worker = await startTelegram({ api: { call: async method => {
    if (method === 'getMe') return { id: BOT, is_bot: true, username: 'vault_test_bot' };
    throw new Error('Disconnected');
  }, send: async () => {} }, vault: f.vault, limits: f.limits, store: f.store(), onWarning: text => warnings.push(text) });
  await worker.stop(); assert.equal(worker.state.url, null); assert.equal(warnings.length, 1);
  await assert.rejects(startTelegram({ api: { call: async () => ({ id: BOT, is_bot: false }) } }), /identity/);
});
