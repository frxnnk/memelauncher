import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { depositFlowFixture, depositInput, transferReceipt } from './fixtures/deposit-flow.mjs';
import { hash, address, input, completion, asset, accountGameFixture } from './fixtures/account-game.mjs';
import { createWebFunding } from '../server/economy/web-funding.mjs';
import { startWebFunding, validateWebFundingConfiguration } from '../server/economy/web-funding-runtime.mjs';
import { createAuthenticatedClaims } from '../server/economy/authenticated-claims.mjs';
import { createHttpServer } from '../server/http.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { paidBetaTerms, paidBetaPricePolicy } from '../server/economy/paid-beta-policy.mjs';

const unusedAuth = { configured: true, authenticate: async () => { throw new Error('unused'); } };
const unusedLimits = { reserve: () => { throw new Error('unused'); }, settle: () => {}, reconcile: () => {}, assertReceiptSettled: () => {} };
const unusedVault = paidConfigured => ({ status: () => ({ configured: true, paidConfigured }), attempt: async () => { throw new Error('unused'); } });
function fixtureRpc() {
  const rpcUrl = 'https://fixture.invalid/funding-runtime';
  const fetchImpl = async (url, init) => {
    assert.equal(url, rpcUrl);
    const { id, method } = JSON.parse(init.body);
    const results = { eth_chainId: '0xb626', eth_blockNumber: '0x66', eth_getTransactionReceipt: null,
      eth_getBlockByNumber: { hash: hash('b'), number: '0x64' } };
    assert.ok(Object.hasOwn(results, method), 'The runtime must not call signing or send methods.');
    return Response.json({ jsonrpc: '2.0', id, result: results[method] });
  };
  return { rpcUrl, fetchImpl };
}

