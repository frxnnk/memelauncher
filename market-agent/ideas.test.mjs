import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIdea, validateCatalog, makeDecisionRecord } from './ideas.mjs';

const generatedAt = '2026-09-12T09:00:00.000Z';
function idea(overrides = {}) {
  return {
    id: 'two-for-two', title: '2-for-2', angle: 'character',
    pitch: 'Marcador de dos victorias, con un personaje y humor visual.',
    whatItDoes: 'Convierte la escena en una identidad y una serie de escenas.',
    whyNow: 'La noticia ofrece un marcador que se entiende inmediatamente.',
    distinctiveElement: 'Marcador y carpeta como lenguaje visual.',
    minimumBuild: 'Identidad, pieza inicial y metadatos locales.', buildEstimate: 'hours',
    competitionStatus: 'not_checked', competitionNote: 'Busqueda de nombres pendiente.',
    relatedMarketNodeIds: [], basisEvidenceIds: ['source-news'],
    quickCheck: 'Comprobar que el nombre expresa el chiste en una frase.',
    discardIf: 'Si la expresion depende de un resultado judicial falso.',
    disposition: 'EXPLORE', decisionReason: 'Idea legible y construible en horas.', ...overrides,
  };
}
function story(overrides = {}) {
  return { id: 'news-steel', title: 'Steel gana otra vez', mode: 'snapshot',
    publishedAt: '2026-09-12T00:00:00Z', firstSeenAt: null,
    firstMarketObservedAt: null, firstLaunchAt: null, interpretations: [idea()], ...overrides };
}
const catalog = stories => ({ version: 1, generatedAt, stories });

test('a complete pretoken brief can be EXPLORE with no market, liquidity or community prerequisite', () => {
  const result = evaluateIdea(idea(), story(), generatedAt);
  assert.equal(result.status, 'EXPLORE');
  assert.deepEqual(result.missing, []);
  assert.equal(result.executionAuthorized, false);
  assert.equal(Object.hasOwn(result, 'score'), false);
  assert.equal(Object.hasOwn(result, 'winnerProbability'), false);
});

test('unknown observation clocks stay null and publication never becomes first sighting', () => {
  const result = evaluateIdea(idea(), story(), generatedAt);
  assert.equal(result.timing.publishedAt, '2026-09-12T00:00:00Z');
  assert.equal(result.timing.firstSeenAt, null);
  assert.equal(result.timing.observationDelayHours, null);
  assert.equal(result.timing.leadToFirstLaunchHours, null);
  assert.equal(result.timing.knowledge, 'unknown');
  assert.match(result.reason, /no prueba cuando vimos/);
  assert.match(result.reason, /no se afirma que aun no exista/);
});

test('known clocks produce observation delay and signed time to the recorded launch', () => {
  const result = evaluateIdea(idea(), story({ firstSeenAt: '2026-09-12T01:30:00Z',
    firstLaunchAt: '2026-09-12T03:00:00Z' }), generatedAt);
  assert.equal(result.timing.observationDelayHours, 1.5);
  assert.equal(result.timing.leadToFirstLaunchHours, 1.5);
  assert.equal(result.timing.knowledge, 'observed');
  assert.equal(result.timing.generatedAt, generatedAt);
  assert.match(result.reason, /no equivale a tiempo restante/);
  const late = evaluateIdea(idea(), story({ firstSeenAt: '2026-09-12T03:00:00Z',
    firstLaunchAt: '2026-09-12T01:00:00Z' }), generatedAt);
  assert.equal(late.timing.leadToFirstLaunchHours, -2);
  assert.match(late.reason, /llegada tardia/);
});

test('retrospective intervals remain historical and do not upgrade the curated decision', () => {
  const result = evaluateIdea(idea({ disposition: 'REWORK' }), story({ mode: 'retrospective',
    firstSeenAt: '2026-09-12T01:00:00Z', firstLaunchAt: '2026-09-12T04:00:00Z' }), generatedAt);
  assert.equal(result.status, 'REWORK');
  assert.equal(result.timing.leadToFirstLaunchHours, 3);
  assert.equal(result.timing.knowledge, 'retrospective');
  assert.match(result.reason, /no una ventana disponible hoy/);
});

