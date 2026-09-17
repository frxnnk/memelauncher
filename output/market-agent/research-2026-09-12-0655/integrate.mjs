import { readFile, writeFile, mkdir, readdir, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mergeSightings, recordSightings, sourceKey } from '../../../market-agent/sightings.mjs';
import { validateCatalog } from '../../../market-agent/ideas.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const workspace = path.resolve(here, '../../..');
const modulePath = path.join(workspace, 'market-agent');
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const [x, news, check, catalog, oldCatalog, oldSocial, oldMarket] = await Promise.all([
  read(path.join(here, 'x-discovery.json')), read(path.join(here, 'news-discovery.json')),
  read(path.join(here, 'market-check.json')), read(path.join(here, 'concepts-next.json')),
  read(path.join(modulePath, 'concepts.json')), read(path.join(modulePath, 'map-social.json')),
  read(path.join(modulePath, 'map-market.json')),
]);
const backup = path.join(here, 'before-integration');
const evidence = structuredClone(x.evidence);
Object.assign(evidence.find(e => e.id === 'reuters-nvda-talks-parent'), {
  publishedAt: '2026-09-11T22:59:00Z', publishedAtPrecision: 'minute',
  observedAt: null, verification: 'Parent opened Reuters dispatch; exact first-read second not recorded.',
  paraphrase: 'Reuters informa conversaciones para que Nvidia participe en el IPO de Anthropic. No hay acuerdo final; las empresas ya tenían una relación anterior.',
});
evidence.push({
  id: 'nvda-prior-commitment-10q', kind: 'company-filing', author: 'NVIDIA · Form 10-Q',
  url: 'https://s201.q4cdn.com/141608511/files/doc_financials/2026/q3/13e6981b-95ed-4aac-a602-ebc5865d0590.pdf',
  publishedAt: null, publishedDate: '2025-11', observedAt: null,
  paraphrase: 'El informe registra un acuerdo de noviembre de 2025, sujeto a condiciones, para invertir hasta USD 10 mil millones en Anthropic. Es antecedente, no confirmación del IPO actual.',
  verification: 'Documento primario, nota 11, página 18. Leído por el agente principal; segundo exacto de lectura no registrado.',
});
const box = news.seeds.find(seed => seed.id === 'box-on-wheels-announcement');
evidence.push({
  id: 'stellantis-box-on-wheels', kind: 'official-announcement', author: 'Stellantis / UQI',
  url: box.primarySource.url, publishedAt: null, publishedDate: '2026-09-11',
  publishedAtPrecision: 'day', observedAt: box.primarySource.observedAt,
  verification: 'Comunicado oficial leído; segunda lectura del agente principal el 12/9 a las 07:10 UTC.',
  paraphrase: 'Stellantis y UQI anuncian una prueba de concepto de reparto autónomo. La presentación y demostración pública se anuncian para el 14 de septiembre; todavía no se observaron.',
});
const clusters = [
  { id: 'u2-resurfacing', title: 'U2 / nostalgia digital',
    news: 'PopBase vuelve a poner en circulación el recuerdo de Songs of Innocence en iTunes. Es una reactivación cultural de un episodio histórico.',
    meme: 'Dos respuestas propias recuerdan un regalo no pedido y la dificultad de borrarlo. No verifican malware ni una imposibilidad técnica universal.',
    gap: { status: 'hipótesis', text: 'Transformar el recuerdo en un personaje intruso con un gesto propio. La búsqueda parcial no demuestra que esa identidad esté libre ni que haya demanda de un token.' },
    evidenceIds: ['x-u2-recall', 'x-u2-unasked-gift', 'x-u2-thought-virus'], assetNodeIds: [] },
  { id: 'box-on-wheels', title: 'La caja / reparto autónomo',
    news: 'Stellantis y UQI anuncian Box-on-Wheels, una prueba de concepto de logística autónoma con demostración prevista para el 14/9.',
    meme: 'No se midió una expresión social de esta noticia. La caja que persigue a su destinatario es una interpretación propuesta por el agente.',
    gap: { status: 'hipótesis', text: 'Hay margen de calendario antes de la demostración anunciada. Falta probar una personalidad o acción distinta de otros robots de reparto; el calendario no acredita ventaja de mercado.' },
    evidenceIds: ['stellantis-box-on-wheels'], assetNodeIds: ['boxcat-adjacent', 'amazon-box-adjacent'] },
  { id: 'nvidia-ipo', title: 'Nvidia / proveedor e inversor',
    news: 'Reuters reporta conversaciones para que Nvidia invierta en el IPO de Anthropic. El vínculo entre ambas empresas ya existía; no es un acuerdo cerrado.',
    meme: 'En el hilo aparecen lecturas de financiación circular y del doble rol proveedor/inversor. Las respuestas observadas tienen poco alcance y no prueban adopción amplia.',
    gap: { status: 'reformular', text: 'Comparar un vendedor que cambia de mostrador. Repetir el círculo de dinero no aporta novedad por sí solo y puede representar flujos no documentados.' },
    evidenceIds: ['x-nvda-talks', 'reuters-nvda-talks-parent', 'nvda-prior-commitment-10q', 'x-nvda-expensive-loop', 'x-nvda-financing-steps'], assetNodeIds: ['anthropig'] },
];
const social = { schemaVersion: 1, observedAt: '2026-09-12T07:00:00Z',
  observationWindowUtc: ['2026-09-12T06:57:06.419Z', '2026-09-12T07:00:00Z'],
  method: 'Lectura puntual de X y fuentes primarias; revisión adicional de documentos por el agente principal. No es un feed continuo ni censo de narrativas.',
  metricsCaveat: 'Contadores visibles en X, con la hora de cada evidencia. No representan autores únicos, organicidad ni demanda de tokens; no se suman audiencias.',
  clusters, evidence, researchFiles: ['x-discovery.json', 'news-discovery.json', 'market-check.json'],
};
const normalizePool = (pool, id = pool.id, observedAt = pool.observedAt) => ({
  ...pool, id, quote: pool.quote.symbol, quoteName: pool.quote.name,
  quoteContract: pool.quote.contract, observedAt,
});
const poolMap = new Map(oldMarket.nodes.map(node => [node.id, node]));
for (const pool of check.pools) poolMap.set(pool.id, normalizePool(pool));
for (const [index, id] of ['boxcat-adjacent', 'amazon-box-adjacent'].entries()) {
  poolMap.set(id, normalizePool(check.followup.adjacentCompetitors[index], id, '2026-09-12T06:59:22.937Z'));
}
const firstScan = await read(check.rawScanPath);
const market = { ...oldMarket, currentObservedAt: check.followup.observedAt,
  collectionStartedAt: firstScan.requests[0]?.observedAt ?? null, scanFile: check.rawScanPath, nodes: [...poolMap.values()],
  followupScanFile: check.followup.rawScanPath, keywordCompetition: check.followup.keywordCompetition,
  coverage: check.limits, queryAmbiguities: check.followup.interpretationNotes,
  note: 'Cada pool conserva su propia fecha. Homónimos y resultados parciales no se convierten en competidores directos. Primer lanzamiento desconocido.',
};
// Archived catalog generation is not an observation. Only timed source readings enter the ledger.
const observations = [];
validateCatalog({ ...catalog, evidence });
const evidenceIds = new Set(evidence.map(item => item.id));
if (evidenceIds.size !== evidence.length) throw new Error('Duplicate evidence id');
for (const item of evidence) sourceKey(item.url);
const requireEvidence = id => {
  if (!evidenceIds.has(id)) throw new Error(`Missing evidence ${id}`);
};
const requirePool = id => {
  if (!poolMap.has(id)) throw new Error(`Missing pool ${id}`);
};
for (const signal of x.signals) {
  if (!Array.isArray(signal.newsEvidenceIds) || !signal.newsEvidenceIds.length) {
    throw new Error(`Signal requires news evidence: ${signal.id}`);
  }
  for (const id of [...signal.newsEvidenceIds, ...(signal.expressionEvidenceIds ?? [])]) requireEvidence(id);
  observations.push({ storyKey: signal.id, title: signal.title, context: 'new_to_radar',
    sourceUrl: evidence.find(item => item.id === signal.newsEvidenceIds[0]).url,
    publishedAt: signal.publishedAt, observedAt: signal.firstSeenAt });
}
observations.push({ storyKey: box.id, title: box.title, context: 'new_to_radar',
  sourceUrl: box.primarySource.url, publishedAt: null, observedAt: box.firstObservedByThisRadarPassAt });
