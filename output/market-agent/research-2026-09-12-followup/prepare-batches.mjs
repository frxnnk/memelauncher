import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sourceKey } from '../../../market-agent/sightings.mjs';
import { validateSocialBatch } from '../../../market-agent/social-delta.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const archive = path.resolve(here, '../ideas-2026-09-12T07-21-31-202Z-db46dcd0-a016-4121-8af2-e9ef103d949e');
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const [catalog, sources, provenance, followup] = await Promise.all([
  read(path.join(archive, 'concepts.json')), read(path.join(archive, 'sources.json')),
  read(path.join(archive, 'provenance.json')), read(path.join(here, 'followup-social.json')),
]);
const observations = [];
for (const story of catalog.stories) {
  const urls = new Set(story.sourceUrls.map(sourceKey));
  const evidence = sources.social.evidence.filter(item => story.sourceEvidenceIds.includes(item.id)
    || urls.has(sourceKey(item.url)));
  for (const item of evidence) {
    if (!item.observedAt) continue; // No synthetic clock for undated reads.
    observations.push({ storyKey: story.id, sourceUrl: item.url, author: item.author,
      publishedAt: item.publishedAt ?? null, observedAt: item.observedAt,
      text: item.paraphrase, textBasis: 'paraphrase', kind: item.kind,
      ...(item.metrics ? { metrics: item.metrics } : {}) });
  }
}
const baseline = { version: 1, recordedAt: provenance.recordedAt, observations,
  sourceArchive: archive, importedAt: new Date().toISOString(),
  method: 'Import of the archived capture; recordedAt is the original archive time, not a new source observation.',
  coverage: catalog.stories.map(story => ({ storyKey: story.id, status: 'observed',
    note: 'Historical archived capture, bounded readings only.' })) };
const byCluster = new Map(catalog.stories.map(story => [story.clusterId, story.id]));
function storyId(key) {
  const id = byCluster.get(key);
  if (!id) throw new Error(`Unknown follow-up story mapping: ${key}`);
  return id;
}
const current = { ...followup,
  observations: followup.observations.map(item => ({ ...item, sourceStoryKey: item.storyKey,
    storyKey: storyId(item.storyKey), textBasis: 'paraphrase' })),
  coverage: followup.coverage.map(item => ({ ...item, storyKey: storyId(item.storyKey) })),
  normalizationNote: 'Cluster keys mapped to existing story identities. Text consists of investigator paraphrases, not post edits.' };
validateSocialBatch(baseline);
validateSocialBatch(current);
for (const [filename, data] of Object.entries({ 'baseline-batch.json': baseline, 'followup-batch.json': current })) {
  await writeFile(path.join(here, filename), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ baselineObservations: baseline.observations.length, currentObservations: current.observations.length }));
