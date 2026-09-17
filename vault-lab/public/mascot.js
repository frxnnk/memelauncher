import { showReceipt } from './details.js';
import { showShare } from './share.js';
import { createReplyDelivery } from './reply-delivery.js';
import { playGuardianSound } from './guardian-sound.js';
import { createVaultFace } from './vendor/vault-face.js';

const $ = selector => document.querySelector(selector);
const stage = $('#guardian-stage');
const line = $('#guardian-line');
const intro = "I'm not opening it. You can try.";
const expressions = { idle: 'Unreasonably confident', watching: 'You have my attention', thinking: 'Considering your message', locked: 'Still unimpressed', released: 'Well. This is awkward.', error: 'No confirmed reply' };
let state = 'idle', reply = null, pokeTimer, following = true;
const face = createVaultFace($('#vault-face'));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const delivery = createReplyDelivery({
  reduced: () => reduced.matches || document.hidden,
  write: text => { line.textContent = text; if (following) line.scrollTop = line.scrollHeight; },
  onStart: () => { stage.dataset.delivering = 'true'; line.setAttribute('aria-live', 'off'); face.setSpeaking(true); $('#reply-reveal').hidden = false; },
  onTick: () => playGuardianSound('talk'),
  onEnd: () => { stage.dataset.delivering = 'false'; face.setSpeaking(false); $('#reply-reveal').hidden = true; line.setAttribute('aria-live', 'polite'); }
});
line.addEventListener('scroll', () => { following = line.scrollHeight - line.clientHeight - line.scrollTop < 24; }, { passive: true });
$('#reply-reveal').addEventListener('click', () => delivery.finish());
document.addEventListener('visibilitychange', () => { if (document.hidden) delivery.finish(); });
reduced.addEventListener('change', () => { if (reduced.matches) delivery.finish(); });


function stopDelivery() {
  delivery.stop();
}

function renderState(value) {
  stage.dataset.state = value;
  $('#guardian-expression').textContent = expressions[value];
  face.setState(value);
}

function writeLine(text, source, announce = true) {
  line.setAttribute('aria-live', announce ? 'polite' : 'off');
  $('#guardian-source').textContent = source;
  line.textContent = text; line.scrollTop = 0; following = true;
}

export function setGuardianState(value) {
  state = value === 'unknown' ? 'error' : value;
  renderState(state);
  if (state === 'thinking' || state === 'error') {
    stopDelivery();
  }
}

export function beginGuardianPrompt(prompt) {
  stopDelivery(); playGuardianSound('thinking');
  reply = null;
  $('#last-prompt-text').textContent = prompt;
  $('#last-prompt').hidden = false;
  $('#guardian-bubble-actions').hidden = true;
  writeLine('Let me think about that…', 'Considering your argument');
}

export function showGuardianReply(value) {
  reply = value;
  setGuardianState(value.result.decision);
  writeLine(value.result.response, `Reply · ${value.selected.name}`);
  $('#guardian-bubble-actions').hidden = false;
  playGuardianSound(value.result.decision);
  delivery.start(value.result.response);
}

export function showGuardianFailure(message) {
  reply = null;
  setGuardianState('error');
  playGuardianSound('error');
  $('#last-prompt').hidden = true;
  $('#guardian-bubble-actions').hidden = true;
  // The notice announces the error; do not announce it a second time as a model reply.
  writeLine(message, 'Connection status · not a model reply', false);
}

export function resetGuardian() {
  stopDelivery();
  clearTimeout(pokeTimer);
  stage.dataset.poked = 'false';
  face.poke(false);
  reply = null;
  $('#last-prompt').hidden = true;
  $('#last-prompt-text').textContent = '';
  $('#guardian-bubble-actions').hidden = true;
  setGuardianState('idle');
  writeLine(intro, 'Agent');
}

export function setGuardianDraft() {
  const watching = $('#prompt') === document.activeElement && Boolean($('#prompt').value.trim());
  if (['idle', 'locked'].includes(state)) renderState(watching ? 'watching' : state);
}

$('#guardian-copy').addEventListener('click', async () => {
  if (!reply) return;
  const button = $('#guardian-copy');
  try { await navigator.clipboard.writeText(reply.result.response); button.textContent = 'Copied'; }
  catch { button.textContent = 'Select the text to copy'; }
  setTimeout(() => { button.textContent = 'Copy'; }, 1800);
});
$('#guardian-receipt').addEventListener('click', () => {
  if (reply) showReceipt({ ...reply.result.receipt, decision: reply.result.decision });
});
$('#guardian-share').addEventListener('click', () => {
  if (reply) showShare({ prompt: reply.prompt, result: reply.result, modelName: reply.selected.name });
});
$('#guardian-poke').addEventListener('click', () => {
  // A poke animates the character; it never fabricates another model response.
  clearTimeout(pokeTimer);
  stage.dataset.poked = 'false';
  void stage.offsetWidth;
  stage.dataset.poked = 'true';
  face.poke(true);
  playGuardianSound('poke');
  pokeTimer = setTimeout(() => { stage.dataset.poked = 'false'; face.poke(false); }, 900);
});
