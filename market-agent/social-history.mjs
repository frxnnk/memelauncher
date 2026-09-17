import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compareSocialBatches } from './social-delta.mjs';
import { nextRecordingTime, parseInstant } from './sightings.mjs';

const defaultDirectory = fileURLToPath(new URL('../output/market-agent/social/', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const digest = text => createHash('sha256').update(text).digest('hex');
const labels = { NEW_STORY: 'Historia nueva en esta memoria', NEW_SOURCE: 'Fuente nueva',
  NEW_ASSOCIATION: 'Asociación nueva de una fuente conocida', CONTENT_CHANGED: 'Texto fuente modificado',
  REOBSERVED: 'Fuente releída' };
const md = value => String(value ?? '').replace(/[\r\n]/g, ' ').replace(/[\\`*_{}\[\]<>]/g, '\\$&');

export function renderSocialReport(result) {
  const lines = ['# Cambios del radar', '', `Captura: ${result.recordedAt}.`, '',
    result.needsReview ? 'Hay cambios para revisar. Ninguno valida por sí solo una oportunidad de lanzamiento.'
      : 'No se detectaron cambios de contenido que pidan revisión en esta cobertura.',
    '', '## Fuentes y asociaciones', ''];
  const review = result.changes.filter(change => change.type !== 'REOBSERVED');
  if (!review.length) lines.push('Sin fuentes o asociaciones nuevas en esta comparación.');
  for (const item of review) {
    const link = item.sourceUrl ? ` — [fuente](<${new URL(item.sourceUrl).href}>)` : '';
    lines.push(`- ${labels[item.type] ?? md(item.type)}: ${md(item.storyKey)}${link}`);
  }
  const repeats = result.changes.filter(change => change.type === 'REOBSERVED');
  lines.push('', '## Relecturas y cobertura', '', `${repeats.length} fuentes releídas. Cambios de contadores no equivalen a demanda ni a una idea nueva.`);
  for (const item of result.coverage) lines.push(`- ${md(item.storyKey)}: ${md(item.status)}. ${md(item.note)}`);
  lines.push('', `${result.missing.length} fuentes anteriores no incluidas en esta pasada; no se consideran eliminadas ni fallidas.`,
    '', 'La memoria conserva fuentes ausentes para no redetectarlas como nuevas en una pasada posterior.',
    'No se programó un monitor ni se publicaron mensajes.');
  return lines.join('\n') + '\n';
}

export async function readLatestSocial({ directory = defaultDirectory } = {}) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const names = entries.filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T.*-[\da-f-]{36}$/.test(entry.name))
    .map(entry => entry.name).sort();
  if (!names.length) return null;
  const folder = path.join(directory, names.at(-1));
  const [state, provenance] = await Promise.all(['state.json', 'provenance.json']
    .map(async name => JSON.parse(await readFile(path.join(folder, name), 'utf8'))));
  return { folder, state, storedAt: provenance.storedAt };
}

export async function recordSocialBatch(batch, { directory = defaultDirectory } = {}) {
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true });
  const lockPath = path.join(root, '.writer.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw Object.assign(new Error('SOCIAL_BUSY: another writer or interrupted writer owns this history; retry after it finishes.'), { code: 'SOCIAL_BUSY' });
    throw error;
  }
  try {
    await lock.writeFile(json({ pid: process.pid, acquiredAt: new Date().toISOString() }));
    const previous = await readLatestSocial({ directory: root });
    const storedAt = await nextRecordingTime(previous ? { recordedAt: previous.storedAt } : null);
    if (parseInstant(batch.recordedAt) > parseInstant(storedAt)) throw new Error('Batch cannot be recorded in the future');
    const result = compareSocialBatches(previous?.state ?? null, batch);
    const id = randomUUID(), pending = path.join(root, `_pending-${id}`);
    const folder = path.join(root, `${storedAt.replace(/[:.]/g, '-')}-${id}`);
    const { nextState, ...changes } = result;
    const files = { 'batch.json': json(batch), 'changes.json': json(changes),
      'state.json': json(nextState), 'REPORT.md': renderSocialReport(result) };
    const provenance = { version: 1, storedAt, observedBatchAt: batch.recordedAt,
      previousFolder: previous ? path.basename(previous.folder) : null,
      executionAuthorized: false, sourceScope: 'curated observations; not continuous or complete X coverage',
      files: Object.entries(files).map(([file, content]) => ({ file, sha256: digest(content) })) };
    await mkdir(pending);
    // Only a complete directory becomes visible to readLatestSocial. An interrupted
    // _pending directory remains diagnostic evidence and is never treated as a run.
    for (const [file, content] of Object.entries({ ...files, 'provenance.json': json(provenance) })) {
      await writeFile(path.join(pending, file), content, { flag: 'wx', encoding: 'utf8' });
    }
    await rename(pending, folder);
    return { folder, storedAt, result };
  } finally {
    try { await lock.close(); } finally { await unlink(lockPath); }
  }
}
