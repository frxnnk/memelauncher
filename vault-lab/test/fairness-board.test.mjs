import test from 'node:test';
import assert from 'node:assert/strict';
import { publicFairnessBoard, truncateAddress } from '../server/economy/fairness-board.mjs';
import { accountGameFixture, address, hash, input } from './fixtures/account-game.mjs';

test('truncateAddress shows only wallet ends, never a full player id', () => {
  assert.equal(truncateAddress(address('2')), '0x2222…2222');
  const player = 'player_' + 'a'.repeat(48);
  const shown = truncateAddress(player);
  assert.match(shown, /…/);
  assert.equal(shown.includes(player), false);
});

test('fairness board publishes credited deposits and settled attempts without unsigned orders', async t => {
  const f = await accountGameFixture();
  t.after(f.close);
  f.economy.ledger.deposits.create({
    key: 'unsigned-pending', owner: address('2'), minimumReceived: '1000'
  }, f.alice, { chainHead: '0x63' });
  f.deposit();
  await f.game.attempt(f.headers(), input());
  const board = publicFairnessBoard(f.economy);
  assert.equal(board.custody, 'operator-controlled');
  assert.equal(board.attestation, 'operator-recorded-rpc-not-independent-attestation');
  assert.equal(board.realFundsEnabled, false);
  assert.equal(board.demonstrated.depositToTreasury, true);
  assert.equal(board.demonstrated.paidAttempt, true);
  assert.equal(board.demonstrated.bountyAccrued, true);
  assert.equal(board.demonstrated.prizeSent, false);
  assert.equal(board.demonstrated.attestedExecutor, false);
  assert.equal(board.sourceUrl, 'https://github.com/frxnnk/memelauncher');
  assert.equal(board.rounds[0].kind, 'game');
  assert.equal(board.deposits.length, 1);
  assert.equal(board.deposits[0].transactionHash, hash('a'));
  assert.equal(board.deposits[0].from, '0x2222…2222');
  assert.equal(board.deposits[0].to, '0x3333…3333');
  assert.equal(board.deposits[0].amount, '1000');
  assert.equal(board.attempts.length, 1);
  assert.equal(board.attempts[0].state, 'locked');
  assert.equal(board.attempts[0].price, '100');
  assert.equal(board.attempts[0].prizeContribution, '70');
  assert.equal(board.attempts[0].operations, '20');
  assert.equal(board.rounds[0].bounty, '70');
  assert.match(board.attempts[0].player, /…/);
  assert.doesNotMatch(JSON.stringify(board), /rpcEvidence|PRIVATE|apiKey|unsigned-pending/);
});
