import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { hostingTopology, resolveDataDirectory } from '../server/hosting.mjs';
import { restoreApiUrl } from '../server/vercel-request.mjs';
import { createRequestListener, createHttpServer } from '../server/http.mjs';
import { createVaultService } from '../server/service.mjs';
import { createLiveX402Payer } from '../server/x402-payer.mjs';
import { privateKeyToAccount } from 'viem/accounts';

const root = fileURLToPath(new URL('..', import.meta.url));

test('vercel.json serves /api on the Node function; Caddy rewrite is the rollback file', () => {
  const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const apiRewrite = (config.rewrites ?? []).find(rule => rule.source === '/api/:path*');
  assert.equal(apiRewrite?.destination, '/api/index?__vault_path=/api/:path*');
  assert.ok(config.functions?.['api/index.mjs']);
  const caddy = JSON.parse(readFileSync(join(root, 'deploy/vercel.caddy-rewrite.json'), 'utf8'));
  const caddyApi = (caddy.rewrites ?? []).find(rule => rule.source === '/api/:path*');
  assert.match(caddyApi?.destination ?? '', /vault-beta-api\.173\.212\.246\.68\.sslip\.io\/api\/:path\*/);
  const cutover = JSON.parse(readFileSync(join(root, 'deploy/vercel.api-cutover.json'), 'utf8'));
  const cutoverApi = (cutover.rewrites ?? []).find(rule => rule.source === '/api/:path*');
  assert.equal(cutoverApi?.destination, '/api/index?__vault_path=/api/:path*');
  const ignore = readFileSync(join(root, '.vercelignore'), 'utf8');
  assert.match(ignore, /^\.env$/m);
  assert.ok((config.rewrites ?? []).some(rule => rule.source === '/fairness' && rule.destination === '/fairness.html'));
  assert.ok((cutover.rewrites ?? []).some(rule => rule.source === '/fairness' && rule.destination === '/fairness.html'));
});

test('Vercel hosting uses env-backed /tmp data and no background Windows service', () => {
  assert.deepEqual(hostingTopology({}), { name: 'local', ephemeralData: false, backgroundTimers: true });
  assert.deepEqual(hostingTopology({ VERCEL: '1' }), { name: 'vercel', ephemeralData: true, backgroundTimers: false });
  assert.deepEqual(hostingTopology({ VERCEL: '1', VAULT_DURABLE_DATA: 'true' }),
    { name: 'vercel', ephemeralData: false, backgroundTimers: false });
  assert.equal(resolveDataDirectory('/app', { VERCEL: '1' }), '/tmp/vault-data');
  assert.equal(resolveDataDirectory('/app', { VERCEL: '1', VAULT_DURABLE_DATA: 'true', VAULT_DATA_DIRECTORY: '/tmp/vault-paid' }), '/tmp/vault-paid');
  assert.throws(() => resolveDataDirectory('/app', { VERCEL: '1', VAULT_DATA_DIRECTORY: '/var/data/vault' }), /\/tmp/);
  assert.throws(() => resolveDataDirectory('/app', { VERCEL: '1', VAULT_DATA_DIRECTORY: '/tmp/web-funding-testnet' }), /rehearsal|web-funding-testnet/i);
  assert.equal(resolveDataDirectory('/app', {}), join('/app', '.local'));
  assert.equal(resolveDataDirectory('/app', { VAULT_DATA_DIRECTORY: '/var/data/vault' }), '/var/data/vault');
  assert.equal(restoreApiUrl({ url: '/api/index', headers: { 'x-forwarded-uri': '/api/status' } }), '/api/status');
  assert.equal(restoreApiUrl({ url: '/api/status', headers: {} }), '/api/status');
  assert.equal(restoreApiUrl({ url: '/api/index?__vault_path=/api/funding/config' }), '/api/funding/config');
  assert.equal(restoreApiUrl({ url: '/api/index?__vault_path=/api/status&ui=1' }), '/api/status?ui=1');
  assert.equal(restoreApiUrl({ url: '/api/funding/config?__vault_path=/api/funding/config' }), '/api/funding/config');
  assert.equal(restoreApiUrl({ url: '/api/index.mjs?__vault_path=/api/funding/config' }), '/api/funding/config');
  assert.equal(restoreApiUrl({ url: '/api/index?__vault_path=/api/funding/account&_vercel_share=1' }), '/api/funding/account');
  assert.equal(restoreApiUrl({
    url: '/api/funding/account?__vault_path=/api/funding/account&_vercel_share=1'
  }), '/api/funding/account');
  assert.equal(restoreApiUrl({
    url: '/api/index?__vault_path=/api/funding/deposits&before=abc&_vercel_share=1'
  }), '/api/funding/deposits?before=abc');
  assert.equal(restoreApiUrl({
    url: '/api/index?__vault_path=/api/funding/account&path=funding/account'
  }), '/api/funding/account');
  assert.equal(restoreApiUrl({
    url: '/api/index?__vault_path=/api/funding/deposits&path=funding/deposits&before=abc'
  }), '/api/funding/deposits?before=abc');
  assert.equal(restoreApiUrl({
    url: '/api/funding/account?path=funding/account'
  }), '/api/funding/account');
  assert.equal(restoreApiUrl({
    url: '/api/index',
    headers: { 'x-forwarded-uri': '/api/funding/account?path=funding/account' }
  }), '/api/funding/account');
  assert.equal(restoreApiUrl({
    url: '/api/index?__vault_path=/api/funding/account&path=funding%2Faccount'
  }), '/api/funding/account');
  assert.equal(restoreApiUrl({
    url: '/api/index?__vault_path=/api/funding/deposits/order1/check&path=funding/deposits/order1/check'
  }), '/api/funding/deposits/order1/check');
  assert.equal(restoreApiUrl({
    url: '/api/funding/deposits/order1?path=funding/deposits/order1'
  }), '/api/funding/deposits/order1');
  assert.equal(restoreApiUrl({
    url: '/api/index?__vault_path=/api/funding/attempts&path=funding/attempts'
  }), '/api/funding/attempts');
  assert.equal(restoreApiUrl({
    url: '/api/funding/attempts?path=funding/attempts'
  }), '/api/funding/attempts');
  assert.equal(restoreApiUrl({ url: '/api/index', headers: { 'x-forwarded-uri': '/api/index' } }), '/api/index');
});

test('the HTTP listener answers /api/status without listen() or a VPS service', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-vercel-listener-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'public'));
  await writeFile(join(directory, 'public', 'index.html'), '<h1>Practice</h1>');
  await writeFile(join(directory, 'public', 'landing.html'), '<h1>Landing</h1>');
  const key = `0x${'11'.repeat(32)}`;
  const payment = createLiveX402Payer({ VAULT_X402_PRIVATE_KEY: key, VAULT_X402_FLOOR_USDC: '1' });
  const service = createVaultService({
    apiKey: '', payment, logDir: join(directory, '.local'),
    fetchImpl: () => { throw new Error('Unexpected network call'); }
  });
  t.after(() => service.close());
  const listener = createRequestListener({ service, publicDir: join(directory, 'public') });
  const server = createServer(listener);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const status = await (await fetch(`http://127.0.0.1:${server.address().port}/api/status`)).json();
  assert.equal(status.paidConfigured, true);
  assert.equal(status.mode, 'x402-exact');
  assert.equal(status.bountyEnabled, false);
  assert.equal(payment.address.toLowerCase(), privateKeyToAccount(key).address.toLowerCase());
  assert.equal(typeof createHttpServer, 'function');
});
