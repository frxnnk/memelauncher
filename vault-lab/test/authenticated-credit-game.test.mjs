import test from 'node:test';
import assert from 'node:assert/strict';
import { accountGameFixture, input, completion, address, asset, terms } from './fixtures/account-game.mjs';
import { createAssetEconomy } from '../server/economy/asset-service.mjs';
import { createCreditGame } from '../server/economy/model-game.mjs';
import { DEFAULT_GUARDIANS } from '../server/rounds.mjs';

test('verified users share a bounty, not balances, idempotency keys, sessions or private results', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit(); f.deposit(f.bob, '1000', 'c');
  const a = await f.game.attempt(f.headers(), input('shared'));
  await assert.rejects(f.game.result(f.headers('bob'), 'shared'), e => e.code === 'MODEL_JOB_NOT_FOUND');
  const b = await f.game.attempt(f.headers('bob'), { ...input('shared', address('4')), modelId: DEFAULT_GUARDIANS[1] });
  assert.notEqual(a.receipt.id, b.receipt.id); assert.equal(a.accounting.prizeContribution, '70');
  assert.equal(a.receipt.round.manifestHash, b.receipt.round.manifestHash);
  assert.equal((await f.game.attempt(f.headers(), input('shared'))).replayed, true); assert.equal(f.calls.length, 2);
  assert.equal((await f.game.account(f.headers())).available, '900');
  const account = await f.game.account(f.headers('bob')); assert.equal(account.available, '900');
  assert.ok(!JSON.stringify(account).includes(f.alice.accountId)); assert.ok(!JSON.stringify(account).includes(address('2')));
  await assert.rejects(f.game.attempt(f.headers('bob'), { ...input('foreign-session', address('4')), sessionId: a.sessionId }), e => e.code === 'SESSION_NOT_FOUND');
  assert.equal(f.calls.length, 2); assert.equal((await f.game.account(f.headers('bob'))).available, '900');
  assert.equal(f.economy.state().balances.find(row => row.account === 'round:r1:prize').amount, '140');
});

test('authentication, wallet ownership, roster and balance checks precede any provider call', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit();
  await assert.rejects(f.game.attempt({}, input()), e => e.code === 'AUTH_REQUIRED');
  await assert.rejects(f.game.attempt(f.headers(), { ...input(), payoutWallet: address('9') }), e => e.code === 'WALLET_NOT_VERIFIED');
  await assert.rejects(f.game.attempt(f.headers(), { ...input(), player: f.bob.accountId }), e => e.code === 'INVALID_CREDIT_ATTEMPT');
  await assert.rejects(f.game.attempt(f.headers(), { ...input(), modelId: 'openrouter/auto' }), e => e.code === 'ROUND_MODEL_NOT_ALLOWED');
  await assert.rejects(f.game.attempt(f.headers('bob'), input('empty', address('4'))), e => e.code === 'CREDIT_RESERVATION_REJECTED');
  assert.equal(f.calls.length, 0); assert.equal((await f.game.account(f.headers())).available, '1000');
  assert.equal(f.economy.state().attempts.length, 0);
});

test('a model cannot choose a recipient; a valid win retains the wallet fixed at admission after wallet changes', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit();
  f.controls.transport = body => completion(body.model, 'release_prize', { recipient: address('9') });
  await assert.rejects(f.game.attempt(f.headers(), input('bad-tool')), e => e.code === 'INVALID_MODEL_RESPONSE' && e.accounting.creditsReturned === '100');
  f.controls.transport = body => completion(body.model, 'release_prize');
  const won = await f.game.attempt(f.headers(), input('winner'));
  assert.equal(won.accounting.winnerPayable, '70'); assert.equal(won.accounting.winnerRecipient, address('2'));
  assert.equal(won.accounting.chainTransaction, null); assert.equal(won.accounting.realFunds, false);
  const changedHeaders = f.headers('alice', [address('9')]);
  assert.equal((await f.game.result(changedHeaders, 'winner')).accounting.winnerRecipient, address('2'));
  assert.equal((await f.game.account(changedHeaders)).prizes[0].recipient, address('2'));
  await assert.rejects(f.game.attempt(changedHeaders, input('winner', address('9'))), e => e.code === 'MODEL_JOB_CONFLICT');
  assert.equal(f.calls.length, 2);
  assert.throws(() => f.economy.ledger.execute('pay', { type: 'payout', roundId: 'r1' }), /disabled/);
});

test('wrong prompt, configuration, session or reconstructed decision becomes a refundable technical error', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit(); let sequence = 0;
  for (const mutate of [
    value => { value.receipt.inputMessages[0].content = 'different system'; },
    value => { value.receipt.configuration.generation.temperature = 0; },
    value => { value.receipt.sessionScope.roundId = 'different-round'; },
    value => { value.receipt.inputMessages.at(-1).content = 'another prompt'; },
    value => { value.decision = value.receipt.decision = 'released'; },
    value => { value.receipt.tools = []; }
  ]) {
    f.controls.mapReply = value => { mutate(value); return value; };
    const request = input('mismatch-' + ++sequence);
    await assert.rejects(f.game.attempt(f.headers(), request), e => e.code === 'ROUND_RECEIPT_MISMATCH' && e.accounting.creditsReturned === '100');
    await assert.rejects(f.game.attempt(f.headers(), request), e => e.code === 'ROUND_RECEIPT_MISMATCH');
  }
  assert.equal(f.calls.length, 6); assert.equal((await f.game.account(f.headers())).available, '1000');
  assert.equal(f.economy.state().rounds[0].state, 'open');
});

