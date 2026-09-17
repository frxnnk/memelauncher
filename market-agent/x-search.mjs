// Official references checked 2026-09-12:
// https://docs.x.com/x-api/posts/search/quickstart/recent-search
// https://docs.x.com/x-api/posts/search-recent-posts
// https://docs.x.com/x-api/fundamentals/rate-limits
import { parseInstant } from './sightings.mjs';

const ENDPOINT = 'https://api.x.com/2/tweets/search/recent';
const ID = /^[0-9]{1,19}$/;
const TOKEN = /^[A-Za-z0-9._~+/=-]{1,2048}$/;
const MAX_TEXT = 30000;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function validate({ storyKey, query, maxResults, sinceId, nextToken, bearerToken, allowPaidRead, fetchImpl }) {
  if (typeof storyKey !== 'string' || !storyKey.trim() || storyKey.length > 120 || /[\u0000-\u001f]/.test(storyKey)) {
    throw new TypeError('storyKey must contain 1..120 printable characters');
  }
  if (typeof query !== 'string' || !query.trim() || query.length > 512 || /[\u0000-\u001f]/.test(query)) {
    throw new TypeError('query must contain 1..512 printable characters');
  }
  if (!Number.isInteger(maxResults) || maxResults < 10 || maxResults > 100) {
    throw new TypeError('maxResults must be an integer from 10 to 100');
  }
  if (sinceId !== undefined && (typeof sinceId !== 'string' || !ID.test(sinceId))) {
    throw new TypeError('sinceId must be a decimal ID with 1..19 digits');
  }
  if (nextToken !== undefined && (typeof nextToken !== 'string' || !TOKEN.test(nextToken))) {
    throw new TypeError('nextToken must be a nonempty bounded pagination token');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof bearerToken !== 'string' || !bearerToken.trim() || /\s/.test(bearerToken)) {
    throw new TypeError('A nonempty bearerToken is required');
  }
  if (allowPaidRead !== true) throw new TypeError('allowPaidRead must be true for this paid API read');
}

function observation(post, storyKey, observedAt) {
  if (!plainObject(post) || typeof post.id !== 'string' || !ID.test(post.id)
    || typeof post.author_id !== 'string' || !ID.test(post.author_id)
    || typeof post.text !== 'string' || !post.text.trim() || post.text.length > MAX_TEXT) return null;
  let publishedAt;
  try {
    const published = parseInstant(post.created_at);
    if (published > parseInstant(observedAt)) return null;
    publishedAt = new Date(published).toISOString();
  } catch {
    return null;
  }
  const metrics = plainObject(post.public_metrics) ? post.public_metrics : {};
  return {
    storyKey,
    sourceUrl: `https://x.com/i/web/status/${post.id}`,
    author: post.author_id,
    authorId: post.author_id,
    publishedAt,
    observedAt,
    text: post.text,
    textBasis: 'verbatim',
    kind: 'unclassified',
    metrics: {
      views: count(metrics.impression_count), likes: count(metrics.like_count),
      reposts: count(metrics.retweet_count ?? metrics.repost_count),
      replies: count(metrics.reply_count), quotes: count(metrics.quote_count),
      bookmarks: count(metrics.bookmark_count),
    },
  };
}