if (new Set(observations.map(item => item.storyKey)).size !== observations.length) throw new Error('Duplicate incoming signal id');
if (catalog.selectedStoryId && !catalog.stories.some(story => story.id === catalog.selectedStoryId)) {
  throw new Error(`Missing selected story ${catalog.selectedStoryId}`);
}
for (const cluster of clusters) {
  cluster.evidenceIds.forEach(requireEvidence);
  cluster.assetNodeIds.forEach(requirePool);
}
const localReferences = new Set([check.rawScanPath, check.followup.rawScanPath]);
for (const story of catalog.stories) {
  if (!clusters.some(cluster => cluster.id === story.clusterId)) throw new Error(`Missing cluster ${story.clusterId}`);
  for (const id of [...story.sourceEvidenceIds, ...story.interpretations.flatMap(idea => idea.basisEvidenceIds ?? [])]) requireEvidence(id);
  for (const url of story.sourceUrls ?? []) sourceKey(url);
  for (const idea of story.interpretations) {
    (idea.relatedMarketNodeIds ?? []).forEach(requirePool);
    (idea.basisSourceFiles ?? []).forEach(file => localReferences.add(file));
  }
}
const realWorkspace = await realpath(workspace);
for (const file of localReferences) {
  const resolved = await realpath(path.resolve(workspace, file));
  const relative = path.relative(realWorkspace, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
    || !(await stat(resolved)).isFile()) throw new Error(`Invalid local reference ${file}`);
}
observations.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
const incomingStates = mergeSightings([], observations, catalog.generatedAt);
const sightingsDirectory = path.join(workspace, 'output/market-agent/sightings');
const ledgerNames = await readdir(sightingsDirectory).catch(error => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
const latestName = ledgerNames.filter(name => name.endsWith('.json')).sort().at(-1);
const latest = latestName ? await read(path.join(sightingsDirectory, latestName)) : null;
if (latest && (latest.version !== 1 || !Array.isArray(latest.states))) throw new Error('Invalid previous sighting record');
const expectedStates = mergeSightings(latest?.states ?? [], observations, new Date().toISOString());
for (const story of catalog.stories) {
  for (const states of [incomingStates, expectedStates]) {
    const recorded = states.find(state => state.storyKey === story.id);
    if (!recorded || recorded.firstSeenAt !== story.firstSeenAt) throw new Error(`First observation mismatch: ${story.id}`);
  }
}
// All reference and temporal preflight checks precede persistent side effects.
await mkdir(backup, { recursive: true });
for (const [name, value] of Object.entries({ concepts: oldCatalog, social: oldSocial, market: oldMarket })) {
  await writeFile(path.join(backup, `${name}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' })
    .catch(error => { if (error.code !== 'EEXIST') throw error; });
}
const sightings = await recordSightings(observations);
catalog.sightingsFile = path.relative(workspace, sightings.file).replaceAll(path.sep, '/');
catalog.researchFiles = ['x-discovery.json', 'news-discovery.json', 'market-check.json']
  .map(name => `output/market-agent/research-2026-09-12-0655/${name}`);
for (const [name, value] of Object.entries({ 'concepts.json': catalog, 'map-social.json': social, 'map-market.json': market })) {
  await writeFile(path.join(modulePath, name), JSON.stringify(value, null, 2) + '\n');
}
console.log(JSON.stringify({ stories: catalog.stories.length, sightingsFile: catalog.sightingsFile, backup }));
