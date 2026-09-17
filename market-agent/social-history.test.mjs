import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, open, readFile, readdir, realpath, rm, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { readLatestSocial, recordSocialBatch } from './social-history.mjs';

async function temporary(t) {
  const tempRoot = await realpath(os.tmpdir());
  const directory = await mkdtemp(path.join(tempRoot, 'social-history-test-'));
  t.after(async () => {
    const resolved = await realpath(directory);
    assert.equal(path.dirname(resolved), tempRoot);
    assert.match(path.basename(resolved), /^social-history-test-/);
    await rm(resolved, { recursive: true, force: true });
  });
  return directory;
}
function batch(storyKey = 'story', recordedAt = '2026-09-12T06:01:00Z') {
  return { version: 1, recordedAt, observations: [{ storyKey,
    sourceUrl: `https://example.com/${storyKey}`, author: 'Source', text: 'A cultural expression.',
    publishedAt: '2026-09-12T05:00:00Z', observedAt: '2026-09-12T06:00:00Z',
    textBasis: 'paraphrase', kind: 'cultural-expression' }],
  coverage: [{ storyKey, status: 'observed', note: 'Bounded reading.' }] };
}

test('a failed coverage pass retains sources and a later reading does not rediscover them', async t => {
  const directory = await temporary(t), initial = batch();
  const first = await recordSocialBatch(initial, { directory });
  const empty = { version: 1, recordedAt: '2026-09-12T06:02:00Z', observations: [],
    coverage: [{ storyKey: 'story', status: 'unavailable', note: 'Reading unavailable.' }] };
  const second = await recordSocialBatch(empty, { directory });
  assert.equal(second.result.nextState.observations.length, 1);
  const again = batch('story', '2026-09-12T06:04:00Z');
  again.observations[0].observedAt = '2026-09-12T06:03:00Z';
  again.observations[0].metrics = null;
  const third = await recordSocialBatch(again, { directory });
  assert.equal(third.result.needsReview, false);
  assert.equal(Date.parse(third.result.nextState.observations[0].firstObservedAt), Date.parse('2026-09-12T06:00:00Z'));
  assert.equal((await readLatestSocial({ directory })).folder, third.folder);
  const original = await readFile(path.join(first.folder, 'batch.json'), 'utf8');
  const provenance = JSON.parse(await readFile(path.join(first.folder, 'provenance.json'), 'utf8'));
  assert.equal(provenance.files.find(file => file.file === 'batch.json').sha256,
    createHash('sha256').update(original).digest('hex'));
  assert.deepEqual(JSON.parse(original), initial);
});

test('incomplete runs are ignored and validation failure leaves no completed history or lock', async t => {
  const directory = await temporary(t);
  await mkdir(path.join(directory, '_pending-interrupted'));
  assert.equal(await readLatestSocial({ directory }), null);
  const invalid = batch();
  invalid.observations[0].observedAt = '2026-02-30T06:00:00Z';
  await assert.rejects(recordSocialBatch(invalid, { directory }));
  assert.deepEqual(await readdir(directory), ['_pending-interrupted']);
  const run = await recordSocialBatch(batch(), { directory });
  assert.equal((await readLatestSocial({ directory })).folder, run.folder);
});

test('an active writer fails before publication and an explicit retry retains concurrent inputs', async t => {
  const directory = await temporary(t), lockPath = path.join(directory, '.writer.lock');
  const lock = await open(lockPath, 'wx');
  await assert.rejects(recordSocialBatch(batch(), { directory }), error => error.code === 'SOCIAL_BUSY');
  await lock.close();
  await unlink(lockPath);
  const inputs = [batch('alpha'), batch('beta')];
  const results = await Promise.allSettled(inputs.map(input => recordSocialBatch(input, { directory })));
  for (let index = 0; index < results.length; index++) {
    if (results[index].status === 'rejected') {
      assert.equal(results[index].reason.code, 'SOCIAL_BUSY');
      await recordSocialBatch(inputs[index], { directory });
    }
  }
  assert.equal((await readLatestSocial({ directory })).state.observations.length, 2);
});
