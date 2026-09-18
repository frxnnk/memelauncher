import { displayTokens } from './funding-client.js';

const amount = document.querySelector('#door-bounty-amount');
const label = document.querySelector('#door-bounty-label');
let configuration, modelId, loading = false, failed = false;

export function setBountyModel(value) {
  modelId = value;
  const round = configuration?.rounds?.find(r => r.manifest.manifest.configuration.guardians.some(g => g.modelId === modelId));
  const text = failed ? 'Unavailable' : !configuration ? '—' : !configuration.enabled ? 'Practice'
    : round ? displayTokens(round.bounty, configuration.asset.decimals) : 'No round';
  if (amount.textContent !== text) {
    amount.textContent = text;
    amount.animate?.([{ opacity: .35 }, { opacity: 1 }], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 });
  }
  label.textContent = round && !failed
    ? (round.kind === 'payout-proving' ? 'Payout proving · test tokens' : 'The game · test tokens')
    : 'Round bounty';
  amount.title = round ? `${text} test tokens · ${modelId} · ${round.id}` : text;
}

export async function refreshDoorBounty() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch('/api/funding/config', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    configuration = await response.json(); failed = false;
  } catch { failed = true; }
  finally { loading = false; setBountyModel(modelId); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDoorBounty(); });
refreshDoorBounty();
