const STATES = { 'requests-enabled':'Request gates are open', 'setup-required':'API setup required', 'storage-failure':'Receipt storage needs attention',
  'storage-unavailable':'Stored state unavailable', 'reconciliation-required':'Paused for reconciliation', busy:'Processing an attempt',
  'budget-exhausted':'Practice budget exhausted', 'daily-limit':'Daily request limit reached', 'beta-paused':'Beta paused by the host' };
const node = (tag, text) => { const value = document.createElement(tag); value.textContent = text; return value; };

export async function appendOperationalHealth(content) {
  const section = node('section', ''); section.className = 'settings-section'; section.dataset.operationalHealth = '';
  section.append(node('h3', 'Live operational status')); const status = node('p', 'Checking current server state…'); section.append(status); content.append(section);
  try {
    const response = await fetch('/api/health', { signal:AbortSignal.timeout(7000) });
    const data = await response.json();
    if (!content.contains(section)) return;
    if (!data.state || (!response.ok && response.status !== 503)) throw new Error('Unavailable');
    status.textContent = STATES[data.state] ?? 'Status unavailable';
    const list = node('dl', ''); list.className = 'settings-list';
    const add = (label, value) => { const row = node('div', ''); row.className = 'settings-row'; row.append(node('dt', label), node('dd', value)); list.append(row); };
    add('Checked', new Date(data.checkedAt).toLocaleString('en-US'));
    add('Access mode', data.closedBeta ? 'Invitation-only beta' : data.mode === 'public-practice' ? 'Authenticated practice' : 'Local practice');
    add('Real deposits / payouts', 'Disabled');
    if (data.execution) {
      add('Receipts this process', String(data.execution.persistedReceipts));
      add('Valid replies / errors', `${data.execution.validReplies} / ${data.execution.errors}`);
      add('Observations since', new Date(data.execution.since).toLocaleString('en-US'));
    }
    if (data.usage) {
      add('Requests today / cap', `${data.usage.globalRequestsToday} / ${data.usage.totalPerDay} · UTC`);
      add('Reported API cost / budget', `${data.usage.reportedCostUsd} / ${data.usage.budgetUsd} USD`);
      add('Pending / unknown cost', `${data.usage.pending} / ${data.usage.unknown}`);
    }
    section.append(list, node('p', 'Server observations, without independent attestation. Process counters reset on restart; public usage accounting persists. No model call is made by this check.'));
  } catch { if (content.contains(section)) status.textContent = 'Could not read current status. No successful check is assumed.'; }
}
