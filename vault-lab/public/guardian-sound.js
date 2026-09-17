// Original short synthesized cues. No microphone, speech service or downloaded audio.
const button = document.querySelector('#sound-button');
let context, enabled = false, last = 0;
const voices = { poke: [330, 510], thinking: [190, 240], locked: [310, 230], released: [330, 440, 660], error: [170, 135], talk: [280] };

export function playGuardianSound(kind) {
  if (!enabled || document.hidden || !context || context.state !== 'running') return;
  const now = context.currentTime;
  if (now - last < .09) return;
  last = now;
  (voices[kind] || voices.poke).forEach((frequency, i) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = now + i * .095, duration = kind === 'talk' ? .045 : .12;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .8, start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(kind === 'talk' ? .012 : .035, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}

button.addEventListener('click', async () => {
  try {
    if (enabled) { enabled = false; await context.suspend(); }
    else {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Unavailable');
      context ??= new Audio(); await context.resume(); enabled = context.state === 'running';
    }
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Mute sounds' : 'Enable sounds');
    button.title = enabled ? 'Sounds on' : 'Sounds off';
    playGuardianSound('poke');
  } catch {
    enabled = false; button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Sounds unavailable'); button.title = 'Sounds unavailable in this browser';
  }
});
