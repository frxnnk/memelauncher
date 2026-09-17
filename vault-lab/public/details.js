import { appendOperationalHealth } from './health.js';
import { displayTokens } from './funding-client.js';
const $ = selector => document.querySelector(selector);
const LIMIT_LABELS = {
  maxPromptCharacters: 'Characters per message', maxTurns: 'Valid attempts per conversation',
  maxContextCharacters: 'Context characters', maxOutputTokens: 'Maximum output tokens',
  timeoutSeconds: 'Request timeout (seconds)', sessionTtlMinutes: 'Inactivity timeout (minutes)',
  maxSessions: 'Server sessions', concurrentRequests: 'Concurrent requests'
};
const GENERATION_LABELS = {
  temperature: 'Temperature', max_tokens: 'Maximum output tokens', tool_choice: 'Tool selection',
  stream: 'Streaming response', require_parameters: 'Require supported parameters',
  allow_fallbacks: 'Provider fallback on error', reasoning: 'Reasoning settings', only: 'Allowed provider slugs', order: 'Provider priority'
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function display(value) {
  if (value === undefined || value === null) return 'Unavailable';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function fields(target, entries) {
  const list = element('dl', undefined, 'settings-list');
  for (const [label, value] of entries) {
    const row = element('div', undefined, 'settings-row');
    row.append(element('dt', label), element('dd', display(value)));
    list.append(row);
  }
  target.append(list);
}

function section(target, title) {
  const block = element('section', undefined, 'settings-section');
  block.append(element('h3', title));
  target.append(block);
  return block;
}

function disclosure(target, title, value) {
  const block = element('details', undefined, 'settings-details');
  block.append(element('summary', title), element('pre', typeof value === 'string' ? value : JSON.stringify(value, null, 2)));
  target.append(block);
}

function copyAction(target, label, text) {
  const action = element('div', undefined, 'copy-action');
  const button = element('button', label, 'copy-button copy-config-button');
  const status = element('p', '', 'copy-status settings-help');
  button.type = 'button';
  status.setAttribute('role', 'status');
  status.hidden = true;
  let fallback;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      fallback?.remove();
      fallback = null;
      status.textContent = 'Copied to clipboard.';
    } catch {
      status.textContent = 'Automatic copying failed. The text is selected below so you can copy it manually.';
      if (!fallback) {
        fallback = element('textarea', undefined, 'copy-fallback');
        fallback.readOnly = true;
        fallback.rows = 6;
        fallback.setAttribute('aria-label', `${label}: manual copy`);
        fallback.value = text;
        action.append(fallback);
      }
      fallback.focus();
      fallback.select();
    } finally { status.hidden = false; button.disabled = false; }
  });
  action.append(button, status);
  target.append(action);
}

function appendConfiguration(target, rules) {
  if (!rules) {
    target.append(element('p', 'Configuration could not be loaded. Refresh the page to view the server rules.', 'info-note'));
    return;
  }
  if (rules.generation) {
    const block = section(target, 'Generation · fixed settings');
    const entries = Object.entries(rules.generation).filter(([key]) => key !== 'provider');
    entries.push(...Object.entries(rules.generation.provider || {}));
    fields(block, entries.map(([key, value]) => [GENERATION_LABELS[key] || key, value]));
    block.append(element('p', 'These values are set by the server. Changing models starts a new conversation.', 'settings-help'));
  }
  if (rules.limits) {
    const block = section(target, 'Conversation limits');
    const entries = Object.entries(rules.limits).filter(([key]) => key !== 'contextMeasurement');
    fields(block, entries.map(([key, value]) => [LIMIT_LABELS[key] || key, value]));
    if (rules.limits.contextMeasurement) disclosure(block, 'How context is measured', rules.limits.contextMeasurement);
  }
  const instructions = section(target, 'Public instructions');
  if (rules.version) fields(instructions, [['Version', rules.version]]);
  if (typeof rules.systemPrompt === 'string') {
    disclosure(instructions, 'System prompt', rules.systemPrompt);
    copyAction(instructions, 'Copy prompt', rules.systemPrompt);
  }
  if (rules.tools) disclosure(instructions, 'Tools', rules.tools);
  if (rules.profiles) disclosure(instructions, 'All model configurations', rules.profiles);
  copyAction(instructions, 'Copy configuration JSON', JSON.stringify(rules, null, 2));
}