test('persisted inference can settle after a full service restart without another provider call', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit();
  const execute = f.economy.ledger.execute;
  f.economy.ledger.execute = (key, request) => {
    if (request.type === 'settle') throw new Error('Fixture settlement interrupted'); return execute(key, request);
  };
  await assert.rejects(f.game.attempt(f.headers(), input()), /settlement interrupted/);
  assert.equal((await f.game.result(f.headers(), 'message')).status, 'inferred');
  assert.equal((await f.game.account(f.headers())).reserved, '100');
  const scope = f.economy.sessionRound('r1'); f.restart(); assert.equal(f.economy.sessionRound('r1'), scope);
  await assert.rejects(f.game.reconcile(f.headers('bob'), 'message'), e => e.code === 'MODEL_JOB_NOT_FOUND');
  const recovered = await f.game.reconcile(f.headers(), 'message');
  assert.equal(recovered.accounting.prizeContribution, '70'); assert.equal(f.calls.length, 1);
  assert.equal((await f.game.account(f.headers())).available, '900');
  assert.equal((await f.game.reconcile(f.headers(), 'message')).replayed, true);
});

test('a deposit hold appearing during inference retains the response for reconciliation without resampling', async t => {
  const f = await accountGameFixture(); t.after(f.close); const deposit = f.deposit();
  let finish, entered; const inProvider = new Promise(resolve => { entered = resolve; });
  f.controls.transport = body => { entered(); return new Promise(resolve => { finish = () => resolve(completion(body.model)); }); };
  const pending = f.game.attempt(f.headers(), input()); await inProvider;
  f.economy.ledger.deposits.reconcile(deposit.order.id, f.alice, { chainId: '0x539', receipt: null });
  finish(); await assert.rejects(pending, /reconciliation/);
  assert.equal((await f.game.result(f.headers(), 'message')).status, 'inferred');
  assert.equal((await f.game.account(f.headers())).reserved, '100');
  deposit.reconcile();
  assert.equal((await f.game.reconcile(f.headers(), 'message')).accounting.prizeContribution, '70');
  assert.equal(f.calls.length, 1);
});

test('the persistent usage limit refunds an unserved attempt and never turns it into a loss', async t => {
  const f = await accountGameFixture({ limits: { perUserPerDay: 1 } }); t.after(f.close); f.deposit();
  await f.game.attempt(f.headers(), input('first'));
  await assert.rejects(f.game.attempt(f.headers(), input('limited')), e => e.code === 'DAILY_LIMIT_REACHED' && e.accounting.creditsReturned === '100');
  assert.equal((await f.game.account(f.headers())).available, '900'); assert.equal(f.calls.length, 1);
  assert.equal((await f.game.usage(f.headers())).requestsToday, 1);
});

test('job stores bind to the ledger instance and round terms cannot drift silently', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit();
  await f.game.attempt(f.headers(), input());
  const other = createAssetEconomy({ asset, terms }); t.after(other.close); other.openRound('r1');
  assert.notEqual(other.sessionRound('r1'), f.economy.sessionRound('r1'));
  assert.throws(() => createCreditGame({ path: f.jobsPath, economy: other, vault: f.vault }), /another ledger/);
  assert.throws(() => f.economy.openRound('r1', DEFAULT_GUARDIANS.slice(0, 2)), e => e.code === 'ROUND_IMMUTABLE');
  const manifest = f.economy.manifest('r1');
  assert.equal(manifest.manifest.configuration.unit.mode, 'rpc-credit-preparation');
  assert.equal(manifest.manifest.configuration.assetHash, f.economy.state().assetHash);
  assert.equal(manifest.manifest.configuration.price, '100');
});

test('a usage-write failure preserves the completed response until its exact owner and receipt cost are reconciled', async t => {
  const f = await accountGameFixture(); t.after(f.close); f.deposit();
  f.limits.settle = () => { throw new Error('Fixture usage write failed'); };
  await assert.rejects(f.game.attempt(f.headers(), input()), e => e.code === 'USAGE_UNRECONCILED');
  assert.equal((await f.game.result(f.headers(), 'message')).status, 'inferred');
  const stored = f.vault.receiptHistory(f.alice.accountId).records[0];
  const receipt = f.vault.receipt(f.alice.accountId, stored.id).record;
  assert.throws(() => f.limits.assertReceiptSettled(receipt, f.alice.accountId), e => e.code === 'USAGE_UNRECONCILED');
  await assert.rejects(f.game.reconcile(f.headers(), 'message'), e => e.code === 'USAGE_UNRECONCILED');
  f.restart(); f.limits.reconcile(receipt);
  assert.throws(() => f.limits.assertReceiptSettled(receipt, f.bob.accountId), e => e.code === 'USAGE_UNRECONCILED');
  assert.throws(() => f.limits.assertReceiptSettled({ ...receipt, usage: { cost: 99 } }, f.alice.accountId), e => e.code === 'USAGE_UNRECONCILED');
  const result = await f.game.reconcile(f.headers(), 'message');
  assert.equal(result.accounting.prizeContribution, '70'); assert.equal(f.calls.length, 1);
  assert.equal((await f.game.account(f.headers())).reserved, '0');
});
