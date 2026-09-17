import { accountHeaders, accountState } from './account.js';
import { showInfo } from './details.js';

const $ = selector => document.querySelector(selector);
let epoch = 0, pending, privateView = false;
const node = (tag, text, className) => {
  const element = document.createElement(tag); if (text !== undefined) element.textContent = text;
  if (className) element.className = className; return element;
};
const button = (root, label, action) => {
  const element = node('button', label, 'download-button'); element.type = 'button';
  element.addEventListener('click', action); root.append(element); return element;
};
const amount = (value, decimals) => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value) || BigInt(value) >= (1n << 256n) ||
      !Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Invalid amount.');
  if (!decimals) return value;
  const digits = value.padStart(decimals + 1, '0'), fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
};
const stateLabel = deposit => deposit.accountingHold ? 'Recorded deposit · verification on hold'
  : deposit.credited ? (deposit.purpose === 'prize-reserve' ? 'Prize reserve contribution recorded' : 'Credit recorded') : deposit.state === 'awaiting-receipt' ? 'Waiting for receipt'
    : deposit.state === 'awaiting-evidence' ? 'Waiting for confirmation'
      : Date.now() > deposit.expiresAt ? 'Order expired · no transfer recorded' : 'No transfer recorded';
const timestamp = value => value === null ? 'Not recorded' : new Date(value).toLocaleString('en-US');

function begin() {
  pending?.abort(); pending = new AbortController();
  const content = showInfo('Your credits', 'ACCOUNT RECORDS'), root = node('section');
  root.dataset.accountCredits = ''; content.append(root); privateView = true;
  return { epoch: ++epoch, owner: accountState()?.accountId, controller: pending, root };
}
const current = run => run.epoch === epoch && run.owner === accountState()?.accountId && run.root.isConnected &&
  $('#info-dialog').open && !run.controller.signal.aborted;
