import { createHash } from 'node:crypto';
import { meteredAttempt } from './metered-attempt.mjs';

const HELP = "I'm Vault. You have an argument. I have a very good lock.\n\nConvince the AI to open the vault. Practice only: no deposits or cash prize.\n\n/models — available opponents\n/model <id> — choose one, start fresh\n/new — a fresh conversation\n/last — recover your last reply without a model call\n/receipt — last result metadata\n/rules — the rules and prompt\n\nSend up to 2,000 characters. Your Telegram and web histories are separate.";
const CLOSED = new Set(['SESSION_NOT_FOUND', 'SESSION_CLOSED', 'SESSION_MODEL_MISMATCH', 'SESSION_CONFIGURATION_CHANGED', 'TURN_LIMIT', 'CONTEXT_LIMIT']);
const PREFLIGHT = new Set(['MISSING_API_KEY', 'INVALID_INPUT', 'MODEL_NOT_ALLOWED', 'CATALOG_UNAVAILABLE', 'ATTEMPT_BUSY', 'DAILY_LIMIT_REACHED', 'APP_BUDGET_REACHED', 'USAGE_UNRECONCILED', 'RECEIPT_STORAGE_UNAVAILABLE']);
export const telegramOwner = (botId, userId) => 'player_telegram_' + createHash('sha256').update(`${botId}:${userId}`).digest('hex').slice(0, 48);

export function createTelegramGame({ botId, username, vault, limits, store, send, defaultModel = 'google/gemini-2.5-flash' }) {
  async function process(update) {
    if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) return;
    const message = update.message;
    const privateText = message?.chat?.type === 'private' && Number.isSafeInteger(message.from?.id) && message.from.id > 0 &&
      message.from.is_bot === false && message.chat.id === message.from.id && typeof message.text === 'string' && !message.via_bot;
    const owner = privateText ? telegramOwner(botId, message.from.id) : 'ignored';
    if (!store.claim(botId, update.update_id, owner)) return;
    if (!privateText) { store.finish(botId, update.update_id, owner, '', null); return; }
    const text = message.text.trim();
    let state = store.profile(owner);
    let reply;
    if (!text || text.length > 2000) reply = 'One argument at a time. Send 1–2,000 characters.';
    else if (text.startsWith('/')) {
      const [raw, ...args] = text.split(/\s+/);
      const [command, addressed] = raw.toLowerCase().split('@');
      if (addressed && addressed !== username.toLowerCase()) reply = 'That command is addressed to a different bot.';
      else if (command === '/start' || command === '/help') reply = HELP;
      else if (command === '/last') reply = state.lastReply || 'No saved reply yet. Make your case.';
      else if (command === '/receipt') reply = state.receipt ? JSON.stringify(state.receipt, null, 2) : 'No result yet.';
      else if (command === '/rules') {
        const rules = vault.rules();
        reply = `${rules.systemPrompt}\n\nPrompt version: ${rules.version}\nMaximum turns: ${rules.limits.maxTurns}\n\nA validated release_prize tool call opens this practice vault. Saying yes does not. Results are recorded by the operator, not independent cryptographic proof. No cash prize.`;
      } else if (command === '/new') {
        state = { ...state, sessionId: undefined, pending: false, closed: false };
        reply = `Fresh vault. Same attitude. Opponent: ${state.modelId || defaultModel}.`;
      } else if (command === '/models' || command === '/model') {
        try {
          const { models } = await vault.models();
          if (command === '/models') reply = 'Choose with /model <id>:\n\n' + models.map(m => `${m.name || m.id}\n${m.id}`).join('\n\n');
          else if (args.length !== 1 || !models.some(m => m.id === args[0])) reply = 'Choose an exact model ID from /models.';
          else {
            state = { ...state, modelId: args[0], sessionId: undefined, pending: false, closed: false };
            reply = `Opponent: ${args[0]}. New conversation. Make your case.`;
          }
        } catch { reply = 'The model list is unavailable. No argument was sent. Try /models later.'; }
      } else reply = 'Unknown command. /help lists the useful ones.';
    } else if (state.pending || state.closed) reply = 'This conversation needs a fresh start. Use /last for the saved reply, or /new before another argument.';
    else {
      store.pending(owner);
      let result;
      try {
        result = await meteredAttempt({ vault, limits, input: { modelId: state.modelId || defaultModel, prompt: text,
          ...(state.sessionId ? { sessionId: state.sessionId } : {}) }, scope: { ownerId: owner } });
      } catch (error) {
        if (error.completedResponse) result = error.completedResponse;
        else {
          state = { ...state, pending: !PREFLIGHT.has(error.code), closed: CLOSED.has(error.code) };
          reply = PREFLIGHT.has(error.code) || CLOSED.has(error.code)
            ? `${error.message}\n\nNo new model reply. /new starts a fresh conversation.`
            : 'The result could not be confirmed. It is not a loss. No automatic retry was made. /new starts fresh; unresolved usage may pause new requests.';
          state.lastReply = reply;
          state.receipt = error.receipt ? { id: error.receipt.id, status: 'error', error: error.receipt.error,
            usage: error.receipt.usage, evidence: 'operator-recorded', cashPrize: false } : undefined;
        }
      }
      if (result) {
        reply = `${result.response}\n\n${result.decision === 'released' ? 'Vault opened. Practice win — no cash prize.' : 'Vault locked.'}\nModel: ${result.modelId}\n/receipt shows this result. /new starts over.`;
        const receipt = result.receipt;
        state = { ...state, sessionId: result.sessionId, pending: false, closed: result.decision === 'released',
          lastReply: reply, receipt: { id: receipt.id, model: result.modelId, provider: result.provider,
            decision: result.decision, promptVersion: receipt.promptVersion, configuration: receipt.configuration,
            usage: receipt.usage, evidence: 'operator-recorded', cashPrize: false } };
      }
    }
    // Persist before delivery. A delivery timeout must never cause another paid inference.
    store.finish(botId, update.update_id, owner, reply, state);
    await send(message.chat.id, reply);
  }
  return { process, offset: () => store.offset(botId) };
}
