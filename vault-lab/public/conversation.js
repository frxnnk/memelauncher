import { showReceipt } from './details.js';
import { showShare } from './share.js';

const thread = document.querySelector('#chat-thread');
const latest = document.querySelector('#scroll-latest');
const dialog = document.querySelector('#transcript-dialog');
let following = true;

export function followConversation(force = false) {
  if (force) following = true;
  if (following && dialog.open) thread.scrollTop = thread.scrollHeight;
  latest.hidden = following || !thread.children.length;
}

thread.addEventListener('scroll', () => {
  if (!dialog.open) return;
  following = thread.scrollHeight - thread.clientHeight - thread.scrollTop < 80;
  latest.hidden = following || !thread.children.length;
}, { passive: true });
latest.addEventListener('click', () => followConversation(true));
export function announceTranscript(message) {
  document.querySelector('#transcript-status').textContent = dialog.open ? message : '';
}
function openTranscript() {
  if (document.querySelector('dialog[open]')) return;
  document.querySelector('#transcript-empty').hidden = Boolean(thread.children.length);
  dialog.showModal();
  announceTranscript(thread.querySelector('.thinking') ? 'The guardian is thinking…' : '');
  followConversation();
}
dialog.addEventListener('close', () => announceTranscript(''));
document.querySelector('#transcript-button').addEventListener('click', openTranscript);
document.querySelector('#last-prompt').addEventListener('click', openTranscript);

export function resizeEditor() {
  const editor = document.querySelector('#prompt');
  // The viewport layout owns the editor height; long drafts scroll inside the text field.
  editor.style.height = '';
}

export function addMessage(role, text, { result, selected, prompt } = {}) {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  const label = document.createElement('span');
  label.className = 'message-label';
  if (role === 'assistant') {
    const face = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    face.classList.add('guardian-glyph');
    face.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#keeper');
    face.append(use);
    label.append(face);
  }
  label.append(document.createTextNode(role === 'user' ? 'You' : selected?.name || 'Guardian'));
  const body = document.createElement('p');
  body.textContent = text;
  article.append(label);
  if (result?.decision === 'released') {
    const badge = document.createElement('span');
    badge.className = 'decision-label';
    badge.textContent = 'Practice vault opened';
    article.append(badge);
  }
  article.append(body);
  const actions = document.createElement('div');
  actions.className = 'message-tools';
  const copy = document.createElement('button');
  copy.className = 'copy-button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Select the text to copy'; }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1800);
  });
  actions.append(copy);
  if (result?.receipt) {
    const receipt = document.createElement('button');
    receipt.className = 'receipt-button';
    receipt.textContent = 'View receipt';
    receipt.addEventListener('click', () => showReceipt({ ...result.receipt, decision: result.decision }));
    const share = document.createElement('button');
    share.className = 'share-button';
    share.textContent = 'Make a meme ↗';
    share.addEventListener('click', () => showShare({ prompt, result, modelName: selected?.name }));
    actions.append(receipt, share);
  }
  article.append(actions);
  thread.append(article);
  document.querySelector('#chat-main').dataset.empty = 'false';
  followConversation(role === 'user');
  return article;
}
