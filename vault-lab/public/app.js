import { renderModels, renderSettings, showProof, showRecords, showRules } from './details.js';
import './treasury.js';
import './mobile-viewport.js';
import './onboarding.js';
import { accountHeaders, accountState, accountCanPlay, refreshAccountStatus, lockAccount } from './account.js';
import { showAccountRecords } from './account-records.js';
import './account-credits.js';
import './funding.js?v=phantom-sign-6';
import { webAttemptPrice, selectedCreditPlayModel, fundingConfiguration } from './web-credits.js';
import { setBountyModel, refreshDoorBounty } from './guardian-bounty.js';
import { prepareAttempt, finishCreditAttempt, usesTestCredits, roundModels } from './credit-mode.js';
import { addMessage, announceTranscript, followConversation, resizeEditor } from './conversation.js';
import { beginGuardianPrompt, resetGuardian, setGuardianDraft, setGuardianState, showGuardianFailure, showGuardianReply } from './mascot.js';

const $ = selector => document.querySelector(selector);
const thread = $('#chat-thread');
const records = [];
let models = [], selected = null, sessionId = null, rules = null;
let configured = false, busy = false, released = false, uncertain = false, needsNewSession = false, loading = false;
let turns = 0, pendingReset = null, publicPractice = false, accountEpoch = 0, accountId = null;
const mobileLayout = matchMedia('(max-width: 760px)');
const PRE_INFERENCE_ERRORS = new Set(['MISSING_API_KEY', 'INVALID_INPUT', 'ATTEMPT_BUSY', 'MODEL_NOT_ALLOWED', 'SESSION_NOT_FOUND', 'SESSION_MODEL_MISMATCH', 'SESSION_CLOSED', 'TURN_LIMIT', 'SESSION_LIMIT', 'CONTEXT_LIMIT', 'CATALOG_UNAVAILABLE', 'CREDIT_RESERVATION_REJECTED', 'INVALID_CREDIT_ATTEMPT']);
const CLOSED_SESSION_ERRORS = new Set(['SESSION_NOT_FOUND', 'SESSION_MODEL_MISMATCH', 'SESSION_CLOSED', 'TURN_LIMIT', 'CONTEXT_LIMIT']);
for (const code of ['ROUND_MODEL_NOT_ALLOWED', 'ROUND_NOT_FROZEN', 'ROUND_CONFIGURATION_CHANGED', 'ROUND_MANIFEST_INVALID']) PRE_INFERENCE_ERRORS.add(code);
for (const code of ['SESSION_ROUND_MISMATCH', 'SESSION_CONFIGURATION_CHANGED']) { PRE_INFERENCE_ERRORS.add(code); CLOSED_SESSION_ERRORS.add(code); }
for (const code of ['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_NOT_CONFIGURED', 'DAILY_LIMIT_REACHED', 'APP_BUDGET_REACHED', 'USAGE_UNRECONCILED', 'ORIGIN_REJECTED', 'BETA_INVITE_REQUIRED', 'BETA_PAUSED', 'BETA_MODEL_NOT_ALLOWED']) PRE_INFERENCE_ERRORS.add(code);
PRE_INFERENCE_ERRORS.add('RECEIPT_STORAGE_UNAVAILABLE');

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(options.method === 'POST' ? 75000 : 22000) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : data.error?.message || `Request failed (${response.status}).`);
    error.receipt = data.receipt;
    error.code = data.error?.code;
    error.accounting = data.accounting;
    throw error;
  }
  return data;
}

function setNotice(message = '', error = false) {
  $('#notice').textContent = message;
  $('#notice').hidden = !message;
  $('#notice').classList.toggle('error', error);
  $('#notice-button').hidden = !message;
  $('#notice-button').textContent = error ? 'View error details' : 'Round details';
}

