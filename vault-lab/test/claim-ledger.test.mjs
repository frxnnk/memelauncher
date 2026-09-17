import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger } from '../server/economy/ledger.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';

const address = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
const asset = { chainId: '1337', tokenAddress: address('1'), destination: address('3'), decimals: 18,
  minimumConfirmations: 3, standardTransferVerified: true };
const identity = (name = 'alice', wallet = '2') => ({ authenticated: true, accountId: 'player_' + name,
  walletOwnershipVerified: true, wallets: [{ address: address(wallet), chainType: 'ethereum' }] });
const opening = { type: 'open-round', roundId: 'r1', price: '100', prizeBps: 7000, operationsBps: 2000, configuration: 'fixture-rules' };
const balance = (ledger, account) => ledger.snapshot().balances.find(row => row.account === account)?.amount ?? '0';

function credit(ledger, key = 'one', principal = identity(), amount = '1000', tx = 'a') {
  const owner = principal.wallets[0].address;
  const order = ledger.deposits.create({ key, owner, minimumReceived: amount }, principal, { chainHead: '0x63' });
  const transfer = { transactionHash: hash(tx), logIndex: '0x0' };
  ledger.deposits.attach(order.id, principal, transfer);
  const evidence = { chainId: '0x539', headBlockNumber: '0x66', canonicalBlock: { hash: hash('b'), number: '0x64' },
    receipt: { ...transfer, status: '0x1', blockHash: hash('b'), blockNumber: '0x64', logs: [{ ...transfer, address: asset.tokenAddress,
      blockHash: hash('b'), blockNumber: '0x64', removed: false,
      topics: [TRANSFER_TOPIC, '0x' + '0'.repeat(24) + owner.slice(2), '0x' + '0'.repeat(24) + asset.destination.slice(2)],
      data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }] } };
  return ledger.deposits.reconcile(order.id, principal, evidence);
}

function win(ledger) {
  credit(ledger);
  let seq = 0;
  const exec = request => ledger.execute('claim-' + ++seq, request);
  exec(opening);
  exec({ type: 'reserve', player: 'player_alice', roundId: 'r1', attemptId: 'a1', recipient: address('2') });
  exec({ type: 'start', attemptId: 'a1' });
  const settled = exec({ type: 'settle', attemptId: 'a1', outcome: 'released', receiptRef: 'win' });
  return { ledger, exec, settled };
}

test('an asset win records a payable and still rejects simulated minting payouts', t => {
  const ledger = createLedger({ asset }); t.after(ledger.close);
  const { settled } = win(ledger);
  assert.equal(settled.winnerPayable, '70');
  assert.equal(settled.winnerRecipient, address('2'));
  assert.equal(balance(ledger, 'round:r1:payable'), '70');
  assert.equal(ledger.snapshot().rounds[0].state, 'won');
  assert.throws(() => ledger.execute('pay', { type: 'payout', roundId: 'r1' }), /disabled/);
});

test('a verified treasury transfer of the exact payable marks the round paid once', t => {
  const ledger = createLedger({ asset }); t.after(ledger.close);
  const { exec } = win(ledger);
  const paid = exec({
    type: 'record-payout', roundId: 'r1', amount: '70', recipient: address('2'),
    transactionHash: hash('c'), logIndex: '0x0'
  });
  assert.equal(paid.paid, '70');
  assert.equal(paid.player, 'player_alice');
  assert.equal(paid.source, 'verified-rpc-standard-transfer');
  assert.equal(paid.transactionHash, hash('c'));
  assert.equal(balance(ledger, 'round:r1:payable'), '0');
  assert.equal(ledger.snapshot().rounds[0].state, 'paid');
  const replay = ledger.execute('claim-5', {
    type: 'record-payout', roundId: 'r1', amount: '70', recipient: address('2'),
    transactionHash: hash('c'), logIndex: '0x0'
  });
  assert.equal(replay.replayed, true);
  assert.equal(balance(ledger, 'custody'), '930');
  assert.throws(() => ledger.execute('claim-other', {
    type: 'record-payout', roundId: 'r1', amount: '70', recipient: address('2'),
    transactionHash: hash('d'), logIndex: '0x0'
  }), /unpaid|paid/);
});

test('record-payout cannot change the frozen winner, amount or pay an open round', t => {
  const ledger = createLedger({ asset }); t.after(ledger.close);
  const { exec } = win(ledger);
  assert.throws(() => exec({
    type: 'record-payout', roundId: 'r1', amount: '71', recipient: address('2'),
    transactionHash: hash('c'), logIndex: '0x0'
  }), /payable|amount/);
  assert.throws(() => exec({
    type: 'record-payout', roundId: 'r1', amount: '70', recipient: address('4'),
    transactionHash: hash('c'), logIndex: '0x0'
  }), /recipient/);
  const other = createLedger({ asset }); t.after(other.close);
  credit(other, 'seed');
  other.execute('open', opening);
  assert.throws(() => other.execute('early', {
    type: 'record-payout', roundId: 'r1', amount: '70', recipient: address('2'),
    transactionHash: hash('c'), logIndex: '0x0'
  }), /unpaid|won/);
});
