import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import {
  FORBIDDEN_OPERATING_BOXES,
  LAPTOP_REHEARSAL_BOX,
  PAYER_BOX,
  PRODUCT_X402_BOX,
  TREASURY_BOX
} from '../server/x402-operating-box-policy.mjs';
import {
  REQUIRED_VERCEL_PRODUCTION_ENV_NAMES,
  assessVercelPaidBetaPreflight,
  inspectLocalX402Key,
  inspectX402Address,
  isCaddyApiRewrite,
  isNodeApiCutover,
  parseTursoWhoami,
  parseVercelEnvNames
} from '../scripts/paid-beta-vercel-preflight.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const CADDY_API = 'https://vault-beta-api.173.212.246.68.sslip.io/api/:path*';

function caddyConfig() {
  return { rewrites: [{ source: '/api/:path*', destination: CADDY_API }] };
}

test('required Vercel Production env names come from .env.example and boot', () => {
  const names = REQUIRED_VERCEL_PRODUCTION_ENV_NAMES;
  for (const name of [
    'VAULT_X402_PRIVATE_KEY',
    'VAULT_WEB_FUNDING_CONFIG',
    'VAULT_DURABLE_DATA',
    'VAULT_LIBSQL_URL',
    'VAULT_LIBSQL_AUTH_TOKEN'
  ]) {
    assert.ok(names.includes(name), name);
  }
  for (const extra of [
    'VAULT_ACCESS_MODE',
    'VAULT_CLOSED_BETA',
    'VAULT_PUBLIC_ORIGIN',
    'OPENROUTER_API_KEY',
    'PRIVY_APP_ID',
    'PRIVY_CLIENT_ID',
    'PRIVY_VERIFICATION_KEY'
  ]) {
    assert.ok(names.includes(extra), extra);
  }
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  const bootSources = [
    'server/boot.mjs',
    'server/x402-payer.mjs',
    'server/storage/database.mjs',
    'server/runtime.mjs',
    'server/auth.mjs'
  ].map(file => readFileSync(join(root, file), 'utf8')).join('\n');
  for (const name of names) {
    assert.match(example, new RegExp(name));
    assert.match(bootSources, new RegExp(name));
  }
  const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
  assert.match(packageJson, /paid-beta:vercel-preflight/);
  assert.doesNotMatch(packageJson, /vercel env add/);
  assert.doesNotMatch(packageJson, /vercel --prod/);
  const script = readFileSync(join(root, 'scripts/paid-beta-vercel-preflight.mjs'), 'utf8');
  assert.doesNotMatch(script, /env add/);
  assert.doesNotMatch(script, /--prod/);
  assert.doesNotMatch(script, /copyFile(?:Sync)?\([^)]*vercel\.json|vercel\.json[^)]*copyFile/);
});

