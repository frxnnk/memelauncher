import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSocialBatches, validateSocialBatch } from './social-delta.mjs';

const first = '2026-09-12T07:00:00.000Z';
const second = '2026-09-12T08:00:00.000Z';
const third = '2026-09-12T09:00:00.000Z';
const observation = overrides => ({ storyKey: 'album-guest',
  sourceUrl: 'https://x.com/reader/status/123', author: '@reader',
  publishedAt: '2026-09-12T06:00:00Z', observedAt: first,
  text: 'An album that keeps returning.', kind: 'reply', textBasis: 'verbatim',
  metrics: { likes: 4, views: 100 }, ...overrides });
const batch = (observations = [], recordedAt = first, coverage = []) => ({ version: 1, recordedAt, observations, coverage });
const initial = () => compareSocialBatches(null, batch([observation()])).nextState;
const types = result => result.changes.map(item => item.type);

test('new story means first in local memory, with explicit review limits', () => {
  const input = batch([observation()]);
  const copy = structuredClone(input);
  const result = compareSocialBatches(null, input);
  assert.deepEqual(types(result), ['NEW_STORY']);
  assert.equal(result.needsReview, true);
  assert.equal(result.changes[0].opportunityValidated, false);
  assert.equal(result.changes[0].sourceUrl, input.observations[0].sourceUrl);
  assert.equal(result.changes[0].author, '@reader');
  assert.equal(result.changes[0].text, input.observations[0].text);
  assert.equal(result.changes[0].kind, 'reply');
  assert.match(result.changes[0].note, /not global/);
  assert.equal(result.nextState.observations[0].firstObservedAt, first);
  assert.deepEqual(input, copy);
});

test('X aliases deduplicate to newest reading while keeping earliest actual observation', () => {
  const result = compareSocialBatches(null, batch([
    observation({ observedAt: second, sourceUrl: 'https://twitter.com/reader/status/123/photo/1?s=20', metrics: { likes: 7 } }),
    observation({ sourceUrl: 'https://x.com/i/web/status/123?utm_source=radar' }),
  ], second));
  assert.deepEqual(types(result), ['NEW_STORY']);
  assert.equal(result.nextState.observations.length, 1);
  assert.equal(result.nextState.observations[0].sourceKey, 'x:123');
  assert.equal(result.nextState.observations[0].observedAt, second);
  assert.equal(result.nextState.observations[0].firstObservedAt, first);
  assert.deepEqual(result.nextState.observations[0].metrics, { likes: 7 });
});

test('identical aliases at one instant merge; conflicting same-time readings fail', () => {
  const aliases = [observation(), observation({ sourceUrl: 'https://twitter.com/reader/status/123' })];
  assert.equal(validateSocialBatch(batch(aliases)).observations.length, 1);
  assert.throws(() => validateSocialBatch(batch([observation(), observation({ text: 'Other text' })])), /Conflicting/);
  assert.throws(() => validateSocialBatch(batch([observation(), observation({ metrics: { likes: 8 } })])), /Conflicting/);
});

test('rereading and numeric metric deltas never create a review alert', () => {
  const previous = initial(), copy = structuredClone(previous);
  const result = compareSocialBatches(previous, batch([observation({ observedAt: second,
    metrics: { likes: 3, views: 140, reposts: 2 } })], second));
  assert.deepEqual(types(result), ['REOBSERVED']);
  assert.equal(result.needsReview, false);
  assert.deepEqual(result.changes[0].metricDeltas, {
    likes: { previous: 4, current: 3, delta: -1 },
    reposts: { previous: null, current: 2, delta: null },
    views: { previous: 100, current: 140, delta: 40 },
  });
  assert.equal(result.nextState.observations[0].firstObservedAt, first);
  assert.deepEqual(previous, copy);
  const absent = compareSocialBatches(result.nextState, batch([observation({ observedAt: third, metrics: undefined })], third));
  assert.deepEqual(absent.changes[0].metricDeltas, {});
  assert.equal(absent.needsReview, false);
});

test('only two verbatim readings can produce CONTENT_CHANGED', () => {
  const result = compareSocialBatches(initial(), batch([observation({ observedAt: second, text: 'Changed exact text.' })], second));
  assert.deepEqual(types(result), ['REOBSERVED', 'CONTENT_CHANGED']);
  assert.equal(result.needsReview, true);
  assert.equal(result.changes[1].previousText, 'An album that keeps returning.');
  for (const [beforeBasis, afterBasis] of [['paraphrase', 'paraphrase'], ['unknown', 'verbatim'], ['verbatim', 'paraphrase']]) {
    const previous = compareSocialBatches(null, batch([observation({ textBasis: beforeBasis })])).nextState;
    const next = compareSocialBatches(previous, batch([observation({ observedAt: second,
      text: 'A different summary.', textBasis: afterBasis })], second));
    assert.deepEqual(types(next), ['REOBSERVED']);
    assert.equal(next.needsReview, false);
  }
});

test('unknown metrics remain null across zero and known values without alerts', () => {
  const previous = compareSocialBatches(null, batch([
    observation({ metrics: { likes: 0, views: null, reposts: null } }),
  ])).nextState;
  const result = compareSocialBatches(previous, batch([
    observation({ observedAt: second, metrics: { likes: null, views: 25, reposts: null } }),
  ], second));
  assert.deepEqual(types(result), ['REOBSERVED']);
  assert.equal(result.needsReview, false);
  assert.deepEqual(result.changes[0].metricDeltas, {
    likes: { previous: 0, current: null, delta: null },
    reposts: { previous: null, current: null, delta: null },
    views: { previous: null, current: 25, delta: null },
  });
  assert.equal(result.nextState.observations[0].metrics.likes, null);
});