async function setup(t, beta) {
  const g = await depositFlowFixture(), f = g.f;
  const funding = createWebFunding({ economy: f.economy, deposits: g.deposits, game: f.game,
    authentication: f.authentication, beta, maximumTopup: '5000', testnet: true });
  const server = createHttpServer({ service: f.vault, authentication: f.authentication, publicDir: '.', funding });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await g.close(); });
  const call = async (path, body, owner = 'alice', extra = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { ...(owner ? f.headers(owner) : {}), 'Content-Type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  return { g, f, call };
}
test('web deposit -> confirmation -> charged attempt -> bounty; duplicate calls do not duplicate funds or inference', async t => {
  const { g, f, call } = await setup(t);
  const prepared = await call('deposits', depositInput());
  assert.equal(prepared.status, 200); assert.equal(prepared.body.transfer.signingEnabled, true);
  assert.equal(prepared.body.realFundsEnabled, false);
  const id = prepared.body.order.id;
  assert.equal((await call('deposits', depositInput())).body.order.id, id);
  await call(`deposits/${id}/submit`, { transactionHash: hash('a') });
  assert.equal((await call(`deposits/${id}/check`, {})).body.order.credited, false);
  assert.equal((await call('account')).body.available, '0');
  g.control.receipt = transferReceipt(); g.control.head = '0x66';
  const checks = await Promise.all([call(`deposits/${id}/check`, {}), call(`deposits/${id}/check`, {})]);
  assert.ok(checks.every(x => x.body.order.credited));
  assert.equal((await call('account')).body.available, '1000');
  const reply = await call('attempts', input()); assert.equal(reply.status, 200);
  const duplicate = await call('attempts', input()); assert.equal(duplicate.body.replayed, true);
  assert.equal(f.calls.length, 1); assert.equal((await call('account')).body.available, '900');
  const state = await call('config'); assert.equal(state.body.rounds[0].bounty, '70');
  assert.equal(state.body.rounds[0].prizeRecipient, null);
  assert.equal(state.body.payoutsEnabled, false); assert.equal(state.cache, 'no-store');
  assert.equal((await call('attempts/message/reconcile', {})).body.replayed, true);
  assert.equal(f.calls.length, 1);
});
test('funding rejects foreign owners, forged evidence, excess amounts, missing auth and cross-origin requests', async t => {
  const { g, call } = await setup(t);
  assert.equal((await call('deposits', depositInput(), null)).status, 401);
  assert.equal((await call('deposits', depositInput('foreign', address('4')))).status, 400);
  assert.equal((await call('deposits', depositInput('big', address('2'), '5001'))).status, 400);
  assert.equal((await call('deposits', depositInput('bad'), 'alice', { Origin: 'https://evil.invalid' })).status, 403);
  const { body } = await call('deposits', depositInput()); const path = `deposits/${body.order.id}`;
  const rpc = g.calls.length;
  assert.equal((await call(path, undefined, 'bob')).status, 404);
  assert.equal((await call(path + '/submit', { transactionHash: hash('a') }, 'bob')).status, 404);
  assert.equal((await call(path + '/check', { receipt: transferReceipt() })).status, 400);
  assert.equal((await call('account?owner=bob')).status, 400);
  assert.equal(g.calls.length, rpc); assert.equal((await call('account')).body.available, '0');
});
test('closed beta admission applies to funding mutations and account reads', async t => {
  const beta = { assertAccess() { throw Object.assign(new Error('Invite required'), { status: 403, code: 'BETA_INVITE_REQUIRED' }); } };
  const { call, g } = await setup(t, beta);
  assert.equal((await call('config')).status, 200);
  assert.equal((await call('deposits', depositInput())).status, 403);
  assert.equal((await call('account')).status, 403); assert.equal(g.calls.length, 0);
});
test('public funding config stays unauthenticated when Vercel leaves rewrite query params', async t => {
  const { call } = await setup(t);
  const rewritten = await call('config?__vault_path=/api/funding/config&_vercel_share=1', undefined, null);
  assert.equal(rewritten.status, 200, JSON.stringify(rewritten.body));
  assert.equal(rewritten.body.enabled, true);
  assert.equal(rewritten.body.error?.code, undefined);
});
test('public fairness board is unauthenticated and lists every credited attempt', async t => {
  const { f, call } = await setup(t);
  assert.equal((await call('fairness', undefined, null)).status, 200);
  f.deposit();
  await call('attempts', input());
  const board = await call('fairness?__vault_path=/api/funding/fairness&path=funding/fairness', undefined, null);
  assert.equal(board.status, 200, JSON.stringify(board.body));
  assert.equal(board.cache, 'no-store');
  assert.equal(board.body.demonstrated.paidAttempt, true);
  assert.equal(board.body.demonstrated.attestedExecutor, false);
  assert.equal(board.body.attempts.length, 1);
  assert.equal(board.body.attempts[0].state, 'locked');
  assert.equal(board.body.deposits.length, 1);
  assert.match(board.body.deposits[0].from, /…/);
  assert.doesNotMatch(JSON.stringify(board.body), /rpcEvidence/);
});
test('Top up account and deposits ignore Vercel rewrite leftovers and still reject owner query', async t => {
  const { call } = await setup(t);
  const account = await call('account?__vault_path=/api/funding/account&_vercel_share=1');
  assert.equal(account.status, 200, JSON.stringify(account.body));
  assert.equal(account.body.error?.code, undefined);
  assert.equal(account.body.available, '0');
  const listed = await call('deposits?__vault_path=/api/funding/deposits&_vercel_share=1');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.error?.message, undefined);
  assert.ok(Array.isArray(listed.body.deposits));
  const prepared = await call('deposits?__vault_path=/api/funding/deposits&_vercel_share=1', depositInput());
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  assert.equal((await call('account?owner=bob')).status, 400);
});
test('Top up GETs ignore the Vercel :path* capture leftover that production appends', async t => {
  const { call } = await setup(t);
  const account = await call('account?path=funding/account');
  assert.equal(account.status, 200, JSON.stringify(account.body));
  assert.notEqual(account.body.error?.code, 'INVALID_FUNDING_QUERY');
  assert.equal(account.body.available, '0');
  const encoded = await call('account?path=funding%2Faccount');
  assert.equal(encoded.status, 200, JSON.stringify(encoded.body));
  const listed = await call('deposits?__vault_path=/api/funding/deposits&path=funding/deposits');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.ok(Array.isArray(listed.body.deposits));
});
test('Review top-up POST ignores the same leftover path= capture', async t => {
  const { call } = await setup(t);
  const prepared = await call('deposits?path=funding/deposits', depositInput());
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  assert.notEqual(prepared.body.error?.code, 'INVALID_FUNDING_QUERY');
  assert.equal(prepared.body.transfer.signingEnabled, true);
});
test('POST attempts ignores leftover path= and does not apply BETA_MODELS write checks', async t => {
  const seen = [];
  const { call, f } = await setup(t, { assertAccess(owner, opts) { seen.push({ owner, opts }); } });
  f.deposit();
  const reply = await call('attempts?path=funding/attempts', input());
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  assert.notEqual(reply.body.error?.code, 'INVALID_FUNDING_QUERY');
  assert.ok(seen.every(row => row.opts === undefined || row.opts.write !== true));
});
test('Recover GET order and POST check ignore leftover path= on the order id', async t => {
  const { call } = await setup(t);
  const prepared = await call('deposits', depositInput());
  const id = prepared.body.order.id;
  const got = await call(`deposits/${id}?path=funding/deposits/${id}`);
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.notEqual(got.body.error?.code, 'INVALID_FUNDING_QUERY');
  const checked = await call(`deposits/${id}/check?path=funding/deposits/${id}/check`, {});
  assert.notEqual(checked.body.error?.code, 'INVALID_FUNDING_QUERY');
  assert.equal(checked.status, 409);
  assert.equal(checked.body.error.code, 'DEPOSIT_NOT_SUBMITTED');
});
test('failed model calls refund credits and unresolved provider usage keeps new calls paused', async t => {
  const { call, f } = await setup(t); f.deposit();
  f.controls.transport = () => { throw new Error('Fixture offline'); };
  assert.equal((await call('attempts', input('error'))).body.accounting.creditsReturned, '100');
  assert.equal((await call('account')).body.available, '1000');
  assert.equal((await call('attempts', input('next'))).status, 503);
});

