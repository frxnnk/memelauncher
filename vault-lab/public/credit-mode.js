import { showReceipt } from './details.js';
import { prepareWebAttempt, finishWebAttempt, webCreditModels } from './web-credits.js';
const $ = selector => document.querySelector(selector);
const toggle = $('#use-test-credits');
const pendingButton = $('#reconcile-model-reply');
let ledgerState = null, roundId = null, pendingKey = null;
try { pendingKey = sessionStorage.getItem('vault-pending-test-attempt'); } catch {}
function savePending(value) {
  pendingKey = value;
  try { if (value) sessionStorage.setItem('vault-pending-test-attempt', value); else sessionStorage.removeItem('vault-pending-test-attempt'); } catch {}
  pendingButton.hidden = !value;
}
savePending(pendingKey);

const balance = account => ledgerState?.balances.find(row => row.account === account)?.amount ?? '0';
function footer() {
  const target = $('#practice-footer');
  if (toggle.checked && ledgerState) {
    const credits = BigInt(balance('player:local-demo:available')).toLocaleString('en-US');
    const prize = BigInt(balance(`round:${roundId}:prize`)).toLocaleString('en-US');
    target.textContent = `TEST · ${credits} credits / ${prize} vault`;
  } else target.textContent = 'Local practice / No real prize';
}
document.addEventListener('vault:treasury-state', event => {
  ledgerState = event.detail.state; roundId = event.detail.selectedRound; footer();
});
toggle.addEventListener('change', () => {
  footer(); document.dispatchEvent(new Event('vault:credit-mode-changed'));
});

export const usesTestCredits = () => toggle.checked;
export function roundModels(models) {
  models = webCreditModels(models);
  if (!toggle.checked) return models;
  const manifest = ledgerState?.roundManifests?.find(item => item.manifest.roundId === roundId);
  const ids = manifest?.manifest.configuration.guardians.map(g => g.modelId) ?? [];
  return models.filter(model => ids.includes(model.id));
}
export function prepareAttempt(input) {
  const web = prepareWebAttempt(input); if (web) return web;
  if (!toggle.checked) return { path: '/api/attempt', body: input };
  if (pendingKey) throw Object.assign(new Error('An earlier TEST-credit attempt needs reconciliation in Wallet and treasury.'), { code: 'MODEL_JOB_UNCERTAIN' });
  const round = ledgerState?.rounds.find(item => item.id === roundId);
  if (!round || round.state !== 'open') throw Object.assign(new Error('Choose an open accounting round in Wallet and treasury.'), { code: 'CREDIT_RESERVATION_REJECTED' });
  if (!roundModels([{ id: input.modelId }]).length) throw Object.assign(new Error('Choose one of this round\'s frozen guardians. Legacy rounds require a new round.'), { code: 'ROUND_MODEL_NOT_ALLOWED' });
  const key = crypto.randomUUID(); savePending(key);
  return { path: '/api/sandbox/model-attempt', creditKey: key, body: { ...input, key, roundId, simulatedCredits: true } };
}
export function finishCreditAttempt(creditKey, result, error, rejectedBeforeInference = false) {
  if (finishWebAttempt(creditKey, result, error, rejectedBeforeInference)) return;
  if (!creditKey || creditKey !== pendingKey) return;
  if (result?.modelAttemptKey || error?.accounting || error?.receipt?.status === 'error' || rejectedBeforeInference) savePending(null);
  const accounting = result?.accounting ?? error?.accounting;
  if (accounting) {
    const message = accounting.creditsReturned
      ? `${accounting.creditsReturned} TEST returned · No vault contribution`
      : accounting.prizeContribution !== undefined
        ? `+${accounting.prizeContribution} TEST to vault · ${accounting.operations} operations · ${accounting.nextRound} next round`
        : 'No TEST credits consumed';
    $('#connection-label').textContent = message;
    $('#credit-mode-status').textContent = `${message}. Local accounting only; no onchain transfer.`;
  }
  if (result?.accounting?.prizeContribution && !result.replayed && result.accounting.prizeContribution !== '0' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // A browser animation must never change an already recorded inference outcome.
    try { $('#treasury-button').animate([{ background: 'var(--accent-bg)' }, { background: 'transparent' }], { duration: 1000 }); } catch {}
  }
  if (toggle.checked || result?.accounting || error?.accounting) document.dispatchEvent(new Event('vault:refresh-treasury'));
}

pendingButton.addEventListener('click', async () => {
  if (!pendingKey) return;
  pendingButton.disabled = true;
  const status = $('#credit-mode-status');
  try {
    const response = await fetch('/api/sandbox/reconcile-model', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: pendingKey }), signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (response.ok && data.receipt) {
      savePending(null); status.textContent = 'Recorded reply recovered. No new inference was requested.';
      document.dispatchEvent(new CustomEvent('vault:recovered-receipt', { detail: data.receipt }));
      $('#treasury-dialog').close(); showReceipt(data.receipt);
    } else if (data.accounting) {
      savePending(null); status.textContent = data.error?.message || 'Attempt reconciled.';
      if (data.receipt) document.dispatchEvent(new CustomEvent('vault:recovered-receipt', { detail: data.receipt }));
    } else status.textContent = data.error?.message || 'Still awaiting a confirmed result. No new inference was requested.';
    document.dispatchEvent(new Event('vault:refresh-treasury'));
  } catch { status.textContent = 'Could not reconcile yet. The existing attempt key is retained in this browser tab.'; }
  finally { pendingButton.disabled = false; }
});
