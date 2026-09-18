import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import { accountGameFixture, address, completion, hash, input } from './fixtures/account-game.mjs';
import { startWebFunding, validateWebFundingConfiguration } from '../server/economy/web-funding-runtime.mjs';
import { createWebFunding } from '../server/economy/web-funding.mjs';
import { createAuthenticatedClaims } from '../server/economy/authenticated-claims.mjs';
import { createHttpServer } from '../server/http.mjs';
import { checkedDepositTransaction, checkedPayoutTransaction, FUNDING_NETWORK } from '../public/funding-network.js';
import { splitWinPrize, applyPaidBetaFundingConfig, paidBetaPricePolicy } from '../server/economy/paid-beta-policy.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX, operatingBoxDecision } from '../server/x402-operating-box-policy.mjs';
import { inspectTestnetEnv } from '../audit/inspect-testnet-env.mjs';
import { inspectEnvBoxes } from '../audit/inspect-env-boxes.mjs';
import { canSendPlayerDeposit, playerDepositSigner, provingDepositAmount } from '../scripts/paid-beta-testnet-deposit.mjs';
import { TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS, unsignedDepositLifetimeMs } from '../server/economy/deposit-orders.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const haikuConfigPath = join(root, 'config/paid-beta-haiku.testnet.json');
const vercelConfigPath = join(root, 'config/paid-beta.vercel.json');
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';

function fixtureRpc() {
  const rpcUrl = 'https://fixture.invalid/paid-beta-haiku';
  const methods = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, rpcUrl);
    const { id, method } = JSON.parse(init.body);
    methods.push(method);
    assert.ok(!/send|sign|personal_/i.test(method), 'Deposit preparation must not sign or broadcast.');
    const results = {
      eth_chainId: FUNDING_NETWORK.hexId,
      eth_blockNumber: '0x66',
      eth_getTransactionReceipt: null,
      eth_getBlockByNumber: { hash: hash('b'), number: '0x64' }
    };
    assert.ok(Object.hasOwn(results, method), `Unexpected RPC method ${method}`);
    return Response.json({ jsonrpc: '2.0', id, result: results[method] });
  };
  return { rpcUrl, fetchImpl, methods };
}

test('paid-beta Haiku testnet config is Robinhood AMZN 46630, not mainnet USDG or rehearsal', () => {
  const example = JSON.parse(readFileSync(haikuConfigPath, 'utf8'));
  const validated = validateWebFundingConfiguration(example);
  assert.equal(validated.environment, 'testnet');
  assert.equal(validated.policy, 'paid-beta');
  assert.equal(validated.asset.chainId, '46630');
  assert.equal(validated.asset.tokenAddress, AMZN);
  assert.notEqual(validated.asset.chainId, '4663');
  assert.equal(validated.rounds[0].id, 'rh-paid-haiku-v1');
  assert.deepEqual(validated.rounds[0].models, ['anthropic/claude-haiku-4.5']);
  assert.doesNotMatch(validated.rounds[0].id, /amzn|rehearsal/i);
  assert.equal(validated.terms.prizeBps, 7000);
  assert.equal(validated.terms.operationsBps, 3000);
  assert.equal(validated.terms.nextRoundBps, 0);
  assert.equal(validated.terms.price, '1000000000000000000');
  assert.equal(validated.terms.priceStep, '1000000000000000000');
  assert.equal(validated.terms.maximumPrice, '5000000000000000000');
  const published = paidBetaPricePolicy(18);
  assert.equal(published.basePrice, '5000000000000000000');
  assert.equal(published.maximumPrice, '25000000000000000000');
  assert.throws(() => applyPaidBetaFundingConfig(example), /paid-beta|5→25|published/i);
  assert.equal(paidBetaPricePolicy(18).basePrice, published.basePrice);
  assert.equal(validated.destination ?? validated.asset.destination, TREASURY_BOX);
  assert.equal(unsignedDepositLifetimeMs(validated), TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS);
  const vercelPaid = JSON.parse(readFileSync(join(root, 'config/paid-beta.vercel.json'), 'utf8'));
  assert.equal(unsignedDepositLifetimeMs(vercelPaid), TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS);
  assert.notEqual(validated.asset.destination, PAYER_BOX);
  assert.notEqual(validated.asset.destination, LAPTOP_REHEARSAL_BOX);
  assert.throws(() => validateWebFundingConfiguration({
    ...example,
    rounds: [{ id: 'rh-paid-haiku-v1', models: ['anthropic/claude-haiku-4.5', 'anthropic/claude-opus-5'] }]
  }), /one guardian/i);
});

