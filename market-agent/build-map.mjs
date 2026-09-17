import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { makeDecisionRecord } from './ideas.mjs';
import { parseInstant } from './sightings.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const workspace = await realpath(path.join(here, '..'));
const filenames = ['concepts.json', 'map-social.json', 'map-market.json', 'idea-map-template.html', 'ideas.mjs', 'sightings.mjs'];
const contents = await Promise.all(filenames.map(name => readFile(path.join(here, name), 'utf8')));
const [catalog, social, market] = contents.slice(0, 3).map(JSON.parse);
const template = contents[3], decisions = makeDecisionRecord(catalog);
const sourceById = new Map(social.evidence.map(e => [e.id, e]));
const marketById = new Map(market.nodes.map(n => [n.id, n]));
const clusterById = new Map(social.clusters.map(c => [c.id, c]));
const decisionById = new Map(decisions.stories.flatMap(s => s.decisions.map(d => [d.ideaId, d])));
const shortTitles = { 'ai-stocks': 'IA / pre-IPO', 'stocks-dkng': 'Stocks / DKNG', steel: 'Steel / personaje',
  acme: 'ACME / sátira', 'fly-retrospective': 'La mosca / caso' };
const buildLabels = { hours: 'Horas', days: 'Días', unknown: 'Por estimar' };

function safeUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Evidence requires a public HTTPS URL');
  return url.href;
}
function sourceLinks(ids = []) {
  return ids.map(id => {
    const e = sourceById.get(id);
    if (!e) throw new Error(`Unknown evidence id ${id}`);
    return { label: `${e.author} · ${e.publishedAt?.slice(0, 10) ?? e.publishedDate ?? 'fecha pendiente'}`, url: safeUrl(e.url) };
  });
}
function tokenLinks(ids = []) {
  return ids.map(id => {
    const t = marketById.get(id);
    if (!t) throw new Error(`Unknown market node ${id}`);
    return { label: `${t.symbol} / ${t.quote} · pool observado, no validación de esta idea`, url: safeUrl(t.sourceUrl) };
  });
}
const localEvidence = new Map();
async function localSources(files = []) {
  const links = [];
  for (const file of files) {
    const target = await realpath(path.resolve(workspace, file));
    const relative = path.relative(workspace, target);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Local evidence must stay inside this workspace');
    }
    if (!localEvidence.has(relative)) localEvidence.set(relative, await readFile(target, 'utf8'));
    links.push({ label: `Evidencia local · ${relative}`, url: null });
  }
  return links;
}
const stories = [];
async function localJson(file) {
  await localSources([file]);
  const key = path.relative(workspace, await realpath(path.resolve(workspace, file)));
  return JSON.parse(localEvidence.get(key));
}
if (catalog.sightingsFile) {
  const sightings = await localJson(catalog.sightingsFile);
  for (const story of catalog.stories) {
    const state = sightings.states?.find(item => item.storyKey === story.id);
    if (!state || state.firstSeenAt !== story.firstSeenAt) throw new Error(`Sighting record does not match ${story.id}`);
  }
}
if (catalog.researchFiles) await localSources(catalog.researchFiles);
let followup = null;
if (catalog.followupFile) {
  followup = await localJson(catalog.followupFile);
  const report = await localJson(followup.changeReportFile);
  await localSources([followup.batchFile]);
  if (followup.version !== 1 || !Array.isArray(followup.summaries)
    || parseInstant(followup.observedAt) !== parseInstant(report.recordedAt)
    || parseInstant(followup.reviewedAt) < parseInstant(followup.observedAt)
    || parseInstant(followup.reviewedAt) > Date.now()) throw new Error('Invalid follow-up review chronology');
  const seen = new Set();
  for (const summary of followup.summaries) {
    if (seen.has(summary.storyId) || !catalog.stories.some(story => story.id === summary.storyId)) throw new Error('Unknown or duplicate follow-up story');
    seen.add(summary.storyId);
    for (const source of summary.sources) safeUrl(source.url);
  }
}
for (const story of catalog.stories) {
  const cluster = clusterById.get(story.clusterId);
  if (!cluster && story.mode !== 'retrospective') throw new Error(`Missing social cluster ${story.clusterId}`);
  const evidence = sourceLinks(story.sourceEvidenceIds);
  for (const url of story.sourceUrls ?? []) {
    const href = safeUrl(url);
    if (!evidence.some(e => e.url === href)) evidence.push({ label: new URL(href).hostname + ' · referencia del caso', url: href });
  }
  const interpretations = [];
  for (const idea of story.interpretations) {
    interpretations.push({ ...idea, decision: decisionById.get(idea.id), buildLabel: buildLabels[idea.buildEstimate] ?? 'Por estimar',
      evidence: [...sourceLinks(idea.basisEvidenceIds), ...await localSources(idea.basisSourceFiles)],
      marketEvidence: tokenLinks(idea.relatedMarketNodeIds) });
  }
  stories.push({ ...story, shortTitle: story.shortTitle ?? shortTitles[story.clusterId] ?? story.title,
    summary: cluster?.news ?? 'Caso aportado por el usuario y contrastado con los documentos locales del experimento y del competidor. Las interpretaciones se redactaron ahora.',
    meme: cluster?.meme, gap: cluster?.gap?.text,
    rootNote: story.mode === 'retrospective' ? 'Caso retrospectivo · origen y primeras fechas pendientes'
      : 'Abrir fuente · evidencia con fecha', evidence, interpretations });
}
const data = { version: 2, generatedAt: catalog.generatedAt, sourceObservedAt: social.observedAt,
  selectedStoryId: catalog.selectedStoryId ?? stories[0].id, stories, followup };
