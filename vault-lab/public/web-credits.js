import { accountState, accountHeaders } from './account.js';
import { displayTokens } from './funding-client.js';
import { creditPlayModels, chooseCreditPlayModel } from './funding-network.js';

let configuration = null, enabled = false, owner = null, selectedWallet = null;
export function fundingWallet() {
  const wallets = accountState()?.wallets.filter(w => w.chainType === 'ethereum') ?? [];
  return wallets.find(w => w.address === selectedWallet) ?? wallets.find(w => w.kind === 'external') ?? wallets[0];
}
export function chooseFundingWallet(address) { selectedWallet = address; }
const sessions = new Map();
export async function fundingRequest(path, body) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...await accountHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Funding request failed.'), result, { code: result.error?.code });
  return result;
}
export const fundingConfiguration = () => configuration;
export const usesWebCredits = () => enabled;
export function webAttemptPrice(modelId) {
  if (!enabled) return '';
  const round = configuration?.rounds.find(round => round.state === 'open' && round.manifest.manifest.configuration.guardians.some(g => g.modelId === modelId));
  return round ? `${displayTokens(round.price, configuration.asset.decimals)} test tokens / attempt` : 'No open credit round';
}
export function selectWebCredits(value) {
  enabled = Boolean(value && configuration?.enabled && accountState());
  document.dispatchEvent(new Event('vault:credit-mode-changed'));
}
export function selectedCreditPlayModel(catalogModels, selectedId) {
  return chooseCreditPlayModel(catalogModels, configuration, enabled, selectedId);
}
export async function refreshWebFunding() {
  configuration = await fundingRequest('/api/funding/config');
  return configuration;
}
const storageKey = () => `vault-credit-attempt:${configuration?.assetHash}:${accountState()?.accountId}`;
export const pendingWebAttempt = () => JSON.parse(localStorage.getItem(storageKey()) || 'null');
export function webCreditModels(models) {
  return creditPlayModels(models, configuration, enabled);
}
export function prepareWebAttempt(input) {
  if (!enabled) return null;
  if (pendingWebAttempt()) throw Object.assign(new Error('Recover your pending credit attempt in Top up before sending another.'), { code: 'MODEL_JOB_UNCERTAIN' });
  const round = configuration?.rounds.find(round => round.state === 'open' && round.manifest.manifest.configuration.guardians.some(g => g.modelId === input.modelId));
  const wallet = fundingWallet();
  if (!round || !wallet) throw new Error('Choose an open round and create your account wallet first.');
  const key = crypto.randomUUID();
  localStorage.setItem(storageKey(), JSON.stringify({ key, roundId: round.id }));
  const { sessionId: ignored, ...message } = input;
  const sessionId = sessions.get(round.id);
  return { path: '/api/funding/attempts', creditKey: 'web:' + key,
    body: { ...message, ...(sessionId ? { sessionId } : {}), key, roundId: round.id, payoutWallet: wallet.address, creditMode: 'asset-preparation' } };
}
export function finishWebAttempt(creditKey, result, error, rejected) {
  if (!creditKey?.startsWith('web:')) return false;
  const pending = pendingWebAttempt();
  if (pending?.key !== creditKey.slice(4)) return true;
  if (result?.sessionId) sessions.set(pending.roundId, result.sessionId);
  if (result?.accounting || error?.accounting || rejected) localStorage.removeItem(storageKey());
  const accounting = result?.accounting ?? error?.accounting;
  if (accounting) {
    const amount = value => displayTokens(value ?? '0', configuration.asset.decimals);
    const message = accounting.creditsReturned ? `${amount(accounting.creditsReturned)} returned · no bounty contribution`
      : `+${amount(accounting.prizeContribution)} test tokens to bounty`;
    document.querySelector('#practice-footer').textContent = message;
  }
  refreshWebFunding().catch(() => {});
  return true;
}
export async function recoverWebAttempt() {
  const record = pendingWebAttempt(); if (!record) return null;
  try {
    const result = await fundingRequest(`/api/funding/attempts/${record.key}/reconcile`, {});
    finishWebAttempt('web:' + record.key, result); return result;
  } catch (error) { finishWebAttempt('web:' + record.key, null, error); throw error; }
}
document.addEventListener('vault:account-changed', () => {
  const next = accountState()?.accountId ?? null;
  if (next !== owner) { enabled = false; owner = next; selectedWallet = null; sessions.clear(); }
  if (accountState()?.localOperatorObserve) {
    refreshWebFunding().then(() => {
      selectWebCredits(true);
      const footer = document.querySelector('#practice-footer');
      if (footer) footer.textContent = 'Testnet credits · no monetary value';
    }).catch(() => {});
  }
});
document.addEventListener('vault:new-conversation', () => sessions.clear());
