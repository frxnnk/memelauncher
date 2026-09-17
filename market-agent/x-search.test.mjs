import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectXRecent } from './x-search.mjs';

const base = { storyKey: 'demo-story', query: 'robot demo', bearerToken: 'synthetic-test-token', allowPaidRead: true };
const post = overrides => ({ id: '2098581358469611549', author_id: '12345', text: 'A working demo.', created_at: '2026-09-12T06:00:00Z', ...overrides });
const response = payload => ({ ok: true, status: 200, json: async () => payload });
function fixture(value) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (value instanceof Error) throw value;
    return value;
  } };
}

test('invalid options, absent token, or absent explicit paid-read intent never reach fetch', async () => {
  const f = fixture(response({ meta: { result_count: 0 } }));
  for (const invalid of [
    { allowPaidRead: false }, { allowPaidRead: 'true' }, { bearerToken: undefined }, { bearerToken: '' },
    { bearerToken: 'two tokens' }, { storyKey: '' }, { query: '' }, { query: 'a'.repeat(513) },
    { query: 'a\nb' }, { maxResults: 9 }, { maxResults: 101 }, { maxResults: 10.5 },
    { maxResults: '10' }, { sinceId: 'x' }, { sinceId: 123 }, { nextToken: '' }, { nextToken: 'with space' },
  ]) await assert.rejects(collectXRecent({ ...base, ...f, ...invalid }), TypeError);
  assert.equal(f.calls.length, 0);
});

test('one fixed GET has no user expansions, preserves text and author IDs, and missing metrics stay null', async () => {
  const f = fixture(response({ data: [post({ public_metrics: { like_count: 0, repost_count: 2, reply_count: -1 } })], meta: { result_count: 1, newest_id: '2098581358469611549' } }));
  const result = await collectXRecent({ ...base, ...f, sinceId: '123' });
  assert.equal(f.calls.length, 1);
  const { url: rawUrl, init } = f.calls[0];
  const url = new URL(rawUrl);
  assert.equal(url.origin + url.pathname, 'https://api.x.com/2/tweets/search/recent');
  assert.equal(url.searchParams.get('max_results'), '10');
  assert.equal(url.searchParams.get('query'), base.query);
  assert.equal(url.searchParams.get('since_id'), '123');
  assert.equal(url.searchParams.get('tweet.fields'), 'created_at,public_metrics,author_id');
  assert.equal(url.searchParams.has('expansions'), false);
  assert.equal(url.searchParams.has('user.fields'), false);
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  const observed = result.observations[0];
  assert.equal(observed.sourceUrl, 'https://x.com/i/web/status/2098581358469611549');
  assert.equal(observed.author, '12345');
  assert.equal(observed.authorId, '12345');
  assert.equal(observed.text, 'A working demo.');
  assert.equal(observed.textBasis, 'verbatim');
  assert.equal(observed.kind, 'unclassified');
  assert.deepEqual(observed.metrics, { views: null, likes: 0, reposts: 2, replies: null, quotes: null, bookmarks: null });
  assert.equal(result.provider.pagination, 'complete');
  assert.match(result.provider.cursorNote, /not a confirmed complete cursor/);
  assert.equal(JSON.stringify(result).includes(base.bearerToken), false);
});

test('next page and partial provider errors remain partial with no automatic request or cursor advancement', async () => {
  const f = fixture(response({ data: [post()], errors: [{ detail: base.bearerToken, title: 'secret diagnostic' }], meta: { result_count: 1, next_token: 'NEXT-123', newest_id: '2098581358469611549', oldest_id: '2098581358469611549' } }));
  const result = await collectXRecent({ ...base, ...f, nextToken: 'PREVIOUS-123' });
  assert.equal(f.calls.length, 1);
  assert.equal(new URL(f.calls[0].url).searchParams.get('next_token'), 'PREVIOUS-123');
  assert.equal(result.provider.partial, true);
  assert.equal(result.provider.pagination, 'partial');
  assert.equal(result.provider.nextToken, 'NEXT-123');
  assert.equal(result.provider.errorCount, 1);
  assert.equal(result.coverage[0].status, 'observed');
  assert.match(result.coverage[0].note, /PARCIAL/);
  assert.equal('confirmedCursor' in result.provider, false);
  assert.equal(JSON.stringify(result).includes('secret diagnostic'), false);
  assert.equal(JSON.stringify(result).includes(base.bearerToken), false);
  assert.ok(Object.values(result.observations[0].metrics).every(value => value === null));
});