if (!stories.some(story => story.id === data.selectedStoryId)) throw new Error('Unknown selectedStoryId');
if (!template.includes('__MAP_DATA__')) throw new Error('Missing template marker');
const html = template.replace('__MAP_DATA__', () => JSON.stringify(data).replace(/</g, '\\u003c'));
const recordedAt = new Date().toISOString();
const stamp = recordedAt.replace(/[:.]/g, '-');
const outputRoot = path.join(workspace, 'output', 'market-agent');
const archive = path.join(outputRoot, `ideas-${stamp}-${randomUUID()}`);
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(outputRoot, 'radar-map.html');
async function resolvedDestination(target) {
  try { return await realpath(target); }
  catch (error) {
    if (error.code !== 'ENOENT' || path.dirname(target) === target) throw error;
    return path.join(await resolvedDestination(path.dirname(target)), path.basename(target));
  }
}
const destination = await resolvedDestination(outputPath);
const archiveRelativePath = path.relative(outputRoot, destination);
if (path.extname(outputPath).toLowerCase() !== '.html' || path.extname(destination).toLowerCase() !== '.html') {
  throw new Error('Visualization output must be an HTML file');
}
if (!path.isAbsolute(archiveRelativePath) && /^ideas-[^\\/]+(?:[\\/]|$)/i.test(archiveRelativePath)) {
  throw new Error('Cannot write visualization inside an archived ideas record');
}
const hash = content => createHash('sha256').update(content).digest('hex');
const provenance = { recordedAt, generatedAt: catalog.generatedAt, executionAuthorized: false,
  inputs: filenames.map((file, i) => ({ file, sha256: hash(contents[i]) })),
  localEvidence: [...localEvidence].map(([file, content]) => ({ file, sha256: hash(content) })),
  note: 'Hashes detect changes against this record; this is a local timestamp, not independently notarized priority.' };
await mkdir(outputRoot, { recursive: true });
await mkdir(archive);
for (const [name, value] of Object.entries({ 'concepts.json': catalog, 'decisions.json': decisions,
  'sources.json': { social, market, local: Object.fromEntries(localEvidence) }, 'provenance.json': provenance })) {
  await writeFile(path.join(archive, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' });
}
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, 'utf8');
await writeFile(path.join(here, 'map-data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ outputPath, archive, recordedAt, stories: stories.length,
  ideas: stories.reduce((count, story) => count + story.interpretations.length, 0), bytes: Buffer.byteLength(html) }));
