import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import {
  FORBIDDEN_OPERATING_BOXES,
  PRODUCT_X402_BOX
} from '../server/x402-operating-box-policy.mjs';
import { TURSO_WSL_BIN } from './paid-beta-turso.mjs';

const CADDY_API = /vault-beta-api\.173\.212\.246\.68\.sslip\.io\/api\/:path\*/;

export const REQUIRED_VERCEL_PRODUCTION_ENV_NAMES = Object.freeze([
  'VAULT_X402_PRIVATE_KEY',
  'VAULT_WEB_FUNDING_CONFIG',
  'VAULT_DURABLE_DATA',
  'VAULT_LIBSQL_URL',
  'VAULT_LIBSQL_AUTH_TOKEN',
  'VAULT_ACCESS_MODE',
  'VAULT_CLOSED_BETA',
  'VAULT_PUBLIC_ORIGIN',
  'OPENROUTER_API_KEY',
  'PRIVY_APP_ID',
  'PRIVY_CLIENT_ID',
  'PRIVY_VERIFICATION_KEY'
]);

export function isCaddyApiRewrite(config = {}) {
  const destination = (config.rewrites ?? []).find(rule => rule.source === '/api/:path*')?.destination ?? '';
  return CADDY_API.test(destination) && config.functions === undefined;
}

export function isNodeApiCutover(config = {}) {
  const destination = (config.rewrites ?? []).find(rule => rule.source === '/api/:path*')?.destination ?? '';
  return destination === '/api/index?__vault_path=/api/:path*'
    && Boolean(config.functions?.['api/index.mjs']);
}

export function inspectX402Address(address) {
  if (typeof address !== 'string' || !address.trim()) {
    return { present: false, matchesProduct: false, forbidden: false };
  }
  const lower = address.trim().toLowerCase();
  return {
    present: true,
    address: lower,
    matchesProduct: lower === PRODUCT_X402_BOX,
    forbidden: FORBIDDEN_OPERATING_BOXES.includes(lower),
    kind: lower === PRODUCT_X402_BOX ? 'product' : (FORBIDDEN_OPERATING_BOXES.includes(lower) ? 'forbidden' : 'other')
  };
}

export function inspectLocalX402Key(raw) {
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) return { present: false, matchesProduct: false, forbidden: false };
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    return { present: true, matchesProduct: false, forbidden: false, format: 'invalid' };
  }
  return inspectX402Address(privateKeyToAccount(normalized).address);
}

export function parseVercelEnvNames(text = '') {
  if (!text || /no environment variables found/i.test(text)) return [];
  const skip = new Set([
    'NAME', 'VALUE', 'ENVIRONMENTS', 'ENVIRONMENT', 'CREATED', 'PRODUCTION',
    'PREVIEW', 'DEVELOPMENT', 'ENCRYPTED', 'COMMON', 'UPDATED', 'AGE'
  ]);
  const names = new Set();
  for (const match of String(text).matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
    const name = match[1];
    if (skip.has(name)) continue;
    if (/^(VAULT_|PRIVY_|OPENROUTER_|TELEGRAM_)/.test(name)) names.add(name);
  }
  return [...names].sort();
}

export function parseTursoWhoami(text = '') {
  const combined = String(text ?? '');
  const line = combined.split(/\r?\n/).map(item => item.trim()).find(Boolean) || '';
  if (/not logged|please login|unauthoriz/i.test(combined)) {
    return { loggedIn: false, whoami: line, loginStarted: false };
  }
  return {
    loggedIn: Boolean(line),
    whoami: line,
    loginStarted: false
  };
}

function x402Report(inspection) {
  return {
    present: Boolean(inspection.present),
    match: inspection.matchesProduct ? 'yes' : 'no',
    matchesProduct: Boolean(inspection.matchesProduct),
    forbidden: Boolean(inspection.forbidden),
    ...(inspection.address ? { address: inspection.address } : {}),
    ...(inspection.format ? { format: inspection.format } : {}),
    keysPrinted: false
  };
}

