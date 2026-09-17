import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { apiError } from './errors.mjs';
import { checkPublicRequest, runtimeConfiguration } from './runtime.mjs';
import { createPublicPractice } from './public-practice.mjs';
import { readOperationalHealth } from './health.mjs';
import { BETA_MODELS } from './beta-access.mjs';
import { withoutRewriteQuery } from './vercel-request.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw apiError(415, 'JSON_REQUIRED', 'The request must use application/json.');
  }
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 32768) {
        tooLarge = true;
        reject(apiError(413, 'BODY_TOO_LARGE', 'The request exceeds the local size limit.'));
      } else if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) return;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.')); }
    });
    request.on('error', () => reject(apiError(400, 'REQUEST_INTERRUPTED', 'The request was interrupted.')));
  });
}

function checkLocalRequest(request) {
  const host = request.headers.host;
  const port = request.socket.localPort;
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) {
    throw apiError(403, 'LOCAL_ONLY', 'This lab only allows local access through 127.0.0.1 or localhost.');
  }
  if (request.headers.origin && request.headers.origin !== `http://${host}`) {
    throw apiError(403, 'ORIGIN_REJECTED', 'Requests from another origin are not allowed.');
  }
  if (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site'])) {
    throw apiError(403, 'ORIGIN_REJECTED', 'Requests from another site are not allowed.');
  }
}

async function serveFile(request, response, pathname, publicDir) {
  const segments = pathname.split('/');
  if (segments.some(part => part.startsWith('.')) || pathname.includes('\\') || pathname.includes('\0')) {
    throw apiError(404, 'NOT_FOUND', 'File not found.');
  }
  const legacyChat = new URL(request.url, 'http://localhost').searchParams.has('ui');
  const relative = pathname === '/' ? (legacyChat ? 'index.html' : 'landing.html')
    : pathname === '/play' || pathname === '/play/' ? 'index.html'
    : pathname === '/sign-deposit' || pathname === '/sign-deposit/' ? 'sign-deposit.html'
    : pathname === '/fairness' || pathname === '/fairness/' ? 'fairness.html'
    : pathname.slice(1);
  if (!MIME[extname(relative).toLowerCase()]) throw apiError(404, 'NOT_FOUND', 'File not found.');
  let filePath;
  try {
    const root = await realpath(publicDir);
    filePath = await realpath(resolve(root, relative));
    if (!filePath.startsWith(`${root}${sep}`) || !(await stat(filePath)).isFile()) {
      throw apiError(404, 'NOT_FOUND', 'File not found.');
    }
  } catch { throw apiError(404, 'NOT_FOUND', 'File not found.'); }
  const content = await readFile(filePath);
  response.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()], 'Cache-Control': 'no-cache' });
  response.end(request.method === 'HEAD' ? undefined : content);
}