test('paid-beta Haiku funding prepares an unsigned Robinhood testnet deposit and never broadcasts', async t => {
  const f = await accountGameFixture();
  const directory = await mkdtemp(join(tmpdir(), 'vault-paid-beta-haiku-'));
  assert.doesNotMatch(directory, /web-funding-testnet|rh-test-amzn/i);
  const { rpcUrl, fetchImpl, methods } = fixtureRpc();
  const runtime = await startWebFunding({
    configPath: haikuConfigPath,
    dataDirectory: join(directory, 'web-funding-paid-beta'),
    authentication: f.authentication,
    limits: f.limits,
    vault: f.vault,
    rpcUrl,
    fetchImpl,
    hosting: { name: 'local', ephemeralData: false, backgroundTimers: false }
  });
  const round = runtime.funding.configuration().rounds[0];
  assert.equal(round.id, 'rh-paid-haiku-v1');
  assert.equal(round.prizeBps, 7000);
  assert.equal(round.operationsBps, 3000);
  assert.equal(round.nextRoundBps, 0);
  assert.equal(round.price, '1000000000000000000');
  assert.equal(runtime.funding.configuration().realFundsEnabled, false);
  assert.equal(runtime.funding.configuration().asset.chainId, '46630');
  assert.equal(runtime.funding.configuration().asset.tokenAddress, AMZN);

  const server = createHttpServer({
    service: f.vault, authentication: f.authentication, publicDir: '.', funding: runtime.funding
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await runtime.close();
    f.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  const amount = '1000000000000000000';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/deposits`, {
    method: 'POST',
    headers: { ...f.headers('alice'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'rh-haiku-prep', wallet: address('2'), amountBaseUnits: amount })
  });
  const prepared = await response.json();
  assert.equal(response.status, 200, JSON.stringify(prepared));
  assert.equal(prepared.environment, 'testnet');
  assert.equal(prepared.realFundsEnabled, false);
  assert.equal(prepared.transfer.paymentsEnabled, false);
  const tx = checkedDepositTransaction(prepared);
  assert.equal(tx.chainId, '0xb626');
  assert.equal(tx.from, address('2'));
  assert.notEqual(tx.from.toLowerCase(), '0xfcf79a0d3d32791df521a041b02ac97ca12842f4');
  assert.notEqual(tx.from.toLowerCase(), TREASURY_BOX);
  const otherWallet = address('4');
  const other = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/deposits`, {
    method: 'POST',
    headers: { ...f.headers('bob', [otherWallet]), 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'rh-haiku-prep-other', wallet: otherWallet, amountBaseUnits: amount })
  });
  const otherBody = await other.json();
  assert.equal(other.status, 200, JSON.stringify(otherBody));
  assert.equal(checkedDepositTransaction(otherBody).from, otherWallet);
  assert.notEqual(checkedDepositTransaction(otherBody).from, address('2'));
  assert.equal(tx.to, AMZN);
  assert.equal(tx.value, '0x0');
  assert.equal(tx.data, '0xa9059cbb' + TREASURY_BOX.slice(2).padStart(64, '0') + BigInt(amount).toString(16).padStart(64, '0'));
  assert.ok(!methods.some(method => /send|sign/i.test(method)));
  assert.equal(prepared.order.expiresAt - prepared.order.createdAt, TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS);
  assert.equal((await runtime.funding.handle(f.headers('alice'), 'GET', '/api/funding/account', new URLSearchParams())).available, '0');
});

