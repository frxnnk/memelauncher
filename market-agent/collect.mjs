import { setTimeout as pauseDefault } from 'node:timers/promises';

const API = 'https://api.dexscreener.com';
const SPACING_MS = 1050;
const TIMEOUT_MS = 12000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validSlug = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);

function arrayOfObjects(value) {
  return Array.isArray(value) && value.every(object);
}

function readPairs(value) {
  if (!object(value) || !arrayOfObjects(value.pairs)) throw new Error('INVALID_PAIRS_RESPONSE');
  return value;
}

function errorMessage(error) {
  const message = error?.message;
  if (typeof message === 'string' && /^(HTTP_[0-9]{3}|INVALID_[A-Z_]+|META_SLUG_MISMATCH)$/.test(message)) return message;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'REQUEST_TIMEOUT';
  return 'REQUEST_FAILED'; // Do not persist arbitrary remote/library error text.
}

/** A bounded public GET collector. The injectable pause is for deterministic offline tests. */
export async function collectMarket({ queries = [], chain = null, limit = 8, fetchImpl = fetch, pause = pauseDefault } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw new Error('limit must be an integer from 1 to 8');
  if (!Array.isArray(queries) || queries.length > 8 || queries.some(q => typeof q !== 'string' || !q.trim() || q.trim().length > 160)) {
    throw new Error('queries must contain at most 8 nonempty strings of at most 160 characters');
  }
  if (chain !== null && (typeof chain !== 'string' || !/^[a-z0-9-]{1,50}$/.test(chain))) {
    throw new Error('chain must be null or a lowercase chain identifier');
  }
  if (typeof fetchImpl !== 'function' || typeof pause !== 'function') throw new Error('fetchImpl and pause must be functions');
  const normalizedQueries = [...new Set(queries.map(q => q.trim()))];
  const requests = [], errors = [], metas = [], searches = [];
  const observedAt = new Date().toISOString();
  const filterPairs = pairs => chain === null ? pairs : pairs.filter(pair => pair.chainId === chain);

  async function get(path, validate) {
    // One shared queue covers trending, all meta details, searches and failed requests.
    if (requests.length) await pause(SPACING_MS);
    const url = API + path;
    const request = { url, observedAt: new Date().toISOString(), ok: false };
    requests.push(request);
    try {
      const response = await fetchImpl(url, {
        method: 'GET', redirect: 'error', headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      let data;
      try { data = await response.json(); } catch { throw new Error('INVALID_JSON_RESPONSE'); }
      request.data = data;
      const validated = validate(data);
      request.ok = true;
      return { data: validated, error: null };
    } catch (error) {
      const message = errorMessage(error);
      errors.push({ endpoint: url, message });
      return { data: null, error: message };
    }
  }

  const trending = await get('/metas/trending/v1', data => {
    if (!arrayOfObjects(data)) throw new Error('INVALID_TRENDING_RESPONSE');
    return data;
  });
  const selected = (trending.data ?? []).slice(0, limit);
  for (const providerMeta of selected) {
    if (!validSlug(providerMeta.slug)) {
      const message = 'INVALID_META_SLUG';
      errors.push({ endpoint: API + '/metas/trending/v1', message });
      metas.push({ ...providerMeta, pairs: [], collectionError: message });
      continue;
    }
    const result = await get(`/metas/meta/v1/${providerMeta.slug}`, data => {
      readPairs(data);
      if (data.slug !== undefined && data.slug !== providerMeta.slug) throw new Error('META_SLUG_MISMATCH');
      return data;
    });
    metas.push({ ...providerMeta, ...(result.data ?? {}), pairs: filterPairs(result.data?.pairs ?? []),
      ...(result.error ? { collectionError: result.error } : {}) });
  }
  for (const query of normalizedQueries) {
    const result = await get('/latest/dex/search?q=' + encodeURIComponent(query), readPairs);
    searches.push({ query, pairs: filterPairs(result.data?.pairs ?? []),
      ...(result.error ? { collectionError: result.error } : {}) });
  }
  return {
    observedAt, source: 'dexscreener',
    coverage: [
      `Provider-selected trending metas: first ${limit}; collected ${metas.length}. This is a bounded sample, not a market census.`,
      `Explicit search queries: ${normalizedQueries.length}; search ranking and matching are provider-controlled.`,
      chain === null ? 'Pair chain filter: none.' : `Pair chain filter: ${chain}. Provider aggregate fields remain unfiltered and are not chain totals.`,
      'Public GET only; no social reach, independent demand, wallet ownership, contract safety or executable liquidity verification.',
      'Reported volume is not net inflow; trending placement and descriptive metadata are not evidence of organic demand.',
    ],
    metas, searches, errors, requests,
  };
}
