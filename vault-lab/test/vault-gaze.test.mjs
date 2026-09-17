import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

const compiled = await build({ entryPoints: ['client/vault-face.mjs'], bundle: true, write: false,
  format: 'iife', globalName: 'VaultFace', platform: 'browser', logLevel: 'silent' });

function scene() {
  const listeners = new Map(), frames = new Map();
  let sequence = 0, now = 0;
  const node = () => ({ attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, replaceChildren() {} });
  const body = node(), clip = node(), dots = node(), eyes = [node(), node()];
  const svg = { ...node(), dataset: {},
    querySelector: selector => ({ '[data-face-body]': body, '[data-face-clip]': clip, '[data-face-dots]': dots })[selector],
    querySelectorAll: () => eyes,
    getBoundingClientRect: () => ({ left: 400, top: 300, width: 200, height: 200 }) };
  const on = (type, handler) => listeners.set(type, handler);
  const context = { document: { hidden: false, createElementNS: node, addEventListener: on },
    window: { innerWidth: 1000, innerHeight: 800, addEventListener: on },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: () => ++sequence, clearTimeout() {} };
  runInNewContext(compiled.outputFiles[0].text, context);
  const face = context.VaultFace.createVaultFace(svg);
  function advance() {
    for (const end = now + 1400; now <= end; now += 40) {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now));
    }
  }
  const center = () => eyes.map(eye => eye.attrs.transform.match(/matrix\(([^)]+)\)/)[1].split(/[ ,]+/).map(Number))
    .reduce((sum, values) => ({ x: sum.x + values[4] / 2, y: sum.y + values[5] / 2 }), { x: 0, y: 0 });
  return { face, advance, center, svg, frames, move: (x, y, type = 'mouse') => listeners.get('pointermove')?.({ clientX:x, clientY:y, pointerType:type }) };
}

test('screen-down gaze moves the eyes down, not up', () => {
  const up = scene(), down = scene();
  up.face.gaze(0, -1); down.face.gaze(0, 1); up.advance(); down.advance();
  assert.ok(down.center().y > up.center().y + 10, 'Screen y and engine pitch have opposite signs.');
});

test('the face follows the cursor outside the vault without a hover or click', () => {
  const left = scene(), right = scene();
  left.move(50, 400); right.move(950, 400); left.advance(); right.advance();
  assert.ok(right.center().x > left.center().x + 10, 'Movement across the page must reach the face.');
});

test('touch movement does not pin the face to a finger', () => {
  const idle = scene(), touch = scene();
  touch.move(950, 750, 'touch'); idle.advance(); touch.advance();
  assert.deepEqual(touch.center(), idle.center());
});

test('moving the cursor wakes a sleeping face without duplicating animation loops', () => {
  const view = scene();
  view.face.setState('sleep'); view.advance();
  view.move(950, 650); view.advance();
  assert.equal(view.svg.dataset.expression, 'idle');
  assert.ok(Number.isFinite(view.center().x));
  assert.equal(view.frames.size, 1);
});
