import test from 'node:test';
import assert from 'node:assert/strict';
import { depositFlowFixture, depositInput, transferReceipt } from './fixtures/deposit-flow.mjs';
import { address, hash, input, completion } from './fixtures/account-game.mjs';
import { createCreditHistory } from '../server/economy/credit-history.mjs';
import { createHttpServer } from '../server/http.mjs';

async function setup(t, configured = true) {
  const g = await depositFlowFixture(), f = g.f;
  const creditHistory = configured ? createCreditHistory({ game: f.game, deposits: g.deposits }) : undefined;
  const server = createHttpServer({ service: f.vault, authentication: f.authentication, publicDir: '.', creditHistory });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await g.close(); });
  const read = async (path, name = 'alice', init = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...init, headers: { ...(name ? f.headers(name) : {}), ...init.headers } });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return { g, f, read };
}

test('credit HTTP summaries are authenticated, private, uncached and distinguish payable from paid', async t => {
  const { g, f, read } = await setup(t); f.deposit(); f.deposit(f.bob, '1000', 'c');
  f.controls.transport = body => completion(body.model, 'release_prize'); await f.game.attempt(f.headers(), input());
  const before = f.calls.length, rpc = g.calls.length;
  assert.equal((await read('/api/credits', null)).status, 401);
  const alice = await read('/api/credits'), bob = await read('/api/credits', 'bob');
  assert.equal(alice.status, 200); assert.equal(alice.headers.get('cache-control'), 'no-store');
  assert.equal(alice.body.available, '900'); assert.equal(alice.body.reserved, '0'); assert.equal(alice.body.prizePayable, '70');
  assert.equal(alice.body.payoutsEnabled, false); assert.equal(alice.body.realFundsEnabled, false);
  assert.equal(bob.body.available, '1000'); assert.equal(bob.body.prizePayable, '0');
  for (const fragment of ['inputMessages', 'Fixture response.', f.alice.accountId, address('2'), 'instanceId']) assert.ok(!JSON.stringify(bob.body).includes(fragment));
  assert.equal((await read('/api/auth/config')).body.creditRecordsEnabled, true);
  assert.equal(f.calls.length, before); assert.equal(g.calls.length, rpc);
});

test('deposit HTTP history pages and downloads include only account records without calldata or operator exports', async t => {
  const { g, f, read } = await setup(t);
  for (let index = 0; index < 22; index++) await g.deposits.prepare(f.headers(), depositInput('page-' + index));
  const foreign = (await g.deposits.prepare(f.headers('bob'), depositInput('foreign', address('4')))).order.id;
  const rpc = g.calls.length, first = await read('/api/credits/deposits');
  assert.equal(first.body.deposits.length, 20); assert.equal(first.headers.get('cache-control'), 'no-store');
  const last = await read('/api/credits/deposits?before=' + first.body.nextCursor); assert.equal(last.body.deposits.length, 2);
  const record = await read('/api/credits/deposits/' + first.body.deposits[0].id);
  assert.deepEqual(record.body, first.body.deposits[0]);
  assert.equal(record.body.amountRequestedBaseUnits, '1000'); assert.equal(record.body.amountCreditedBaseUnits, '0');
  assert.equal(record.body.transactionHash, null); assert.equal(record.body.owner, address('2'));
  for (const field of ['transfer', 'transaction', 'accountId', 'rpcEvidence', 'ledger', 'request_key']) assert.equal(record.body[field], undefined);
  for (const prefix of ['/api/credits/deposits/', '/api/credits/deposits?before=']) {
    const denied = await read(prefix + foreign), missing = await read(prefix + 'missing');
    assert.equal(denied.status, 404); assert.deepEqual(denied.body, missing.body);
  }
  for (const path of ['/api/credits/deposits', '/api/credits/deposits/' + foreign]) assert.equal((await read(path, null)).status, 401);
  assert.equal(g.calls.length, rpc); assert.equal(f.calls.length, 0);
});

test('credit routes reject mutations, account selectors and other origins without crediting or querying RPC', async t => {
  const { g, f, read } = await setup(t); const snapshot = JSON.stringify(f.economy.export());
  for (const path of ['/api/credits?owner=player_b', '/api/credits/deposits?before=a&before=b', '/api/credits/deposits?account=player_b',
    '/api/credits/deposits/missing?before=a', '/api/credits/deposits?before=']) assert.equal((await read(path)).status, 400);
  assert.equal((await read('/api/credits?__vault_path=/api/credits&_vercel_share=1')).status, 200);
  assert.equal((await read('/api/credits/deposits?__vault_path=/api/credits/deposits&_vercel_share=1')).status, 200);
  assert.equal((await read('/api/credits?path=credits')).status, 200);
  assert.equal((await read('/api/credits/deposits?path=credits/deposits')).status, 200);
  for (const path of ['/api/credits', '/api/credits/deposits', '/api/credits/deposits/prepare', '/api/credits/deposits/check']) {
    const rejected = await read(path, 'alice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(rejected.status, 405); assert.equal(rejected.body.error.code, 'CREDIT_READ_ONLY');
  }
  assert.equal((await read('/api/credits/export')).status, 404);
  assert.equal((await read('/api/credits', 'alice', { headers: { Origin: 'https://foreign.invalid' } })).status, 403);
  assert.equal(JSON.stringify(f.economy.export()), snapshot); assert.equal(g.calls.length + f.calls.length, 0);
});

test('a server without an asset-credit composition reports unavailable instead of showing invented zero balances', async t => {
  const { g, f, read } = await setup(t, false);
  assert.equal((await read('/api/auth/config')).body.creditRecordsEnabled, false);
  for (const path of ['/api/credits', '/api/credits/deposits', '/api/credits/deposits/missing']) {
    const result = await read(path); assert.equal(result.status, 503); assert.equal(result.body.error.code, 'CREDITS_NOT_CONFIGURED');
    assert.equal(result.body.available, undefined); assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  assert.equal(g.calls.length + f.calls.length, 0);
});

test('private HTTP records distinguish confirmed sponsor reserve from spendable credits without exposing funding mutations', async t => {
  const { g, f, read } = await setup(t);
  const { order } = await g.deposits.preparePrizeFunding(f.headers(), { ...depositInput(), source: 'sponsor' });
  await g.deposits.submit(f.headers(), order.id, { transactionHash: hash('a') });
  g.control.receipt = transferReceipt(); g.control.head = '0x66';
  await g.deposits.check(f.headers(), order.id);
  const rpc = g.calls.length, record = await read('/api/credits/deposits/' + order.id);
  assert.equal(record.status, 200); assert.equal(record.body.purpose, 'prize-reserve');
  assert.equal(record.body.amountFundedBaseUnits, '1000'); assert.equal(record.body.amountCreditedBaseUnits, '0');
  assert.equal(record.body.allocation.source, 'sponsor'); assert.equal(record.body.realFundsEnabled, false);
  assert.equal((await read('/api/credits')).body.available, '0');
  assert.equal((await read('/api/credits/deposits/' + order.id, 'bob')).status, 404);
  assert.equal((await read('/api/credits/deposits/prepare-prize-funding', 'alice', { method: 'POST' })).status, 405);
  assert.equal(g.calls.length, rpc); assert.equal(f.calls.length, 0);
});
