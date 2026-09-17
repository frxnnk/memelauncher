import { setTimeout as delay } from 'node:timers/promises';
import { fetchJson } from './errors.mjs';
import { createTelegramGame } from './telegram-game.mjs';

export function createTelegramApi({ token, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('Configure a valid Telegram bot token in the local environment.');
  async function call(method, body = {}) {
    if (!['getMe', 'getUpdates', 'sendMessage'].includes(method)) throw new Error('Unsupported Telegram method.');
    try {
      const data = await fetchJson(fetchImpl, `https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }, method === 'getUpdates' ? 35000 : 15000);
      if (data?.ok !== true) throw new Error('Telegram rejected the request.');
      return data.result;
    } catch { throw new Error(`Telegram ${method} did not complete. No automatic message retry was made.`); }
  }
  return { call, async send(chatId, text) {
    // Plain text, with no parse mode or paid broadcast. Preserve surrogate pairs.
    const characters = Array.from(text);
    for (let start = 0; start < characters.length; start += 1900) {
      await call('sendMessage', { chat_id: chatId, text: characters.slice(start, start + 1900).join(''),
        link_preview_options: { is_disabled: true } });
      if (start + 1900 < characters.length) await delay(1100);
    }
  } };
}

export async function startTelegram({ api, vault, limits, store, defaultModel, onWarning = () => {} }) {
  const me = await api.call('getMe');
  if (!Number.isSafeInteger(me?.id) || me.id <= 0 || me.is_bot !== true || !/^[A-Za-z0-9_]{5,32}$/.test(me.username)) throw new Error('Telegram bot identity could not be verified.');
  const game = createTelegramGame({ botId: me.id, username: me.username, vault, limits, store, defaultModel, send: api.send });
  let stopped = false;
  const state = { enabled: true, username: me.username, url: `https://t.me/${me.username}`, status: 'running' };
  const done = (async () => {
    try {
      while (!stopped) {
        const updates = await api.call('getUpdates', { offset: game.offset(), timeout: 30, limit: 20, allowed_updates: ['message'] });
        if (!Array.isArray(updates)) throw new Error('Telegram returned invalid updates.');
        for (const update of updates) {
          if (stopped) break;
          // Storage or delivery failures halt the worker; never replay an uncertain send.
          await game.process(update);
        }
        if (!updates.length && !stopped) await delay(250);
      }
    } catch { state.status = 'stopped'; state.url = null; onWarning('Telegram practice stopped. Check configuration/connectivity; saved updates will not trigger inference again.'); }
  })();
  return { state, async stop() { stopped = true; await done; state.status = 'stopped'; state.url = null; } };
}
