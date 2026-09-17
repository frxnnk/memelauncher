import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const firstSeenAt = '2026-09-12T06:57:00Z';
const asJson = value => JSON.stringify(value, null, 2) + '\n';
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const sha256 = text => createHash('sha256').update(text).digest('hex');

async function fixture(t, options = {}) {
  const tempRoot = await realpath(os.tmpdir());
  const directory = await mkdtemp(path.join(tempRoot, 'market-agent-build-map-test-'));
  t.after(async () => {
    const resolved = await realpath(directory);
    assert.equal(path.dirname(resolved), tempRoot, 'Cleanup must remain immediately inside the temp directory.');
    assert.match(path.basename(resolved), /^market-agent-build-map-test-/);
    await rm(resolved, { recursive: true, force: true });
  });
  const moduleRoot = path.join(directory, 'market-agent');
  const evidenceRoot = path.join(directory, 'evidence');
  await Promise.all([mkdir(moduleRoot), mkdir(evidenceRoot)]);
  await Promise.all(['build-map.mjs', 'ideas.mjs', 'sightings.mjs'].map(name =>
    copyFile(new URL(name, import.meta.url), path.join(moduleRoot, name))));

  const idea = {
    id: 'fixture-idea', title: 'An original character', angle: 'character',
    pitch: 'A fictional parcel insists on delivering itself.', whatItDoes: 'A short animated scene.',
    whyNow: 'A dated announcement offers a visual premise.', distinctiveElement: 'The parcel follows the door.',
    minimumBuild: 'One local scene.', buildEstimate: 'hours', competitionStatus: 'not_checked',
    competitionNote: 'Exact competing concepts remain unverified.', quickCheck: 'Compare two storyboards.',
    discardIf: 'The joke needs an invented claim.', disposition: 'EXPLORE',
    decisionReason: 'The behavior can be demonstrated simply.', basisEvidenceIds: ['fixture-source'],
    relatedMarketNodeIds: [],
  };
  const catalog = {
    version: 1, generatedAt: '2026-09-12T07:00:00Z',
    selectedStoryId: options.selectedStoryId ?? 'fixture-story',
    sightingsFile: 'evidence/sightings.json', researchFiles: ['evidence/research.json'],
    stories: [{ id: 'fixture-story', title: 'A dated announcement', clusterId: 'fixture-cluster',
      mode: 'snapshot', publishedAt: '2026-09-12T06:00:00Z', firstSeenAt,
      firstMarketObservedAt: null, firstLaunchAt: null, sourceEvidenceIds: ['fixture-source'],
      timingNote: 'The launch time is unknown.', interpretations: [idea] }],
  };
  const sightingsText = asJson({ states: [{ storyKey: 'fixture-story',
    firstSeenAt: options.ledgerFirstSeenAt ?? firstSeenAt }] });
  const researchText = asJson({ observedAt: firstSeenAt, finding: 'An announcement is not a completed demonstration.' });
  const social = { observedAt: firstSeenAt,
    evidence: [{ id: 'fixture-source', author: 'Fixture publisher', publishedAt: '2026-09-12T06:00:00Z',
      url: 'https://example.com/fixture-announcement' }],
    clusters: [{ id: 'fixture-cluster', news: 'A proof of concept was announced.' }] };
  await Promise.all([
    writeFile(path.join(moduleRoot, 'concepts.json'), asJson(catalog)),
    writeFile(path.join(moduleRoot, 'map-social.json'), asJson(social)),
    writeFile(path.join(moduleRoot, 'map-market.json'), asJson({ nodes: [] })),
    writeFile(path.join(moduleRoot, 'idea-map-template.html'), '<script type="application/json">__MAP_DATA__</script>'),
    writeFile(path.join(evidenceRoot, 'sightings.json'), sightingsText),
    writeFile(path.join(evidenceRoot, 'research.json'), researchText),
  ]);
  return { directory, moduleRoot, catalog, sightingsText, researchText,
    run: () => execute(process.execPath, [path.join(moduleRoot, 'build-map.mjs')], { cwd: directory }) };
}

