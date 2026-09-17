import { mkdir, readFile, writeFile, open, unlink, rename, readdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectMarket } from './collect.mjs';
import { codexModel } from './scout-model.mjs';
import { discoverySchema, reviewSchema } from './scout-schema.mjs';
import { validateDiscovery, marketContext, buildScoutResult } from './scout-evidence.mjs';
import { discoveryPrompt, reviewPrompt } from './scout-prompts.mjs';
import { renderScout, scoutReport } from './scout-render.mjs';
import { readLatestSocial } from './social-history.mjs';
import { sourceKey, parseInstant } from './sightings.mjs';

const defaultRoot = fileURLToPath(new URL('../output/market-agent/autonomous/', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = text => createHash('sha256').update(text).digest('hex');
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }

export async function latestScout(root = defaultRoot) {
  let pointer;
  try { pointer = await readJson(path.join(root, 'latest.json')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!/^run-[a-zA-Z0-9-]+$/.test(pointer.folder)) throw new Error('Invalid latest run pointer');
  const folder = path.join(root, pointer.folder), manifest = await readJson(path.join(folder, 'manifest.json'));
  if (manifest.status !== 'COMPLETE') throw new Error('Latest run is not complete');
  const content = await readFile(path.join(folder, 'result.json'), 'utf8');
  if (manifest.files['result.json'] !== hash(content)) throw new Error('Latest result hash mismatch');
  return { folder, manifest, result: JSON.parse(content) };
}

export async function refreshScoutView(root = defaultRoot) {
  const latest = await latestScout(root);
  if (!latest) throw new Error('No completed scout run');
  const destination = path.join(root, 'latest-map.html'), temp = path.join(root, `view-${randomUUID()}.tmp`);
  await writeFile(temp, await renderScout(latest.result), { flag: 'wx' });
  await rename(temp, destination);
  return destination;
}

async function initialMemory() {
  const catalog = await readJson(new URL('./concepts.json', import.meta.url));
  const history = await readLatestSocial();
  return { stories: catalog.stories.map(s => ({ id: s.id, title: s.title,
    ideas: s.interpretations.map(i => ({ title: i.title, pitch: i.pitch })) })),
    sources: (history?.state.observations ?? []).map(s => ({ key: sourceKey(s.sourceUrl), url: s.sourceUrl,
      firstSeenAt: s.firstObservedAt ?? s.observedAt, lastSeenAt: s.observedAt })) };
}

export async function runScout({ root = defaultRoot, focus = 'Noticias y memes emergentes: tecnología, stocks, cultura y conversaciones en X.',
  model = codexModel, collect = collectMarket, seedMemory = initialMemory, now = () => new Date().toISOString(), onProgress = () => {} } = {}) {
  if (typeof focus !== 'string' || !focus.trim() || focus.length > 2000) throw new Error('Focus must contain 1..2000 characters');
  await mkdir(root, { recursive: true });
  const lockFile = path.join(root, '.writer.lock');
  let lock;
  try { lock = await open(lockFile, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw new Error('SCOUT_BUSY'); throw error; }
  let directory, stage = 'initializing';
  try {
    await lock.writeFile(json({ pid: process.pid, startedAt: now() }));
    const previous = await latestScout(root), seed = previous ? null : await seedMemory();
    const startedAt = now();
    if (previous && parseInstant(startedAt) < parseInstant(previous.manifest.completedAt)) throw new Error('Clock moved backwards');
    const name = `run-${startedAt.replace(/[:.]/g, '-')}-${randomUUID()}`;
    directory = path.join(root, name); await mkdir(directory);
    const memory = previous ? { stories: previous.result.map.stories.map(s => ({ id: s.id, title: s.title,
      ideas: s.interpretations.map(i => ({ title: i.title, pitch: i.pitch, disposition: i.decision.status })) })),
      sources: previous.result.sources } : seed;
    // Limit model context; preserve all remembered source clocks in the result, including absent sources.
    const context = { stories: memory.stories.slice(-15), sources: memory.sources.slice(-40) };
    await writeFile(path.join(directory, 'request.json'), json({ startedAt, focus, previousRun: previous?.folder ?? null, memory: context }), { flag: 'wx' });
    stage = 'discovery'; onProgress({ stage });
    const discovery = await model({ stage, prompt: discoveryPrompt({ now: startedAt, focus, memory: context }),
      schema: discoverySchema, directory, search: true, onProgress });
    const observedAt = now(); validateDiscovery(discovery.output, observedAt);
    await writeFile(path.join(directory, 'discovery.json'), json({ observedAt, ...discovery }), { flag: 'wx' });
    stage = 'market'; onProgress({ stage });
    const queries = [...new Set(discovery.output.stories.flatMap(s => s.queries))];
    const raw = queries.length ? await collect({ queries, limit: 1 }) : { observedAt: now(), searches: [], requests: [], errors: [], coverage: ['No proposals; no market queries needed.'] };
    await writeFile(path.join(directory, 'market.json'), json(raw), { flag: 'wx' });
    stage = 'review'; onProgress({ stage });
    const review = queries.length ? await model({ stage, prompt: reviewPrompt(discovery.output, marketContext(raw)),
      schema: reviewSchema, directory, search: false, onProgress })
      : { output: { summary: discovery.output.abstentionReason, reviews: [] }, provenance: { stage, skipped: 'No proposals' } };
    await writeFile(path.join(directory, 'review.json'), json(review), { flag: 'wx' });
    const completedAt = now();
    const result = buildScoutResult(discovery.output, review.output, raw, { observedAt, completedAt, previousSources: memory.sources });
    stage = 'persisting'; onProgress({ stage });
    const outputs = { 'result.json': json(result), 'map-data.json': json(result.map), 'map.html': await renderScout(result),
      'REPORT.md': scoutReport(result) };
    for (const [file, content] of Object.entries(outputs)) await writeFile(path.join(directory, file), content, { flag: 'wx' });
    const files = {};
    for (const name of await readdir(directory)) files[name] = hash(await readFile(path.join(directory, name)));
    const manifest = { version: 1, status: 'COMPLETE', startedAt, completedAt, files,
      stages: [discovery.provenance, review.provenance], executionAuthorized: false, continuousMonitoring: false };
    await writeFile(path.join(directory, 'manifest.json'), json(manifest), { flag: 'wx' });
    const pointer = path.join(root, `latest-${randomUUID()}.tmp`);
    await writeFile(pointer, json({ folder: name, completedAt }), { flag: 'wx' });
    await rename(pointer, path.join(root, 'latest.json'));
    return { folder: directory, manifest, result };
  } catch (error) {
    if (directory) await writeFile(path.join(directory, 'failure.json'), json({ status: 'FAILED', stage, observedAt: now(),
      reason: error.message, latestSuccessfulRunPreserved: true }), { flag: 'wx' });
    throw error;
  } finally { await lock.close(); await unlink(lockFile); }
}

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args[0] === '--help') {
    console.log('node market-agent/scout.mjs status\nnode market-agent/scout.mjs view\nnode market-agent/scout.mjs run [--focus "text"]\nUses existing Codex CLI login and account usage. One bounded research pass; no token execution or scheduler.'); return;
  }
  if (args[0] === 'view' && args.length === 1) { console.log(json({ map: await refreshScoutView() })); return; }
  if (args[0] === 'status' && args.length === 1) {
    const latest = await latestScout();
    console.log(json({ runtime: 'codex-cli', authentication: 'Run codex -c model_reasoning_effort=high login status to check without reading secrets',
      continuousMonitoring: false, latest: latest?.folder ?? null, completedAt: latest?.manifest.completedAt ?? null })); return;
  }
  if (args[0] !== 'run' || !(args.length === 1 || (args.length === 3 && args[1] === '--focus'))) throw new Error('Use run [--focus text] or status');
  const run = await runScout({ ...(args[2] ? { focus: args[2] } : {}), onProgress: event => console.log(json({ ...event, at: new Date().toISOString() }).trim()) });
  console.log(json({ status: 'COMPLETE', folder: run.folder, stories: run.result.map.stories.length,
    ideas: run.result.map.stories.reduce((n, s) => n + s.interpretations.length, 0), executionAuthorized: false }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(json({ status: 'FAILED', reason: error.message })); process.exitCode = 1; });
}
