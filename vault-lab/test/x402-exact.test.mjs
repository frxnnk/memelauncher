import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { selectExactBaseUsdc, signExactPayment, requestPaidCompletion } from '../server/x402-blockrun.mjs';
import { createOperatingBox } from '../server/operating-box.mjs';

const KEY = `0x${'11'.repeat(32)}`;
const ACCOUNT = privateKeyToAccount(KEY);
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const requirement = (overrides = {}) => ({
  scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: USDC,
  payTo: '0x00000000000000000000000000000000000000aa', maxTimeoutSeconds: 300,
  extra: { name: 'USD Coin', version: '2' }, ...overrides
});
const challenge = accepts => ({
  status: 402, headers: { get: () => null },
  data: { x402Version: 2, accepts, error: 'Payment Required', price: { amount: '0.002000', currency: 'USD' } }
});

test('only the exact Base USDC quote is payable', () => {
  const selected = selectExactBaseUsdc(challenge([
    { scheme: 'exact', network: 'solana:mainnet', amount: '1', asset: USDC },
    requirement()
  ]));
  assert.equal(selected.amount, '2000');
  assert.equal(selected.network, 'eip155:8453');
  assert.throws(() => selectExactBaseUsdc(challenge([{ scheme: 'exact', network: 'eip155:1', amount: '2000', asset: USDC }])),
    e => e.code === 'X402_QUOTE_UNSUPPORTED');
});

test('operating box refuses a quote before any signature if the floor would be breached', async () => {
  const box = createOperatingBox({ readBalance: async () => 3500n, floor: 1000n });
  await box.assertCoverage('2000');
  await assert.rejects(box.assertCoverage('2000'), e => e.code === 'INSUFFICIENT_OPERATING_FUNDS');
});

test('a 402 is signed once and retried with that payment; a timeout after signing does not create a second authorization', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, payment: init.headers?.['PAYMENT-SIGNATURE'] || null });
    if (!init.headers?.['PAYMENT-SIGNATURE']) {
      return new Response(JSON.stringify({ x402Version: 2, accepts: [requirement()], price: { amount: '0.002000', currency: 'USD' } }),
        { status: 402, headers: { 'Content-Type': 'application/json' } });
    }
    await new Promise(() => {});
  };
  await assert.rejects(requestPaidCompletion({
    fetchImpl, payer: {
      assertCoverage: async () => {},
      sign: async req => signExactPayment({ account: ACCOUNT, requirement: req, now: () => 1_700_000_000 })
    },
    modelId: 'anthropic/claude-haiku-4.5', messages: [{ role: 'user', content: 'Say ok.' }], timeoutMs: 30
  }), e => e.code === 'PAYMENT_UNCERTAIN');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].payment, null);
  assert.ok(calls[1].payment);
  const payload = JSON.parse(Buffer.from(calls[1].payment, 'base64').toString('utf8'));
  assert.equal(payload.x402Version, 2);
  assert.equal(payload.payload.authorization.from.toLowerCase(), ACCOUNT.address.toLowerCase());
  assert.equal(payload.payload.authorization.value, '2000');
});
