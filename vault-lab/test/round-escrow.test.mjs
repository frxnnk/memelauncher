import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoundEscrow, USDG_MAINNET, USDG_FIXTURE_UNITS } from '../server/economy/round-escrow.mjs';
import { splitWinPrize } from '../server/economy/paid-beta-policy.mjs';

const address = n => '0x' + n.repeat(40);

test('escrow freezes the winner wallet before the call and pays only that hashed result', () => {
  const escrow = createRoundEscrow({
    asset: USDG_MAINNET, roundId: 'usdg-drill', manifestHash: 'a'.repeat(64), seedAmount: '1000000'
  });
  escrow.freezeAttempt({ attemptId: 'a1', recipient: address('2'), maxPrice: '5000000', inputHash: 'b'.repeat(64) });
  assert.throws(() => escrow.freezeAttempt({
    attemptId: 'a1', recipient: address('9'), maxPrice: '5000000', inputHash: 'b'.repeat(64)
  }), /frozen|recipient/);
  escrow.resolve({ attemptId: 'a1', resultHash: 'c'.repeat(64), decision: 'released' });
  assert.throws(() => escrow.resolve({ attemptId: 'a1', resultHash: 'd'.repeat(64), decision: 'locked' }), /already/);
  const claim = escrow.claim({ attemptId: 'a1' });
  assert.equal(claim.recipient, address('2'));
  assert.equal(claim.amount, splitWinPrize('1000000').payable);
  assert.equal(claim.continuity, '250000');
  assert.throws(() => escrow.yank({ to: address('3'), amount: '1' }), /cannot/);
  assert.throws(() => escrow.claim({ attemptId: 'a1', recipient: address('9') }), /recipient|paid/);
});

test('the 1 USDG drill is a fixture settlement of one unit, never a live mainnet send', () => {
  const drill = createRoundEscrow({
    asset: USDG_MAINNET, roundId: 'usdg-1', manifestHash: 'e'.repeat(64), seedAmount: USDG_FIXTURE_UNITS, mode: 'fixture-drill'
  });
  drill.freezeAttempt({ attemptId: 'd1', recipient: address('2'), maxPrice: '1000000', inputHash: 'f'.repeat(64) });
  drill.resolve({ attemptId: 'd1', resultHash: 'c'.repeat(64), decision: 'released' });
  const paid = drill.executeFixtureClaim({ attemptId: 'd1', transactionHash: '0x' + '1'.repeat(64) });
  assert.equal(paid.amount, '750000');
  assert.equal(paid.continuity, '250000');
  assert.equal(paid.asset, USDG_MAINNET.tokenAddress);
  assert.equal(paid.chainId, '4663');
  assert.equal(paid.broadcast, false);
  assert.equal(paid.realFundsEnabled, false);
  assert.equal(paid.transfer.paymentsEnabled, false);
  assert.equal(paid.transfer.transaction.value, '0x0');
  assert.equal(paid.transfer.transaction.to.toLowerCase(), USDG_MAINNET.tokenAddress.toLowerCase());
  assert.equal(paid.transfer.transaction.chainId, '0x1237');
  assert.equal(BigInt('0x' + paid.transfer.transaction.data.slice(-64)).toString(), '750000');
  assert.throws(() => drill.broadcastMainnet(), /mainnet|disabled|refused/i);
  assert.throws(() => drill.broadcastMainnet({ amount: '1000000' }), /mainnet|disabled|refused/i);
});

test('the USDG fixture drill refuses a $500 seed', () => {
  assert.throws(() => createRoundEscrow({
    asset: USDG_MAINNET, roundId: 'usdg-500', manifestHash: 'e'.repeat(64),
    seedAmount: '500000000', mode: 'fixture-drill'
  }), /1 unit|500|seed/i);
});

test('usdg-claim-drill evidence is a 1-unit unsigned fixture and refuses mainnet $500', async () => {
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { join } = await import('node:path');
  const { readFileSync } = await import('node:fs');
  const { TREASURY_BOX, PRODUCT_X402_BOX } = await import('../server/x402-operating-box-policy.mjs');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const child = spawn(process.execPath, [join(root, 'audit/usdg-claim-drill.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = await new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `drill exit ${code}`)));
  });
  const printed = JSON.parse(out);
  assert.equal(printed.ok, true);
  assert.equal(printed.broadcast, false);
  assert.equal(printed.payable, '750000');
  const report = JSON.parse(readFileSync(join(root, 'output/usdg-claim-drill.json'), 'utf8'));
  assert.equal(report.seedAmount, '1000000');
  assert.equal(report.payable, '750000');
  assert.equal(report.continuity, '250000');
  assert.equal(report.broadcast, false);
  assert.equal(report.realFundsEnabled, false);
  assert.equal(report.chainId, '4663');
  assert.equal(report.unsignedTransfer.from, TREASURY_BOX);
  assert.notEqual(report.unsignedTransfer.from, PRODUCT_X402_BOX);
  assert.equal(BigInt('0x' + report.unsignedTransfer.data.slice(-64)).toString(), '750000');
  assert.match(report.mainnetBroadcastRefused, /disabled|refused/i);
  assert.doesNotMatch(JSON.stringify(report), /500000000/);
  assert.match(report.note, /does not seed \$500/i);
});
