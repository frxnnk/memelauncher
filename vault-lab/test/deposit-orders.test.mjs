import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import {
  createDepositOrders,
  unsignedDepositLifetimeMs,
  DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS,
  TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS
} from '../server/economy/deposit-orders.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';

const address = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
const owner = address('2');
const principal = { authenticated:true, accountId:'player_fixture', walletOwnershipVerified:true, wallets:[{ address:owner, chainType:'ethereum' }] };
const asset = { chainId:'1337', tokenAddress:address('1'), destination:address('3'), decimals:18, minimumConfirmations:3, standardTransferVerified:true };
const intent = key => ({ key, owner, minimumReceived:'1000' });
const transfer = { transactionHash:hash('a'), logIndex:'0x0' };
const evidence = () => {
  const log = { ...transfer, address:asset.tokenAddress, blockHash:hash('b'), blockNumber:'0x64', removed:false,
    topics:[TRANSFER_TOPIC, '0x' + '0'.repeat(24) + owner.slice(2), '0x' + '0'.repeat(24) + asset.destination.slice(2)],
    data:'0x' + (1000n).toString(16).padStart(64,'0') };
  return { chainId:'0x539', headBlockNumber:'0x66', canonicalBlock:{ hash:hash('b'), number:'0x64' },
    receipt:{ ...transfer, status:'0x1', blockHash:hash('b'), blockNumber:'0x64', logs:[log] } };
};

test('deposit intent belongs to a verified account/wallet and freezes its amount and asset', t => {
  const orders = createDepositOrders({ asset }); t.after(orders.close);
  assert.throws(() => orders.create(intent('x'), { ...principal, authenticated:false }, { chainHead:'0x63' }));
  assert.throws(() => orders.create({ ...intent('x'), owner:address('9') }, principal, { chainHead:'0x63' }));
  const order = orders.create(intent('x'), principal, { chainHead:'0x63' });
  assert.deepEqual(orders.create(intent('x'), principal, { chainHead:'0x65' }), order);
  assert.throws(() => orders.create({ ...intent('x'), minimumReceived:'1' }, principal, { chainHead:'0x63' }));
  assert.throws(() => orders.get(order.id, { ...principal, accountId:'player_other' }), /not found/);
  assert.equal(order.credited, false); assert.equal(order.earliestBlock, '100');
});

test('one transfer cannot be replaced, replayed into another order or counted twice', t => {
  const orders = createDepositOrders({ asset }); t.after(orders.close);
  const order = orders.create(intent('one'), principal, { chainHead:'0x63' });
  orders.attach(order.id, principal, transfer);
  assert.throws(() => orders.attach(order.id, principal, { ...transfer, transactionHash:hash('c') }), /replaced/);
  assert.equal(orders.reconcile(order.id, principal, evidence()).firstEvidence, true);
  assert.equal(orders.reconcile(order.id, principal, evidence()).firstEvidence, false);
  const second = orders.create(intent('two'), principal, { chainHead:'0x63' }); orders.attach(second.id, principal, transfer);
  assert.throws(() => orders.reconcile(second.id, principal, evidence()), /already claimed/);
  assert.equal(orders.get(order.id, principal).credited, false);
});

test('unsigned top-up lifetime is 15 minutes except testnet paid-beta, which lasts two hours', t => {
  assert.equal(DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS, 15 * 60000);
  assert.equal(TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS, 2 * 60 * 60000);
  assert.equal(unsignedDepositLifetimeMs(), DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS);
  assert.equal(unsignedDepositLifetimeMs({ environment: 'testnet' }), DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS);
  assert.equal(unsignedDepositLifetimeMs({ policy: 'paid-beta' }), DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS);
  assert.equal(unsignedDepositLifetimeMs({ policy: 'paid-beta', environment: 'mainnet' }), DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS);
  assert.equal(unsignedDepositLifetimeMs({ policy: 'paid-beta', environment: 'testnet' }), TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS);
  let now = 1000;
  const orders = createDepositOrders({ asset, now: () => now }); t.after(orders.close);
  const order = orders.create(intent('default'), principal, { chainHead: '0x63' });
  assert.equal(order.expiresAt, order.createdAt + DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS);
  const paid = createDepositOrders({
    asset, now: () => now, unsignedLifetimeMs: unsignedDepositLifetimeMs({ policy: 'paid-beta', environment: 'testnet' })
  });
  t.after(paid.close);
  const longLived = paid.create(intent('paid-beta'), principal, { chainHead: '0x63' });
  const tooLate = paid.create(intent('too-late'), principal, { chainHead: '0x63' });
  assert.equal(longLived.expiresAt, longLived.createdAt + TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS);
  now = order.createdAt + DEFAULT_UNSIGNED_DEPOSIT_LIFETIME_MS + 1;
  assert.throws(() => orders.attach(order.id, principal, transfer), /expired/);
  paid.attach(longLived.id, principal, transfer);
  now = tooLate.createdAt + TESTNET_PAID_BETA_UNSIGNED_DEPOSIT_LIFETIME_MS + 1;
  assert.throws(() => paid.attach(tooLate.id, principal, transfer), /expired/);
  assert.throws(() => createDepositOrders({ asset, unsignedLifetimeMs: 16 * 60000 }), /lifetime/);
});

test('missing confirmations stay pending; old transfers, expired intents and reorgs issue no credits', t => {
  let now = 1000; const orders = createDepositOrders({ asset, now:() => now }); t.after(orders.close);
  const order = orders.create(intent('one'), principal, { chainHead:'0x63' }); orders.attach(order.id, principal, transfer);
  const early = evidence(); early.headBlockNumber = '0x65';
  assert.equal(orders.reconcile(order.id, principal, early).status, 'pending');
  const reorg = evidence(); reorg.canonicalBlock.hash = hash('c');
  assert.throws(() => orders.reconcile(order.id, principal, reorg), /canonical/);
  const old = orders.create(intent('old'), principal, { chainHead:'0x64' }); orders.attach(old.id, principal, transfer);
  assert.throws(() => orders.reconcile(old.id, principal, evidence()), /predates/);
  const expired = orders.create(intent('expired'), principal, { chainHead:'0x63' }); now += 16 * 60000;
  assert.throws(() => orders.attach(expired.id, principal, transfer), /expired/);
});

test('order ownership, configuration binding and evidence deduplication survive restart', async t => {
  const root = resolve(tmpdir()), dir = await mkdtemp(join(root, 'vault-deposit-orders-')); assert.ok(resolve(dir).startsWith(root + sep));
  const path = join(dir, 'orders.sqlite'); let orders = createDepositOrders({ path, asset });
  t.after(async () => { orders.close(); await rm(dir, { recursive:true, force:true }); });
  const order = orders.create(intent('one'), principal, { chainHead:'0x63' }); orders.attach(order.id, principal, transfer);
  orders.reconcile(order.id, principal, evidence()); orders.close(); orders = createDepositOrders({ path, asset });
  assert.equal(orders.reconcile(order.id, principal, evidence()).firstEvidence, false);
  orders.close(); orders = createDepositOrders({ path, asset:{ ...asset, tokenAddress:address('4') } });
  assert.throws(() => orders.get(order.id, principal), /another frozen asset/);
});