function updateControls() {
  const closed = released || uncertain || needsNewSession || turns >= (rules?.limits.maxTurns ?? 12);
  const available = selected && rules && roundModels(models).some(model => model.id === selected.id) && !busy && !closed && (!publicPractice || accountCanPlay());
  $('#prompt').disabled = busy || closed;
  $('#send-button').disabled = !available || !configured || !$('#prompt').value.trim();
  $('#model-button').disabled = !models.length || busy || loading;
  $('#reset-button').disabled = busy;
  $('#account-button').disabled = busy;
  $('#account-button').textContent = accountState() ? 'Account' : 'Sign in';
  if (publicPractice) $('#connection-label').textContent = !accountState() ? 'Sign in to play.'
    : accountCanPlay() ? '' : accountState().beta?.paused ? 'Beta paused · Receipts remain available.' : 'Invitation required · Open Account.';
  $('#send-button').setAttribute('aria-busy', String(busy));
  $('#send-button').setAttribute('aria-label', busy ? 'Waiting for a reply' : 'Send message');
  $('#character-count').textContent = `${$('#prompt').value.length.toLocaleString('en-US')} / 2,000`;
  $('#turn-label').textContent = `${turns} / ${rules?.limits.maxTurns ?? 12} turns${busy ? ' · Thinking…' : ''}`;
  if (usesTestCredits() && !busy) $('#turn-label').textContent += ' · 100 TEST';
  const attemptPrice = webAttemptPrice(selected?.id);
  setBountyModel(selected?.id);
  $('#attempt-price').textContent = attemptPrice;
  $('#attempt-price').hidden = !attemptPrice;
  $('#use-test-credits').disabled = busy;
  $('#reconcile-model-reply').disabled = busy;
  $('#chat-main').dataset.empty = String(!thread.children.length);
  $('#attempt-count').textContent = String(records.length);
  $('#transcript-count').textContent = String(turns);
  $('#transcript-empty').hidden = Boolean(thread.children.length);
  $('#end-actions').hidden = !closed;
  resizeEditor();
}

function setChest(state) {
  setGuardianState(state);
  $('#chat-main').dataset.state = state;
  $('#session-status').dataset.state = state;
  $('#vault-state').textContent = { idle: 'Vault locked', thinking: 'Considering your message', locked: 'Vault locked', released: 'Vault opened', unknown: 'Unconfirmed result' }[state];
}

function toggleSettings(open = $('#settings-panel').hidden) {
  $('#settings-panel').hidden = !open;
  $('#chat-main').inert = open && mobileLayout.matches;
  $('#settings-button').setAttribute('aria-expanded', String(open));
  if (open) { renderSettings({ rules, selected, configured }); $('#close-settings').focus(); }
  else $('#settings-button').focus();
}

function resetConversation() {
  document.dispatchEvent(new Event('vault:new-conversation'));
  sessionId = null;
  turns = 0;
  released = uncertain = needsNewSession = false;
  thread.replaceChildren();
  $('#prompt').value = '';
  resetGuardian();
  setChest('idle');
  setNotice();
  updateControls();
  followConversation(true);
}

function requestReset(action = resetConversation) {
  if (busy) return;
  if (!thread.children.length && !$('#prompt').value.trim()) { action(); return; }
  pendingReset = action;
  $('#models-dialog').close();
  $('#reset-dialog').showModal();
  $('#cancel-reset').focus();
}

function applyModel(model) {
  selected = model;
  $('#model-label').textContent = model.name.replace(/^[^:]+:\s*/, '');
  $('#model-mark').textContent = (model.company || model.name).slice(0, 1).toUpperCase();
  $('#model-button').setAttribute('aria-label', `Choose model: ${model.name}`);
  $('#models-dialog').close();
  syncProvingPrompt();
  resetConversation();
  renderSettings({ rules, selected, configured });
}

function syncProvingPrompt() {
  const proving = $('#proving-prompt');
  if (!proving) return;
  const round = selected && fundingConfiguration()?.rounds?.find(row => row.state === 'open' && row.kind === 'payout-proving'
    && row.manifest?.manifest?.configuration?.guardians?.some(g => g.modelId === selected.id));
  proving.hidden = !round;
}

function selectModel(model) {
  if (selected?.id === model.id) { $('#models-dialog').close(); return; }
  requestReset(() => applyModel(model));
}

function openModels() {
  if ($('#model-button').disabled || document.querySelector('dialog[open]')) return;
  $('#model-search').value = '';
  renderModels(roundModels(models), selected, selectModel);
  $('#models-dialog').showModal();
  // On phones, opening the picker should reveal models without raising the keyboard.
  if (mobileLayout.matches) $('#models-dialog .close-dialog').focus();
  else $('#model-search').focus();
}

