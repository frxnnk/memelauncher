const FUNCTION_PATHS = new Set(['/api/index', '/api/index.mjs', '/api']);

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isFunctionPath(pathname) {
  return FUNCTION_PATHS.has(pathname);
}

function withQuery(path, params) {
  const rest = params.toString();
  return rest ? `${path}${path.includes('?') ? '&' : '?'}${rest}` : path;
}

export function isRewriteQueryKey(key) {
  return key === '__vault_path' || key === 'path' || key === 'path*'
    || key.startsWith('_vercel') || key.startsWith('__vercel');
}

export function withoutRewriteQuery(params) {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (isRewriteQueryKey(key)) continue;
    next.append(key, value);
  }
  return next;
}

function stripForwarded(forwarded) {
  const qIndex = forwarded.indexOf('?');
  const pathname = qIndex === -1 ? forwarded : forwarded.slice(0, qIndex);
  const rest = qIndex === -1 ? new URLSearchParams() : withoutRewriteQuery(new URLSearchParams(forwarded.slice(qIndex + 1)));
  return withQuery(pathname, rest);
}

export function restoreApiUrl(request) {
  const current = request.url || '/';
  const qIndex = current.indexOf('?');
  const pathname = qIndex === -1 ? current : current.slice(0, qIndex);
  const search = qIndex === -1 ? '' : current.slice(qIndex + 1);
  const params = new URLSearchParams(search);

  const fromQuery = params.get('__vault_path');
  const rest = withoutRewriteQuery(params);
  if (typeof fromQuery === 'string' && fromQuery.startsWith('/api')) {
    if (isFunctionPath(pathname)) return withQuery(fromQuery, rest);
    if (pathname.startsWith('/api')) return withQuery(pathname, rest);
  }

  const forwarded = header(request, 'x-forwarded-uri');
  if (isFunctionPath(pathname) && typeof forwarded === 'string' && forwarded.startsWith('/api/') &&
      !isFunctionPath(forwarded.split('?')[0])) {
    return stripForwarded(forwarded);
  }

  return rest.size ? withQuery(pathname, rest) : (qIndex === -1 ? current : pathname);
}
