import { createVaultFace } from './vendor/vault-face.js';
import { paidBetaLandingCopy } from './paid-beta-copy.js';
const character = document.querySelector('#landing-character');
const face = createVaultFace(document.querySelector('#vault-face'));
let faceTimer;
const line = document.querySelector('#landing-roast');
const lines = [
  "I've seen better arguments from a CAPTCHA.",
  "Poking me isn't a persuasive argument. Interesting strategy, though.",
  "My therapist calls this a boundary. I call it a vault.",
  "Take your time. I've got absolutely nowhere to be.",
  "You're one clever sentence away. Allegedly."
];
let poke = 0;
character.addEventListener('click', () => {
  clearTimeout(faceTimer); face.poke(true); faceTimer=setTimeout(()=>face.poke(false),900);
  line.textContent = lines[++poke % lines.length];
  character.classList.remove('is-poked');
  requestAnimationFrame(() => character.classList.add('is-poked'));
});
character.addEventListener('animationend', () => character.classList.remove('is-poked'));

try {
  const response = await fetch('/api/channels', { signal: AbortSignal.timeout(5000) });
  const { telegram } = await response.json();
  if (response.ok && telegram?.status === 'running' && /^[A-Za-z0-9_]{5,32}$/.test(telegram.username) && telegram.url === `https://t.me/${telegram.username}`) {
    const link = document.querySelector('#telegram-link');
    link.href = telegram.url; link.hidden = false;
    
  }
} catch { /* The web game remains available without Telegram. */ }

try {
  const [statusResponse, fundingResponse] = await Promise.all([
    fetch('/api/status', { signal: AbortSignal.timeout(5000) }),
    fetch('/api/funding/config', { signal: AbortSignal.timeout(5000) })
  ]);
  const state = statusResponse.ok ? await statusResponse.json() : {};
  const funding = fundingResponse.ok ? await fundingResponse.json() : null;
  const copy = paidBetaLandingCopy(state, funding);
  document.querySelector('.edition').textContent = copy.edition;
  document.querySelector('.play-note').textContent = copy.playNote;
  document.querySelector('.footer-practice').textContent = copy.footer;
  if (copy.navPlay) document.querySelector('.nav-play').firstChild.textContent = copy.navPlay;
} catch { /* Keep the practice description when status is unavailable. */ }