/** One paid GET, only when explicitly enabled. No retries, pagination, or cursor writes. */
export async function collectXRecent({
  storyKey, query, maxResults = 10, sinceId, nextToken, bearerToken,
  allowPaidRead = false, fetchImpl = fetch,
} = {}) {
  validate({ storyKey, query, maxResults, sinceId, nextToken, bearerToken, allowPaidRead, fetchImpl });
  const batch = {
    version: 1, recordedAt: new Date().toISOString(), observations: [], coverage: [],
    provider: {
      name: 'x-recent-search', query, maxResults, endpoint: ENDPOINT,
      ...(sinceId !== undefined ? { requestedSinceId: sinceId } : {}),
      ...(nextToken !== undefined ? { requestedNextToken: nextToken } : {}),
      pagination: 'unknown', partial: false,
      cursorNote: 'newestId describes this page only; it is not a confirmed complete cursor.',
    },
  };
  const unavailable = errorCode => {
    batch.recordedAt = new Date().toISOString();
    batch.provider.errorCode = errorCode;
    batch.coverage = [{ storyKey, status: 'unavailable', note: `X no disponible: ${errorCode}. No prueba ausencia de conversación.` }];
    return batch;
  };
  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('max_results', String(maxResults));
  url.searchParams.set('tweet.fields', 'created_at,public_metrics,author_id');
  url.searchParams.set('sort_order', 'recency');
  if (sinceId !== undefined) url.searchParams.set('since_id', sinceId);
  if (nextToken !== undefined) url.searchParams.set('next_token', nextToken);
  const signal = AbortSignal.timeout(12000);
  let response;
  try {
    response = await fetchImpl(url.href, {
      method: 'GET', headers: { Authorization: `Bearer ${bearerToken}` }, redirect: 'error', signal,
    });
  } catch {
    return unavailable(signal.aborted ? 'TIMEOUT' : 'NETWORK_OR_REDIRECT_ERROR');
  }
  if (response.redirected) return unavailable('REDIRECT_REJECTED');
  if (!response.ok) {
    const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    if (status !== null) batch.provider.httpStatus = status;
    return unavailable(status === null ? 'INVALID_HTTP_RESPONSE' : `HTTP_${status}`);
  }
  batch.provider.httpStatus = response.status;
  let payload;
  try {
    payload = await response.json();
  } catch {
    return unavailable(signal.aborted ? 'TIMEOUT' : 'INVALID_JSON');
  }
  if (!plainObject(payload) || (payload.data !== undefined && !Array.isArray(payload.data))
    || (payload.errors !== undefined && !Array.isArray(payload.errors))) return unavailable('INVALID_RESPONSE');
  const posts = payload.data ?? [];
  const meta = plainObject(payload.meta) ? payload.meta : {};
  batch.provider.errorCount = payload.errors?.length ?? 0;
  if (!Array.isArray(payload.data) && meta.result_count !== 0 && !batch.provider.errorCount) {
    return unavailable('INVALID_RESPONSE');
  }
  const observedAt = new Date().toISOString();
  batch.recordedAt = observedAt;
  batch.observations = posts.slice(0, maxResults).map(post => observation(post, storyKey, observedAt)).filter(Boolean);
  batch.provider.discardedCount = posts.length - batch.observations.length;
  batch.provider.resultCount = count(meta.result_count);
  const invalidNextToken = meta.next_token !== undefined && (typeof meta.next_token !== 'string' || !TOKEN.test(meta.next_token));
  if (!invalidNextToken && meta.next_token !== undefined) batch.provider.nextToken = meta.next_token;
  for (const [remote, local] of [['newest_id', 'newestId'], ['oldest_id', 'oldestId']]) {
    if (typeof meta[remote] === 'string' && ID.test(meta[remote])) batch.provider[local] = meta[remote];
  }
  const countMismatch = batch.provider.resultCount === null || batch.provider.resultCount !== posts.length;
  const incomplete = Boolean(batch.provider.nextToken) || invalidNextToken || batch.provider.errorCount > 0
    || batch.provider.discardedCount > 0 || countMismatch;
  batch.provider.partial = incomplete;
  batch.provider.pagination = incomplete ? 'partial' : nextToken !== undefined ? 'unknown' : 'complete';
  if (!batch.observations.length && (batch.provider.errorCount > 0 || batch.provider.discardedCount > 0)) {
    return unavailable('NO_USABLE_POSTS');
  }
  if (!batch.observations.length && countMismatch) return unavailable('INVALID_RESPONSE');
  const note = incomplete
    ? 'PARCIAL: página pendiente, errores o datos incompletos. No avanzar un cursor confirmado con newestId.'
    : nextToken !== undefined
      ? 'Página recibida; no hay próxima página indicada. La cobertura previa no fue verificada; newestId no confirma un cursor completo.'
      : 'Una página recibida sin continuación indicada para esta consulta. No representa toda X ni acredita demanda.';
  batch.coverage = [{ storyKey, status: 'observed', note }];
  return batch;
}
