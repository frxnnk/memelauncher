import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createVaultService } from '../server/service.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createHttpServer } from '../server/http.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';
import { apiError } from '../server/errors.mjs';

const MODEL = 'qwen/qwen3.5-9b';
const input = { modelId:MODEL, prompt:'Concurrency fixture. Keep the vault closed.' };
async function bounded(promise, milliseconds = 5000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('The local concurrency drill timed out.')), milliseconds);
  })]); } finally { clearTimeout(timer); }
}

// No target URL, credentials or database paths are accepted: only an isolated local fixture.
export async function concurrencyDrill() {
  const tempRoot = resolve(tmpdir()), directory = await mkdtemp(join(tempRoot, 'vault-concurrency-'));
  assert.ok(resolve(directory).startsWith(tempRoot + sep));
  let service, limits, server, finishFirst, startedFirst;
  const firstGate = new Promise(resolveGate => { finishFirst = resolveGate; });
  const firstStarted = new Promise(resolveStarted => { startedFirst = resolveStarted; });
  const jobs = [], samples = [], checks = [];
  let modelCalls = 0, active = 0, peak = 0, metadataCalls = 0;
  const startedAt = performance.now();
  try {
    const publicDir = join(directory, 'public'), logDir = join(directory, 'receipts');
    await mkdir(publicDir); await writeFile(join(publicDir, 'index.html'), '<h1>Concurrency drill fixture</h1>');
    await writeFile(join(publicDir, 'landing.html'), '<h1>Concurrency drill fixture landing</h1>');
    service = createVaultService({ apiKey:'fixture-key-never-sent', logDir, sessionsPath:join(directory, 'sessions.sqlite'),
      fetchImpl:async (url, options = {}) => {
        if (url === 'https://openrouter.ai/api/v1/models') {
          metadataCalls++;
          return Response.json({ data:[{ id:MODEL, supported_parameters:['tools'], pricing:{ prompt:'0.00001', completion:'0.00001' } }] });
        }
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); assert.equal(options.method, 'POST');
        modelCalls++; active++; peak = Math.max(peak, active);
        try {
          if (modelCalls === 1) { startedFirst(); await firstGate; }
          return Response.json({ model:MODEL, provider:'Concurrency fixture', usage:{ cost:0.001 },
            choices:[{ finish_reason:'stop', message:{ role:'assistant', content:'Fixture response. Still locked.' } }] });
        } finally { active--; }
      } });
    limits = createInferenceLimits({ path:join(directory, 'usage.sqlite'), budgetUsd:0.002, totalPerDay:100 });
    const authentication = { configured:true, publicConfig:() => ({ configured:true }), authenticate:async headers => {
      const account = /^Bearer fixture-([a-z0-9]+)$/.exec(headers.authorization ?? '')?.[1];
      if (!account) throw apiError(401, 'AUTH_REQUIRED', 'Fixture authentication required.');
      return { accountId:`player_${account}` };
    } };
    const runtime = runtimeConfiguration({ VAULT_ACCESS_MODE:'public-practice', VAULT_PUBLIC_ORIGIN:'https://vault.example' });
    server = createHttpServer({ service, limits, authentication, runtime, publicDir });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));

    function send({ path = '/api/attempt', method = 'POST', owner = 'a', body = JSON.stringify(input), headers = {} } = {}) {
      const start = performance.now(); let handle;
      const result = new Promise(resolveResult => {
        handle = request({ hostname:'127.0.0.1', port:server.address().port, path, method, agent:false,
          headers:{ host:'vault.example', origin:'https://vault.example', 'content-type':'application/json',
            ...(owner ? { authorization:`Bearer fixture-${owner}` } : {}), ...headers } }, response => {
          let content = '';
          response.setEncoding('utf8'); response.on('data', chunk => { content += chunk; });
          response.on('end', () => {
            samples.push(performance.now() - start);
            let value; try { value = JSON.parse(content); } catch { value = content; }
            resolveResult({ status:response.statusCode, body:value });
          });
          response.on('error', () => resolveResult({ status:0, transport:'response-interrupted' }));
        });
        handle.on('error', () => resolveResult({ status:0, transport:'request-interrupted' }));
        handle.setTimeout(5000, () => handle.destroy()); handle.end(method === 'POST' ? body : undefined);
      });
      jobs.push(result); return { result, abort:() => handle.destroy() };
    }
    async function burst(count, options, status, code) {
      const results = await bounded(Promise.all(Array.from({ length:count }, (_, index) => send({ owner:String(index), ...options }).result)));
      for (const result of results) { assert.equal(result.status, status); assert.equal(result.body.error.code, code); }
      checks.push({ name:code, requests:count, expectedHttpStatus:status, passed:true });
    }

    await burst(12, { owner:null }, 401, 'AUTH_REQUIRED');
    await burst(8, { headers:{ origin:'https://other.example' } }, 403, 'ORIGIN_REJECTED');
    await burst(8, { body:'{' }, 400, 'INVALID_JSON');
    await burst(4, { body:'x'.repeat(34000) }, 413, 'BODY_TOO_LARGE');
    assert.equal(modelCalls, 0); assert.equal(limits.operationalState().globalRequestsToday, 0);

    const first = send();
    await bounded(firstStarted);
    await burst(32, {}, 409, 'ATTEMPT_BUSY');
    assert.equal(modelCalls, 1); assert.equal(limits.operationalState().globalRequestsToday, 1);
    const health = await send({ path:'/api/health', method:'GET', owner:null }).result;
    assert.equal(health.status, 200); assert.equal(health.body.state, 'busy');
    const home = await send({ path:'/', method:'GET', owner:null }).result;
    assert.equal(home.status, 200); assert.match(home.body, /Concurrency drill fixture/);
    checks.push({ name:'status-and-static-readable-during-inference', passed:true });

    // Disconnect after the provider has accepted the call, then let it finish.
    first.abort(); assert.equal((await first.result).status, 0); finishFirst();
    await bounded((async () => { while (limits.operationalState().pending) await delay(10); })());
    assert.equal(limits.operationalState().known, 1); assert.equal(limits.operationalState().reportedCostUsd, 0.001);
    assert.equal(service.operationalState().persistedReceipts, 1); assert.equal(modelCalls, 1);
    assert.equal(service.receiptHistory('player_a').records.length, 1);
    assert.equal(service.receiptHistory('player_b').records.length, 0);
    checks.push({ name:'disconnect-settles-once-with-persisted-receipt', passed:true });

    const receipts = (await readFile(join(logDir, 'attempts.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const stolen = await send({ owner:'b', body:JSON.stringify({ ...input, sessionId:receipts[0].sessionId }) }).result;
    assert.equal(stolen.status, 404); assert.equal(stolen.body.error.code, 'SESSION_NOT_FOUND');
    assert.equal(modelCalls, 1); assert.equal(limits.operationalState().notSent, 1);
    checks.push({ name:'foreign-session-rejected-before-provider', passed:true });

    const second = await send({ owner:'b' }).result;
    assert.equal(second.status, 200); assert.equal(second.body.decision, 'locked');
    await burst(16, {}, 429, 'APP_BUDGET_REACHED');
    const usage = limits.operationalState();
    assert.equal(modelCalls, 2); assert.equal(peak, 1); assert.equal(metadataCalls, 1);
    assert.equal(usage.reportedCostUsd, 0.002); assert.equal(usage.known, 2);
    assert.equal(usage.globalRequestsToday, 3); assert.equal(usage.pending, 0); assert.equal(usage.unknown, 0);
    assert.equal(service.operationalState().persistedReceipts, 2);
    const finalHealth = await send({ path:'/api/health', method:'GET', owner:null }).result;
    assert.equal(finalHealth.body.state, 'budget-exhausted');
    samples.sort((a, b) => a - b);
    return { generatedAt:new Date().toISOString(), result:'passed',
      scope:'Isolated loopback HTTP burst with synthetic authentication and intercepted provider transport; not a production load benchmark.',
      realInferenceCalls:0, externalNetworkCalls:0, walletActions:0, realFunds:false,
      httpRequests:jobs.length, responseSamples:samples.length, disconnectedRequests:1,
      syntheticInferenceCalls:modelCalls, peakSyntheticInferenceConcurrency:peak, syntheticMetadataCalls:metadataCalls,
      durationMs:Math.round(performance.now() - startedAt),
      loopbackResponseMs:{ p50:Math.round(samples[Math.floor(samples.length * 0.5)]), p95:Math.round(samples[Math.floor(samples.length * 0.95)]) },
      checks, finalUsage:{ requests:usage.globalRequestsToday, known:usage.known, notSent:usage.notSent,
        pending:usage.pending, unknown:usage.unknown, syntheticReportedCostUsd:usage.reportedCostUsd },
      limitations:['One admitted inference at a time; excess concurrent requests are rejected, not queued.',
        'No real Privy, TLS proxy, provider latency, distributed replicas, host saturation or funded settlement tested.'] };
  } finally {
    finishFirst();
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose)); }
    await Promise.allSettled(jobs);
    // Ensure the in-process provider fixture and receipt writes finish before closing SQLite.
    if (service) await bounded((async () => { while (service.operationalState().busy) await delay(10); })());
    service?.close(); limits?.close();
    assert.ok(resolve(directory).startsWith(tempRoot + sep));
    await rm(directory, { recursive:true, force:true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await concurrencyDrill(), output = fileURLToPath(new URL('../output/concurrency-drill.json', import.meta.url));
  await mkdir(fileURLToPath(new URL('../output/', import.meta.url)), { recursive:true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