test('beta pause blocks new funding and play while existing deposits remain recoverable', async t => {
  let paused = false;
  const { call, g, f } = await setup(t, { assertAccess() {}, paused: () => paused });
  const prepared = await call('deposits', depositInput());
  const path = `deposits/${prepared.body.order.id}`;
  paused = true;
  for (const [route, body] of [['deposits', depositInput('new')], ['attempts', input()]]) {
    const blocked = await call(route, body);
    assert.equal(blocked.status, 503); assert.equal(blocked.body.error.code, 'BETA_PAUSED');
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await call(path + '/submit', { transactionHash: hash('a') })).status, 200);
  g.control.receipt = transferReceipt(); g.control.head = '0x66';
  assert.equal((await call(path + '/check', {})).body.order.credited, true);
  assert.equal((await call('account')).body.available, '1000');
  paused = false;
  assert.equal((await call('attempts', input())).status, 200);
});
test('release records a payable rather than pretending to pay', async t => {
  const { call, f } = await setup(t); f.deposit();
  f.controls.transport = body => completion(body.model, 'release_prize');
  const win = await call('attempts', input('win'));
  assert.equal(win.status, 200);
  const config = (await call('config')).body;
  assert.equal(config.rounds[0].state, 'won'); assert.equal(config.rounds[0].prizePayable, '70');
  assert.equal(config.rounds[0].prizeRecipient, address('2'));
  assert.equal(config.payoutsEnabled, false);
});
test('the funded runtime pays inference from the operating box only when one is armed', async t => {
  const { rpcUrl, fetchImpl } = fixtureRpc();
  const directory = await mkdtemp(join(tmpdir(), 'vault-funding-runtime-'));
  const configPath = join(directory, 'funding.json');
  await writeFile(configPath, JSON.stringify({ environment: 'testnet',
    asset: { chainId: '46630', tokenAddress: address('1'), destination: address('3'), decimals: 6, minimumConfirmations: 3, standardTransferVerified: true },
    maximumTopup: '5000000', terms: { price: '100000', prizeBps: 7000, operationsBps: 2000 },
    rounds: [{ id: 'r1', models: ['google/gemini-2.5-flash'] }] }));
  const started = [];
  t.after(async () => {
    for (const runtime of started) await runtime.close();
    await rm(directory, { recursive: true, force: true });
  });
  for (const paidConfigured of [true, false]) {
    const runtime = await startWebFunding({ configPath, dataDirectory: join(directory, `data-${paidConfigured}`),
      authentication: unusedAuth, limits: unusedLimits, vault: unusedVault(paidConfigured), rpcUrl, fetchImpl });
    started.push(runtime);
    assert.equal(runtime.billing, paidConfigured ? 'x402' : null);
    assert.equal(runtime.backgroundTimers, true);
  }
  const vercelRuntime = await startWebFunding({ configPath, dataDirectory: join(directory, 'data-vercel'),
    authentication: unusedAuth, limits: unusedLimits, vault: unusedVault(true), rpcUrl, fetchImpl,
    hosting: { name: 'vercel', ephemeralData: false, backgroundTimers: false } });
  started.push(vercelRuntime);
  assert.equal(vercelRuntime.billing, 'x402');
  assert.equal(vercelRuntime.backgroundTimers, false);
  await assert.rejects(() => startWebFunding({
    configPath, dataDirectory: join(directory, 'data-vercel-ephemeral'),
    authentication: unusedAuth, limits: unusedLimits, vault: unusedVault(true), rpcUrl, fetchImpl,
    hosting: { name: 'vercel', ephemeralData: true, backgroundTimers: false }
  }), /durable|Turso|\/tmp/i);
  const rehearsalRuntime = await startWebFunding({
    configPath, dataDirectory: join(directory, 'data-rehearsal'),
    authentication: unusedAuth, limits: unusedLimits,
    vault: { status: () => ({ configured: true, paidConfigured: false, localRehearsalPayer: true }), attempt: async () => { throw new Error('unused'); } },
    rpcUrl, fetchImpl
  });
  started.push(rehearsalRuntime);
  assert.equal(rehearsalRuntime.billing, 'x402');
});