test('forbidden treasury, payer and laptop boxes never match the product x402 address', () => {
  assert.deepEqual(FORBIDDEN_OPERATING_BOXES, [TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX]);
  for (const address of [TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX]) {
    const inspection = inspectX402Address(address);
    assert.equal(inspection.matchesProduct, false);
    assert.equal(inspection.forbidden, true);
    assert.notEqual(address, PRODUCT_X402_BOX);
    const report = assessVercelPaidBetaPreflight({
      vercelJson: caddyConfig(),
      cutoverExists: true,
      x402Address: address,
      vercelEnvNames: [...REQUIRED_VERCEL_PRODUCTION_ENV_NAMES],
      tursoWhoami: 'user@example.com',
      env: { VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok' }
    });
    assert.equal(report.ready, false);
    assert.equal(report.x402.matchesProduct, false);
    assert.ok(report.blockers.some(item => /0xf670531e46ba92f49c5d9c11d2c03875cffe7d40|forbidden/i.test(item)));
    assert.doesNotMatch(JSON.stringify(report), /0x[0-9a-fA-F]{64}/);
  }
  const product = inspectX402Address(PRODUCT_X402_BOX);
  assert.equal(product.matchesProduct, true);
  assert.equal(product.forbidden, false);
});

test('a local x402 key is reported as match yes/no and the key is never printed', () => {
  const otherKey = `0x${'11'.repeat(32)}`;
  const other = inspectLocalX402Key(otherKey);
  assert.equal(other.present, true);
  assert.equal(other.matchesProduct, false);
  assert.equal(other.forbidden, false);
  assert.equal(other.address, privateKeyToAccount(otherKey).address.toLowerCase());
  const serialized = JSON.stringify(other);
  assert.doesNotMatch(serialized, new RegExp(otherKey.slice(2), 'i'));
  assert.doesNotMatch(serialized, /0x[0-9a-fA-F]{64}/);
  const missing = inspectLocalX402Key('');
  assert.equal(missing.present, false);
  assert.equal(missing.matchesProduct, false);
});

test('live vercel.json is the approved Node /api cutover; Caddy rewrite is the rollback file', () => {
  const live = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.equal(isCaddyApiRewrite(live), false);
  assert.equal(isNodeApiCutover(live), true);
  const apiRewrite = (live.rewrites ?? []).find(rule => rule.source === '/api/:path*');
  assert.equal(apiRewrite?.destination, '/api/index?__vault_path=/api/:path*');
  assert.ok(live.functions?.['api/index.mjs']);
  const caddy = JSON.parse(readFileSync(join(root, 'deploy/vercel.caddy-rewrite.json'), 'utf8'));
  assert.equal(isCaddyApiRewrite(caddy), true);
  const cutover = JSON.parse(readFileSync(join(root, 'deploy/vercel.api-cutover.json'), 'utf8'));
  assert.equal(isCaddyApiRewrite(cutover), false);
  assert.equal(cutover.rewrites.find(rule => rule.source === '/api/:path*')?.destination,
    '/api/index?__vault_path=/api/:path*');
  const report = assessVercelPaidBetaPreflight({
    vercelJson: live,
    cutoverExists: true,
    x402PrivateKey: '',
    vercelEnvNames: [],
    tursoWhoami: 'You are not logged in, please login with turso auth login before running other commands.',
    env: {}
  });
  assert.equal(report.caddyRewriteLive, false);
  assert.equal(report.nodeApiCutoverLive, true);
  assert.equal(report.cutoverFileExists, true);
  assert.equal(report.ready, false);
  assert.equal(isCaddyApiRewrite({
    functions: { 'api/index.mjs': {} },
    rewrites: [{ source: '/api/:path*', destination: '/api/index?__vault_path=/api/:path*' }]
  }), false);
});

test('cutover is not ready when Vercel names, Turso login or libsql env are missing', () => {
  assert.deepEqual(parseVercelEnvNames(''), []);
  assert.deepEqual(parseVercelEnvNames('No environment variables found'), []);
  assert.deepEqual(parseVercelEnvNames([
    ' name                           value               environments',
    ' VAULT_X402_PRIVATE_KEY         Encrypted           Production',
    ' OPENROUTER_API_KEY             Encrypted           Production'
  ].join('\n')), ['OPENROUTER_API_KEY', 'VAULT_X402_PRIVATE_KEY']);
  assert.equal(parseTursoWhoami('You are not logged in, please login with turso auth login').loggedIn, false);
  assert.equal(parseTursoWhoami('logged in as operator@example.com').loggedIn, true);
  assert.equal(parseTursoWhoami('frxnnk').loggedIn, true);
  assert.equal(parseTursoWhoami('frxnnk').whoami, 'frxnnk');
  assert.equal(parseTursoWhoami('please login with turso auth login').loggedIn, false);
  assert.equal(parseTursoWhoami('not logged in').loggedIn, false);
  assert.equal(parseTursoWhoami('').loggedIn, false);

  const incomplete = assessVercelPaidBetaPreflight({
    vercelJson: caddyConfig(),
    cutoverExists: true,
    x402Address: PRODUCT_X402_BOX,
    vercelEnvNames: [],
    tursoWhoami: 'You are not logged in, please login with turso auth login',
    env: {}
  });
  assert.equal(incomplete.x402.matchesProduct, true);
  assert.equal(incomplete.libsqlEnvPresent, false);
  assert.equal(incomplete.turso.loggedIn, false);
  assert.deepEqual(incomplete.missingVercelEnvNames, [...REQUIRED_VERCEL_PRODUCTION_ENV_NAMES]);
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.blockers.some(item => /Turso/i.test(item)));
  assert.ok(incomplete.blockers.some(item => /VAULT_LIBSQL_URL/i.test(item)));
  assert.ok(incomplete.blockers.some(item => /Vercel Production env/i.test(item)));
  assert.equal(incomplete.actions.vercelEnvAdd, false);
  assert.equal(incomplete.actions.vercelProdDeploy, false);
  assert.equal(incomplete.actions.copiedVercelJson, false);
  assert.equal(incomplete.actions.keysPrinted, false);

  const ready = assessVercelPaidBetaPreflight({
    vercelJson: caddyConfig(),
    cutoverExists: true,
    x402Address: PRODUCT_X402_BOX,
    vercelEnvNames: [...REQUIRED_VERCEL_PRODUCTION_ENV_NAMES],
    tursoWhoami: 'user@example.com',
    env: { VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok' }
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.caddyRewriteLive, true);
  assert.deepEqual(ready.blockers, []);

  const cutoverLive = assessVercelPaidBetaPreflight({
    vercelJson: JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')),
    cutoverExists: true,
    x402Address: PRODUCT_X402_BOX,
    vercelEnvNames: [...REQUIRED_VERCEL_PRODUCTION_ENV_NAMES],
    tursoWhoami: 'frxnnk',
    env: { VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok' }
  });
  assert.equal(cutoverLive.nodeApiCutoverLive, true);
  assert.equal(cutoverLive.ready, true);

  const vercelPaid = JSON.parse(readFileSync(join(root, 'config/paid-beta.vercel.json'), 'utf8'));
  assert.equal(vercelPaid.asset.destination, '0xbec4fdb33ed39844956d9078fd232aca92d7396d');
  assert.equal(vercelPaid.terms.price, '5000000000000000000');
  assert.equal(vercelPaid.rounds[0].models[0], 'anthropic/claude-opus-5');
  assert.equal(vercelPaid.rounds[1].id, 'rh-payout-prove-v1');
  assert.equal(vercelPaid.rounds[1].kind, 'payout-proving');
  assert.equal(vercelPaid.rounds[1].models[0], 'anthropic/claude-haiku-4.5');
  assert.notEqual(vercelPaid.asset.destination, '0x0000000000000000000000000000000000000001');

  const usernameOnly = assessVercelPaidBetaPreflight({
    vercelJson: caddyConfig(),
    cutoverExists: true,
    x402Address: PRODUCT_X402_BOX,
    vercelEnvNames: [],
    tursoWhoami: 'frxnnk',
    env: { VAULT_LIBSQL_URL: 'libsql://paid-beta.turso.io', VAULT_LIBSQL_AUTH_TOKEN: 'tok' }
  });
  assert.equal(usernameOnly.turso.loggedIn, true);
  assert.equal(usernameOnly.ready, false);
  assert.ok(!usernameOnly.blockers.some(item => /Turso is not logged in/i.test(item)));
  assert.ok(usernameOnly.blockers.some(item => /Vercel Production env/i.test(item)));
});