export function createRequestListener({ service, publicDir, economy, creditGame, creditHistory, funding, authentication, limits, beta, channels = () => ({ telegram: { enabled: false } }), runtime = runtimeConfiguration() }) {
  const isPublic = runtime.mode === 'public-practice';
  if (isPublic && (!authentication?.configured || !limits)) throw new Error('Public practice requires configured Privy and persistent usage limits.');
  if (runtime.closedBeta && (!isPublic || !beta)) throw new Error('Closed beta requires its persistent admission service.');
  if (beta && !runtime.closedBeta) throw new Error('Admission service requires closed-beta runtime.');
  const practice = isPublic ? createPublicPractice({ vault: service, authentication, limits, beta }) : null;
  return async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    const privySources = authentication?.configured ? ' https://auth.privy.io' : '';
    const fundingSources = funding ? ' https://rpc.testnet.chain.robinhood.com' : '';
    response.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${privySources}${fundingSources}; frame-src ${privySources.trim() || "'none'"}; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    try {
      if (isPublic) checkPublicRequest(request, runtime); else checkLocalRequest(request);
      let pathname;
      try { pathname = decodeURIComponent(request.url.split('?')[0]); }
      catch { throw apiError(400, 'INVALID_PATH', 'Invalid path.'); }
      if (!pathname.startsWith('/')) throw apiError(400, 'INVALID_PATH', 'Invalid path.');
      const cleaned = withoutRewriteQuery(new URL(request.url, 'http://localhost').searchParams);
      request.url = cleaned.size ? `${pathname}?${cleaned}` : pathname;
      if (request.method === 'GET' && pathname === '/api/channels') return json(response, 200, channels());
      if (request.method === 'GET' && pathname === '/api/health') {
        const health = readOperationalHealth({ service, limits, runtime, beta });
        return json(response, health.statusCode, health.body);
      }
      if (request.method === 'GET' && pathname === '/api/auth/config') return json(response, 200, {
        ...(authentication?.publicConfig() ?? { provider: 'privy', configured: false, realFunds: false }),
        accessMode: runtime.mode, closedBeta:Boolean(beta), publicAdmission:Boolean(beta?.publicAdmission), sandboxEnabled: !isPublic, creditRecordsEnabled: Boolean(creditHistory), webFundingEnabled: Boolean(funding) });
      if (pathname.startsWith('/api/funding/')) {
        if (!funding) {
          if (request.method === 'GET' && pathname === '/api/funding/config') return json(response, 200, { enabled: false, realFundsEnabled: false });
          if (request.method === 'GET' && pathname === '/api/funding/fairness') {
            return json(response, 200, {
              enabled: false, realFundsEnabled: false, custody: 'operator-controlled',
              attestation: 'operator-recorded-rpc-not-independent-attestation',
              demonstrated: { depositToTreasury: false, paidAttempt: false, bountyAccrued: false, prizeSent: false, attestedExecutor: false },
              rounds: [], attempts: [], deposits: []
            });
          }
          throw apiError(404, 'FUNDING_DISABLED', 'Web funding is not enabled on this deployment.');
        }
        return json(response, 200, await funding.handle(request.headers, request.method, pathname,
          new URL(request.url, 'http://localhost').searchParams, request.method === 'POST' ? await readJson(request) : undefined));
      }
      if (request.method === 'GET' && pathname === '/api/account') {
        if (!authentication) throw apiError(503, 'AUTH_NOT_CONFIGURED', 'Privy is not configured yet.');
        const principal = await authentication.authenticate(request.headers);
        if (principal.localOperatorTreasury) {
          throw apiError(400, 'WALLET_NOT_VERIFIED', 'Choose a wallet verified for your account.');
        }
        return json(response, 200, { ...principal, ...(beta ? { beta:beta.status(principal.accountId) } : {}) });
      }
      if (pathname === '/api/beta/redeem') {
        if (!beta) throw apiError(404, 'BETA_DISABLED', 'Invitation access is not enabled.');
        if (request.method !== 'POST') throw apiError(405, 'METHOD_NOT_ALLOWED', 'Use POST to redeem your invitation.');
        const principal = await authentication.authenticate(request.headers);
        const body = await readJson(request);
        if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.code !== 'string') throw apiError(400, 'INVALID_INPUT', 'Submit only your invitation code.');
        return json(response, 200, { beta:beta.redeem(principal.accountId, body.code.trim()) });
      }
      if (request.method === 'GET' && pathname === '/api/status') {
        const state = service.status();
        // An armed operating box only pays inference. A bounty exists when a funded credit route is connected.
        return json(response, 200, { ...state, bountyEnabled: Boolean(state.bountyEnabled && funding),
          accessMode: runtime.mode, closedBeta:Boolean(beta), authentication: isPublic ? 'privy' : 'local-only', sandboxEnabled: !isPublic });
      }
      if (request.method === 'GET' && pathname === '/api/rules') return json(response, 200, service.rules());
      if (request.method === 'GET' && pathname === '/api/models') {
        const catalog = await service.models();
        return json(response, 200, beta ? { ...catalog, models:catalog.models.filter(model => BETA_MODELS.includes(model.id)) } : catalog);
      }
      if (isPublic && pathname.startsWith('/api/sandbox/')) throw apiError(404, 'SANDBOX_DISABLED', 'Accounting simulation is unavailable in public practice.');
      if (isPublic && request.method === 'GET' && pathname === '/api/usage') return json(response, 200, await practice.usage(request.headers));
      if (pathname === '/api/credits' || pathname === '/api/credits/deposits' || pathname.startsWith('/api/credits/deposits/')) {
        if (beta) beta.assertAccess((await authentication.authenticate(request.headers)).accountId);
        if (request.method !== 'GET') throw apiError(405, 'CREDIT_READ_ONLY', 'Credit records support reading only. No payment or deposit action is exposed.');
        if (!creditHistory) throw apiError(503, 'CREDITS_NOT_CONFIGURED', 'Account credit records are not connected yet. Deposits and payouts are disabled.');
        const query = new URL(request.url, 'http://localhost').searchParams;
        if ([...query.keys()].some(key => pathname !== '/api/credits/deposits' || key !== 'before') || query.getAll('before').length > 1) {
          throw apiError(400, 'INVALID_CREDIT_QUERY', 'Only one deposit page cursor is accepted.');
        }
        const result = pathname === '/api/credits' ? await creditHistory.summary(request.headers)
          : pathname === '/api/credits/deposits' ? await creditHistory.list(request.headers, query.get('before') ?? undefined)
          : await creditHistory.get(request.headers, pathname.slice('/api/credits/deposits/'.length));
        return json(response, 200, result);
      }
      if (request.method === 'GET' && pathname === '/api/receipts/public') {
        const query = new URL(request.url, 'http://localhost').searchParams;
        if ([...query.keys()].some(key => key !== 'before') || query.getAll('before').length > 1) {
          throw apiError(400, 'INVALID_RECEIPT_QUERY', 'Only one receipt page cursor is accepted.');
        }
        return json(response, 200, service.publicReceipts(query.get('before')));
      }
      if (isPublic && request.method === 'GET' && (pathname === '/api/receipts' || pathname.startsWith('/api/receipts/'))) {
        const { accountId } = await authentication.authenticate(request.headers);
        beta?.assertAccess(accountId);
        const query = new URL(request.url, 'http://localhost').searchParams;
        if ([...query.keys()].some(key => pathname !== '/api/receipts' || key !== 'before') || query.getAll('before').length > 1) {
          throw apiError(400, 'INVALID_RECEIPT_QUERY', 'Only one receipt page cursor is accepted.');
        }
        return json(response, 200, pathname === '/api/receipts'
          ? service.receiptHistory(accountId, query.get('before')) : service.receipt(accountId, pathname.slice('/api/receipts/'.length)));
      }
      if (request.method === 'POST' && pathname === '/api/attempt') {
        const body = await readJson(request);
        return json(response, 200, isPublic ? await practice.attempt(request.headers, body) : await service.attempt(body));
      }
      if (economy && request.method === 'GET' && pathname === '/api/sandbox/treasury') return json(response, 200, economy.state());
      if (economy && request.method === 'GET' && pathname === '/api/sandbox/export') return json(response, 200, economy.export());
      if (economy && request.method === 'POST' && pathname === '/api/sandbox/action') return json(response, 200, economy.action(await readJson(request)));
      if (creditGame && request.method === 'POST' && pathname === '/api/sandbox/model-attempt') return json(response, 200, await creditGame.attempt(await readJson(request)));
      if (creditGame && request.method === 'GET' && pathname === '/api/sandbox/model-attempt') return json(response, 200, creditGame.result(new URL(request.url, 'http://localhost').searchParams.get('key')));
      if (creditGame && request.method === 'POST' && pathname === '/api/sandbox/reconcile-model') {
        const input = await readJson(request);
        if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'key')) throw apiError(400, 'INVALID_ATTEMPT_KEY', 'Only an existing attempt key is accepted.');
        return json(response, 200, creditGame.reconcile(input.key));
      }
      if (pathname === '/api' || pathname.startsWith('/api/')) throw apiError(404, 'API_NOT_FOUND', 'API route not found.');
      if (!['GET', 'HEAD'].includes(request.method)) throw apiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      await serveFile(request, response, pathname, publicDir);
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      const status = Number.isInteger(error.status) ? error.status : 500;
      json(response, status, {
        error: { code: error.code && error.status ? error.code : 'INTERNAL_ERROR',
          message: error.status ? error.message : 'The local server could not complete the request.' },
        ...(error.receipt ? { receipt: error.receipt } : {}),
        ...(error.accounting ? { accounting: error.accounting } : {}),
        ...(error.modelAttemptKey ? { modelAttemptKey: error.modelAttemptKey } : {})
      });
    }
  };
}

export function createHttpServer(options) {
  const server = createServer(createRequestListener(options));
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