test('web funding configuration rejects mainnet, missing caps and shared guardian pools', () => {
  const config = { environment: 'testnet', asset: { chainId: '46630', tokenAddress: address('1'), destination: address('3'), decimals: 6,
    minimumConfirmations: 3, standardTransferVerified: true }, maximumTopup: '5000000',
    terms: { price: '100000', prizeBps: 7000, operationsBps: 2000 }, rounds: [{ id: 'r1', models: ['google/gemini-2.5-flash'] }] };
  assert.equal(validateWebFundingConfiguration(config).asset.chainId, '46630');
  assert.throws(() => validateWebFundingConfiguration({ ...config, environment: 'mainnet' }));
  assert.throws(() => validateWebFundingConfiguration({ ...config, asset: { ...config.asset, chainId: '8453' } }));
  assert.throws(() => validateWebFundingConfiguration({ ...config, maximumTopup: '0' }));
  assert.throws(() => validateWebFundingConfiguration({ ...config, rounds: [{ id: 'r1', models: ['a', 'b'] }] }));
});

test('web funding configuration keeps paid-beta staircase and win-retain terms', () => {
  const example = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../config/paid-beta.example.json'), 'utf8'));
  const validated = validateWebFundingConfiguration(example);
  assert.equal(validated.policy, 'paid-beta');
  assert.equal(validated.terms.prizeBps, 7000);
  assert.equal(validated.terms.operationsBps, 3000);
  assert.equal(validated.terms.nextRoundBps, 0);
  assert.equal(validated.terms.winRetainBps, 2500);
  assert.equal(validated.terms.priceStep, '1000000000000000000');
  assert.equal(validated.terms.maximumPrice, '25000000000000000000');
  assert.equal(validated.terms.durationMonths, 5);
  assert.deepEqual(validated.rounds[0].models, ['anthropic/claude-opus-5']);
  assert.throws(() => validateWebFundingConfiguration({ ...example, terms: { ...example.terms, durationMonths: 0 } }));
});

