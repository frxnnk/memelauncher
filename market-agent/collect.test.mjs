import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectMarket } from './collect.mjs';

const pair = (chainId, pairAddress) => ({ chainId, pairAddress, baseToken: { address: pairAddress + 'Token' }, quoteToken: { address: 'quote' } });
const response = data => ({ ok: true, status: 200, json: async () => data });
function fixture(responses) {
  const calls = [], pauses = [];
  return {
    calls, pauses,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const next = responses[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    },
    pause: async ms => { pauses.push(ms); },
  };
}

test('collector uses documented GET routes, shared spacing and preserves raw responses across chain filtering', async () => {
  const rawPairs = [pair('solana', 'CaseSensitive'), pair('base', '0xabc')];
  const detail = { name: 'AI', slug: 'ai', volume: 1000, tokenCount: 10, pairs: rawPairs };
  const f = fixture([response([{ name: 'AI', slug: 'ai' }]), response(detail), response({ pairs: rawPairs })]);
  const result = await collectMarket({ ...f, queries: ['AI & cat'], chain: 'solana' });
  assert.deepEqual(f.calls.map(c => c.url), [
    'https://api.dexscreener.com/metas/trending/v1',
    'https://api.dexscreener.com/metas/meta/v1/ai',
    'https://api.dexscreener.com/latest/dex/search?q=AI%20%26%20cat',
  ]);
  assert.ok(f.calls.every(({ init }) => init.method === 'GET' && init.redirect === 'error' && init.signal instanceof AbortSignal));
  assert.deepEqual(f.pauses, [1050, 1050]);
  assert.deepEqual(result.metas[0].pairs, [rawPairs[0]]);
  assert.deepEqual(result.searches[0].pairs, [rawPairs[0]]);
  assert.equal(result.metas[0].tokenCount, 10);
  assert.deepEqual(result.requests[1].data, detail);
  assert.ok(result.coverage.some(item => item.includes('unfiltered')));
  assert.deepEqual(result.errors, []);
});

test('failed detail and search requests remain distinguishable from genuine empty results', async () => {
  const f = fixture([
    response([{ name: 'AI', slug: 'ai' }]),
    { ok: false, status: 429 },
    response({ pairs: [] }),
    response({ error: 'remote body' }),
  ]);
  const result = await collectMarket({ ...f, queries: ['empty', 'failed'] });
  assert.equal(result.metas[0].collectionError, 'HTTP_429');
  assert.equal(result.searches[0].collectionError, undefined);
  assert.equal(result.searches[1].collectionError, 'INVALID_PAIRS_RESPONSE');
  assert.equal(result.errors.length, 2);
  assert.deepEqual(result.requests[3].data, { error: 'remote body' });
  assert.equal(result.requests[3].ok, false);
  assert.deepEqual(f.pauses, [1050, 1050, 1050]);
});

test('unsafe provider slugs are never used as routes and detail identity mismatches fail closed', async () => {
  const f = fixture([
    response([{ slug: '../private' }, { slug: 'good' }]),
    response({ slug: 'other', pairs: [] }),
  ]);
  const result = await collectMarket(f);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(result.errors.map(e => e.message), ['INVALID_META_SLUG', 'META_SLUG_MISMATCH']);
  assert.equal(result.metas.length, 2);
  assert.ok(result.metas.every(m => m.collectionError && m.pairs.length === 0));
});

test('collection is bounded and invalid caller options produce no requests', async () => {
  const f = fixture([response(Array.from({ length: 10 }, (_, i) => ({ slug: 'meta-' + i }))), response({ pairs: [] })]);
  const result = await collectMarket({ ...f, limit: 1 });
  assert.equal(result.metas.length, 1);
  assert.equal(f.calls.length, 2);
  const invalid = fixture([]);
  for (const options of [{ limit: 9 }, { limit: 0 }, { queries: Array(9).fill('q') }, { queries: [''] }, { chain: '../' }]) {
    await assert.rejects(collectMarket({ ...invalid, ...options }));
  }
  assert.equal(invalid.calls.length, 0);
});

test('a failed trending response does not suppress explicit searches or leak exception text', async () => {
  const f = fixture([new Error('secret-looking arbitrary library text'), response({ pairs: [] })]);
  const result = await collectMarket({ ...f, queries: [' cats ', 'cats'] });
  assert.equal(result.errors[0].message, 'REQUEST_FAILED');
  assert.equal(result.searches.length, 1);
  assert.equal(result.searches[0].query, 'cats');
  assert.equal(JSON.stringify(result).includes('secret-looking'), false);
  assert.deepEqual(f.pauses, [1050]);
});

test('timeout and malformed JSON are explicit failures', async () => {
  const timeout = new Error('timeout detail'); timeout.name = 'TimeoutError';
  const f = fixture([timeout, { ok: true, status: 200, json: async () => { throw new SyntaxError('invalid'); } }]);
  const result = await collectMarket({ ...f, queries: ['cat'] });
  assert.deepEqual(result.errors.map(e => e.message), ['REQUEST_TIMEOUT', 'INVALID_JSON_RESPONSE']);
  assert.ok(result.requests.every(request => !request.ok));
});
