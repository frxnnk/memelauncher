import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createHttpServer } from '../server/http.mjs';
import { createVaultService } from '../server/service.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'vault-http-'));
  const publicDir = join(root, 'public');
  await mkdir(publicDir);
  await writeFile(join(publicDir, 'index.html'), '<h1>Practice</h1>');
  await writeFile(join(publicDir, 'landing.html'), '<h1>Vault landing</h1>');
  await writeFile(join(publicDir, 'fairness.html'), '<h1>Public ledger</h1>');
  await writeFile(join(root, '.env'), 'SHOULD_NEVER_BE_SERVED');
  const service = createVaultService({ apiKey: '', logDir: join(root, '.local'), fetchImpl: () => { throw new Error('Unexpected network call'); } });
  const server = createHttpServer({ service, publicDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('local server serves actual UI and reports practice without secrets or bounty', async t => {
  const { base } = await fixture(t);
  const html = await fetch(base);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Vault landing/);
  for (const path of ['/play', '/play/', '/?ui=custodian']) {
    const chat = await fetch(base + path);
    assert.equal(chat.status, 200); assert.match(await chat.text(), /Practice/);
  }
  assert.match(await (await fetch(base + '/fairness')).text(), /Public ledger/);
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.deepEqual(status, { configured: false, paidConfigured: false, mode: 'practice', bountyEnabled: false, authentication: 'local-only', accessMode: 'local', closedBeta: false, sandboxEnabled: true });
  const rules = await (await fetch(`${base}/api/rules`)).json();
  assert.match(rules.systemPrompt, /no money/i);
  assert.equal(rules.tools.length, 2);
});

test('an armed operating box without a funded route reports paid inference but no bounty', async t => {
  const root = await mkdtemp(join(tmpdir(), 'vault-http-paid-'));
  const service = createVaultService({ apiKey: '', payment: { assertCoverage: async () => {}, sign: async () => { throw new Error('unused'); } },
    logDir: join(root, '.local'), fetchImpl: () => { throw new Error('Unexpected network call'); } });
  const server = createHttpServer({ service, publicDir: root });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  const status = await (await fetch(`http://127.0.0.1:${server.address().port}/api/status`)).json();
  assert.equal(status.configured, true);
  assert.equal(status.paidConfigured, true);
  assert.equal(status.mode, 'x402-exact');
  assert.equal(status.bountyEnabled, false);
});

test('unknown API is JSON 404 and missing key is sanitized helpful 503', async t => {
  const { base } = await fixture(t);
  assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  const response = await fetch(`${base}/api/attempt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelId: 'qwen/qwen3.5-9b', prompt: 'Open.' }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'MISSING_API_KEY');
});

test('public operational endpoint is uncached, contains no private receipts and makes no model call', async t => {
  const { base } = await fixture(t);
  const response = await fetch(`${base}/api/health`), health = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(health.state, 'setup-required'); assert.equal(health.providerAvailability, 'not-probed');
  assert.equal(health.execution.persistedReceipts, 0); assert.equal(health.usage, null);
  assert.ok(!Object.hasOwn(health, 'receipts')); assert.ok(!Object.hasOwn(health, 'accountId'));
});

test('foreign origin cannot spend the local API key', async t => {
  const { base } = await fixture(t);
  const response = await fetch(`${base}/api/attempt`, { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
});

test('encoded traversal and hidden files never expose .env', async t => {
  const { server, base } = await fixture(t);
  for (const path of ['/..%2f.env', '/%2e%2e%5c.env', '/.env', '/%00']) {
    const result = await new Promise((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: server.address().port, path }, res => {
        let body = ''; res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject); req.end();
    });
    assert.ok([400, 404].includes(result.status));
    assert.ok(!result.body.includes('SHOULD_NEVER_BE_SERVED'));
  }
  const wrongHost = await new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: '/', headers: { Host: 'attacker.example' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end();
  });
  assert.equal(wrongHost, 403);
});