function appendDataHandling(target) {
  target.append(element('p', 'Your messages are sent to OpenRouter and the inference provider, and stored on this server. Avoid including personal information or secrets. Their data policies apply.', 'info-note'));
}

export function showInfo(title, eyebrow = 'LOCAL PRACTICE', options = {}) {
  $('#info-title').textContent = title;
  $('#info-eyebrow').textContent = eyebrow;
  const content = $('#info-content');
  content.replaceChildren();
  const dialog = $('#info-dialog');
  const modal = options.modal !== false;
  if (dialog.open) {
    const isModal = typeof dialog.matches === 'function' && dialog.matches(':modal');
    if (Boolean(isModal) !== modal) dialog.close();
  }
  if (!dialog.open) {
    if (modal) dialog.showModal();
    else dialog.show();
  }
  return content;
}

export function renderSettings({ rules, selected, configured }) {
  const target = $('#settings-content');
  if (!target) return;
  target.replaceChildren();
  const model = section(target, 'Model and connection');
  fields(model, [
    ['Model', selected?.name || 'Not selected'], ['Requested ID', selected?.id || 'Not selected'],
    ['Connection', 'OpenRouter'], ['API key', configured ? 'Configured on the server' : 'Not configured']
  ]);
  const profile = rules?.profiles?.[selected?.id];
  model.append(element('p', profile?.note || 'OpenRouter selects a provider for each request. Provider and reasoning defaults are not calibrated for this model.', 'settings-help'));
  if (profile) fields(model, [['Configuration', profile.version], ['Validation', 'Candidate · no real inference tested']]);
  appendConfiguration(target, profile ? { ...rules, generation: profile.generation, selectedModel: selected.id } : rules);
  if (rules?.explanation) disclosure(target, 'How the result is decided', rules.explanation);
  const evidence = section(target, 'Transparency');
  evidence.append(element('p', 'You can export the actual input and result of each recorded attempt. These are server records, without independent attestation of the model or its weights. This practice does not handle funds.'));
  appendDataHandling(evidence);
}

export function showRules(rules) {
  const content = showInfo('Game rules');
  content.append(element('p', rules?.explanation || 'Server rules are unavailable. Refresh the page before starting an attempt.'));
  appendConfiguration(content, rules);
  appendDataHandling(content);
}

export function showProof() {
  const content = showInfo('What you can verify', 'TRANSPARENCY');
  void appendOperationalHealth(content);
  section(content, 'Before an attempt').append(element('p', 'You can view the requested model, system prompt, tools, limits, and server parameters in Settings.'));
  section(content, 'In each receipt').append(element('p', 'The actual input, response, decision, returned model, provider when reported, token usage, and timestamp. Recorded errors are exported as errors; an unconfirmed result is not a loss.'));
  section(content, 'Limits of this evidence').append(element('p', 'A server record alone does not prove which model or weights ran. The requested ID stays fixed within a conversation, but this API does not attest to an immutable backend version. There is no attestation, custody, or prize payout.', 'info-note'));
  section(content, 'Catalog and brands').append(element('p', 'The catalog comes from OpenRouter. A listed model does not mean its inference has been tested here. Brand names identify models; they do not imply sponsorship or endorsement.'));
  const animation = section(content, 'Character animation');
  animation.append(element('p', 'The face uses Bloub by Jérémy Perret. The door and game interface are made for Vault. No affiliation with the reference project or x.ai is implied.'));
  const license = element('a', 'Bloub · MIT license ↗', 'text-button');
  license.href='/vendor/bloub-LICENSE.txt'; license.target='_blank'; license.rel='noopener'; animation.append(license);
}

