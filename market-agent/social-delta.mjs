import { parseInstant, sourceKey } from './sightings.mjs';

const COVERAGE = new Set(['observed', 'unavailable', 'not_checked']);
const TEXT_BASES = new Set(['verbatim', 'paraphrase', 'unknown']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const identity = item => JSON.stringify([item.storyKey, item.sourceKey]);
const chronological = value => new Date(parseInstant(value)).toISOString();

function observation(value, recordedAt) {
  if (!object(value)) throw new Error('Each observation must be an object');
  for (const field of ['storyKey', 'sourceUrl', 'author', 'kind']) {
    if (!text(value[field])) throw new Error(`Observation requires ${field}`);
  }
  if (typeof value.text !== 'string') throw new Error('Observation text must be a string');
  const key = sourceKey(value.sourceUrl);
  if (value.sourceKey !== undefined && value.sourceKey !== key) throw new Error('Source key does not match URL');
  const observedAt = chronological(value.observedAt);
  const publishedAt = value.publishedAt === null ? null : chronological(value.publishedAt);
  const firstObservedAt = chronological(value.firstObservedAt ?? value.observedAt);
  if (parseInstant(observedAt) > recordedAt) throw new Error('Observation cannot be later than record');
  if (publishedAt !== null && parseInstant(publishedAt) > parseInstant(observedAt)) {
    throw new Error('Publication cannot be later than observation');
  }
  if (parseInstant(firstObservedAt) > parseInstant(observedAt)) throw new Error('First observation cannot be later than latest observation');
  if (publishedAt !== null && parseInstant(firstObservedAt) < parseInstant(publishedAt)) throw new Error('First observation cannot precede publication');
  const textBasis = value.textBasis ?? 'unknown';
  if (!TEXT_BASES.has(textBasis)) throw new Error('Invalid textBasis');
  let metrics;
  if (value.metrics !== undefined && value.metrics !== null) {
    if (!object(value.metrics)) throw new Error('Metrics must be an object of finite numbers or null');
    const entries = Object.entries(value.metrics).sort(([a], [b]) => a.localeCompare(b));
    if (entries.some(([key, number]) => !text(key)
      || (number !== null && (typeof number !== 'number' || !Number.isFinite(number))))) {
      throw new Error('Metrics must be an object of finite numbers or null');
    }
    metrics = Object.fromEntries(entries);
  }
  return { storyKey: value.storyKey, sourceKey: key, sourceUrl: value.sourceUrl,
    author: value.author, publishedAt, observedAt, firstObservedAt, text: value.text,
    kind: value.kind, textBasis, ...(metrics === undefined ? {} : { metrics }) };
}

function sameReading(a, b) {
  return ['author', 'publishedAt', 'text', 'kind', 'textBasis'].every(field => a[field] === b[field])
    && JSON.stringify(a.metrics ?? {}) === JSON.stringify(b.metrics ?? {});
}

/** Returns a normalized, deduplicated copy; it never mutates the supplied batch. */
export function validateSocialBatch(batch) {
  if (!object(batch) || batch.version !== 1) throw new Error('Social batch version must be 1');
  const recordedAt = chronological(batch.recordedAt);
  if (!Array.isArray(batch.observations) || !Array.isArray(batch.coverage)) {
    throw new Error('Social batch requires observations and coverage arrays');
  }
  const observations = new Map();
  for (const value of batch.observations) {
    const item = observation(value, parseInstant(recordedAt));
    const key = identity(item), before = observations.get(key);
    if (!before) { observations.set(key, item); continue; }
    if (item.observedAt === before.observedAt && !sameReading(item, before)) {
      throw new Error(`Conflicting observations at the same time: ${key}`);
    }
    const latest = item.observedAt > before.observedAt ? item : before;
    observations.set(key, { ...latest, firstObservedAt: item.firstObservedAt < before.firstObservedAt
      ? item.firstObservedAt : before.firstObservedAt });
  }
  const coverage = new Map();
  for (const item of batch.coverage) {
    if (!object(item) || !text(item.storyKey) || !COVERAGE.has(item.status) || typeof item.note !== 'string') {
      throw new Error('Coverage requires storyKey, valid status and note');
    }
    const before = coverage.get(item.storyKey);
    if (before && (before.status !== item.status || before.note !== item.note)) {
      throw new Error(`Conflicting coverage: ${item.storyKey}`);
    }
    coverage.set(item.storyKey, { storyKey: item.storyKey, status: item.status, note: item.note });
  }
  return { version: 1, recordedAt, observations: [...observations.values()]
    .sort((a, b) => identity(a).localeCompare(identity(b))), coverage: [...coverage.values()] };
}

function metricDeltas(before, current) {
  return Object.fromEntries(Object.entries(current.metrics ?? {}).map(([key, value]) => {
    const previous = Object.hasOwn(before.metrics ?? {}, key) ? before.metrics[key] : null;
    return [key, { previous, current: value, delta: previous === null || value === null ? null : value - previous }];
  }));
}

/** Differences are review candidates within this memory, never proof of an opportunity. */
export function compareSocialBatches(previous, current) {
  const prior = previous === null ? null : validateSocialBatch(previous);
  const batch = validateSocialBatch(current);
  if (prior && batch.recordedAt < prior.recordedAt) throw new Error('Record cannot move backward in time');
  const previousSources = new Map((prior?.observations ?? []).map(item => [identity(item), item]));
  const nextSources = new Map(previousSources);
  const knownStories = new Set((prior?.observations ?? []).map(item => item.storyKey));
  const sourceStories = new Map();
  for (const item of prior?.observations ?? []) {
    if (!sourceStories.has(item.sourceKey)) sourceStories.set(item.sourceKey, new Set());
    sourceStories.get(item.sourceKey).add(item.storyKey);
  }
  const changes = [], newStories = new Set(), observedKeys = new Set();
  for (const item of batch.observations) {
    const key = identity(item), before = previousSources.get(key);
    observedKeys.add(key);
    const event = type => ({ type, storyKey: item.storyKey, sourceKey: item.sourceKey,
      sourceUrl: item.sourceUrl, observedAt: item.observedAt,
      author: item.author, text: item.text, kind: item.kind, textBasis: item.textBasis,
      reviewCandidate: type !== 'REOBSERVED', opportunityValidated: false });
    if (before) {
      if (item.observedAt < before.observedAt) throw new Error(`Source observation cannot move backward: ${key}`);
      if (item.observedAt === before.observedAt && !sameReading(item, before)) {
        throw new Error(`Conflicting observations at the same time: ${key}`);
      }
      changes.push({ ...event('REOBSERVED'), previousObservedAt: before.observedAt,
        metricDeltas: metricDeltas(before, item) });
      if (before.textBasis === 'verbatim' && item.textBasis === 'verbatim' && before.text !== item.text) {
        changes.push({ ...event('CONTENT_CHANGED'), previousText: before.text, currentText: item.text,
          note: 'Two verbatim readings differ; the cause requires review.' });
      }
      nextSources.set(key, { ...item, firstObservedAt: before.firstObservedAt });
      continue;
    }
    const newStory = !knownStories.has(item.storyKey) && !newStories.has(item.storyKey);
    if (newStory) {
      newStories.add(item.storyKey);
      changes.push({ ...event('NEW_STORY'), note: 'First story in the compared memory, not global discovery.' });
    }
    const associatedStoryKeys = [...(sourceStories.get(item.sourceKey) ?? [])]
      .filter(storyKey => storyKey !== item.storyKey).sort();
    if (associatedStoryKeys.length) {
      changes.push({ ...event('NEW_ASSOCIATION'), previousStoryKeys: associatedStoryKeys,
        note: 'An existing source is now associated with another story.' });
    } else if (!newStory) {
      changes.push({ ...event('NEW_SOURCE'), note: 'Another canonical source in a story already in this memory or pass.' });
    }
    nextSources.set(key, item);
  }
  const coverageByStory = new Map(batch.coverage.map(item => [item.storyKey, item]));
  const missing = [...previousSources.entries()].filter(([key]) => !observedKeys.has(key)).map(([, item]) => ({
    type: 'NOT_OBSERVED_IN_THIS_PASS', storyKey: item.storyKey, sourceKey: item.sourceKey,
    sourceUrl: item.sourceUrl, lastObservedAt: item.observedAt,
    coverageStatus: coverageByStory.get(item.storyKey)?.status ?? 'not_checked',
    note: coverageByStory.get(item.storyKey)?.note ?? 'No coverage supplied for this story in this pass.',
  }));
  const nextState = { version: 1, recordedAt: batch.recordedAt,
    observations: [...nextSources.values()].sort((a, b) => identity(a).localeCompare(identity(b))),
    coverage: structuredClone(batch.coverage) };
  return { version: 1, recordedAt: batch.recordedAt, changes, missing,
    coverage: batch.coverage, needsReview: changes.some(item => item.reviewCandidate), nextState };
}
