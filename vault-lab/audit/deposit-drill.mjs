import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createLedger } from '../server/economy/ledger.mjs';
import { createDepositReader, reconcileDepositFromRpc } from '../server/economy/deposit-rpc.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';

const address = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
const asset = { chainId: '1337', tokenAddress: address('1'), destination: address('3'), decimals: 18,
  minimumConfirmations: 3, standardTransferVerified: true };
const alice = { authenticated: true, accountId: 'player_drill_alice', walletOwnershipVerified: true,
  wallets: [{ address: address('2'), chainType: 'ethereum' }] };
const bob = { ...alice, accountId: 'player_drill_bob', wallets: [{ address: address('4'), chainType: 'ethereum' }] };

export async function depositDrill() {
  const root = resolve(tmpdir()), directory = await mkdtemp(join(root, 'vault-deposit-drill-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  const path = join(directory, 'source.sqlite'), restored = join(directory, 'restored.sqlite');
  let ledger, head = '0x63', reorganized = false, sequence = 0;
  const calls = [], receipts = new Map(), checkpoints = [];
  const reader = createDepositReader({ rpcUrl: 'https://deposit-drill.invalid/rpc', expectedChainId: asset.chainId,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://deposit-drill.invalid/rpc'); assert.equal(init.redirect, 'error');
      const request = JSON.parse(init.body); calls.push(request.method);
      const response = { eth_chainId: '0x539', eth_blockNumber: head,
        eth_getTransactionReceipt: receipts.get(request.params[0]) ?? null,
        eth_getBlockByNumber: { number: '0x64', hash: hash(reorganized ? 'd' : 'b') } };
      assert.ok(Object.hasOwn(response, request.method), 'The drill must never call a write/signing RPC method.');
      return Response.json({ jsonrpc: '2.0', id: request.id, result: response[request.method] });
    } });
  const execute = request => ledger.execute('drill-' + ++sequence, request);
  const checkpoint = stage => {
    const state = ledger.snapshot(), amount = account => state.balances.find(row => row.account === account)?.amount ?? '0';
    checkpoints.push({ stage, custody: state.audit.custody, aliceAvailable: amount('player:player_drill_alice:available'),
      bobAvailable: amount('player:player_drill_bob:available'), bounty: amount('round:r1:prize'),
      winnerPayable: amount('round:r1:payable'), operations: amount('treasury:operations'), nextRound: amount('treasury:next'),
      depositHolds: state.depositHolds.length, balanced: state.audit.balanced });
  };
  const reconcile = (orderId, principal) => reconcileDepositFromRpc({ orders: ledger.deposits, reader, orderId, principal });
  async function deposit(principal, amount, transaction) {
    head = '0x63';
    const owner = principal.wallets[0].address;
    const order = ledger.deposits.create({ key: 'order-' + transaction, owner, minimumReceived: amount }, principal, await reader.head());
    const transfer = { transactionHash: hash(transaction), logIndex: '0x0' };
    ledger.deposits.attach(order.id, principal, transfer);
    const receipt = { ...transfer, status: '0x1', blockNumber: '0x64', blockHash: hash('b'), logs: [{ ...transfer,
      address: asset.tokenAddress, blockNumber: '0x64', blockHash: hash('b'), removed: false,
      topics: [TRANSFER_TOPIC, '0x' + '0'.repeat(24) + owner.slice(2), '0x' + '0'.repeat(24) + asset.destination.slice(2)],
      data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }] };
    receipts.set(transfer.transactionHash, receipt); head = '0x65';
    assert.equal((await reconcile(order.id, principal)).credited, false);
    head = '0x66'; assert.equal((await reconcile(order.id, principal)).credited, true);
    assert.equal((await reconcile(order.id, principal)).firstEvidence, false);
    return order;
  }
  function attempt(attemptId, outcome) {
    execute({ type: 'reserve', roundId: 'r1', player: alice.accountId, attemptId, recipient: alice.wallets[0].address });
    execute({ type: 'start', attemptId });
    return execute({ type: 'settle', attemptId, outcome, receiptRef: 'synthetic-model-' + attemptId });
  }
  try {
    ledger = createLedger({ path, asset });
    execute({ type: 'open-round', roundId: 'r1', price: '100', prizeBps: 7000, operationsBps: 2000, configuration: 'deposit-drill-fixture' });
    const order = await deposit(alice, '1000', 'a'); await deposit(bob, '200', 'c'); checkpoint('deposits-confirmed');
    assert.equal(checkpoints.at(-1).bounty, '0');
    const before = calls.length;
    await assert.rejects(reconcile(order.id, bob), /not found/); assert.equal(calls.length, before);
    assert.equal(attempt('locked', 'locked').prizeContribution, '70'); checkpoint('guard-keeps-locked');
    assert.equal(attempt('technical-error', 'error').creditsReturned, '100'); checkpoint('technical-error-refunded');
    reorganized = true; await assert.rejects(reconcile(order.id, alice), /canonical/); checkpoint('reorg-hold');
    const original = ledger.exportAll(); ledger.close(); ledger = null;
    // No live/user database is copied. Close the writer so SQLite checkpoints its WAL.
    await copyFile(path, restored);
    const originalBytes = await readFile(path), restoredBytes = await readFile(restored); assert.deepEqual(originalBytes, restoredBytes);
    const check = new DatabaseSync(restored, { readOnly: true });
    try {
      assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.equal(check.prepare('PRAGMA foreign_key_check').all().length, 0);
    } finally { check.close(); }
    ledger = createLedger({ path: restored, asset }); assert.deepEqual(ledger.exportAll(), original);
    assert.throws(() => execute({ type: 'reserve', roundId: 'r1', player: alice.accountId, attemptId: 'during-hold', recipient: alice.wallets[0].address }), /reconciliation/);
    reorganized = false; assert.equal((await reconcile(order.id, alice)).firstEvidence, false); checkpoint('original-evidence-restored');
    assert.equal(attempt('winner', 'released').winnerPayable, '140'); checkpoint('winner-recorded-not-paid');
    assert.throws(() => execute({ type: 'payout', roundId: 'r1' }), /disabled/);
    const result = ledger.exportAll();
    assert.equal(result.events.filter(event => event.request.type === 'verified-deposit').length, 2);
    assert.deepEqual(checkpoints.at(-1), { stage: 'winner-recorded-not-paid', custody: '1200', aliceAvailable: '800',
      bobAvailable: '200', bounty: '0', winnerPayable: '140', operations: '40', nextRound: '20', depositHolds: 0, balanced: true });
    return { createdAt: new Date().toISOString(), status: 'passed', mode: 'isolated-synthetic-rpc-evidence',
      externalNetworkCalls: 0, modelCalls: 0, walletSignatures: 0, realFunds: false,
      fixtureRpcCalls: calls.length, rpcMethods: [...new Set(calls)].sort(), checkpoints, ledger: result,
      recovery: { databaseIntegrity: 'ok', stoppedWriterCopySha256: createHash('sha256').update(restoredBytes).digest('hex'),
        evidenceAndBalancesRestored: true, reorgHoldSurvived: true, duplicateCredits: false, foreignOwnerQueriedRpc: false },
      limits: 'Local accounting evidence only. Synthetic chain and model outcomes; no live Privy, asset, indexer, payout, price adoption or independent operator proof.' };
  } finally {
    ledger?.close();
    if (!resolve(directory).startsWith(root + sep) || !directory.includes('vault-deposit-drill-')) throw new Error('Unsafe drill cleanup path.');
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('This isolated drill accepts no paths, keys, endpoints or live data.');
  try {
    const report = await depositDrill(), output = fileURLToPath(new URL('../output/', import.meta.url));
    await mkdir(output, { recursive: true }); await writeFile(join(output, 'deposit-drill.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, ledger: { eventCount: report.ledger.eventCount, audit: report.ledger.audit } }, null, 2));
  } catch (error) { console.error('Deposit drill failed: ' + error.message); process.exitCode = 1; }
}