test('empty passes and unavailable coverage retain sources and never imply deletion', () => {
  const failed = compareSocialBatches(initial(), batch([], second, [
    { storyKey: 'album-guest', status: 'unavailable', note: 'Public page did not load.' },
  ]));
  assert.equal(failed.needsReview, false);
  assert.deepEqual(failed.changes, []);
  assert.equal(failed.missing[0].type, 'NOT_OBSERVED_IN_THIS_PASS');
  assert.equal(failed.missing[0].coverageStatus, 'unavailable');
  assert.equal(failed.nextState.observations[0].firstObservedAt, first);
  assert.equal(failed.nextState.observations[0].observedAt, first);
  const skipped = compareSocialBatches(failed.nextState, batch([], third, [
    { storyKey: 'album-guest', status: 'not_checked', note: 'Outside this pass.' },
  ]));
  assert.equal(skipped.missing[0].coverageStatus, 'not_checked');
  const back = compareSocialBatches(skipped.nextState, batch([observation({ observedAt: third })], third));
  assert.deepEqual(types(back), ['REOBSERVED']);
  assert.equal(back.needsReview, false);
  assert.equal(back.nextState.observations[0].firstObservedAt, first);
});

test('a second source differs from associating a source already seen in another story', () => {
  const additional = compareSocialBatches(initial(), batch([
    observation({ sourceUrl: 'https://x.com/another/status/456', observedAt: second }),
  ], second));
  assert.deepEqual(types(additional), ['NEW_SOURCE']);
  assert.equal(additional.nextState.observations.length, 2);
  const associated = compareSocialBatches(additional.nextState, batch([
    observation({ storyKey: 'unwanted-gift', observedAt: third }),
  ], third));
  assert.deepEqual(types(associated), ['NEW_STORY', 'NEW_ASSOCIATION']);
  assert.deepEqual(associated.changes[1].previousStoryKeys, ['album-guest']);
  assert.equal(associated.nextState.observations.length, 3);
  assert.equal(associated.missing.length, 2);
  const repeat = compareSocialBatches(associated.nextState, batch([
    observation({ storyKey: 'unwanted-gift', observedAt: third }),
  ], third));
  assert.deepEqual(types(repeat), ['REOBSERVED']);
});

test('generic tracking aliases merge while meaningful query parameters remain separate', () => {
  const values = [
    observation({ sourceUrl: 'https://example.com/story?id=5&utm_source=x#part' }),
    observation({ sourceUrl: 'https://example.com/story?id=5' }),
    observation({ sourceUrl: 'https://example.com/story?id=6' }),
  ];
  const result = compareSocialBatches(null, batch(values));
  assert.deepEqual(types(result), ['NEW_STORY', 'NEW_SOURCE']);
  assert.equal(result.nextState.observations.length, 2);
});

test('calendar, publication, record and source chronology are validated', () => {
  for (const value of ['2026-02-30T07:00:00Z', '2026-09-12T24:00:00Z', '2026-09-12', null]) {
    assert.throws(() => validateSocialBatch(batch([observation({ observedAt: value })])), /timestamp/);
  }
  assert.throws(() => validateSocialBatch(batch([observation({ publishedAt: second })])), /Publication/);
  assert.throws(() => validateSocialBatch(batch([observation({ observedAt: second })])), /later than record/);
  assert.throws(() => compareSocialBatches(initial(), batch([], '2026-09-12T06:59:59Z')), /backward/);
  assert.throws(() => compareSocialBatches(initial(), batch([
    observation({ observedAt: '2026-09-12T06:59:00Z' }),
  ], second)), /backward/);
  assert.throws(() => compareSocialBatches(initial(), batch([observation({ text: 'Impossible same-time edit.' })], second)), /Conflicting/);
  assert.throws(() => validateSocialBatch(batch([observation({ firstObservedAt: second })])), /First observation/);
  assert.throws(() => validateSocialBatch(batch([observation({ firstObservedAt: '2000-01-01T00:00:00Z' })])), /First observation/);
  assert.doesNotThrow(() => validateSocialBatch(batch([observation({ publishedAt: null })])));
});

test('malformed schemas, metrics, coverage and forged source keys fail explicitly', () => {
  for (const overrides of [{ author: '' }, { text: null }, { kind: 4 }, { textBasis: 'summary' },
    { metrics: { likes: '4' } }, { metrics: { likes: NaN } }, { metrics: { likes: Infinity } },
    { metrics: { likes: -Infinity } }, { metrics: [] },
    { sourceUrl: 'http://example.com' }, { sourceKey: 'x:999' }]) {
    assert.throws(() => validateSocialBatch(batch([observation(overrides)])));
  }
  for (const bad of [null, { ...batch(), version: 2 }, { ...batch(), observations: null },
    { ...batch(), coverage: [{ storyKey: 'a', status: 'deleted', note: '' }] }]) {
    assert.throws(() => validateSocialBatch(bad));
  }
  assert.throws(() => validateSocialBatch(batch([], first, [
    { storyKey: 'a', status: 'observed', note: '' },
    { storyKey: 'a', status: 'not_checked', note: '' },
  ])), /Conflicting coverage/);
});
