import { readFile, readdir, mkdir, writeFile, open, unlink, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const root = fileURLToPath(new URL('../output/market-agent/sightings/', import.meta.url));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function instant(value) {
  const parts = typeof value === 'string' && value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  if (!parts || !Number.isFinite(Date.parse(value))) {
    throw new Error('A valid timestamp with timezone is required');
  }
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new Error('A valid timestamp with timezone is required');
  }
  return Date.parse(value);
}

export { instant as parseInstant, recordingTime as nextRecordingTime };

export function sourceKey(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Source must be a public HTTPS URL');
  const post = /^\/(?:[^/]+\/status|i\/web\/status)\/(\d+)(?=\/|$)/.exec(url.pathname);
  if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) && post) return `x:${post[1]}`;
  url.hash = '';
  // Tracking parameters do not create a new source; preserve semantic query parameters.
  for (const name of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/.test(name)) url.searchParams.delete(name);
  url.searchParams.sort();
  return url.href;
}

export function mergeSightings(previous, observations, recordedAt) {
  const now = instant(recordedAt);
  if (!Array.isArray(previous) || !Array.isArray(observations) || !observations.length) throw new Error('Nonempty observations are required');
  const states = new Map(previous.map(item => [item.storyKey, structuredClone(item)]));
  for (const item of observations) {
    if (!nonempty(item.storyKey) || !nonempty(item.title)) throw new Error('Each observation requires storyKey and title');
    if (!['new_to_radar', 'known_before_tracking'].includes(item.context)) throw new Error('Observation context is required');
    const seen = instant(item.observedAt);
    if (seen > now) throw new Error('Observation cannot be later than the record');
    const published = item.publishedAt === null ? null : instant(item.publishedAt);
    if (published !== null && published > seen) throw new Error('Publication cannot be later than the observation');
    const key = sourceKey(item.sourceUrl), before = states.get(item.storyKey);
    if (before && seen < instant(before.lastObservedAt)) throw new Error('Historical observations must not overwrite a newer record');
    const known = item.context === 'known_before_tracking' || before?.knownBeforeTracking === true;
    const firstSeenAt = known ? null : before?.firstSeenAt ?? item.observedAt;
    const sources = [...new Set([...(before?.sourceKeys ?? []), key])];
    states.set(item.storyKey, { storyKey: item.storyKey, title: item.title, firstSeenAt,
      firstRecordedAt: before?.firstRecordedAt ?? recordedAt, lastObservedAt: item.observedAt,
      knownBeforeTracking: known, sourceKeys: sources,
      note: known ? 'Known before this tracking series; original discovery time remains unknown.'
        : 'First sighting recorded by this radar, not global discovery or the first token launch.' });
  }
  return [...states.values()];
}

async function readLatest(directory) {
  let names;
  try { names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!names.length) return null;
  const record = JSON.parse(await readFile(path.join(directory, names.at(-1)), 'utf8'));
  if (record.version !== 1 || !Array.isArray(record.states)) throw new Error('Invalid previous sighting record');
  instant(record.recordedAt);
  return record;
}

function recordingError(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

async function recordingTime(previous) {
  const before = previous ? instant(previous.recordedAt) : -Infinity;
  // Filename ordering must follow commits, even for two writes in one millisecond.
  // Wait for an actual clock tick rather than inventing a future recordedAt.
  if (Date.now() === before) await delay(1);
  const now = Date.now();
  if (now <= before) throw recordingError('SIGHTINGS_CLOCK_NOT_ADVANCED', 'Local time must advance past the previous record; retry explicitly once the clock is corrected.');
  return new Date(now).toISOString();
}

export async function recordSightings(observations, { directory = root } = {}) {
  const destination = path.resolve(directory);
  await mkdir(destination, { recursive: true });
  const lockPath = path.join(destination, '.writer.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw recordingError('SIGHTINGS_BUSY', 'A writer or interrupted writer owns the lock. Retry explicitly after it finishes; inspect a persistent lock before removing it.');
    throw error;
  }
  let temporary;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }) + '\n');
    const previous = await readLatest(destination);
    const recordedAt = await recordingTime(previous);
    const states = mergeSightings(previous?.states ?? [], observations, recordedAt);
    const file = path.join(destination, `${recordedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`);
    const record = { version: 1, recordedAt, scope: 'curated sources observed by this radar', observations, states };
    temporary = file + '.tmp';
    await writeFile(temporary, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' });
    await rename(temporary, file);
    temporary = undefined;
    return { file, ...record };
  } finally {
    try {
      if (temporary) await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    } finally {
      try { await lock.close(); } finally { await unlink(lockPath); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node market-agent/sightings.mjs observations.json');
  const observations = JSON.parse(await readFile(path.resolve(process.argv[2]), 'utf8'));
  const record = await recordSightings(observations);
  console.log(JSON.stringify({ file: record.file, stories: record.states.length, recordedAt: record.recordedAt }));
}