async function read(path, run) {
  const headers = await accountHeaders(); if (!current(run)) throw new Error('Account changed.');
  const response = await fetch(path, { headers, cache: 'no-store',
    signal: AbortSignal.any([run.controller.signal, AbortSignal.timeout(12000)]) });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error('Credit records unavailable.'), { code: body.error?.code });
  return body;
}
function failure(run, error, retry) {
  if (!current(run)) return;
  run.root.replaceChildren(node('p', error.code === 'CREDITS_NOT_CONFIGURED'
    ? 'Account credits are not connected yet. Deposits and payouts are disabled.'
    : 'Could not load your credit records. Sign in again or retry. No funds were moved.', 'info-note'));
  button(run.root, 'Retry reading records', retry);
}
function fields(root, entries) {
  const list = node('dl', undefined, 'settings-list');
  for (const [name, value] of entries) {
    const row = node('div', undefined, 'settings-row'); row.append(node('dt', name), node('dd', value)); list.append(row);
  }
  root.append(list);
}
async function openDeposit(id, cursor) {
  const run = begin(); run.root.append(node('p', 'Loading your deposit record…'));
  try {
    const deposit = await read(`/api/credits/deposits/${encodeURIComponent(id)}`, run);
    if (!current(run)) return;
    const requested = amount(deposit.amountRequestedBaseUnits, deposit.asset.decimals), credited = amount(deposit.amountCreditedBaseUnits, deposit.asset.decimals);
    run.root.replaceChildren(); button(run.root, 'Back to your credits', () => showAccountCredits(cursor));
    run.root.append(node('h3', stateLabel(deposit)));
    const funding = deposit.purpose === 'prize-reserve';
    fields(run.root, [['Order', deposit.id], ['Purpose', funding ? 'Prize reserve contribution' : 'Player credits'],
      ...(funding ? [['Declared source', deposit.allocation.source], ['Prize reserve recorded', amount(deposit.amountFundedBaseUnits, deposit.asset.decimals) + ' tokens']] : []),
      ['Token contract', deposit.asset.tokenAddress], ['Chain ID', deposit.asset.chainId],
      ['Deposit sender', deposit.owner], ['Deposit destination', deposit.asset.destination], ['Amount requested', requested + ' tokens'],
      ['Player credits recorded', credited + ' tokens'], ['Requested base units', deposit.amountRequestedBaseUnits], ['Credited base units', deposit.amountCreditedBaseUnits],
      ['Created', timestamp(deposit.createdAt)], ['Submission deadline', timestamp(deposit.expiresAt)],
      ['Transaction hash', deposit.transactionHash ?? 'Not recorded'], ['Hash received by server', timestamp(deposit.submittedAt)],
      ['Transfer log index', deposit.logIndex ?? 'Not recorded'], ['Confirmation policy', deposit.asset.minimumConfirmations + ' blocks']]);
    if (funding) run.root.append(node('p', 'This contribution creates no player credits. It enters the prize reserve; allocation to a round is a separate recorded movement. The declared source does not verify a sponsor or fee origin.', 'info-note'));
    run.root.append(node('p', 'Saved server records, not a fresh chain check or independent proof. A pending transaction is not a request to send again. Deposits and payouts are disabled.', 'info-note'));
    button(run.root, 'Download deposit JSON', () => {
      if (!current(run)) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(deposit, null, 2)], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = `vault-deposit-${deposit.id}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } catch (error) { failure(run, error, () => openDeposit(id, cursor)); }
}

export async function showAccountCredits(cursor = null) {
  const run = begin();
  if (!run.owner) { run.root.append(node('p', 'Sign in through Treasury to read your credit records.', 'info-note')); return; }
  run.root.append(node('p', 'Loading your credit records…', 'settings-help'));
  try {
    const summary = await read('/api/credits', run);
    const page = await read(`/api/credits/deposits${cursor ? '?before=' + encodeURIComponent(cursor) : ''}`, run);
    if (!current(run)) return;
    if (!Array.isArray(page.deposits) || page.deposits.length > 20 || summary.realFundsEnabled !== false) throw new Error('Invalid credit page.');
    const totals = [['Available', summary.available], ['Reserved for attempts', summary.reserved], ['Prize payable · not sent', summary.prizePayable]];
    const formatted = totals.map(([name, value]) => [name, amount(value, summary.unit.decimals)]);
    run.root.replaceChildren(node('p', 'Recorded preparation balances for your account. Wallet balances and the shared TEST sandbox are separate. Deposits and payouts are disabled.', 'info-note'));
    const balances = node('div', undefined, 'treasury-balances account-credit-balances');
    for (const [name, value] of formatted) { const card = node('div', undefined, 'treasury-balance'); card.append(node('span', name), node('strong', value)); balances.append(card); }
    run.root.append(balances, node('p', `Token ${summary.unit.tokenAddress} · chain ${summary.unit.chainId}. Exact token units; no dollar conversion.`, 'settings-help'));
    if (summary.spendingPaused) run.root.append(node('p', 'Spending is on hold while deposit evidence is reconciled. Your recorded balance is preserved.', 'info-note'));
    run.root.append(node('h3', 'Your deposits'));
    if (!page.deposits.length) run.root.append(node('p', 'No deposit records on this page.', 'record-empty'));
    for (const deposit of page.deposits) {
      const row = node('div', undefined, 'record-row'), detail = node('div');
      detail.append(node('strong', stateLabel(deposit)), node('span', `${amount(deposit.amountRequestedBaseUnits, deposit.asset.decimals)} tokens · ${timestamp(deposit.createdAt)}`));
      row.append(detail); button(row, 'View deposit', () => openDeposit(deposit.id, cursor)); run.root.append(row);
    }
    const navigation = node('div'); run.root.append(navigation);
    if (cursor) button(navigation, 'Newest deposits', () => showAccountCredits());
    if (page.nextCursor) button(navigation, 'Older deposits', () => showAccountCredits(page.nextCursor));
    button(navigation, 'Refresh records', () => showAccountCredits(cursor));
    run.root.append(node('p', 'Reading these records does not check the chain, send a prompt or request a wallet signature.', 'settings-help'));
  } catch (error) { failure(run, error, () => showAccountCredits(cursor)); }
}
$('#account-credits').addEventListener('click', () => { $('#treasury-dialog').close(); showAccountCredits(); });
document.addEventListener('vault:account-changed', () => {
  epoch++; pending?.abort();
  if (privateView) { $('#info-content').replaceChildren(); $('#info-dialog').close(); privateView = false; }
});
$('#info-dialog').addEventListener('close', () => {
  epoch++; pending?.abort();
  if (privateView && $('#info-title')?.textContent === 'Your credits') {
    $('#info-content').replaceChildren(); privateView = false;
  } else privateView = false;
});
