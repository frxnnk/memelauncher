import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { accountGameFixture, input } from './fixtures/account-game.mjs';
import { createOperatingBox } from '../server/operating-box.mjs';
import { signExactPayment } from '../server/x402-blockrun.mjs';

const ACCOUNT = privateKeyToAccount(`0x${'11'.repeat(32)}`);

test('a credited deposit pays one x402 inference and splits the attempt into bounty', async t => {
  const box = createOperatingBox({ readBalance: async () => 1_000_000n, floor: 1000n });
  const f = await accountGameFixture({ paidInference: {
    assertCoverage: amount => box.assertCoverage(amount),
    sign: requirement => signExactPayment({ account: ACCOUNT, requirement, now: () => 1_700_000_000 })
  } });
  t.after(f.close);
  f.deposit();
  const result = await f.game.attempt(f.headers(), input('circuit'));
  assert.equal(result.decision, 'locked');
  assert.equal(result.accounting.prizeContribution, '70');
  assert.equal(result.accounting.operations, '20');
  assert.equal(result.accounting.nextRound, '10');
  assert.equal((await f.game.account(f.headers())).available, '900');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:r1:prize').amount, '70');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].transport, 'x402');
  assert.equal(f.calls[0].model, input().modelId);
  assert.equal(f.calls[0].stream, false);
  assert.ok(!('provider' in f.calls[0]));
});

test('an empty operating box refunds credits and never signs a payment', async t => {
  const f = await accountGameFixture({ paidInference: {
    assertCoverage: amount => createOperatingBox({ readBalance: async () => 0n, floor: 1000n }).assertCoverage(amount),
    sign: async () => { throw new Error('must not sign'); }
  } });
  t.after(f.close);
  f.deposit();
  await assert.rejects(f.game.attempt(f.headers(), input('dry')), e => e.code === 'INSUFFICIENT_OPERATING_FUNDS' && e.accounting.creditsReturned === '100');
  assert.equal((await f.game.account(f.headers())).available, '1000');
  assert.equal(f.calls.length, 0);
});