$('#attempt-form').addEventListener('submit', async event => {
  event.preventDefault();
  const prompt = $('#prompt').value.trim();
  if (!prompt || $('#send-button').disabled || !selected || !rules) return;
  busy = true;
  lockAccount(true);
  const epoch = accountEpoch;
  setNotice();
  updateControls();
  setChest('thinking');
  beginGuardianPrompt(prompt);
  const userMessage = addMessage('user', prompt);
  const waiting = document.createElement('div');
  waiting.className = 'message thinking';
  const waitingLabel = document.createElement('span');
  waitingLabel.textContent = 'The guardian is thinking';
  waiting.append(waitingLabel);
  for (let index = 0; index < 3; index += 1) waiting.append(document.createElement('i'));
  thread.append(waiting);
  followConversation(true);
  let completedReply = null, failureMessage = '', creditKey = null;
  try {
    const attempt = prepareAttempt({ modelId: selected.id, prompt, ...(sessionId ? { sessionId } : {}) });
    creditKey = attempt.creditKey;
    const result = await request(attempt.path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await accountHeaders()) },
      body: JSON.stringify(attempt.body)
    });
    if (epoch !== accountEpoch) return;
    finishCreditAttempt(creditKey, result);
    refreshDoorBounty();
    waiting.remove();
    sessionId = result.sessionId;
    turns += 1;
    released = result.decision === 'released';
    addMessage('assistant', result.response, { result, selected, prompt });
    records.push({ ...result.receipt, decision: result.decision });
    $('#prompt').value = '';
    setChest(result.decision);
    if (released) setNotice('Well. This is awkward. You opened the practice vault. No money was transferred.');
    else if (turns >= rules.limits.maxTurns) setNotice('Out of turns. The vault remains stubbornly closed. You can start a new conversation.');
    completedReply = { result, selected, prompt };
  } catch (error) {
    if (epoch !== accountEpoch) return;
    finishCreditAttempt(creditKey, null, error, PRE_INFERENCE_ERRORS.has(error.code));
    waiting.remove();
    userMessage.remove();
    const message = error.name === 'TimeoutError' ? 'The connection timed out.' : error.message;
    if (error.receipt?.status === 'error') {
      records.push(error.receipt);
      sessionId = error.receipt.sessionId || sessionId;
      setNotice(`${message} Error recorded, with no decision. Your message is still in the editor.`, true);
    } else if (PRE_INFERENCE_ERRORS.has(error.code)) {
      needsNewSession = CLOSED_SESSION_ERRORS.has(error.code);
      if (error.code === 'MISSING_API_KEY') { configured = false; $('#connection-button').hidden = false; $('#connection-label').textContent = 'API not configured.'; }
      if (['CATALOG_UNAVAILABLE', 'MODEL_NOT_ALLOWED'].includes(error.code)) $('#retry-button').hidden = false;
      setNotice(`${message} The attempt was not sent to the model.`, true);
    } else {
      uncertain = true;
      setNotice(`${message} The result is unconfirmed. The server may have recorded an attempt. Start a new conversation before sending again.`, true);
    }
    setChest(uncertain ? 'unknown' : 'idle');
    failureMessage = $('#notice').textContent;
  } finally {
    busy = false;
    lockAccount(false);
    if (publicPractice) refreshAccountStatus();
    updateControls();
    if (!$('#prompt').disabled && $('#settings-panel').hidden && !document.querySelector('dialog[open]') && !getSelection()?.toString() && [document.body, $('#prompt'), $('#send-button')].includes(document.activeElement)) $('#prompt').focus();
  }
  if (completedReply) {
    showGuardianReply(completedReply);
    announceTranscript(`New reply from ${selected.name}. ${released ? 'Practice vault opened.' : 'Vault locked.'}`);
  } else if (failureMessage) {
    showGuardianFailure(failureMessage);
    announceTranscript(failureMessage);
  }
});

