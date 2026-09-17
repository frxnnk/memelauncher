import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { preparePayoutTransfer, validatePayout, findPayoutTransfer } from '../server/economy/payout-transfer.mjs';
import { TREASURY_BOX } from '../server/x402-operating-box-policy.mjs';

const address = n => '0x' + n.repeat(40);
const hash = n => '0x' + n.repeat(64);
const topic = a => '0x' + '0'.repeat(24) + a.slice(2);
const asset = { chainId: '1337', tokenAddress: address('1'), destination: address('3'), decimals: 18,
  minimumConfirmations: 3, standardTransferVerified: true };
const operator = { authenticated: true, accountId: 'player_operator', walletOwnershipVerified: true,
  wallets: [{ address: address('3'), chainType: 'ethereum' }] };
const winner = { authenticated: true, accountId: 'player_alice', walletOwnershipVerified: true,
  wallets: [{ address: address('2'), chainType: 'ethereum' }] };

function claim(overrides = {}) {
  return { roundId: 'r1', amount: '70', recipient: address('2'), treasury: asset.destination,
    asset, state: 'won', ...overrides };
}

function evidence(amount = '70', from = address('3'), to = address('2')) {
  const log = { address: asset.tokenAddress, logIndex: '0x0', transactionHash: hash('c'), blockHash: hash('b'),
    blockNumber: '0x64', removed: false, topics: [TRANSFER_TOPIC, topic(from), topic(to)],
    data: '0x' + BigInt(amount).toString(16).padStart(64, '0') };
  return { chainId: '0x539', headBlockNumber: '0x66', canonicalBlock: { number: '0x64', hash: hash('b') },
    receipt: { transactionHash: hash('c'), status: '0x1', blockHash: hash('b'), blockNumber: '0x64', logs: [log] } };
}

test('prize transfer is encoded from the disclosed treasury to the frozen winner for the exact payable', () => {
  const prepared = preparePayoutTransfer(claim(), operator);
  assert.equal(prepared.paymentsEnabled, false);
  assert.deepEqual(prepared.transaction, {
    chainId: '0x539', from: address('3'), to: address('1'), value: '0x0',
    data: '0xa9059cbb' + '0000000000000000000000002222222222222222222222222222222222222222' +
      '0000000000000000000000000000000000000000000000000000000000000046'
  });
  assert.equal(prepared.recipient, address('2'));
  assert.equal(prepared.amountBaseUnits, '70');
});

test('only the treasury wallet can sign a prize transfer; the winner cannot', () => {
  const unsigned = preparePayoutTransfer(claim(), winner);
  assert.equal(unsigned.transaction, null);
  assert.equal(unsigned.signingEnabled, false);
  assert.match(unsigned.reason, /treasury|operator/i);
  const signed = preparePayoutTransfer(claim(), operator);
  assert.ok(signed.transaction);
  assert.equal(preparePayoutTransfer(claim({ state: 'open' }), operator).transaction, null);
  assert.equal(preparePayoutTransfer(claim({ state: 'paid' }), operator).transaction, null);
});

test('a unique treasury-to-winner transfer of the exact payable verifies', () => {
  const result = validatePayout({ claim: { ...claim(), transactionHash: hash('c'), logIndex: '0x0' }, evidence: evidence() });
  assert.equal(result.status, 'verified-rpc-evidence');
  assert.equal(result.amount, '70');
  assert.equal(result.owner, address('3'));
  assert.equal(result.destination, address('2'));
  assert.equal(result.credited, false);
});

test('the 0.1 AMZN historical deposit cannot be prepared as a fake win payout', () => {
  const operator = { authenticated: true, accountId: 'player_operator', walletOwnershipVerified: true,
    wallets: [{ address: TREASURY_BOX, chainType: 'ethereum' }] };
  assert.throws(() => preparePayoutTransfer({
    roundId: 'rh-paid-haiku-v1', amount: '100000000000000000', recipient: address('2'), treasury: TREASURY_BOX,
    state: 'won',
    asset: {
      chainId: '46630', tokenAddress: '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02', destination: TREASURY_BOX,
      decimals: 18, minimumConfirmations: 3, standardTransferVerified: true
    }
  }, operator), /historical|0\.1 AMZN|fake win/i);
});

test('deposit-direction, wrong amount, wrong winner or missing receipt cannot settle a claim', () => {
  assert.equal(findPayoutTransfer(claim({ submittedTransactionHash: hash('c') }), { receipt: null }).status, 'pending');
  assert.throws(() => validatePayout({ claim: { ...claim(), transactionHash: hash('c'), logIndex: '0x0' },
    evidence: evidence('70', address('2'), address('3')) }));
  assert.throws(() => validatePayout({ claim: { ...claim(), transactionHash: hash('c'), logIndex: '0x0' },
    evidence: evidence('71') }));
  assert.throws(() => validatePayout({ claim: { ...claim(), transactionHash: hash('c'), logIndex: '0x0' },
    evidence: evidence('70', address('3'), address('4')) }));
});
