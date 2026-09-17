import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMarket, normalizePair, renderReport } from './analyze.mjs';

const at = '2026-09-12T06:00:00.000Z';
function pair(overrides = {}) {
  return { chainId: 'solana', pairAddress: 'PoolABC', baseToken: { address: 'TokenABC', name: 'Fixture', symbol: 'TEST' },
    priceUsd: '1', marketCap: 100000, liquidity: { usd: 50000, base: 25000 },
    volume: { h1: 2000, h6: 12000, h24: 40000 }, txns: { h1: { buys: 10, sells: 8 } },
    pairCreatedAt: Date.parse(at) - 7200000, ...overrides };
}
const snapshot = (pairs, observedAt = at) => ({ observedAt, metas: [{ name: 'Fixture', slug: 'fixture', pairs }], errors: [] });

test('Missing liquidity stays unknown and cannot pass basic research filters', () => {
  const p = normalizePair(pair({ liquidity: null }), at);
  assert.equal(p.reportedLiquidityUsd, null);
  assert.equal(p.status, 'WATCH');
  assert.ok(p.reasons.includes('liquidity_missing'));
});

test('Reported millions predominantly valued in the token are flagged', () => {
  const p = normalizePair(pair({ liquidity: { usd: 10000000, base: 9800000 } }), at);
  assert.equal(p.status, 'WATCH');
  assert.equal(p.quoteValuationResidualUsd, 200000);
  assert.ok(p.reasons.includes('liquidity_mostly_base_valuation'));
});

test('No market sample authorizes launching or reports winner probabilities', () => {
  const report = analyzeMarket(snapshot([pair()]));
  assert.equal(report.narratives[0].status, 'RESEARCH');
  assert.equal(report.launchDecision, 'NO_LAUNCH');
  assert.equal(report.followup.length, 0);
  assert.match(renderReport(report), /no hay resultados posteriores/);
});

test('Solana case-sensitive contracts stay distinct, duplicate pools do not inflate count', () => {
  const a = pair(), b = pair({ pairAddress: 'poolABC', baseToken: { address: 'tokenABC', symbol: 'TEST' } });
  const report = analyzeMarket(snapshot([a, a, b]));
  assert.equal(report.narratives[0].observedTokens, 2);
  assert.equal(report.narratives[0].pairs.length, 2);
});

test('EVM checksum variants deduplicate, homonyms and different chains stay distinct', () => {
  const a = pair({ chainId: 'robinhood', pairAddress: '0xABC', baseToken: { address: '0xDEF', symbol: 'TEST' } });
  const b = pair({ chainId: 'robinhood', pairAddress: '0xabc', baseToken: { address: '0xdef', symbol: 'TEST' } });
  const c = pair({ chainId: 'ethereum', pairAddress: '0xabc', baseToken: { address: '0xdef', symbol: 'TEST' } });
  assert.equal(analyzeMarket(snapshot([a, b, c])).narratives[0].observedTokens, 2);
});

test('Followup retains rejected and missing pools rather than silently selecting survivors', () => {
  const before = snapshot([pair(), pair({ pairAddress: 'Gone', liquidity: { usd: 100, base: 50 } })]);
  const after = snapshot([pair({ priceUsd: '0.5' })], '2026-09-13T06:00:00.000Z');
  const result = analyzeMarket(after, before).followup;
  assert.equal(result.length, 2);
  assert.equal(result[0].priceChangePct, -50);
  assert.equal(result[1].previousDecision, 'WATCH');
  assert.equal(result[1].status, 'NOT_IN_CURRENT_SAMPLE');
  assert.equal(result[1].priceChangePct, null);
  assert.equal(result[0].sustainedDemandVerified, false);
});

test('Malformed, future-dated and one-sided observations cannot pass filters', () => {
  assert.equal(normalizePair({}, at), null);
  const p = normalizePair(pair({ priceUsd: '', pairCreatedAt: Date.parse(at) + 1,
    txns: { h1: { buys: 500, sells: 0 } } }), at);
  assert.equal(p.priceUsd, null);
  assert.equal(p.poolAgeHours, null);
  assert.equal(p.status, 'WATCH');
});

test('API failures and empty samples remain explicit', () => {
  const raw = snapshot([]);
  raw.errors.push({ endpoint: '/metas/trending/v1', message: 'HTTP 429' });
  const result = analyzeMarket(raw);
  assert.equal(result.narratives[0].status, 'NO_DATA');
  assert.match(renderReport(result), /HTTP 429/);
});

test('Followup rejects reversed timestamps and current snapshot requires a valid time', () => {
  assert.throws(() => analyzeMarket(snapshot([], 'invalid')), /observedAt/);
  assert.throws(() => analyzeMarket(snapshot([]), snapshot([], '2026-09-13T06:00:00Z')), /precede/);
});

test('A failed provider lookup does not label a prior token simply absent', () => {
  const raw = snapshot([], '2026-09-13T06:00:00Z');
  raw.metas[0].collectionError = 'REQUEST_TIMEOUT';
  raw.errors = [{ endpoint: '/metas/meta/v1/fixture', message: 'REQUEST_TIMEOUT' }];
  const report = analyzeMarket(raw, snapshot([pair()]));
  assert.equal(report.narratives[0].status, 'SOURCE_ERROR');
  assert.equal(report.followup[0].status, 'COVERAGE_INCOMPLETE');
  assert.equal(report.followup[0].coverageErrors.length, 1);
});
