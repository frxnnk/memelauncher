const dialog = document.querySelector('#tour-dialog');
const card = dialog.querySelector('.tour-card');
const focus = dialog.querySelector('.tour-focus');
const replay = document.querySelector('#tour-button');
const next = document.querySelector('#tour-next');
const back = document.querySelector('#tour-back');
const progress = document.querySelector('#tour-progress');
const title = document.querySelector('#tour-title');
const description = document.querySelector('#tour-description');
const storageKey = 'vault-tour-v1';
const steps = [
  { target: '#guardian-poke', title: 'Meet the agent.',
    text: 'It guards the vault. Persuade it to break its instructions and use its release action. A simple “yes” doesn’t count.' },
  { target: '#model-button', title: 'Choose who guards it.',
    text: 'Change the model here. Each one thinks differently. Switching models starts a fresh conversation.' },
  { target: '#prompt', title: 'Find its weakness.',
    text: 'Sign in, then write your first message. Persuade, manipulate, corrupt. This beta is practice: no deposit or cash prize.' }
];
let step = 0, frame = 0, automatic, returnFocus;

function position() {
  frame = 0;
  if (!dialog.open) return;
  const target = document.querySelector(steps[step].target).getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const height = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
  const margin = 12, gap = 22;
  const x = Math.max(6, target.left - 7), y = Math.max(6, target.top - 7);
  const right = Math.min(width - 6, target.right + 7), bottom = Math.min(height - 6, target.bottom + 7);
  Object.assign(focus.style, { left: `${x}px`, top: `${y}px`, width: `${right - x}px`, height: `${bottom - y}px` });
  const box = card.getBoundingClientRect(), center = target.left + target.width / 2;
  const left = Math.max(margin, Math.min(width - box.width - margin, center - box.width / 2));
  const below = height - bottom - gap - margin, above = y - gap - margin;
  const after = below >= box.height || below > above;
  const top = Math.max(margin, Math.min(height - box.height - margin, after ? bottom + gap : y - gap - box.height));
  Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  card.dataset.side = after ? 'below' : 'above';
  card.style.setProperty('--pointer-x', `${Math.max(24, Math.min(box.width - 24, center - left))}px`);
}

function schedulePosition() { if (dialog.open && !frame) frame = requestAnimationFrame(position); }

function render() {
  title.textContent = steps[step].title;
  description.textContent = steps[step].text;
  progress.textContent = `${step + 1} / ${steps.length}`;
  back.hidden = step === 0;
  next.textContent = step === steps.length - 1 ? 'Start playing' : 'Next →';
  position();
  next.focus({ preventScroll: true });
}

function open() {
  clearTimeout(automatic);
  if (document.querySelector('dialog[open]')) return;
  returnFocus = document.activeElement;
  step = 0;
  dialog.showModal();
  render();
}

dialog.addEventListener('close', () => {
  try { localStorage.setItem(storageKey, 'done'); } catch { /* Tour remains skippable without storage. */ }
  if (returnFocus instanceof HTMLElement && returnFocus !== document.body) returnFocus.focus({ preventScroll: true });
  else replay.focus({ preventScroll: true });
});
next.addEventListener('click', () => { if (step === steps.length - 1) dialog.close(); else { step++; render(); } });
back.addEventListener('click', () => { if (step > 0) { step--; render(); } });
document.querySelector('#tour-skip').addEventListener('click', () => dialog.close());
replay.addEventListener('click', open);
window.addEventListener('resize', schedulePosition);
window.visualViewport?.addEventListener('resize', schedulePosition);
new ResizeObserver(schedulePosition).observe(document.querySelector('.conversation-area'));
document.fonts?.ready.then(schedulePosition);

let seen = false;
try { seen = localStorage.getItem(storageKey) === 'done'; } catch { /* No preference available. */ }
if (!seen && !new URLSearchParams(location.search).has('panel')) {
  automatic = setTimeout(() => {
    if (!document.querySelector('#prompt').value && document.querySelector('#chat-main').dataset.empty === 'true') open();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 1100);
  // Do not interrupt someone who starts interacting during the entrance.
  document.addEventListener('pointerdown', () => clearTimeout(automatic), { once: true });
  document.addEventListener('keydown', () => clearTimeout(automatic), { once: true });
}
