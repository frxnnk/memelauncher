import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runScout, latestScout, refreshScoutView } from './scout.mjs';
import { validateDiscovery, buildScoutResult } from './scout-evidence.mjs';
import { modelArgs, runProcess, codexModel } from './scout-model.mjs';
import { reviewSchema } from './scout-schema.mjs';

const observedAt = '2026-09-13T08:00:00.000Z', completedAt = '2026-09-13T08:01:00.000Z';
function sample() {
  const idea = (id, angle) => ({ id, angle, title: id, pitch: 'Un personaje con un gesto concreto.',
    whatItDoes: 'Vuelve disfrazado al intentar borrarlo.', whyNow: 'La fuente da contexto.', distinctiveElement: 'El gesto.',
    minimumBuild: 'Dos escenas.', buildEstimate: 'hours', quickCheck: 'Comparar comprensión de dos bocetos.',
    discardIf: 'Nadie entiende el gesto.', basisEvidenceIds: ['news', 'post'] });
  const discovery = { coverageNote: 'Prueba aislada, datos ficticios.', abstentionReason: '',
    sources: [
      { id: 'news', url: 'https://example.com/news', title: 'Noticia', author: 'Fuente', publishedAt: '2026-09-13T07:00:00Z',
        excerpt: 'Dato ficticio.', kind: 'news', access: 'full_text', media: 'not_applicable' },
      { id: 'post', url: 'https://x.com/test/status/12345', title: 'Gag', author: 'Test', publishedAt: null,
        excerpt: 'Gag ficticio.', kind: 'x_post', access: 'full_text', media: 'not_applicable' }],
    stories: [{ id: 'story', title: 'Caso de prueba', summary: 'Noticia de prueba.', meme: 'El gag.', gap: 'Por comprobar.',
      sourceIds: ['news', 'post'], queries: ['TEST'], visualEssential: false,
      interpretations: [idea('character', 'character'), idea('mechanic', 'mechanic')] }] };
  const review = { summary: 'Revisión ficticia.', reviews: discovery.stories[0].interpretations.map(i => ({ storyId: 'story', ideaId: i.id,
    disposition: 'EXPLORE', decisionReason: 'Probar el gesto.', competitionStatus: 'partial', competitionNote: 'Muestra acotada.',
    queryEvidence: ['TEST'], relatedPairs: [] })) };
  const raw = { observedAt, searches: [{ query: 'TEST', pairs: [{ chainId: 'solana', pairAddress: 'Pair1', baseToken: { name: 'Existing', symbol: 'OLD' } }] }],
    requests: [], errors: [], coverage: ['Prueba'] };
  return { discovery, review, raw };
}
async function withRoot(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'radar-scout-test-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function options(root, fixture = sample()) {
  return { root, now: () => observedAt, seedMemory: async () => ({ stories: [], sources: [] }),
    model: async ({ stage }) => ({ output: structuredClone(stage === 'discovery' ? fixture.discovery : fixture.review), provenance: { fixture: true } }),
    collect: async () => fixture.raw };
}

test('end-to-end: model discovers, collector runs before review, and complete map is persisted', async () => withRoot(async root => {
  const fixture = sample(), opts = options(root, fixture), calls = [];
  opts.model = async ({ stage, prompt, directory }) => {
    calls.push(stage);
    if (stage === 'review') { assert.match(prompt, /Pair1/); assert.ok(await readFile(path.join(directory, 'discovery.json'))); }
    return { output: structuredClone(stage === 'discovery' ? fixture.discovery : fixture.review), provenance: { fixture: true } };
  };
  opts.collect = async ({ queries }) => { calls.push('market'); assert.deepEqual(queries, ['TEST']); return fixture.raw; };
  const run = await runScout(opts), latest = await latestScout(root);
  assert.deepEqual(calls, ['discovery', 'market', 'review']);
  assert.equal(latest.folder, run.folder); assert.equal(latest.result.map.stories[0].interpretations.length, 2);
  assert.match(await readFile(path.join(run.folder, 'map.html'), 'utf8'), /early-meme-radar/);
  assert.equal(run.manifest.executionAuthorized, false);
  const view = await refreshScoutView(root);
  assert.match(await readFile(view, 'utf8'), /Cobertura del descubrimiento, antes/);
  const changed = { ...run.result, summary: 'tampered' };
  await writeFile(path.join(run.folder, 'result.json'), JSON.stringify(changed));
  await assert.rejects(latestScout(root), /hash mismatch/);
}));