export function downloadRecords(records, name = 'vault-records') {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), source: 'local-practice-server', records }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resultLabel(record) {
  if (record.status === 'error') return 'Recorded error · no decision';
  if (record.status === 'unknown' || record.status === 'unconfirmed') return 'Unconfirmed result';
  if (record.decision === 'released') return 'Practice vault open';
  if (record.decision === 'locked') return 'Vault locked';
  return 'Unconfirmed result';
}

function receiptUsage(target, record) {
  const block = section(target, 'Recorded usage');
  block.classList.add('receipt-summary');
  const usage = record.usage || {};
  const count = key => Number.isSafeInteger(usage[key]) && usage[key] >= 0 ? usage[key].toLocaleString('en-US') : 'Not reported';
  const started = typeof record.createdAt === 'string' ? new Date(record.createdAt) : null;
  const cost = typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0
    ? `${usage.cost.toLocaleString('en-US', { maximumSignificantDigits: 8 })} OpenRouter credits` : 'Not reported by the API';
  fields(block, [
    ['Recorded start', started && Number.isFinite(started.getTime()) ? started.toLocaleString('en-US') : 'Not recorded'],
    ['Input tokens', count('prompt_tokens')], ['Output tokens', count('completion_tokens')],
    ['Total tokens', count('total_tokens')], ['Reported cost', cost], ['Server inference duration', Number.isFinite(record.inferenceDurationMs) ? `${(record.inferenceDurationMs / 1000).toFixed(2)} seconds` : 'Not recorded']
  ]);
  block.append(element('p', 'The start time and inference duration are measured by the server. Tokens and cost are reported by the API; missing values are not estimated from catalog prices. This receipt does not independently confirm a charge to your account.', 'settings-help'));
  const missing = [['Returned model', record.modelReturned], ['Provider', record.provider], ['Finish reason', record.finishReason]]
    .filter(([, value]) => value === null || value === undefined || value === '').map(([label]) => label.toLowerCase());
  if (missing.length) block.append(element('p', `Not reported in this receipt: ${missing.join(', ')}. Missing data does not prove a result or zero cost.`, 'receipt-missing settings-help'));
}

export function showReceipt(record) {
  const content = showInfo('Attempt receipt', 'SERVER RECORD');
  const badges = element('div', undefined, 'badge-row');
  const assetCredits = record.accounting?.mode === 'rpc-credit-preparation';
  badges.append(element('span', assetCredits ? 'Testnet credits' : 'Practice'), element('span', 'No cash payout'), element('span', 'No attestation'));
  content.append(badges);
  fields(content, [
    ['Result', resultLabel(record)], ['Requested model', record.modelRequested || record.modelId],
    ['Returned model', record.modelReturned], ['Reported provider', record.provider],
    ['Prompt version', record.promptVersion]
  ]);
  receiptUsage(content, record);
  if (record.accounting) {
    const a = record.accounting, block = section(content, assetCredits ? 'Test token allocation' : 'TEST credit allocation');
    const amount = value => assetCredits && value != null ? displayTokens(value, a.decimals) : value;
    fields(block, [['Round', a.roundId], ['Vault contribution', amount(a.prizeContribution)], ['Operations', amount(a.operations)],
      ['Next round reserve', amount(a.nextRound)], ['Credits returned', amount(a.creditsReturned)], ['Winner awaiting payout', amount(a.winnerPayable)]]);
    block.append(element('p', assetCredits
      ? 'Test token amounts, accounted for in the server ledger after your on-chain deposit. This attempt does not send another wallet transaction. No monetary value or cash payout.'
      : 'Amounts are simulated TEST units in the local ledger. A missing field does not mean zero. No blockchain transfer or real payout is recorded here.', 'settings-help'));
  }
  content.append(element('p', 'This receipt describes the interaction recorded by the server. It is not independent proof of execution.', 'info-note'));
  const button = element('button', 'Download receipt JSON', 'download-button');
  button.type = 'button';
  button.addEventListener('click', () => downloadRecords([record], `vault-${record.id || record.attemptId || 'attempt'}`));
  content.append(button);
  disclosure(content, 'View full record', record);
}