test('incomplete brief becomes REWORK while a deliberate PASS stays PASS', () => {
  const incomplete = idea({ distinctiveElement: '', minimumBuild: null, basisEvidenceIds: [] });
  const result = evaluateIdea(incomplete, story(), generatedAt);
  assert.equal(result.status, 'REWORK');
  assert.deepEqual(result.missing, ['distinctiveElement', 'minimumBuild', 'basisEvidenceIds']);
  assert.equal(evaluateIdea({ ...incomplete, disposition: 'PASS' }, story(), generatedAt).status, 'PASS');
});

test('impossible sighting before publication is reviewable, not an invented timing edge', () => {
  const s = story({ firstSeenAt: '2026-09-11T23:00:00Z', firstLaunchAt: '2026-09-12T02:00:00Z' });
  assert.doesNotThrow(() => validateCatalog(catalog([s])));
  const result = evaluateIdea(idea(), s, generatedAt);
  assert.equal(result.status, 'REWORK');
  assert.ok(result.missing.includes('timing.firstSeenAt_before_publishedAt'));
  assert.equal(result.timing.observationDelayHours, null);
  assert.equal(result.timing.leadToFirstLaunchHours, null);
});

test('catalog rejects duplicate identities, invalid enum values, invalid and future source dates', () => {
  assert.throws(() => validateCatalog(catalog([story(), story()])), /Duplicate story/);
  assert.throws(() => validateCatalog(catalog([story(), story({ id: 'other' })])), /Duplicate idea/);
  for (const value of ['2026-09-12', '2026-02-30T00:00:00Z', 'not-a-date']) {
    assert.throws(() => validateCatalog(catalog([story({ publishedAt: value })])), /ISO timestamp/);
  }
  assert.throws(() => validateCatalog(catalog([story({ firstSeenAt: '2026-09-13T00:00:00Z' })])), /later than generatedAt/);
  assert.throws(() => validateCatalog(catalog([story({ mode: 'live' })])), /story.mode/);
  for (const patch of [{ disposition: 'WINNER' }, { buildEstimate: 'minutes' }, { competitionStatus: 'clear' }]) {
    assert.throws(() => validateCatalog(catalog([story({ interpretations: [idea(patch)] })])), /Invalid/);
  }
  assert.throws(() => validateCatalog({ ...catalog([story()]), evidence: [{ publishedAt: '2026-09-13T00:00:00Z' }] }), /later than generatedAt/);
});

test('decision records use interpretations, preserve curated statuses and never mutate source data', () => {
  const input = catalog([story({ interpretations: [idea(), idea({ id: 'clone', disposition: 'PASS' })] })]);
  const before = JSON.stringify(input);
  const record = makeDecisionRecord(input);
  assert.equal(record.version, 1);
  assert.equal(record.generatedAt, generatedAt);
  assert.equal(record.executionAuthorized, false);
  assert.deepEqual(record.stories[0].decisions.map(d => [d.ideaId, d.status]), [['two-for-two', 'EXPLORE'], ['clone', 'PASS']]);
  assert.equal(JSON.stringify(input), before);
});

test('timezone offsets represent real instants and optional unknown clocks remain accepted', () => {
  const s = story({ publishedAt: '2026-09-11T21:00:00-03:00', firstSeenAt: '2026-09-12T01:00:00Z' });
  assert.equal(evaluateIdea(idea(), s, generatedAt).timing.observationDelayHours, 1);
  assert.doesNotThrow(() => validateCatalog(catalog([story({ publishedAt: null })])));
});

test('local source files can ground an idea without fabricated external evidence', () => {
  const local = idea({ basisEvidenceIds: [], basisSourceFiles: ['README.md', 'docs/competitor-flybrain/REVIEW.md'] });
  const input = catalog([story({ interpretations: [local] })]);
  assert.doesNotThrow(() => validateCatalog(input));
  const result = makeDecisionRecord(input).stories[0].decisions[0];
  assert.equal(result.status, 'EXPLORE');
  assert.deepEqual(result.missing, []);
  assert.deepEqual(local.basisEvidenceIds, []);
  for (const invalid of [[], [''], [123], 'README.md']) {
    assert.throws(() => validateCatalog(catalog([story({ interpretations: [idea({ basisSourceFiles: invalid })] })])), /basisSourceFiles/);
  }
});

test('catalog rejects invalid angle and empty structures needed by the interface', () => {
  assert.throws(() => validateCatalog(catalog([])), /nonempty array/);
  assert.throws(() => validateCatalog(catalog([story({ interpretations: [] })])), /nonempty interpretations/);
  assert.throws(() => validateCatalog(catalog([story({ interpretations: [idea({ angle: 'free text' })] })])), /Invalid angle/);
});
