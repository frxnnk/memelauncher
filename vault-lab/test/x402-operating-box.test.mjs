import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { createLiveX402Payer, createX402Payer, assertX402RpcUrl } from '../server/x402-payer.mjs';
import {
  assertDedicatedOperatingBox, classifyOperatingBox, FORBIDDEN_OPERATING_BOXES, operatingBoxDecision,
  PRODUCT_X402_BOX
} from '../server/x402-operating-box-policy.mjs';

test('treasury, deposit payer and laptop rehearsal keys cannot arm the Vercel operating box', () => {
  assert.deepEqual(FORBIDDEN_OPERATING_BOXES, [
    '0xbec4fdb33ed39844956d9078fd232aca92d7396d',
    '0x686c6cd47d0a09b5b77fff3f76e2786425dc2f79',
    '0xf2824a8042e3597afe5a9d420bd69445e80e0c8f'
  ]);
  for (const address of FORBIDDEN_OPERATING_BOXES) {
    assert.throws(() => assertDedicatedOperatingBox(address), error => {
      assert.match(error.message, /dedicated Vercel env key|not the treasury|laptop/i);
      assert.doesNotMatch(error.message, /VPS/i);
      return true;
    });
  }
  assert.doesNotThrow(() => assertDedicatedOperatingBox(privateKeyToAccount(`0x${'11'.repeat(32)}`).address));
});

test('a dedicated key can arm the Vercel env operating box', () => {
  const key = `0x${'aa'.repeat(32)}`;
  const expected = privateKeyToAccount(key).address;
  const payer = createLiveX402Payer({
    VAULT_X402_PRIVATE_KEY: key, VAULT_X402_FLOOR_USDC: '1', VERCEL: '1',
    VAULT_X402_EXPECTED_ADDRESS: expected
  });
  assert.equal(payer.address.toLowerCase(), expected.toLowerCase());
});

test('an empty VAULT_X402_PRIVATE_KEY leaves paidConfigured unarmed', () => {
  assert.equal(createLiveX402Payer({}), null);
  const allowed = `0x${'11'.repeat(32)}`;
  const payer = createX402Payer({ privateKey: allowed, readBalance: async () => 1_000_000n, floor: 1n });
  assert.equal(payer.address.toLowerCase(), privateKeyToAccount(allowed).address.toLowerCase());
});

test('the product x402 ops box is dedicated 0xf670 for Vercel, not a VPS key', () => {
  assert.equal(PRODUCT_X402_BOX, '0xf670531e46ba92f49c5d9c11d2c03875cffe7d40');
  assert.equal(classifyOperatingBox(PRODUCT_X402_BOX), 'dedicated');
  assert.equal(operatingBoxDecision(PRODUCT_X402_BOX, 'vercel'), 'arm');
  assert.equal(operatingBoxDecision(PRODUCT_X402_BOX, 'local'), 'arm');
  assert.ok(!FORBIDDEN_OPERATING_BOXES.includes(PRODUCT_X402_BOX));
  assert.equal(assertX402RpcUrl('https://mainnet.base.org'), 'https://mainnet.base.org/');
  assert.throws(() => assertX402RpcUrl('https://rpc.testnet.chain.robinhood.com'), /Base|Robinhood/i);
  assert.throws(() => assertX402RpcUrl('https://mainnet.base.org', { VAULT_X402_CHAIN_ID: '46630' }), /8453/i);
  const otherKey = `0x${'11'.repeat(32)}`;
  assert.throws(() => createLiveX402Payer({
    VAULT_X402_PRIVATE_KEY: otherKey, VAULT_X402_FLOOR_USDC: '1', VERCEL: '1'
  }), /0xf670|product key/i);
});

test('the laptop rehearsal key is ignored locally and forbidden on Vercel', () => {
  const [treasury, payer, laptop] = FORBIDDEN_OPERATING_BOXES;
  const other = privateKeyToAccount(`0x${'11'.repeat(32)}`).address;
  assert.throws(() => operatingBoxDecision(other, 'vercel'), /0xf670|product key/i);
  assert.equal(operatingBoxDecision(other, 'vercel', { VAULT_X402_EXPECTED_ADDRESS: other }), 'arm');
  assert.equal(operatingBoxDecision(laptop, 'local'), 'ignore');
  assert.throws(() => operatingBoxDecision(laptop, 'vercel'), /Vercel env key/);
  assert.throws(() => operatingBoxDecision(treasury, 'local'), /treasury|Vercel env key/);
  assert.throws(() => operatingBoxDecision(payer, 'vercel'), /payer|Vercel env key/);
});