test('paid-beta Vercel opus funding prepares an unsigned 5e18 AMZN deposit and never broadcasts', async t => {
  const f = await accountGameFixture();
  const directory = await mkdtemp(join(tmpdir(), 'vault-paid-opus-'));
  const { rpcUrl, fetchImpl, methods } = fixtureRpc();
  const runtime = await startWebFunding({
    configPath: vercelConfigPath,
    dataDirectory: join(directory, 'web-funding-paid-opus'),
    authentication: f.authentication,
    limits: f.limits,
    vault: f.vault,
    rpcUrl,
    fetchImpl,
    hosting: { name: 'local', ephemeralData: false, backgroundTimers: false }
  });
  const round = runtime.funding.configuration().rounds[0];
  assert.equal(runtime.funding.configuration().rounds.length, 2);
  assert.equal(round.id, 'rh-paid-opus-v1');
  assert.equal(runtime.funding.configuration().rounds[1].id, 'rh-payout-prove-v1');
  assert.equal(runtime.funding.configuration().rounds[1].kind, 'payout-proving');
  assert.equal(round.prizeBps, 7000);
  assert.equal(round.operationsBps, 3000);
  assert.equal(round.nextRoundBps, 0);
  assert.equal(round.winRetainBps, 2500);
  assert.equal(round.price, '5000000000000000000');
  assert.equal(round.manifest.manifest.configuration.guardians[0].modelId, 'anthropic/claude-opus-5');
  assert.equal(runtime.funding.configuration().realFundsEnabled, false);
  assert.equal(runtime.funding.configuration().asset.chainId, '46630');
  assert.equal(runtime.funding.configuration().asset.tokenAddress, AMZN);
  assert.equal(runtime.funding.configuration().asset.destination, TREASURY_BOX);

  const server = createHttpServer({
    service: f.vault, authentication: f.authentication, publicDir: '.', funding: runtime.funding
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await runtime.close();
    f.close();
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  });
  const amount = '5000000000000000000';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/deposits`, {
    method: 'POST',
    headers: { ...f.headers('alice'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'rh-opus-prep', wallet: address('2'), amountBaseUnits: amount })
  });
  const prepared = await response.json();
  assert.equal(response.status, 200, JSON.stringify(prepared));
  assert.equal(prepared.environment, 'testnet');
  assert.equal(prepared.realFundsEnabled, false);
  assert.equal(prepared.transfer.paymentsEnabled, false);
  const tx = checkedDepositTransaction(prepared);
  assert.equal(tx.chainId, '0xb626');
  assert.equal(tx.from, address('2'));
  assert.notEqual(tx.from.toLowerCase(), TREASURY_BOX);
  assert.notEqual(tx.from.toLowerCase(), PAYER_BOX);
  assert.equal(tx.to, AMZN);
  assert.equal(tx.value, '0x0');
  assert.equal(tx.data, '0xa9059cbb' + TREASURY_BOX.slice(2).padStart(64, '0') + BigInt(amount).toString(16).padStart(64, '0'));
  assert.ok(!methods.some(method => /send|sign/i.test(method)));
  assert.equal(prepared.order.minimumReceived, amount);
  assert.equal((await runtime.funding.handle(f.headers('alice'), 'GET', '/api/funding/account', new URLSearchParams())).available, '0');
});

test('paid-beta Haiku claim prepares an unsigned treasury AMZN transfer and does not broadcast', async t => {
  const example = JSON.parse(readFileSync(haikuConfigPath, 'utf8'));
  const validated = validateWebFundingConfiguration(example);
  const HAIKU = 'anthropic/claude-haiku-4.5';
  const f = await accountGameFixture({
    asset: validated.asset,
    terms: validated.terms,
    models: [HAIKU],
    roundId: 'rh-paid-haiku-v1'
  });
  const claims = createAuthenticatedClaims({
    economy: f.economy, authentication: f.authentication,
    reader: { evidence: async () => { throw new Error('no chain'); } }
  });
  const funding = createWebFunding({
    economy: f.economy, deposits: { list: async () => ({ deposits: [] }) }, game: f.game,
    authentication: f.authentication, claims, maximumTopup: validated.maximumTopup, testnet: true
  });
  const server = createHttpServer({
    service: f.vault, authentication: f.authentication, publicDir: '.', funding
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await f.close();
  });
  const call = async (path, body, owner = 'alice', wallets) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  const amount = validated.terms.price;
  f.deposit(f.alice, amount);
  f.controls.transport = body => completion(body.model, 'release_prize');
  const won = await f.game.attempt(f.headers(), { ...input('win'), roundId: 'rh-paid-haiku-v1', modelId: HAIKU });
  assert.equal(won.decision, 'released');
  const bounty = f.economy.state().balances.find(row => row.account === 'round:rh-paid-haiku-v1:prize')?.amount ?? '0';
  assert.equal(bounty, '0');
  const contribution = (BigInt(amount) * 7000n) / 10000n;
  const expected = splitWinPrize(String(contribution));
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:rh-paid-haiku-v1:payable')?.amount, expected.payable);
  const view = await call('claims/rh-paid-haiku-v1');
  assert.equal(view.status, 200);
  assert.equal(view.body.realFundsEnabled, false);
  assert.equal(view.body.transfer.signingEnabled, false);
  const prepared = await call('claims/rh-paid-haiku-v1/prepare', {}, 'operator', [TREASURY_BOX]);
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  assert.equal(prepared.body.realFundsEnabled, false);
  assert.equal(prepared.body.transfer.paymentsEnabled, false);
  const tx = checkedPayoutTransaction(prepared.body);
  assert.equal(tx.chainId, FUNDING_NETWORK.hexId);
  assert.equal(tx.from, TREASURY_BOX);
  assert.equal(tx.to, AMZN);
  assert.equal(tx.value, '0x0');
  assert.notEqual(tx.from, PAYER_BOX);
  assert.notEqual(tx.from, LAPTOP_REHEARSAL_BOX);
  assert.equal(prepared.body.broadcast, false);
});

test('paid-beta Haiku claim records a payable and pays it from mocked treasury AMZN evidence without broadcasting', async t => {
  const example = JSON.parse(readFileSync(haikuConfigPath, 'utf8'));
  const validated = validateWebFundingConfiguration(example);
  const HAIKU = 'anthropic/claude-haiku-4.5';
  const winner = address('2');
  const f = await accountGameFixture({
    asset: validated.asset,
    terms: validated.terms,
    models: [HAIKU],
    roundId: 'rh-paid-haiku-v1'
  });
  let receipt = null;
  const claims = createAuthenticatedClaims({
    economy: f.economy, authentication: f.authentication,
    reader: {
      evidence: async order => {
        assert.match(order.transactionHash, /^0x[0-9a-f]{64}$/i);
        return {
          chainId: FUNDING_NETWORK.hexId,
          headBlockNumber: '0x66',
          canonicalBlock: { hash: hash('b'), number: '0x64' },
          receipt
        };
      }
    }
  });
  const funding = createWebFunding({
    economy: f.economy, deposits: { list: async () => ({ deposits: [] }) }, game: f.game,
    authentication: f.authentication, claims, maximumTopup: validated.maximumTopup, testnet: true
  });
  const server = createHttpServer({
    service: f.vault, authentication: f.authentication, publicDir: '.', funding
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await f.close();
  });
  const call = async (path, body, owner = 'alice', wallets) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  const amount = validated.terms.price;
  f.deposit(f.alice, amount);
  f.controls.transport = body => completion(body.model, 'release_prize');
  const won = await f.game.attempt(f.headers(), { ...input('win'), roundId: 'rh-paid-haiku-v1', modelId: HAIKU });
  assert.equal(won.decision, 'released');
  const contribution = (BigInt(amount) * 7000n) / 10000n;
  const expected = splitWinPrize(String(contribution));
  assert.notEqual(expected.payable, '100000000000000000');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:rh-paid-haiku-v1:payable')?.amount, expected.payable);
  const prepared = await call('claims/rh-paid-haiku-v1/prepare', {}, 'operator', [TREASURY_BOX]);
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  const payout = checkedPayoutTransaction(prepared.body);
  assert.equal(payout.from, TREASURY_BOX);
  assert.equal(payout.to, AMZN);
  assert.equal(payout.chainId, FUNDING_NETWORK.hexId);
  assert.equal(prepared.body.broadcast, false);
  const submitted = await call('claims/rh-paid-haiku-v1/submit', { transactionHash: hash('c') }, 'operator', [TREASURY_BOX]);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  receipt = {
    transactionHash: hash('c'), status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
    logs: [{
      transactionHash: hash('c'), logIndex: '0x0', address: AMZN, blockHash: hash('b'),
      blockNumber: '0x64', removed: false,
      topics: [
        TRANSFER_TOPIC,
        '0x' + TREASURY_BOX.slice(2).padStart(64, '0'),
        '0x' + winner.slice(2).padStart(64, '0')
      ],
      data: '0x' + BigInt(expected.payable).toString(16).padStart(64, '0')
    }]
  };
  const checked = await call('claims/rh-paid-haiku-v1/check', {}, 'operator', [TREASURY_BOX]);
  assert.equal(checked.status, 200, JSON.stringify(checked.body));
  assert.equal(checked.body.order.state, 'paid');
  assert.equal(checked.body.order.paid, expected.payable);
  assert.equal(checked.body.broadcast, false);
  assert.equal(checked.body.realFundsEnabled, false);
  assert.equal(f.economy.state().rounds.find(row => row.id === 'rh-paid-haiku-v1').state, 'paid');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:rh-paid-haiku-v1:payable')?.amount ?? '0', '0');
});

test('paid-beta Vercel Opus claim records a 5e18 payable and pays it from mocked treasury AMZN without broadcasting', async t => {
  const example = JSON.parse(readFileSync(vercelConfigPath, 'utf8'));
  const validated = validateWebFundingConfiguration(example);
  const OPUS = 'anthropic/claude-opus-5';
  const winner = address('2');
  const f = await accountGameFixture({
    asset: validated.asset,
    terms: validated.terms,
    models: [OPUS],
    roundId: 'rh-paid-opus-v1'
  });
  let receipt = null;
  const claims = createAuthenticatedClaims({
    economy: f.economy, authentication: f.authentication,
    reader: {
      evidence: async order => {
        assert.match(order.transactionHash, /^0x[0-9a-f]{64}$/i);
        return {
          chainId: FUNDING_NETWORK.hexId,
          headBlockNumber: '0x66',
          canonicalBlock: { hash: hash('b'), number: '0x64' },
          receipt
        };
      }
    }
  });
  const funding = createWebFunding({
    economy: f.economy, deposits: { list: async () => ({ deposits: [] }) }, game: f.game,
    authentication: f.authentication, claims, maximumTopup: validated.maximumTopup, testnet: true
  });
  const server = createHttpServer({
    service: f.vault, authentication: f.authentication, publicDir: '.', funding
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await f.close();
  });
  const call = async (path, body, owner = 'alice', wallets) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  const amount = validated.terms.price;
  assert.equal(amount, '5000000000000000000');
  f.deposit(f.alice, amount);
  f.controls.transport = body => completion(body.model, 'release_prize');
  const won = await f.game.attempt(f.headers(), { ...input('win'), roundId: 'rh-paid-opus-v1', modelId: OPUS });
  assert.equal(won.decision, 'released');
  const contribution = (BigInt(amount) * 7000n) / 10000n;
  const expected = splitWinPrize(String(contribution));
  assert.equal(expected.payable, '2625000000000000000');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:rh-paid-opus-v1:payable')?.amount, expected.payable);
  const unauth = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/claims/rh-paid-opus-v1`);
  assert.equal(unauth.status, 401);
  const prepared = await call('claims/rh-paid-opus-v1/prepare', {}, 'operator', [TREASURY_BOX]);
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  const payout = checkedPayoutTransaction(prepared.body);
  assert.equal(payout.from, TREASURY_BOX);
  assert.equal(payout.to, AMZN);
  assert.equal(payout.chainId, FUNDING_NETWORK.hexId);
  assert.notEqual(payout.from, PAYER_BOX);
  assert.notEqual(payout.from, LAPTOP_REHEARSAL_BOX);
  assert.equal(prepared.body.broadcast, false);
  assert.equal(prepared.body.realFundsEnabled, false);
  const submitted = await call('claims/rh-paid-opus-v1/submit', { transactionHash: hash('c') }, 'operator', [TREASURY_BOX]);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  receipt = {
    transactionHash: hash('c'), status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
    logs: [{
      transactionHash: hash('c'), logIndex: '0x0', address: AMZN, blockHash: hash('b'),
      blockNumber: '0x64', removed: false,
      topics: [
        TRANSFER_TOPIC,
        '0x' + TREASURY_BOX.slice(2).padStart(64, '0'),
        '0x' + winner.slice(2).padStart(64, '0')
      ],
      data: '0x' + BigInt(expected.payable).toString(16).padStart(64, '0')
    }]
  };
  const checked = await call('claims/rh-paid-opus-v1/check', {}, 'operator', [TREASURY_BOX]);
  assert.equal(checked.status, 200, JSON.stringify(checked.body));
  assert.equal(checked.body.order.state, 'paid');
  assert.equal(checked.body.order.paid, expected.payable);
  assert.equal(checked.body.broadcast, false);
  assert.equal(f.economy.state().rounds.find(row => row.id === 'rh-paid-opus-v1').state, 'paid');
});