test('abstention is a successful empty run and does not force market or review calls', async () => withRoot(async root => {
  const opts = options(root), calls = [];
  opts.model = async ({ stage }) => { calls.push(stage); return { output: { coverageNote: 'Fuentes inaccesibles.',
    abstentionReason: 'No hay evidencia suficiente.', sources: [], stories: [] }, provenance: { fixture: true } }; };
  opts.collect = async () => { throw new Error('Unexpected collector'); };
  const run = await runScout(opts);
  assert.deepEqual(calls, ['discovery']); assert.equal(run.result.map.stories.length, 0);
  assert.match(await readFile(path.join(run.folder, 'map.html'), 'utf8'), /sin propuestas/);
}));

test('failure preserves the last complete pointer and archives failure stage', async () => withRoot(async root => {
  const first = await runScout(options(root));
  const opts = options(root); opts.model = async () => { throw new Error('MODEL_PROCESS_FAILED'); };
  await assert.rejects(runScout(opts), /MODEL_PROCESS_FAILED/);
  assert.equal((await latestScout(root)).folder, first.folder);
  const entries = await readdir(root); assert.ok(!entries.includes('.writer.lock'));
  const failed = entries.find(name => name.startsWith('run-') && path.join(root, name) !== first.folder);
  assert.equal(JSON.parse(await readFile(path.join(root, failed, 'failure.json'))).stage, 'discovery');
}));

test('concurrent runs reject before invoking the second model', async () => withRoot(async root => {
  const opts = options(root), original = opts.model;
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; }), held = new Promise(resolve => { release = resolve; });
  opts.model = async request => { if (request.stage === 'discovery') { enter(); await held; } return original(request); };
  const active = runScout(opts); await entered;
  await assert.rejects(runScout(options(root)), /SCOUT_BUSY/); release(); await active;
}));

test('source clocks survive repeated reads and absence from later passes', () => {
  const { discovery, review, raw } = sample();
  const previousSources = [{ key: 'x:12345', url: 'https://twitter.com/test/status/12345', firstSeenAt: '2026-09-13T07:30:00Z' },
    { key: 'https://example.com/absent', url: 'https://example.com/absent', firstSeenAt: '2026-09-12T07:30:00Z' }];
  const result = buildScoutResult(discovery, review, raw, { observedAt, completedAt, previousSources });
  assert.equal(result.sources.find(s => s.key === 'x:12345').firstSeenAt, previousSources[0].firstSeenAt);
  assert.ok(result.sources.some(s => s.key === 'https://example.com/absent'));
  assert.equal(result.map.stories[0].firstSeenAt, observedAt, 'an older reply must not backdate the principal story');
});

test('date-only sources preserve the day without fabricating a publication hour', () => {
  const { discovery, review, raw } = sample(); discovery.sources[0].publishedAt = '2026-09-13';
  const result = buildScoutResult(discovery, review, raw, { observedAt, completedAt });
  assert.equal(result.map.stories[0].publishedAt, null); assert.equal(result.map.stories[0].publishedDate, '2026-09-13');
  discovery.sources[0].publishedAt = '2026-02-30'; assert.throws(() => validateDiscovery(discovery, observedAt));
});

test('no observed X post does not gate an early idea supported by a readable news source', () => {
  const { discovery, review, raw } = sample(); discovery.sources[1].kind = 'commentary';
  const result = buildScoutResult(discovery, review, raw, { observedAt, completedAt });
  assert.equal(result.map.stories[0].interpretations[0].decision.status, 'EXPLORE');
  assert.match(result.map.stories[0].interpretations[0].decisionReason, /recepción social pendiente/);
});

test('missing, extra and duplicate idea reviews are rejected', () => {
  for (const mutate of [r => r.reviews.pop(), r => r.reviews.push(r.reviews[0]), r => { r.reviews[0].ideaId = 'invented'; }]) {
    const { discovery, review, raw } = sample(); mutate(review);
    assert.throws(() => buildScoutResult(discovery, review, raw, { observedAt, completedAt }), /review/i);
  }
});

