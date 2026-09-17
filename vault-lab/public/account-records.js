import { accountHeaders, accountState } from './account.js';
import { showInfo, showReceipt } from './details.js';

const $ = selector => document.querySelector(selector);
let epoch = 0, pending = null, privateView = false;
function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function begin() {
  pending?.abort(); pending = new AbortController();
  const content = showInfo('Your records', 'ACCOUNT RECEIPTS'), root = node('section');
  root.dataset.accountRecords = ''; content.append(root); privateView = true;
  return { epoch:++epoch, owner:accountState()?.accountId, root, controller:pending };
}
const current = run => run.epoch === epoch && run.owner === accountState()?.accountId &&
  run.root.isConnected && $('#info-dialog').open && !run.controller.signal.aborted;
function button(target, label, action) {
  const result = node('button', label, 'download-button'); result.type = 'button';
  result.addEventListener('click', action); target.append(result); return result;
}
async function read(path, run) {
  const headers = await accountHeaders();
  if (!current(run)) throw new Error('Account changed.');
  const response = await fetch(path, { headers, cache:'no-store',
    signal:AbortSignal.any([run.controller.signal, AbortSignal.timeout(12000)]) });
  const data = await response.json();
  if (!response.ok) throw new Error('Receipt retrieval failed.');
  return data;
}
function unavailable(run, retry) {
  if (!current(run)) return;
  run.root.replaceChildren(node('p', 'Could not load your records. Sign in again or retry. No message was sent.', 'info-note'));
  button(run.root, 'Retry', retry);
}
function label(record) {
  return record.status === 'error' ? 'Recorded error' : record.decision === 'released' ? 'Practice vault open'
    : record.decision === 'locked' ? 'Vault locked' : 'No confirmed decision';
}
async function openReceipt(id, cursor) {
  const run = begin(); run.root.append(node('p', 'Loading your receipt…', 'settings-help'));
  try {
    const data = await read(`/api/receipts/${encodeURIComponent(id)}`, run);
    if (!current(run)) return;
    showReceipt(data.record);
    const back = node('button', 'Back to account receipts', 'download-button'); back.type = 'button';
    back.addEventListener('click', () => showAccountRecords(cursor)); $('#info-content').prepend(back);
  } catch { unavailable(run, () => openReceipt(id, cursor)); }
}

export async function showAccountRecords(cursor = null) {
  const run = begin();
  if (!run.owner) {
    run.root.append(node('p', 'Sign in through Treasury to view the receipts saved for your account.', 'info-note')); return;
  }
  run.root.append(node('p', 'Loading your saved receipts…', 'settings-help'));
  try {
    const data = await read(`/api/receipts${cursor ? `?before=${encodeURIComponent(cursor)}` : ''}`, run);
    if (!current(run)) return;
    if (!Array.isArray(data.records)) throw new Error('Invalid receipt page.');
    run.root.replaceChildren(node('p', 'Saved receipts for this account, including attempts completed after a disconnect. Viewing a receipt never sends another message.'));
    run.root.append(node('p', 'This opens recorded results; it does not resume a conversation. Older server logs created before account history was enabled are not imported.', 'settings-help'));
    if (!data.records.length) run.root.append(node('p', 'No saved receipts on this page.', 'record-empty'));
    for (const record of data.records) {
      const row = node('div', undefined, 'record-row'), detail = node('div');
      const date = new Date(record.createdAt), timestamp = Number.isFinite(date.getTime()) ? date.toLocaleString('en-US') : 'Time not reported';
      detail.append(node('strong', record.modelRequested || 'Model not reported'), node('span', `${timestamp} · ${label(record)}`));
      row.append(detail); button(row, 'View receipt', () => openReceipt(record.id, cursor)); run.root.append(row);
    }
    const navigation = node('div'); run.root.append(navigation);
    if (cursor) button(navigation, 'Newest receipts', () => showAccountRecords());
    if (data.nextCursor) button(navigation, 'Older receipts', () => showAccountRecords(data.nextCursor));
    run.root.append(node('p', 'Private server records. No independent attestation or real payout.', 'info-note'));
  } catch { unavailable(run, () => showAccountRecords(cursor)); }
}

document.addEventListener('vault:account-changed', () => {
  epoch++; pending?.abort();
  if (privateView) { $('#info-content').replaceChildren(); $('#info-dialog').close(); privateView = false; }
});
$('#info-dialog').addEventListener('close', () => {
  epoch++; pending?.abort();
  if (privateView && $('#info-title')?.textContent === 'Your records') {
    $('#info-content').replaceChildren(); privateView = false;
  } else privateView = false;
});