test('paid-beta Robinhood testnet env names are documented for a new ledger', () => {
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  for (const name of [
    'VAULT_WEB_FUNDING_CONFIG',
    'VAULT_FUNDING_RPC_URL',
    'VAULT_TESTNET_DEPOSIT_PRIVATE_KEY',
    'VAULT_TESTNET_CLAIM_PRIVATE_KEY',
    'VAULT_LOCAL_TESTNET_OBSERVE',
    'VAULT_X402_EXPECTED_ADDRESS',
    'VAULT_X402_CHAIN_ID'
  ]) {
    assert.match(example, new RegExp(name));
  }
  assert.match(example, /0xf670531e46ba92f49c5d9c11d2c03875cffe7d40/);
  assert.match(example, /Vercel project/);
  assert.match(example, /Not a new VPS/i);
  assert.match(example, /vercel\.api-cutover\.json/);
  assert.doesNotMatch(example, /deploy a new VPS/i);
  assert.match(example, /web-funding-paid-beta|NEW funding data directory/);
  assert.match(example, /localhost:4319|127\.0\.0\.1:4319/);
  const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
  assert.match(packageJson, /paid-beta:testnet/);
  assert.match(packageJson, /paid-beta:testnet-deposit/);
  assert.match(packageJson, /paid-beta:turso/);
  assert.doesNotMatch(example, /173\.212\.246\.68/);
  const inspected = inspectTestnetEnv(join(root, '.env.example'));
  assert.equal(inspected.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY.present, false);
  assert.equal(inspected.VAULT_TESTNET_CLAIM_PRIVATE_KEY.present, false);
  assert.equal(inspected.canLiveDeposit, false);
  assert.equal(inspected.canLiveClaim, false);
  const boxes = inspectEnvBoxes([join(root, '.env.example')]);
  assert.equal(boxes.keysPrinted, false);
  assert.equal(boxes.treasurySignerPresent, false);
  const liveBeta = readFileSync(join(root, 'deploy/LIVE-BETA.md'), 'utf8');
  assert.doesNotMatch(liveBeta, /deploy to VPS/i);
  assert.match(liveBeta, /vercel\.api-cutover\.json/);
  assert.match(liveBeta, /unused credits stay non-refundable/i);
  assert.match(liveBeta, /Send prize from treasury/);
  assert.match(readFileSync(join(root, 'scripts/paid-beta-testnet.mjs'), 'utf8'), /Send prize from treasury/);
  const closedStatus = readFileSync(join(root, '../docs/treasure-guardian/CLOSED-BETA-STATUS.md'), 'utf8');
  assert.match(closedStatus, /Live product is Vercel/i);
  assert.match(closedStatus, /do not SSH/i);
  assert.doesNotMatch(closedStatus, /API Node y SQLite en el VPS Windows existente/);
  assert.match(readFileSync(join(root, 'public/funding.js'), 'utf8'), /Unused credits stay non-refundable/);
  assert.match(readFileSync(join(root, 'public/funding.js'), 'utf8'), /Pay-from wallet/);
  assert.match(readFileSync(join(root, 'scripts/paid-beta-testnet.mjs'), 'utf8'), /localhost login optional/);
  assert.doesNotMatch(readFileSync(join(root, 'scripts/paid-beta-testnet.mjs'), 'utf8'), /Fund this dedicated testnet address, then complete Top up/);
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.equal((vercel.rewrites ?? []).find(rule => rule.source === '/api/:path*')?.destination, '/api/index?__vault_path=/api/:path*');
  const caddy = JSON.parse(readFileSync(join(root, 'deploy/vercel.caddy-rewrite.json'), 'utf8'));
  assert.match((caddy.rewrites ?? []).find(rule => rule.source === '/api/:path*')?.destination ?? '', /sslip\.io/);
});

