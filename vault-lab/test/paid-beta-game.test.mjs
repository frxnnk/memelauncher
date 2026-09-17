import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { accountGameFixture, completion, input } from './fixtures/account-game.mjs';
import { paidBetaTerms, paidBetaPricePolicy, splitWinPrize } from '../server/economy/paid-beta-policy.mjs';
import { verifyAssetLedgerExport } from '../audit/verify-asset-ledger.mjs';
import { createOperatingBox } from '../server/operating-box.mjs';
import { signExactPayment } from '../server/x402-blockrun.mjs';

const vercelPaid = JSON.parse(readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'config/paid-beta.vercel.json'), 'utf8'));

test('after a valid paid-beta attempt the next reservation uses the bumped price without breaking the manifest', async t => {
  const prices = paidBetaPricePolicy(0);
  const haiku = ['anthropic/claude-haiku-4.5'];
  const f = await accountGameFixture({
    terms: { ...paidBetaTerms(), price: prices.basePrice, priceStep: prices.stepPrice, maximumPrice: prices.maximumPrice, durationMonths: 5 },
    models: haiku
  });
  t.after(f.close);
  f.deposit();
  const first = await f.game.attempt(f.headers(), { ...input('one'), modelId: haiku[0] });
  assert.equal(first.accounting.prizeContribution, '3');
  assert.equal(first.accounting.operations, '2');
  assert.equal(first.accounting.nextRound, '0');
  assert.equal(f.economy.state().rounds.find(row => row.id === 'r1').price, '6');
  const second = await f.game.attempt(f.headers(), { ...input('two'), modelId: haiku[0] });
  assert.equal(second.accounting.prizeContribution, '4');
  assert.equal(f.economy.state().rounds.find(row => row.id === 'r1').price, '7');
  const snapshot = JSON.parse(JSON.stringify(f.economy.export()));
  assert.equal(snapshot.roundManifests[0].manifest.configuration.guardians.length, 1);
  assert.equal(verifyAssetLedgerExport(snapshot).status, 'internally-consistent');
});

test('a paid-beta opus round can pay x402 even when the practice catalog omits it', async t => {
  const prices = paidBetaPricePolicy(0);
  const opus = ['anthropic/claude-opus-5'];
  const box = createOperatingBox({ readBalance: async () => 1_000_000n, floor: 1000n });
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const f = await accountGameFixture({
    terms: { ...paidBetaTerms(), price: prices.basePrice, priceStep: prices.stepPrice, maximumPrice: prices.maximumPrice, durationMonths: 5 },
    models: opus,
    paidInference: {
      assertCoverage: amount => box.assertCoverage(amount),
      sign: requirement => signExactPayment({ account, requirement, now: () => 1_700_000_000 })
    }
  });
  t.after(f.close);
  f.deposit();
  const result = await f.game.attempt(f.headers(), { ...input('opus'), modelId: opus[0] });
  assert.equal(result.decision, 'locked');
  assert.equal(result.accounting.prizeContribution, '3');
  assert.equal(result.accounting.operations, '2');
  assert.equal(result.accounting.nextRound, '0');
  assert.equal(f.calls[0].transport, 'x402');
  assert.equal(f.calls[0].model, opus[0]);
});

test('a vercel paid-beta opus round at 5e18 AMZN splits 70/30 and retains 25% on a win', async t => {
  const opus = vercelPaid.rounds[0].models;
  assert.deepEqual(opus, ['anthropic/claude-opus-5']);
  assert.equal(vercelPaid.terms.price, '5000000000000000000');
  const box = createOperatingBox({ readBalance: async () => 1_000_000n, floor: 1000n });
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const f = await accountGameFixture({
    asset: vercelPaid.asset,
    terms: vercelPaid.terms,
    models: opus,
    roundId: vercelPaid.rounds[0].id,
    paidInference: {
      assertCoverage: amount => box.assertCoverage(amount),
      sign: requirement => signExactPayment({ account, requirement, now: () => 1_700_000_000 })
    }
  });
  t.after(f.close);
  f.deposit(f.alice, vercelPaid.maximumTopup);
  const locked = await f.game.attempt(f.headers(), {
    ...input('opus-5e18-lock'), roundId: vercelPaid.rounds[0].id, modelId: opus[0]
  });
  assert.equal(locked.decision, 'locked');
  assert.equal(locked.accounting.prizeContribution, '3500000000000000000');
  assert.equal(locked.accounting.operations, '1500000000000000000');
  assert.equal(locked.accounting.nextRound, '0');
  assert.equal(f.calls[0].transport, 'x402');
  assert.equal(f.calls[0].model, opus[0]);
  assert.equal(f.economy.state().rounds.find(row => row.id === vercelPaid.rounds[0].id).price, '6000000000000000000');
  f.controls.transport = body => completion(body.model, 'release_prize');
  const won = await f.game.attempt(f.headers(), {
    ...input('opus-5e18-win'), roundId: vercelPaid.rounds[0].id, modelId: opus[0]
  });
  assert.equal(won.decision, 'released');
  assert.equal(won.accounting.prizeContribution, '4200000000000000000');
  const expected = splitWinPrize('7700000000000000000');
  assert.equal(expected.payable, '5775000000000000000');
  assert.equal(expected.continuity, '1925000000000000000');
  const roundId = vercelPaid.rounds[0].id;
  assert.equal(f.economy.state().balances.find(row => row.account === `round:${roundId}:prize`)?.amount ?? '0', '0');
  assert.equal(f.economy.state().balances.find(row => row.account === `round:${roundId}:payable`)?.amount, expected.payable);
  assert.equal(f.economy.state().balances.find(row => row.account === 'treasury:next')?.amount, expected.continuity);
  assert.equal(f.economy.state().rounds.find(row => row.id === roundId).state, 'won');
  const snapshot = JSON.parse(JSON.stringify(f.economy.export()));
  assert.equal(snapshot.roundManifests[0].manifest.configuration.guardians[0].modelId, opus[0]);
  assert.equal(verifyAssetLedgerExport(snapshot).status, 'internally-consistent');
});