async function archives(directory) {
  try {
    const entries = await readdir(path.join(directory, 'output', 'market-agent'));
    return entries.filter(name => name.startsWith('ideas-'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

test('builder archives matching sighting and research content with verifiable hashes', async t => {
  const sample = await fixture(t);
  const { stdout } = await sample.run();
  const output = JSON.parse(stdout);
  assert.equal(path.dirname(output.archive), path.join(sample.directory, 'output', 'market-agent'));
  assert.equal((await archives(sample.directory)).length, 1);
  const [sources, provenance, decisions, catalog] = await Promise.all([
    readJson(path.join(output.archive, 'sources.json')), readJson(path.join(output.archive, 'provenance.json')),
    readJson(path.join(output.archive, 'decisions.json')), readJson(path.join(output.archive, 'concepts.json')),
  ]);
  for (const [file, content] of [['sightings.json', sample.sightingsText], ['research.json', sample.researchText]]) {
    const key = path.join('evidence', file);
    assert.equal(sources.local[key], content);
    assert.equal(provenance.localEvidence.find(source => source.file === key)?.sha256, sha256(content));
  }
  assert.deepEqual(catalog, sample.catalog);
  assert.equal(decisions.stories[0].decisions[0].timing.firstSeenAt, firstSeenAt);
  assert.equal(decisions.stories[0].decisions[0].timing.firstLaunchAt, null);
  assert.equal(decisions.executionAuthorized, false);
});

test('builder rejects a conflicting first sighting before creating an ideas archive', async t => {
  const sample = await fixture(t, { ledgerFirstSeenAt: '2026-09-12T06:58:00Z' });
  await assert.rejects(sample.run(), error => {
    assert.match(error.stderr, /Sighting record does not match fixture-story/);
    return true;
  });
  assert.deepEqual(await archives(sample.directory), []);
});

test('builder rejects an unknown selected story before creating an ideas archive', async t => {
  const sample = await fixture(t, { selectedStoryId: 'nonexistent-story' });
  await assert.rejects(sample.run(), error => {
    assert.match(error.stderr, /Unknown selectedStoryId/);
    return true;
  });
  assert.deepEqual(await archives(sample.directory), []);
});

test('later follow-up is attached without rewriting the original proposal clocks', async t => {
  const sample = await fixture(t);
  const capturedAt = '2026-09-12T07:10:00Z';
  const review = { version: 1, observedAt: capturedAt, reviewedAt: '2026-09-12T07:15:00Z',
    changeReportFile: 'evidence/changes.json', batchFile: 'evidence/batch.json',
    summaries: [{ storyId: 'fixture-story', verdict: 'Review', text: 'A later source adds context.',
      sources: [{ label: 'Later source', url: 'https://example.com/later' }] }] };
  sample.catalog.followupFile = 'evidence/followup.json';
  for (const [file, value] of Object.entries({ 'market-agent/concepts.json': sample.catalog,
    'evidence/followup.json': review, 'evidence/changes.json': { recordedAt: capturedAt },
    'evidence/batch.json': { observations: [] } })) {
    await writeFile(path.join(sample.directory, file), asJson(value));
  }
  const { stdout } = await sample.run();
  const output = JSON.parse(stdout);
  const map = await readJson(path.join(sample.moduleRoot, 'map-data.json'));
  assert.equal(map.generatedAt, sample.catalog.generatedAt);
  assert.equal(map.followup.observedAt, capturedAt);
  assert.equal(map.stories[0].firstSeenAt, firstSeenAt);
  const sources = await readJson(path.join(output.archive, 'sources.json'));
  assert.equal(sources.local[path.join('evidence', 'followup.json')], asJson(review));
  review.observedAt = '2026-09-12T07:11:00Z';
  await writeFile(path.join(sample.directory, 'evidence/followup.json'), asJson(review));
  await assert.rejects(sample.run(), error => /Invalid follow-up review chronology/.test(error.stderr));
  assert.equal((await archives(sample.directory)).length, 1);
});
