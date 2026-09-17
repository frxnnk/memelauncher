import { createWalletConnection, networkLabel } from './wallet.js';
import { accessConfiguration } from './access.js';

const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const format = value => BigInt(value ?? '0').toLocaleString('en-US');
const dialog = $('#treasury-dialog');
let state = null, busy = false, selectedRound = null, retryInput = null;
const amount = () => $('#treasury-amount').value;
const notice = message => { $('#treasury-notice').textContent = message; };
const balance = account => state?.balances.find(row => row.account === account)?.amount ?? '0';

async function request(path, body) {
  const response = await fetch(path, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error?.message || 'The sandbox could not complete this action.'); error.confirmed = true; throw error; }
  return data;
}
function button(text, action, data = {}, disabled = false) {
  const b = el('button', text, 'treasury-action'); b.type = 'button'; b.disabled = busy || disabled || Boolean(retryInput);
  b.addEventListener('click', () => mutate(action, data)); return b;
}
async function refresh() {
  if (!(await accessConfiguration).sandboxEnabled) return;
  try { state = await request('/api/sandbox/treasury'); render(); }
  catch { notice('Treasury unavailable. Reload or restart the local server; no balance is assumed.'); }
}
async function mutate(action, data) {
  if (!(await accessConfiguration).sandboxEnabled) return;
  if (busy) return;
  const body = retryInput ?? { action, key: crypto.randomUUID(), ...data };
  busy = true; render(); notice('Recording a simulated event…');
  try {
    const response = await request('/api/sandbox/action', body);
    state = response.state; retryInput = null;
    if (action === 'new-round') selectedRound = response.result.roundId;
    const contribution = response.result.prizeContribution;
    notice(response.result.replayed ? 'Existing event confirmed. It was not counted again.' : contribution && contribution !== '0'
      ? `+${format(contribution)} TEST allocated to the vault. Local ledger entry; no onchain transfer.`
      : 'Simulation recorded. No real tokens or funds moved.');
    if (!response.result.replayed && contribution && contribution !== '0' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('#treasury-prize').animate([{ opacity: 0.4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450 });
    }
  } catch (error) {
    if (!error.confirmed) retryInput = body;
    else await refresh();
    notice(error.confirmed ? error.message : 'Outcome not confirmed. Retry this same event to reconcile it; do not create a replacement.');
  } finally { busy = false; render(); }
}

function render() {
  if (!state) return;
  let round = state.rounds.find(row => row.id === selectedRound) ?? state.rounds[0];
  selectedRound = round?.id;
  document.dispatchEvent(new CustomEvent('vault:treasury-state', { detail: { state, selectedRound } }));
  const picker = $('#treasury-round'); picker.replaceChildren();
  for (const r of state.rounds) { const option = el('option', `${r.id === 'round-1' ? 'Round 1' : `Round ${state.rounds.length - state.rounds.indexOf(r)}`} · ${r.state}`); option.value = r.id; picker.append(option); }
  picker.value = selectedRound ?? ''; picker.disabled = busy;
  const manifest = state.roundManifests?.find(item => item.manifest.roundId === selectedRound);
  $('#treasury-guardians').textContent = manifest ? JSON.stringify(manifest, null, 2)
    : 'Legacy accounting round. Create a new round to freeze its guardian roster before model-linked play.';
  const cards = $('#treasury-balances'); cards.replaceChildren();
  for (const [label, account, key] of [
    ['Available credits', 'player:local-demo:available'], ['Reserved credits', 'player:local-demo:reserved'],
    ['This vault', `round:${selectedRound}:prize`, 'treasury-prize'], ['Winner awaiting payout', `round:${selectedRound}:payable`],
    ['Operations', 'treasury:operations'], ['Next round reserve', 'treasury:next']
  ]) { const card = el('div', null, 'treasury-balance'); card.append(el('span', label)); const value = el('strong', format(balance(account))); if (key) value.id = key; card.append(value, el('small', 'TEST')); cards.append(card); }
  $('#treasury-audit').textContent = `${state.audit.balanced ? 'Balanced' : 'Needs review'} · ${format(state.audit.custody)} TEST in simulated custody · ${state.eventCount} events`;
  $('#treasury-audit').dataset.balanced = String(state.audit.balanced);
  const funding = $('#treasury-funding'); funding.replaceChildren();
  const entered = amount(); const invalid = !/^[1-9][0-9]{0,11}$/.test(entered);
  funding.append(button('Add test credits', 'topup', { amount: entered }, invalid), button('Return unused credits', 'refund', { amount: entered }, invalid));
  const contributions = $('#treasury-contributions'); contributions.replaceChildren();
  for (const [label, action] of [['Seed vault', 'seed'], ['Sponsor received', 'sponsor'], ['Creator fees received', 'creator-fees'], ['Use next-round reserve', 'use-reserve']]) {
    contributions.append(button(label, action, { roundId: selectedRound, amount: entered }, invalid || round?.state !== 'open'));
  }
  const controls = $('#treasury-attempt-actions'); controls.replaceChildren();
  const pending = state.attempts.filter(a => a.round_id === selectedRound && ['reserved', 'processing', 'unknown'].includes(a.state)).toSorted((a, b) => a.position - b.position);
  const head = pending[0];
  $('#treasury-attempt-state').textContent = head ? `Attempt ${head.position} · ${head.state} · ${pending.length} in queue` : 'No pending attempt. Reserve 100 TEST to begin.';
  controls.append(button('Reserve attempt · 100', 'reserve', { roundId: selectedRound }, round?.state !== 'open'));
  if (head?.id.startsWith('model-')) {
    controls.append(el('span', 'This attempt is linked to a model API receipt. Manual outcome controls are unavailable.', 'treasury-muted'));
  } else if (head) {
    if (head.state === 'reserved') controls.append(button('Start processing', 'start', { attemptId: head.id }), button('Cancel reservation', 'cancel', { attemptId: head.id }));
    if (head.state === 'processing' || head.state === 'unknown') {
      const prefix = head.state === 'unknown' ? 'reconcile-' : '';
      for (const [label, outcome] of [['Vault stayed locked', 'locked'], ['Vault opened', 'released'], ['Technical error', 'error']]) controls.append(button(`${prefix ? 'Reconcile: ' : 'Simulate: '}${label}`, prefix + outcome, { attemptId: head.id }));
      if (!prefix) controls.append(button('Mark outcome uncertain', 'unknown', { attemptId: head.id }));
    }
  }
  const lifecycle = $('#treasury-lifecycle'); lifecycle.replaceChildren();
  lifecycle.append(button('Simulate confirmed payout', 'payout', { roundId: selectedRound }, round?.state !== 'won'), button('Create next round', 'new-round'));
  $('#treasury-retry').hidden = !retryInput; $('#treasury-retry').disabled = busy;
  const events = $('#treasury-events'); events.replaceChildren();
  for (const event of state.events.slice(0, 12)) {
    const row = el('details', null, 'treasury-event');
    const title = el('summary'); title.append(el('span', event.request.type.replaceAll('-', ' ')), el('small', `#${event.sequence}`));
    row.append(title, el('pre', JSON.stringify(event, null, 2))); events.append(row);
  }
  $('#treasury-export').disabled = busy;
}

$('#treasury-button').addEventListener('click', () => { dialog.showModal(); refresh(); });
$('#account-button').addEventListener('click', () => {
  dialog.showModal(); refresh();
  $('#account-email').closest('section').scrollIntoView({ block: 'start' });
  if (!$('#account-login-form').hidden) $('#account-email').focus({ preventScroll: true });
});
$('#treasury-round').addEventListener('change', event => { selectedRound = event.target.value; render(); });
$('#treasury-amount').addEventListener('input', render);
$('#treasury-refresh').addEventListener('click', refresh);
document.addEventListener('vault:refresh-treasury', refresh);
$('#treasury-retry').addEventListener('click', () => retryInput && mutate(retryInput.action, retryInput));
$('#treasury-export').addEventListener('click', async () => {
  try {
    const data = await request('/api/sandbox/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = el('a'); link.href = url; link.download = 'vault-simulated-ledger.json'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { notice('Export failed. The ledger remains on the local server.'); }
});

let wallet;
const updateWallet = value => {
  const target = $('#wallet-options'); target.replaceChildren();
  const text = $('#wallet-state');
  if (value.status === 'connected') {
    text.textContent = `${value.walletName} · ${networkLabel(value.chainId)}\n${value.address}\nConnected locally. Ownership is not authenticated; deposits are disabled.`;
  } else text.textContent = value.error || (value.status === 'connecting' ? 'Waiting for wallet permission…' : 'No wallet connected. Real deposits are not configured.');
  if (value.status !== 'disconnected') {
    const disconnect = el('button', value.status === 'connecting' ? 'Cancel connection' : 'Disconnect locally', 'treasury-action');
    disconnect.addEventListener('click', () => wallet.disconnect()); target.append(disconnect);
  } else for (const item of value.wallets) {
    const connect = el('button', `Connect ${item.name}`, 'treasury-action'); connect.addEventListener('click', () => wallet.connect(item.id)); target.append(connect);
  }
  if (!value.wallets.length) target.append(el('span', 'Open this page in a browser with an EVM wallet extension to test connection.', 'treasury-muted'));
};
wallet = createWalletConnection({ onChange: updateWallet });