test('unknown sources, future publication, invented X URL and repeated angle are rejected', () => {
  for (const mutate of [d => { d.stories[0].sourceIds = ['unknown']; }, d => { d.sources[0].publishedAt = '2099-01-01T00:00:00Z'; },
    d => { d.sources[1].url = 'https://x.com/search?q=meme'; }, d => { d.stories[0].interpretations[1].angle = 'character'; }]) {
    const { discovery } = sample(); mutate(discovery); assert.throws(() => validateDiscovery(discovery, observedAt));
  }
});

test('review cannot invent a market query, pool or successful coverage', () => {
  for (const mutate of [r => { r.queryEvidence = ['INVENTED']; }, r => { r.relatedPairs = [{ chainId: 'solana', pairAddress: 'fake' }]; },
    r => { r.competitionStatus = 'represented'; }]) {
    const { discovery, review, raw } = sample(); mutate(review.reviews[0]);
    assert.throws(() => buildScoutResult(discovery, review, raw, { observedAt, completedAt }));
  }
  const { discovery, review, raw } = sample(); raw.searches[0].collectionError = 'REQUEST_FAILED';
  assert.throws(() => buildScoutResult(discovery, review, raw, { observedAt, completedAt }), /successful query/);
});

test('a missing essential visual downgrades exploration without erasing the hypothesis', () => {
  const { discovery, review, raw } = sample(); discovery.stories[0].visualEssential = true;
  const result = buildScoutResult(discovery, review, raw, { observedAt, completedAt });
  assert.equal(result.map.stories[0].interpretations[0].decision.status, 'REWORK');
  assert.match(result.map.stories[0].interpretations[0].decisionReason, /visual esencial/);
});

test('runtime isolates user config, disables execution tools and uses stdin for prompt', () => {
  const args = modelArgs('schema.json', 'out.json', 'work', true);
  assert.ok(args.includes('--ignore-user-config')); assert.ok(args.includes('read-only'));
  assert.equal(args.at(-1), '-'); assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  for (const feature of ['shell_tool', 'apps', 'plugins', 'hooks', 'multi_agent']) assert.equal(args[args.indexOf(feature) - 1], '--disable');
});

test('runtime enforces timeout on an unresponsive model process', async () => {
  const spawnImpl = () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { queueMicrotask(() => child.emit('close', null)); return true; }; return child;
  };
  const result = await runProcess('fake', [], 'test', { spawnImpl, timeoutMs: 10 });
  assert.equal(result.failure, 'MODEL_TIMEOUT');
});

test('exit zero without a completed model turn is not success', async () => withRoot(async directory => {
  await assert.rejects(codexModel({ stage: 'review', prompt: 'test', schema: reviewSchema, directory,
    processRunner: async () => ({ code: 0, stdout: '', stderr: '', failure: null }) }), /MODEL_TURN_INCOMPLETE/);
}));

test('runtime stops unexpected execution tools and excessive search calls', async () => {
  for (const [type, reason] of [['command_execution', 'MODEL_UNEXPECTED_TOOL'], ['web_search', 'MODEL_SEARCH_LIMIT']]) {
    const spawnImpl = () => {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
      child.kill = () => { queueMicrotask(() => child.emit('close', null)); return true; };
      queueMicrotask(() => child.stdout.write(JSON.stringify({ type: 'item.started', item: { type } }) + '\n'));
      return child;
    };
    const result = await runProcess('fake', [], '', { spawnImpl, timeoutMs: 1000, maxSearchCalls: 0 });
    assert.equal(result.failure, reason);
  }
});

test('runtime preserves UTF-8 characters split between stream chunks', async () => {
  const spawnImpl = () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => true;
    queueMicrotask(() => { const bytes = Buffer.from('ñ'); child.stdout.write(bytes.subarray(0, 1)); child.stdout.write(bytes.subarray(1)); child.emit('close', 0); });
    return child;
  };
  assert.equal((await runProcess('fake', [], '', { spawnImpl })).stdout, 'ñ');
});
