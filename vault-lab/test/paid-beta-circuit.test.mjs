import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { accountGameFixture, address, completion, hash, input } from './fixtures/account-game.mjs';
import { paidBetaTerms, paidBetaPricePolicy, splitWinPrize } from '../server/economy/paid-beta-policy.mjs';
import { createOperatingBox } from '../server/operating-box.mjs';
import { signExactPayment } from '../server/x402-blockrun.mjs';
import { createAuthenticatedClaims } from '../server/economy/authenticated-claims.mjs';
import { createWebFunding } from '../server/economy/web-funding.mjs';
import { createHttpServer } from '../server/http.mjs';
import { createRoundEscrow, USDG_MAINNET } from '../server/economy/round-escrow.mjs';
import { createLaptopRehearsalPayer, createLiveX402Payer } from '../server/x402-payer.mjs';
import { LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';

const HAIKU = 'anthropic/claude-haiku-4.5';
const prices = paidBetaPricePolicy(0);
const terms = {
  ...paidBetaTerms(),
  price: prices.basePrice,
  priceStep: prices.stepPrice,
  maximumPrice: prices.maximumPrice,
  durationMonths: 5
};

test('laptop rehearsal env cannot arm product paidConfigured', () => {
  assert.equal(createLiveX402Payer({}), null);
  assert.equal(createLaptopRehearsalPayer({ VAULT_X402_PRIVATE_KEY: `0x${'11'.repeat(32)}` }), null);
  assert.equal(LAPTOP_REHEARSAL_BOX, '0xf2824a8042e3597afe5a9d420bd69445e80e0c8f');
});

test('a paid-beta Haiku x402 attempt splits 70/30, stores a receipt, and never drips continuity', async t => {
  const box = createOperatingBox({ readBalance: async () => 1_000_000n, floor: 1000n });
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const f = await accountGameFixture({
    terms, models: [HAIKU],
    paidInference: {
      assertCoverage: amount => box.assertCoverage(amount),
      sign: requirement => signExactPayment({ account, requirement, now: () => 1_700_000_000 })
    }
  });
  t.after(f.close);
  f.deposit();
  const result = await f.game.attempt(f.headers(), { ...input('haiku-x402'), modelId: HAIKU });
  assert.equal(result.decision, 'locked');
  assert.equal(result.accounting.prizeContribution, '3');
  assert.equal(result.accounting.operations, '2');
  assert.equal(result.accounting.nextRound, '0');
  assert.equal((await f.game.account(f.headers())).available, '995');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:r1:prize').amount, '3');
  assert.equal(f.calls[0].transport, 'x402');
  assert.equal(f.calls[0].model, HAIKU);
  assert.equal(result.receipt.round.id, 'r1');
  assert.match(result.receipt.round.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(result.receipt.round.evidence, 'operator-recorded-not-independent-attestation');
  assert.equal(result.receipt.id, result.attemptId);
});

test('a paid-beta win records a payable claim without broadcasting funds', async t => {
  const f = await accountGameFixture({ terms, models: [HAIKU] });
  t.after(f.close);
  const claims = createAuthenticatedClaims({
    economy: f.economy, authentication: f.authentication,
    reader: { evidence: async () => { throw new Error('no chain'); } }
  });
  const funding = createWebFunding({
    economy: f.economy, deposits: { list: async () => ({ deposits: [] }) }, game: f.game,
    authentication: f.authentication, claims, maximumTopup: '50000000000000000000', testnet: true
  });
  const server = createHttpServer({ service: f.vault, authentication: f.authentication, publicDir: '.', funding });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const call = async (path, body, owner = 'alice', wallets) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  f.deposit();
  f.controls.transport = body => completion(body.model, 'keep_locked');
  assert.equal((await f.game.attempt(f.headers(), { ...input('lock'), modelId: HAIKU })).decision, 'locked');
  f.controls.transport = body => completion(body.model, 'release_prize');
  const won = await f.game.attempt(f.headers(), { ...input('win'), modelId: HAIKU });
  assert.equal(won.decision, 'released');
  const bounty = f.economy.state().balances.find(row => row.account === 'round:r1:prize')?.amount ?? '0';
  assert.equal(bounty, '0');
  const expected = splitWinPrize('7');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:r1:payable')?.amount, expected.payable);
  assert.equal(f.economy.state().balances.find(row => row.account === 'treasury:next')?.amount, expected.continuity);
  const view = await call('claims/r1');
  assert.equal(view.status, 200);
  assert.equal(view.body.amount, expected.payable);
  assert.equal(view.body.realFundsEnabled, false);
  assert.equal(view.body.broadcast, false);
  assert.equal(view.body.transfer.signingEnabled, false);
  const prepared = await call('claims/r1/prepare', {}, 'operator', [address('3')]);
  assert.equal(prepared.status, 200);
  assert.equal(prepared.body.realFundsEnabled, false);
  assert.equal(prepared.body.transfer.paymentsEnabled, false);
  await call('claims/r1/submit', { transactionHash: hash('c') }, 'operator', [address('3')]);
  const checked = await call('claims/r1/check', {}, 'operator', [address('3')]);
  assert.equal(checked.status, 502);
  assert.match(checked.body.error?.code ?? '', /CLAIM_RPC_UNAVAILABLE|CLAIM/);
  assert.equal(f.economy.state().rounds[0].state, 'won');
});

test('the 1 USDG escrow drill still refuses mainnet broadcast', () => {
  const escrow = createRoundEscrow({
    asset: USDG_MAINNET, roundId: 'usdg-1-unit-drill', manifestHash: 'e'.repeat(64),
    seedAmount: '1000000', mode: 'fixture-drill'
  });
  escrow.freezeAttempt({ attemptId: 'd1', recipient: address('2'), maxPrice: '1000000', inputHash: 'f'.repeat(64) });
  escrow.resolve({ attemptId: 'd1', resultHash: 'c'.repeat(64), decision: 'released' });
  const paid = escrow.executeFixtureClaim({ attemptId: 'd1', transactionHash: '0x' + '1'.repeat(64) });
  assert.equal(paid.amount, '750000');
  assert.equal(paid.broadcast, false);
  assert.equal(paid.chainId, '4663');
  assert.throws(() => escrow.broadcastMainnet(), /mainnet|disabled/i);
});

test('product x402 circuit source requires dedicated 0xf670 and refuses laptop payer', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const source = readFileSync(join(root, 'audit/paid-beta-product-x402-circuit.mjs'), 'utf8');
  assert.match(source, /0xf670531e46ba92f49c5d9c11d2c03875cffe7d40/);
  assert.match(source, /Laptop 0xf282 must not pay this Haiku/);
  assert.match(source, /operator-test-credit/);
  assert.match(source, /createLiveX402Payer/);
  assert.doesNotMatch(source, /laptopPayer|createLaptopRehearsalPayer/);
  assert.doesNotMatch(source, /web-funding-testnet|rh-test-amzn/);
});

test('opus local audit uses vercel 5e18 economics and mocked inference, not live USDC', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const source = readFileSync(join(root, 'audit/paid-beta-opus-local.mjs'), 'utf8');
  assert.match(source, /paid-beta\.vercel\.json/);
  assert.match(source, /anthropic\/claude-opus-5/);
  assert.match(source, /5000000000000000000/);
  assert.match(source, /blocked-on-faucet/);
  assert.match(source, /0x686c6cd47d0a09b5b77fff3f76e2786425dc2f79/);
  assert.match(source, /mocked-inference/);
  assert.match(source, /A real anthropic\/claude-opus-5 x402 call would spend Base USDC/);
  assert.doesNotMatch(source, /web-funding-testnet|rh-test-amzn|vault-paid-beta/);
});
