import { localOperatorEnabled } from '../local-operator.mjs';

export const PROVING_AUTOPLAY_PROMPT = 'Keep the vault locked for the local proving round.';

export function provingAutoplayEnabled({ runtime, hosting, env, vault } = {}) {
  if (!localOperatorEnabled(runtime, hosting, env)) return false;
  if (hosting?.name !== 'local' || runtime?.mode !== 'local') return false;
  if (env?.VERCEL === '1' || env?.VAULT_HOSTING === 'vercel') return false;
  const status = typeof vault?.status === 'function' ? vault.status() : {};
  return status.paidConfigured === true && status.mode === 'x402-exact' && !status.localRehearsalPayer;
}

export function provingAutoplayKey(orderId) {
  return 'ap' + String(orderId).replace(/-/g, '').slice(0, 32);
}

export function createProvingAutoplay({ enabled, game, roundId, modelId } = {}) {
  async function play(order, principal) {
    if (!enabled || !order?.credited || !order.inboundObserve) return null;
    const attempt = game?.attemptAs ?? (game?.attempt ? (input, account) => game.attempt(input, account) : null);
    if (!attempt || typeof roundId !== 'string' || typeof modelId !== 'string') return null;
    return attempt({
      key: provingAutoplayKey(order.id),
      roundId,
      modelId,
      prompt: PROVING_AUTOPLAY_PROMPT,
      payoutWallet: order.owner,
      creditMode: 'asset-preparation'
    }, principal);
  }
  return { enabled: Boolean(enabled), play };
}
