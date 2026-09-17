import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, readdir, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceKey, mergeSightings, recordSightings } from './sightings.mjs';
const time = '2026-09-12T07:00:00Z';
const observation = overrides => ({ storyKey: 'new-demo', title: 'Demo', context: 'new_to_radar',
  sourceUrl: 'https://x.com/example/status/123?utm_source=test', publishedAt: '2026-09-12T06:00:00Z',
  observedAt: time, ...overrides });

test('publication is not first detection, repeat sightings preserve the recorded first observation', () => {
  const first = mergeSightings([], [observation()], time);
  const next = mergeSightings(first, [observation({ observedAt: '2026-09-12T08:00:00Z' })], '2026-09-12T08:01:00Z');
  assert.equal(next[0].firstSeenAt, time);
  assert.equal(next[0].lastObservedAt, '2026-09-12T08:00:00Z');
  assert.equal(first[0].lastObservedAt, time);
  assert.equal(next[0].sourceKeys.length, 1);
});
test('old context never becomes an early discovery by refreshing it', () => {
  const first = mergeSightings([], [observation({ context: 'known_before_tracking' })], time);
  const next = mergeSightings(first, [observation({ observedAt: '2026-09-12T08:00:00Z' })], '2026-09-12T08:01:00Z');
  assert.equal(next[0].firstSeenAt, null);
  assert.equal(next[0].knownBeforeTracking, true);
});
test('source identity normalizes X aliases but keeps meaningful query parameters', () => {
  assert.equal(sourceKey('https://twitter.com/Example/status/123?s=20'), sourceKey('https://x.com/i/web/status/123'));
  assert.equal(sourceKey('https://example.com/story?id=5&utm_source=abc#section'), 'https://example.com/story?id=5');
  assert.notEqual(sourceKey('https://example.com/story?id=5'), sourceKey('https://example.com/story?id=6'));
});
test('future observations and historical overwrites fail before persistence', () => {
  assert.throws(() => mergeSightings([], [observation({ observedAt: '2026-09-13T00:00:00Z' })], time), /later than/);
  const prior = mergeSightings([], [observation()], time);
  assert.throws(() => mergeSightings(prior, [observation({ observedAt: '2026-09-12T06:30:00Z' })], time), /Historical/);
});

test('calendar validation rejects normalized impossible dates and accepts a real leap day with timezone', () => {
  for (const invalid of ['2026-02-30T06:00:00Z', '2026-02-29T06:00:00Z', '2026-04-31T06:00:00Z',
    '2026-09-11T24:00:00Z', '2026-09-12T07:00Z', '2026-09-12T07:00:00+25:00']) {
    for (const field of ['publishedAt', 'observedAt']) {
      assert.throws(() => mergeSightings([], [observation({ [field]: invalid })], time), /valid timestamp/);
    }
    assert.throws(() => mergeSightings([], [observation()], invalid), /valid timestamp/);
  }
  const leap = observation({ publishedAt: '2024-02-29T23:00:00-03:00', observedAt: '2024-03-01T02:30:00Z' });
  assert.equal(mergeSightings([], [leap], '2024-03-01T03:00:00Z')[0].firstSeenAt, leap.observedAt);
});

test('X post IDs require a complete segment while media and host aliases still deduplicate', () => {
  const canonical = sourceKey('https://x.com/example/status/123');
  assert.equal(sourceKey('https://twitter.com/example/status/123/photo/1'), canonical);
  assert.equal(sourceKey('https://x.com/i/web/status/123?utm_source=abc'), canonical);
  for (const malformed of ['https://x.com/example/status/123garbage', 'https://x.com/example/status/123.4',
    'https://x.com/prefix/example/status/123', 'https://x.com/example/status/123%2Fgarbage']) {
    assert.notEqual(sourceKey(malformed), canonical);
  }
});

async function temporaryDirectory(t) {
  const parent = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(parent, 'sightings-test-'));
  t.after(async () => {
    if (path.dirname(path.resolve(directory)) !== parent || !path.basename(directory).startsWith('sightings-test-')) {
      throw new Error('Unexpected temporary cleanup path');
    }
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('a held writer lock fails clearly without creating a snapshot; an explicit retry succeeds', async t => {
  const directory = await temporaryDirectory(t), lockPath = path.join(directory, '.writer.lock');
  const lock = await open(lockPath, 'wx');
  try {
    await assert.rejects(recordSightings([observation()], { directory }), { code: 'SIGHTINGS_BUSY' });
    assert.deepEqual(await readdir(directory), ['.writer.lock']);
  } finally { await lock.close(); await unlink(lockPath); }
  const record = await recordSightings([observation()], { directory });
  assert.equal(record.states[0].firstSeenAt, time);
  assert.equal(JSON.parse(await readFile(record.file, 'utf8')).observations.length, 1);
  assert.deepEqual(await readdir(directory), [path.basename(record.file)]);
});

test('concurrent writers plus explicit busy retries preserve both observations in the latest snapshot', async t => {
  const directory = await temporaryDirectory(t);
  const inputs = ['story-a', 'story-b'].map(storyKey => [observation({ storyKey })]);
  const attempts = await Promise.allSettled(inputs.map(input => recordSightings(input, { directory })));
  assert.ok(attempts.some(result => result.status === 'fulfilled'));
  for (const [index, result] of attempts.entries()) {
    if (result.status === 'rejected') {
      assert.equal(result.reason.code, 'SIGHTINGS_BUSY');
      await recordSightings(inputs[index], { directory });
    }
  }
  const files = (await readdir(directory)).sort();
  assert.equal(files.length, 2);
  assert.ok(files.every(file => file.endsWith('.json')));
  const latest = JSON.parse(await readFile(path.join(directory, files.at(-1)), 'utf8'));
  assert.deepEqual(latest.states.map(state => state.storyKey).sort(), ['story-a', 'story-b']);
  assert.ok(latest.states.every(state => state.firstSeenAt === time));
});

test('failed validation releases the lock and leaves the previous snapshot untouched', async t => {
  const directory = await temporaryDirectory(t);
  const first = await recordSightings([observation()], { directory });
  await assert.rejects(recordSightings([observation({ publishedAt: '2026-02-30T06:00:00Z' })], { directory }), /valid timestamp/);
  assert.deepEqual(await readdir(directory), [path.basename(first.file)]);
  const retry = await recordSightings([observation({ storyKey: 'another-story' })], { directory });
  assert.equal(retry.states.length, 2);
  assert.equal(JSON.parse(await readFile(first.file, 'utf8')).states.length, 1);
});
