// Presentation of an already validated response; never requests or changes a result.
export function createReplyDelivery({ write, onStart = () => {}, onEnd = () => {}, onTick = () => {},
  reduced = () => false, schedule = setTimeout, cancel = clearTimeout }) {
  let timer, source = '', parts = [], position = 0, active = false;
  function stop() { cancel(timer); timer = undefined; if (active) { active = false; onEnd(); } }
  function finish() { if (!active) return; write(source); stop(); }
  function start(text) {
    stop(); source = text;
    parts = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].map(p => p.segment) : Array.from(text);
    position = 0; active = true; onStart(); write('');
    if (reduced() || !parts.length) { finish(); return; }
    const stride = Math.max(2, Math.ceil(parts.length / 150));
    function step() {
      if (!active) return;
      position = Math.min(parts.length, position + stride);
      write(parts.slice(0, position).join('')); onTick();
      if (position === parts.length) stop(); else timer = schedule(step, 26);
    }
    timer = schedule(step, 26);
  }
  return { start, stop, finish };
}
