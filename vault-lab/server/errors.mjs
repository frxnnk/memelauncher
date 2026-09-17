export function apiError(status, code, message, details = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

export function redact(value, secret) {
  if (typeof value === 'string') return secret ? value.replaceAll(secret, '[REDACTED_API_KEY]') : value;
  if (Array.isArray(value)) return value.map(item => redact(item, secret));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, secret)]));
  }
  return value;
}

export async function fetchJson(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { ...init, signal: controller.signal });
        if (!response.ok) throw apiError(502, 'UPSTREAM_HTTP_ERROR', 'The provider rejected the request. Check your balance, permissions, and API status.', { upstreamStatus: response.status });
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8 * 1024 * 1024) {
            await reader.cancel();
            throw apiError(502, 'UPSTREAM_INVALID', 'The provider response exceeds the allowed size.');
          }
          chunks.push(value);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      })(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(apiError(504, 'UPSTREAM_TIMEOUT', 'The API did not complete the attempt within the time limit. This does not count as a loss.'));
          controller.abort();
        }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (error.status) throw error;
    throw apiError(502, 'UPSTREAM_UNAVAILABLE', 'Could not get a valid response from the API. This does not count as a loss.');
  } finally {
    clearTimeout(timer);
  }
}