test('paid-beta testnet deposit CLI proves 1e18 AMZN from a player EOA including 0x686c', () => {
  const config = JSON.parse(readFileSync(haikuConfigPath, 'utf8'));
  assert.equal(provingDepositAmount(config).toString(), '1000000000000000000');
  assert.equal(provingDepositAmount(config).toString(), config.terms.price);
  assert.notEqual(provingDepositAmount(config).toString(), '5000000000000000000');
  assert.equal(canSendPlayerDeposit(PAYER_BOX), true);
  assert.equal(canSendPlayerDeposit('0xFcF79a0D3D32791dF521A041b02Ac97Ca12842F4'), true);
  assert.equal(canSendPlayerDeposit(TREASURY_BOX), false);
  const faucetKey = `0x${'11'.repeat(32)}`;
  const faucet = playerDepositSigner({ VAULT_TESTNET_DEPOSIT_PRIVATE_KEY: faucetKey });
  assert.equal(faucet.address, privateKeyToAccount(faucetKey).address.toLowerCase());
  assert.notEqual(faucet.address, TREASURY_BOX);
  assert.equal(playerDepositSigner({ VAULT_TESTNET_DEPOSIT_PRIVATE_KEY: '' }), null);
  assert.throws(() => operatingBoxDecision(PAYER_BOX, 'local'), /treasury|payer|Vercel env key/i);
  assert.throws(() => operatingBoxDecision(TREASURY_BOX, 'local'), /treasury|Vercel env key/i);
  assert.throws(() => operatingBoxDecision(LAPTOP_REHEARSAL_BOX, 'vercel'), /Vercel env key/);
  const script = readFileSync(join(root, 'scripts/paid-beta-testnet-deposit.mjs'), 'utf8');
  assert.doesNotMatch(script, /5_000_000_000_000_000_000n/);
  assert.doesNotMatch(script, /classifyOperatingBox\(account\.address\) !== 'dedicated'/);
  assert.doesNotMatch(script, /!== DEPOSIT_ADDRESS\.toLowerCase\(\)/);
});