export function showRecords(records) {
  const content = showInfo('Your records', 'IN THIS TAB');
  content.append(element('p', 'Attempts and errors recorded on this page. Export them before reloading: this interface does not restore previous conversations.'));
  if (!records.length) {
    content.append(element('p', 'No attempts recorded yet.', 'record-empty'));
    return;
  }
  for (const record of [...records].reverse()) {
    const row = element('div', undefined, 'record-row');
    const detail = element('div');
    detail.append(element('strong', record.modelRequested || record.modelId || 'Model not reported'));
    const date = record.createdAt ? new Date(record.createdAt) : null;
    const timestamp = date && Number.isFinite(date.getTime()) ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Time not reported';
    detail.append(element('span', `${timestamp} · ${resultLabel(record)}`));
    const button = element('button', 'View receipt');
    button.type = 'button';
    button.addEventListener('click', () => showReceipt(record));
    row.append(detail, button);
    content.append(row);
  }
  const button = element('button', 'Export all records', 'download-button');
  button.type = 'button';
  button.addEventListener('click', () => downloadRecords(records));
  content.append(button);
}

function price(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < 0.001 ? 6 : 3 }).format(value);
}

export function renderModels(models, selected, choose) {
  const search = $('#model-search').value.trim().toLocaleLowerCase('en-US');
  const list = $('#models-list');
  list.replaceChildren();
  const groups = new Map();
  for (const model of models) {
    if (!`${model.name} ${model.id} ${model.company || ''}`.toLocaleLowerCase('en-US').includes(search)) continue;
    const company = model.company || model.id.split('/')[0];
    if (!groups.has(company)) groups.set(company, []);
    groups.get(company).push(model);
  }
  for (const [company, groupModels] of groups) {
    const group = element('section', undefined, 'model-group');
    group.append(element('h3', company, 'model-group-title'));
    for (const model of groupModels) {
      const isSelected = model.id === selected?.id;
      const button = element('button', undefined, `model-option${isSelected ? ' selected' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-label', `Choose ${model.name}`);
      button.setAttribute('aria-pressed', String(isSelected));
      const badge = element('span', company.slice(0, 1).toUpperCase(), 'company-badge');
      const detail = element('span', undefined, 'model-description');
      detail.append(element('span', model.name, 'model-name'), element('span', model.id, 'model-id'));
      const cost = element('span', `USD ${price(model.inputPricePerMillion)} / ${price(model.outputPricePerMillion)}`, 'model-price');
      cost.title = 'API cost per million input / output tokens. This is not a game entry fee.';
      const mark = element('span', isSelected ? '✓' : '', 'selection-mark');
      mark.setAttribute('aria-hidden', 'true');
      button.append(badge, detail, cost, mark);
      button.addEventListener('click', () => choose(model));
      group.append(button);
    }
    list.append(group);
  }
  if (!groups.size) list.append(element('p', 'No models match your search.', 'dialog-intro'));
  else list.append(element('p', 'API prices per 1 million tokens: input / output. Prices may vary by provider.', 'dialog-footnote'));
}

document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  let backdropPress = false;
  const outside = event => {
    const box = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
  };
  // The click that opens a modal may end on its new backdrop. Only dismiss a
  // gesture that also began there, avoiding immediate closure during entrance.
  dialog.addEventListener('pointerdown', event => { backdropPress = outside(event); });
  dialog.addEventListener('click', event => { if (backdropPress && outside(event)) dialog.close(); backdropPress = false; });
  dialog.addEventListener('close', () => { backdropPress = false; });
});