export function assessVercelPaidBetaPreflight({
  vercelJson,
  cutoverExists,
  x402PrivateKey,
  x402Address,
  vercelEnvNames = [],
  tursoWhoami = '',
  env = {}
} = {}) {
  const caddyRewriteLive = isCaddyApiRewrite(vercelJson);
  const nodeApiCutoverLive = isNodeApiCutover(vercelJson);
  const x402 = x402Address !== undefined
    ? inspectX402Address(x402Address)
    : inspectLocalX402Key(x402PrivateKey);
  const turso = parseTursoWhoami(tursoWhoami);
  const requiredProductionEnvNames = [...REQUIRED_VERCEL_PRODUCTION_ENV_NAMES];
  const listed = new Set(vercelEnvNames);
  const missingVercelEnvNames = requiredProductionEnvNames.filter(name => !listed.has(name));
  const libsqlEnvPresent = Boolean(env.VAULT_LIBSQL_URL?.trim() && env.VAULT_LIBSQL_AUTH_TOKEN?.trim());
  const blockers = [];
  if (!caddyRewriteLive && !nodeApiCutoverLive) {
    blockers.push('vercel.json /api rewrite is neither the Caddy backup nor the approved Node cutover.');
  }
  if (!cutoverExists) {
    blockers.push('deploy/vercel.api-cutover.json is missing.');
  }
  if (x402.forbidden) {
    blockers.push('VAULT_X402_PRIVATE_KEY maps to a forbidden box (0xf282/0xbec4/0x686c). Product box must be 0xf670531e46ba92f49c5d9c11d2c03875cffe7d40 (match: no).');
  } else if (!x402.matchesProduct) {
    blockers.push(x402.present
      ? 'Local x402 address does not match product box 0xf670531e46ba92f49c5d9c11d2c03875cffe7d40 (match: no).'
      : 'VAULT_X402_PRIVATE_KEY is missing; product box must be 0xf670531e46ba92f49c5d9c11d2c03875cffe7d40 (match: no).');
  }
  if (!turso.loggedIn) {
    blockers.push('Turso is not logged in (wsl auth whoami). Do not start login from this preflight.');
  }
  if (!libsqlEnvPresent) {
    blockers.push('Gitignored env is missing VAULT_LIBSQL_URL and/or VAULT_LIBSQL_AUTH_TOKEN.');
  }
  if (missingVercelEnvNames.length) {
    blockers.push(`Vercel Production env names are not set (${missingVercelEnvNames.join(', ')}). Do not write project env from this preflight.`);
  }
  return {
    ready: Boolean(
      (caddyRewriteLive || nodeApiCutoverLive)
      && cutoverExists
      && x402.matchesProduct
      && !x402.forbidden
      && turso.loggedIn
      && libsqlEnvPresent
      && missingVercelEnvNames.length === 0
    ),
    caddyRewriteLive,
    nodeApiCutoverLive,
    cutoverFileExists: Boolean(cutoverExists),
    x402: x402Report(x402),
    requiredProductionEnvNames,
    vercelEnvNames: [...vercelEnvNames],
    missingVercelEnvNames,
    libsqlEnvPresent,
    turso,
    blockers,
    actions: {
      vercelEnvAdd: false,
      vercelProdDeploy: false,
      copiedVercelJson: false,
      keysPrinted: false
    }
  };
}

function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = value;
  }
  return out;
}

function readLocalEnv(root, env) {
  const path = join(root, '.env');
  const fromFile = existsSync(path) ? parseEnvFile(readFileSync(path, 'utf8')) : {};
  return { ...fromFile, ...env };
}

function listVercelEnvNames({ cwd, spawn }) {
  try {
    const result = spawn('vercel', ['env', 'ls'], {
      cwd,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 25000,
      windowsHide: true
    });
    return parseVercelEnvNames(`${result.stdout || ''}\n${result.stderr || ''}`);
  } catch {
    return [];
  }
}

function probeTursoWhoami({ spawn }) {
  try {
    const result = spawn('wsl', ['-u', 'root', '--', TURSO_WSL_BIN, 'auth', 'whoami'], {
      encoding: 'utf8',
      timeout: 25000,
      windowsHide: true
    });
    return `${result.stdout || ''}\n${result.stderr || ''}`;
  } catch (error) {
    return error?.message || 'wsl turso whoami unavailable';
  }
}

function assertNoSecrets(report, env = {}) {
  const text = JSON.stringify(report);
  if (/0x[0-9a-fA-F]{64}/.test(text)) {
    throw new Error('Refusing to print a private key.');
  }
  for (const name of ['VAULT_X402_PRIVATE_KEY', 'VAULT_LIBSQL_AUTH_TOKEN', 'OPENROUTER_API_KEY', 'PRIVY_VERIFICATION_KEY']) {
    const value = env[name]?.trim();
    if (value && value.length >= 8 && text.includes(value)) {
      throw new Error('Refusing to print a secret value.');
    }
  }
}

export function runPaidBetaVercelPreflight({
  root,
  env = process.env,
  spawn = spawnSync
} = {}) {
  const vercelJson = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const cutoverExists = existsSync(join(root, 'deploy/vercel.api-cutover.json'));
  const localEnv = readLocalEnv(root, env);
  const vercelEnvNames = listVercelEnvNames({ cwd: root, spawn });
  const tursoWhoami = probeTursoWhoami({ spawn });
  const report = assessVercelPaidBetaPreflight({
    vercelJson,
    cutoverExists,
    x402PrivateKey: localEnv.VAULT_X402_PRIVATE_KEY,
    vercelEnvNames,
    tursoWhoami,
    env: localEnv
  });
  report.turso = {
    ...report.turso,
    command: `wsl -u root -- ${TURSO_WSL_BIN} auth whoami`,
    loginStarted: false
  };
  report.vercelEnvCommand = 'vercel env ls';
  assertNoSecrets(report, localEnv);
  return report;
}

const root = fileURLToPath(new URL('..', import.meta.url));
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = runPaidBetaVercelPreflight({ root });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) {
    console.log('Not ready to cut over.');
    for (const blocker of report.blockers) console.log(`- ${blocker}`);
    process.exitCode = 1;
  }
}