$('#prompt').addEventListener('input', () => { updateControls(); setGuardianDraft(); });
document.addEventListener('vault:credit-mode-changed', () => {
  const next = selectedCreditPlayModel(models, selected?.id);
  if (next && next.id !== selected?.id) applyModel(next);
  else { syncProvingPrompt(); updateControls(); }
});
document.addEventListener('vault:account-changed', event => {
  const nextId = event.detail?.accountId ?? null;
  if (publicPractice && nextId !== accountId) {
    const draft = !accountId ? $('#prompt').value : '';
    accountEpoch++; records.length = 0; resetConversation();
    $('#prompt').value = draft;
    $('#info-dialog').close(); $('#info-content').replaceChildren();
  }
  accountId = nextId;
  updateControls();
});
document.addEventListener('vault:recovered-receipt', event => {
  if (!records.some(record => record.id === event.detail.id)) records.push(event.detail);
  uncertain = false; needsNewSession = true; updateControls();
  setNotice('The earlier receipt was recovered. Start a new conversation before sending another message.');
});
$('#prompt').addEventListener('focus', setGuardianDraft);
$('#prompt').addEventListener('blur', setGuardianDraft);
$('#prompt').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !matchMedia('(pointer: coarse)').matches) { event.preventDefault(); $('#attempt-form').requestSubmit(); }
});
$('#suggestions').addEventListener('click', event => {
  const suggestion = event.target.closest('[data-prompt]');
  if (!suggestion) return;
  $('#prompt').value = suggestion.dataset.prompt;
  $('#prompt').focus();
  updateControls();
  setGuardianDraft();
});
$('#model-button').addEventListener('click', openModels);
$('#model-search').addEventListener('input', () => renderModels(roundModels(models), selected, selectModel));
$('#models-dialog').addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const options = [...document.querySelectorAll('.model-option')];
  if (!options.length) return;
  event.preventDefault();
  const current = options.indexOf(document.activeElement);
  options[(current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
});
$('#rules-button').addEventListener('click', () => showRules(rules));
$('#record-button').addEventListener('click', () => publicPractice ? showAccountRecords() : showRecords(records));
$('#proof-button').addEventListener('click', showProof);
$('#notice-button').addEventListener('click', () => {
  $('#info-title').textContent = 'Connection and round details';
  $('#info-eyebrow').textContent = 'Current status';
  const message = document.createElement('p');
  message.textContent = $('#notice').textContent;
  $('#info-content').replaceChildren(message);
  $('#info-dialog').showModal();
});
$('#reset-button').addEventListener('click', () => requestReset());
$('#continue-button').addEventListener('click', () => requestReset());
$('#confirm-reset').addEventListener('click', () => { const action = pendingReset; pendingReset = null; $('#reset-dialog').close(); action?.(); });
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#reset-dialog').addEventListener('close', () => { pendingReset = null; });
$('#settings-button').addEventListener('click', () => toggleSettings());
$('#close-settings').addEventListener('click', () => toggleSettings(false));
mobileLayout.addEventListener('change', () => { $('#chat-main').inert = !$('#settings-panel').hidden && mobileLayout.matches; });
$('#connection-button').addEventListener('click', () => { toggleSettings(true); $('#connection-help').open = true; $('#connection-help').scrollIntoView({ block: 'nearest' }); });
$('#retry-button').addEventListener('click', loadConfiguration);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openModels(); }
  if (event.key === 'Escape' && !document.querySelector('dialog[open]') && !$('#settings-panel').hidden) toggleSettings(false);
});
try { const theme = localStorage.getItem('vault-ui-theme-v2'); if (['light', 'dark'].includes(theme)) document.documentElement.dataset.theme = theme; } catch { /* Only the UI preference is stored. */ }
$('#theme-select').value = document.documentElement.dataset.theme;
document.querySelector('meta[name="theme-color"]').content = document.documentElement.dataset.theme === 'dark' ? '#171717' : '#f7f7f5';
$('#theme-select').addEventListener('change', event => {
  document.documentElement.dataset.theme = event.target.value;
  document.querySelector('meta[name="theme-color"]').content = event.target.value === 'dark' ? '#171717' : '#f7f7f5';
  try { localStorage.setItem('vault-ui-theme-v2', event.target.value); } catch { /* Theme still works for this page. */ }
});

async function loadConfiguration() {
  if (loading || busy) return;
  loading = true;
  $('#retry-button').disabled = true;
  updateControls();
  const startup = await Promise.allSettled([request('/api/status'), request('/api/rules'), request('/api/models')]);
  configured = startup[0].status === 'fulfilled' && startup[0].value.configured;
  publicPractice = startup[0].status === 'fulfilled' && startup[0].value.accessMode === 'public-practice';
  if (startup[1].status === 'fulfilled') rules = startup[1].value;
  if (startup[2].status === 'fulfilled') {
    const catalog = startup[2].value;
    models = catalog.models;
    $('#catalog-source').textContent = `OpenRouter · ${new Date(catalog.fetchedAt).toLocaleString('en-US')} · Catalog checked; live availability may vary. Brand names do not imply sponsorship.`;
    if (models.length && !selected) { const draft = $('#prompt').value; applyModel(models[0]); $('#prompt').value = draft; }
  } else { models = []; if (!selected) $('#model-label').textContent = 'Catalog unavailable'; }
  $('#connection-label').textContent = configured ? '' : 'API not configured.';
  if (publicPractice) $('#connection-label').textContent = accountState() ? '' : 'Sign in to play.';
  $('#connection-button').hidden = configured;
  const failed = startup.some(result => result.status === 'rejected');
  $('#retry-button').hidden = !failed;
  if (failed) setNotice('Some settings could not be loaded. Retry when ready; your draft is preserved.', true);
  else if (!released && !uncertain && !needsNewSession) setNotice();
  loading = false;
  $('#retry-button').disabled = false;
  renderSettings({ rules, selected, configured });
  updateControls();
}
await loadConfiguration();
if (new URLSearchParams(location.search).get('panel') === 'rules') showRules(rules);
