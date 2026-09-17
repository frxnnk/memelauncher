import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeposit, TRANSFER_TOPIC } from '../server/economy/deposit.mjs';

const address = n => '0x' + n.repeat(40);
const hash = n => '0x' + n.repeat(64);
const topic = a => '0x' + '0'.repeat(24) + a.slice(2);
function fixture() {
  const log = { address: address('1'), logIndex: '0x0', transactionHash: hash('a'), blockHash: hash('b'), blockNumber: '0x64', removed: false,
    topics: [TRANSFER_TOPIC, topic(address('2')), topic(address('3'))], data: '0x' + (10n ** 25n).toString(16).padStart(64, '0') };
  return { asset: { chainId: '4663', tokenAddress: address('1'), destination: address('3'), standardTransferVerified: true, decimals: 18, minimumConfirmations: 3 },
    order: { id: 'deposit-1', owner: address('2'), transactionHash: hash('a'), logIndex: '0x0', minimumReceived: String(10n ** 25n) },
    evidence: { chainId: '0x1237', headBlockNumber: '0x66', canonicalBlock: { number: '0x64', hash: hash('b') },
      receipt: { transactionHash: hash('a'), status: '0x1', blockHash: hash('b'), blockNumber: '0x64', logs: [log] } } };
}
test('a configured exact transfer produces a stable deduplication key without crediting money', () => {
  const f = fixture(); const result = validateDeposit(f);
  assert.equal(result.amount, '10000000000000000000000000');
  assert.equal(result.confirmations, '3'); assert.equal(result.credited, false);
  assert.equal(result.depositKey, validateDeposit(structuredClone(f)).depositKey);
  assert.match(result.finality, /not-L1/);
});
test('missing receipts and insufficient confirmations remain pending', () => {
  const missing = fixture(); missing.evidence.receipt = null;
  assert.equal(validateDeposit(missing).status, 'pending');
  const early = fixture(); early.evidence.headBlockNumber = '0x65';
  assert.equal(validateDeposit(early).reason, 'confirmations');
});
test('wrong chain, reverted receipt, reorg and mismatched transaction are rejected', () => {
  for (const mutate of [f => { f.evidence.chainId = '0x1'; }, f => { f.evidence.receipt.status = '0x0'; },
    f => { f.evidence.canonicalBlock.hash = hash('c'); }, f => { f.evidence.receipt.transactionHash = hash('d'); },
    f => { f.evidence.headBlockNumber = '0x63'; }]) {
    const f = fixture(); mutate(f); assert.throws(() => validateDeposit(f));
  }
});
test('wrong token, sender, destination, removed log and duplicate log cannot credit an order', () => {
  for (const mutate of [l => { l.address = address('9'); }, l => { l.topics[1] = topic(address('9')); },
    l => { l.topics[2] = topic(address('9')); }, l => { l.removed = true; }, l => { l.data = '0x1'; }]) {
    const f = fixture(); mutate(f.evidence.receipt.logs[0]); assert.throws(() => validateDeposit(f));
  }
  const duplicate = fixture(); duplicate.evidence.receipt.logs.push(structuredClone(duplicate.evidence.receipt.logs[0]));
  assert.throws(() => validateDeposit(duplicate), /ambiguous/);
});
test('unverified token behavior, implicit decimals and underpayment are rejected', () => {
  for (const mutate of [f => { f.asset.standardTransferVerified = false; }, f => { delete f.asset.decimals; },
    f => { f.order.minimumReceived = String(10n ** 26n); }, f => { f.asset.minimumConfirmations = 0; },
    f => { f.evidence.receipt.logs[0].topics[1] = '0x' + 'f'.repeat(64); }]) {
    const f = fixture(); mutate(f); assert.throws(() => validateDeposit(f));
  }
});