test('HTTP failures, network errors, redirects and invalid JSON are unavailable and never disclose provider diagnostics', async () => {
  for (const status of [401, 403, 429, 500]) {
    const f = fixture({ ok: false, status, json: async () => { throw new Error('body must not be read'); } });
    const result = await collectXRecent({ ...base, ...f });
    assert.equal(result.provider.errorCode, `HTTP_${status}`);
    assert.equal(result.coverage[0].status, 'unavailable');
    assert.equal(f.calls.length, 1);
  }
  for (const [value, code] of [
    [new TypeError(`redirect or network ${base.bearerToken}`), 'NETWORK_OR_REDIRECT_ERROR'],
    [{ ok: true, status: 200, redirected: true }, 'REDIRECT_REJECTED'],
    [{ ok: true, status: 200, json: async () => { throw new SyntaxError(base.bearerToken); } }, 'INVALID_JSON'],
    [response({ errors: [{ detail: base.bearerToken }] }), 'NO_USABLE_POSTS'],
    [response({ surprise: base.bearerToken }), 'INVALID_RESPONSE'],
  ]) {
    const f = fixture(value);
    const result = await collectXRecent({ ...base, ...f });
    assert.equal(result.provider.errorCode, code);
    assert.equal(result.coverage[0].status, 'unavailable');
    assert.equal(result.observations.length, 0);
    assert.equal(f.calls.length, 1);
    assert.equal(JSON.stringify(result).includes(base.bearerToken), false);
  }
});

test('a 12-second abort is recorded as timeout without waiting or reaching a real service', async t => {
  const deadlines = [];
  t.mock.method(AbortSignal, 'timeout', ms => { deadlines.push(ms); return AbortSignal.abort(); });
  let calls = 0;
  const result = await collectXRecent({ ...base, fetchImpl: async (_url, { signal }) => {
    calls += 1;
    signal.throwIfAborted();
  } });
  assert.deepEqual(deadlines, [12000]);
  assert.equal(calls, 1);
  assert.equal(result.provider.errorCode, 'TIMEOUT');
  assert.equal(result.coverage[0].status, 'unavailable');
});

test('empty success differs from malformed data; an isolated terminal page never confirms earlier coverage', async () => {
  const empty = await collectXRecent({ ...base, ...fixture(response({ meta: { result_count: 0 } })) });
  assert.equal(empty.coverage[0].status, 'observed');
  assert.equal(empty.observations.length, 0);
  const terminal = await collectXRecent({ ...base, nextToken: 'NEXT', ...fixture(response({ data: [post()], meta: { result_count: 1 } })) });
  assert.equal(terminal.provider.pagination, 'unknown');
  const malformed = await collectXRecent({ ...base, ...fixture(response({ data: [post({ text: 'x'.repeat(30001) })], meta: { result_count: 1 } })) });
  assert.equal(malformed.coverage[0].status, 'unavailable');
  assert.equal(malformed.provider.discardedCount, 1);
  assert.equal(malformed.observations.length, 0);
});

test('impossible calendar dates and future publication times are discarded per row without losing valid posts', async () => {
  const invalidDates = [
    post({ id: '123', created_at: '2026-02-30T06:00:00Z' }),
    post({ id: '124', created_at: new Date(Date.now() + 60000).toISOString() }),
  ];
  const mixed = await collectXRecent({ ...base, ...fixture(response({
    data: [post(), ...invalidDates], meta: { result_count: 3 },
  })) });
  assert.equal(mixed.observations.length, 1);
  assert.equal(mixed.observations[0].sourceUrl, 'https://x.com/i/web/status/2098581358469611549');
  assert.equal(mixed.provider.discardedCount, 2);
  assert.equal(mixed.provider.partial, true);
  assert.equal(mixed.coverage[0].status, 'observed');
  assert.match(mixed.coverage[0].note, /PARCIAL/);
  const unusable = await collectXRecent({ ...base, ...fixture(response({
    data: invalidDates, meta: { result_count: 2 },
  })) });
  assert.equal(unusable.observations.length, 0);
  assert.equal(unusable.provider.discardedCount, 2);
  assert.equal(unusable.coverage[0].status, 'unavailable');
});