test('web funding without paid-beta policy keeps rehearsal 70/20/10 terms', () => {
  const config = { environment: 'testnet', asset: { chainId: '46630', tokenAddress: address('1'), destination: address('3'), decimals: 6,
    minimumConfirmations: 3, standardTransferVerified: true }, maximumTopup: '5000000',
    terms: { price: '100000', prizeBps: 7000, operationsBps: 2000 }, rounds: [{ id: 'r1', models: ['google/gemini-2.5-flash'] }] };
  const validated = validateWebFundingConfiguration(config);
  assert.equal(validated.policy, undefined);
  assert.equal(validated.terms.prizeBps, 7000);
  assert.equal(validated.terms.operationsBps, 2000);
  assert.equal(validated.terms.nextRoundBps, 1000);
  assert.equal(validated.terms.winRetainBps, undefined);
});

test('a new paid-beta ledger opens opus on 70/30 staircase terms without rewriting rehearsal', async t => {
  const { rpcUrl, fetchImpl } = fixtureRpc();
  const directory = await mkdtemp(join(tmpdir(), 'vault-paid-beta-runtime-'));
  const example = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../config/paid-beta.example.json'), 'utf8'));
  const paidPath = join(directory, 'paid-beta.json');
  const rehearsalPath = join(directory, 'rehearsal.json');
  await writeFile(paidPath, JSON.stringify(example));
  await writeFile(rehearsalPath, JSON.stringify({
    environment: 'testnet', asset: example.asset, maximumTopup: example.maximumTopup,
    terms: { price: '100000000000000000', prizeBps: 7000, operationsBps: 2000 },
    rounds: [{ id: 'rh-amzn-haiku', models: ['anthropic/claude-haiku-4.5'] }]
  }));
  const started = [];
  t.after(async () => {
    for (const runtime of started) await runtime.close();
    await rm(directory, { recursive: true, force: true });
  });
  const paid = await startWebFunding({ configPath: paidPath, dataDirectory: join(directory, 'paid'),
    authentication: unusedAuth, limits: unusedLimits, vault: unusedVault(false), rpcUrl, fetchImpl });
  started.push(paid);
  const round = paid.funding.configuration().rounds[0];
  assert.equal(round.id, 'rh-paid-opus-v1');
  assert.equal(round.prizeBps, 7000);
  assert.equal(round.operationsBps, 3000);
  assert.equal(round.nextRoundBps, 0);
  assert.equal(round.winRetainBps, 2500);
  assert.equal(round.price, '5000000000000000000');
  assert.equal(round.priceStep, '1000000000000000000');
  assert.ok(round.expiresAt);
  assert.equal(round.manifest.manifest.configuration.guardians[0].modelId, 'anthropic/claude-opus-5');
  const rehearsal = await startWebFunding({ configPath: rehearsalPath, dataDirectory: join(directory, 'rehearsal'),
    authentication: unusedAuth, limits: unusedLimits, vault: unusedVault(false), rpcUrl, fetchImpl });
  started.push(rehearsal);
  const rehearsalRound = rehearsal.funding.configuration().rounds[0];
  assert.equal(rehearsalRound.id, 'rh-amzn-haiku');
  assert.equal(rehearsalRound.operationsBps, 2000);
  assert.equal(rehearsalRound.nextRoundBps, 1000);
  assert.equal(rehearsalRound.winRetainBps, 0);
  await rehearsal.close();
  started.pop();
  await assert.rejects(startWebFunding({ configPath: paidPath, dataDirectory: join(directory, 'rehearsal'),
    authentication: unusedAuth, limits: unusedLimits, vault: unusedVault(false), rpcUrl, fetchImpl }),
    /new data directory|rehearsal ledger/i);
});