test('amzn-claim-drill records a payable through prepare/submit/check without broadcasting or touching live Turso', async () => {
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [join(root, 'audit/amzn-claim-drill.mjs')], {
    cwd: root,
    env: {
      ...process.env,
      VAULT_DURABLE_DATA: '',
      VAULT_LIBSQL_URL: '',
      VAULT_LIBSQL_AUTH_TOKEN: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const out = await new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `drill exit ${code}`)));
  });
  const printed = JSON.parse(out);
  assert.equal(printed.ok, true);
  assert.equal(printed.broadcast, false);
  assert.equal(printed.executedTransfer, false);
  assert.equal(printed.liveRoundMutated, false);
  assert.equal(printed.payable, '2625000000000000000');
  assert.equal(printed.continuity, '875000000000000000');
  const report = JSON.parse(readFileSync(join(root, 'output/amzn-claim-drill.json'), 'utf8'));
  assert.equal(report.chainId, '46630');
  assert.equal(report.guardian, 'anthropic/claude-opus-5');
  assert.equal(report.decision, 'released');
  assert.equal(report.prizeContribution, '3500000000000000000');
  assert.equal(report.operationsContribution, '1500000000000000000');
  assert.equal(report.payable, '2625000000000000000');
  assert.equal(report.continuity, '875000000000000000');
  assert.equal(report.broadcast, false);
  assert.equal(report.executedTransfer, false);
  assert.equal(report.liveRoundMutated, false);
  assert.equal(report.productionTurso, false);
  assert.equal(report.roundStateAfterCheck, 'paid');
  assert.equal(report.unsignedTransfer.from.toLowerCase(), TREASURY_BOX);
  assert.equal(report.unsignedTransfer.to.toLowerCase(), AMZN);
  assert.equal(report.unsignedTransfer.chainId, FUNDING_NETWORK.hexId);
  assert.notEqual(report.unsignedTransfer.from.toLowerCase(), PAYER_BOX);
  assert.notEqual(report.unsignedTransfer.from.toLowerCase(), LAPTOP_REHEARSAL_BOX);
  assert.match(report.testnetBroadcastRefused, /disabled|refused/i);
  assert.match(report.mainnetBroadcastRefused, /\$500|disabled|refused/i);
  assert.doesNotMatch(JSON.stringify(report), /500000000[^0]|vault-paid-beta-frxnnk/);
});

