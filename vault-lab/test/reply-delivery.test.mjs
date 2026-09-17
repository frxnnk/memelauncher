import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplyDelivery } from '../public/reply-delivery.js';

function fixture(reduced = false) {
  const queue = new Map(), writes = []; let next = 0, ended = 0;
  const delivery = createReplyDelivery({ write: value => writes.push(value), reduced: () => reduced,
    schedule: fn => { queue.set(++next, fn); return next; }, cancel: id => queue.delete(id), onEnd: () => ended++ });
  const tick = () => { const [id, fn] = queue.entries().next().value; queue.delete(id); fn(); };
  return { delivery, queue, writes, tick, get ended() { return ended; } };
}
test('progressive delivery preserves exact Unicode text and permits immediate reveal', () => {
  const f = fixture(), text = 'A 🔐 and e\u0301. ' + 'One more argument. '.repeat(20);
  f.delivery.start(text); f.tick();
  assert.ok(f.writes.at(-1).length < text.length);
  assert.ok(text.startsWith(f.writes.at(-1)));
  f.delivery.finish();
  assert.equal(f.writes.at(-1), text); assert.equal(f.queue.size, 0); assert.equal(f.ended, 1);
});
test('new reply or reset cancels previous delivery; reduced motion renders immediately', () => {
  const f = fixture(); f.delivery.start('Old reply'); f.tick(); f.delivery.start('New reply');
  while (f.queue.size) f.tick();
  assert.equal(f.writes.at(-1), 'New reply');
  f.delivery.start('Cancelled'); f.delivery.stop(); assert.equal(f.queue.size, 0);
  const r = fixture(true); r.delivery.start('Instant');
  assert.equal(r.writes.at(-1), 'Instant'); assert.equal(r.queue.size, 0); assert.equal(r.ended, 1);
});