test('a testnet win is claimed by an executed treasury transfer, not a simulated payout', async t => {
  const g = await depositFlowFixture(), f = g.f;
  const claims = createAuthenticatedClaims({ economy: f.economy, authentication: f.authentication, reader: g.reader });
  const funding = createWebFunding({ economy: f.economy, deposits: g.deposits, game: f.game,
    authentication: f.authentication, claims, maximumTopup: '5000', testnet: true });
  const server = createHttpServer({ service: f.vault, authentication: f.authentication, publicDir: '.', funding });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await g.close(); });
  const call = async (path, body, owner = 'alice', wallets) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  f.deposit();
  f.controls.transport = body => completion(body.model, 'release_prize');
  assert.equal((await call('attempts', input('win'))).status, 200);
  const config = (await call('config')).body;
  assert.equal(config.payoutsEnabled, false);
  assert.equal(config.realFundsEnabled, false);
  assert.equal(config.testnetClaimsEnabled, true);
  assert.equal(config.rounds[0].prizePayable, '70');
  assert.equal(config.rounds[0].prizeRecipient, address('2'));
  const view = await call('claims/r1');
  assert.equal(view.status, 200);
  assert.equal(view.body.amount, '70');
  assert.equal(view.body.recipient, address('2'));
  assert.equal(view.body.transfer.signingEnabled, false);
  const unauth = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/claims/r1`);
  assert.equal(unauth.status, 401);
  const blocked = await call('claims/r1/prepare', {});
  assert.equal(blocked.status, 400);
  const prepared = await call('claims/r1/prepare', {}, 'operator', [address('3')]);
  assert.equal(prepared.status, 200);
  assert.equal(prepared.body.transfer.transaction.from, address('3'));
  assert.equal(prepared.body.transfer.transaction.to, asset.tokenAddress);
  assert.equal(BigInt('0x' + prepared.body.transfer.transaction.data.slice(-64)).toString(), '70');
  await call('claims/r1/submit', { transactionHash: hash('c') }, 'operator', [address('3')]);
  g.control.receipt = {
    transactionHash: hash('c'), status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
    logs: [{ transactionHash: hash('c'), logIndex: '0x0', address: asset.tokenAddress, blockHash: hash('b'),
      blockNumber: '0x64', removed: false,
      topics: [TRANSFER_TOPIC, '0x' + address('3').slice(2).padStart(64, '0'), '0x' + address('2').slice(2).padStart(64, '0')],
      data: '0x' + (70n).toString(16).padStart(64, '0') }]
  };
  g.control.head = '0x66';
  const checked = await call('claims/r1/check', {}, 'operator', [address('3')]);
  assert.equal(checked.status, 200);
  assert.equal(checked.body.order.state, 'paid');
  assert.equal(checked.body.order.paid, '70');
  assert.equal((await call('config')).body.rounds[0].prizePayable, '0');
  assert.equal((await call('config')).body.rounds[0].state, 'paid');
});

test('treasury HTTP expiry records the 5-month unwind without broadcasting funds', async t => {
  const prices = paidBetaPricePolicy(0);
  let clock = '2020-01-01T00:00:00.000Z';
  const f = await accountGameFixture({
    now: () => clock,
    terms: { ...paidBetaTerms(), price: prices.basePrice, priceStep: prices.stepPrice, maximumPrice: prices.maximumPrice, durationMonths: 5 }
  });
  const claims = createAuthenticatedClaims({
    economy: f.economy, authentication: f.authentication,
    reader: { evidence: async () => { throw new Error('unused'); } }
  });
  const funding = createWebFunding({
    economy: f.economy, deposits: { list: async () => ({ deposits: [] }) }, game: f.game,
    authentication: f.authentication, claims, maximumTopup: '50000000000000000000', testnet: true
  });
  const server = createHttpServer({ service: f.vault, authentication: f.authentication, publicDir: '.', funding });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await f.close(); });
  const call = async (path, body, owner = 'alice', wallets) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await call('config')).body.rounds[0].expiresAt != null, true);
  const early = await call('rounds/r1/expire', {}, 'operator', [address('3')]);
  assert.equal(early.status, 409);
  const player = await call('rounds/r1/expire', {}, 'alice');
  assert.ok([400, 403, 404].includes(player.status));
  clock = '2020-07-01T00:00:00.000Z';
  const expired = await call('rounds/r1/expire', {}, 'operator', [address('3')]);
  assert.equal(expired.status, 200);
  assert.equal(expired.body.state, 'expired');
  assert.equal(expired.body.broadcast, false);
  assert.equal(expired.body.realFundsEnabled, false);
  assert.equal((await call('config')).body.rounds[0].state, 'expired');
});
