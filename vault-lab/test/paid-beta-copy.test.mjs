import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paidBetaLandingCopy, paidBetaAccountCopy } from '../public/paid-beta-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('landing copy names paid beta when x402 and funding are live', () => {
  const copy = paidBetaLandingCopy(
    { paidConfigured: true, bountyEnabled: true, closedBeta: true },
    {
      enabled: true,
      asset: { decimals: 18, destination: '0xbec4fdb33ed39844956d9078fd232aca92d7396d' },
      rounds: [{ id: 'rh-paid-opus-v1', state: 'open', price: '5000000000000000000' }]
    }
  );
  assert.equal(copy.edition, 'Closed paid beta');
  assert.match(copy.playNote, /5 AMZN per paid attempt/i);
  assert.match(copy.playNote, /Ledger and source are public/i);
  assert.doesNotMatch(copy.playNote, /No deposit/i);
  assert.match(copy.footer, /testnet AMZN/i);
  assert.equal(copy.navPlay, 'Enter the beta ');
});

test('landing keeps practice copy when funding is off', () => {
  const copy = paidBetaLandingCopy({ paidConfigured: false, closedBeta: true, bountyEnabled: false }, { enabled: false });
  assert.equal(copy.playNote, 'By invitation. No deposit. No cash prize.');
  const practice = paidBetaLandingCopy({});
  assert.match(practice.playNote, /Practice edition/);
});

test('account copy tells invited players to Top up AMZN when web funding is on', () => {
  const copy = paidBetaAccountCopy({ webFundingEnabled: true, closedBeta: true });
  assert.match(copy.treasuryIntro, /Top up/i);
  assert.match(copy.treasuryIntro, /payout proving/i);
  assert.doesNotMatch(copy.treasuryIntro, /Deposits and payouts are disabled/i);
  assert.match(copy.treasuryLabel, /operator custody/i);
  assert.equal(paidBetaAccountCopy({ webFundingEnabled: false }), null);
});

test('play treasury does not keep rehearsal 70/20/10 copy over paid-beta account copy', () => {
  const funding = readFileSync(join(root, 'public/funding.js'), 'utf8');
  assert.match(funding, /paidBetaAccountCopy/);
  assert.doesNotMatch(funding, /Testnet funding rehearsal/);
  assert.doesNotMatch(funding, /Practice for free or test the wallet-to-credit flow/);
  assert.match(funding, /openRound \? amount\(openRound\.price\)/);
  assert.doesNotMatch(funding, /placeholder = '1\.00'/);
  const page = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.match(page, /data-local-sandbox/);
  const access = readFileSync(join(root, 'public/access.js'), 'utf8');
  assert.match(access, /data-local-sandbox/);
});

test('landing and play expose the public fairness ledger', () => {
  const landing = readFileSync(join(root, 'public/landing.html'), 'utf8');
  const play = readFileSync(join(root, 'public/index.html'), 'utf8');
  const page = readFileSync(join(root, 'public/fairness.html'), 'utf8');
  assert.match(landing, /href="\/fairness"/);
  assert.match(landing, /github.com\/frxnnk\/memelauncher/);
  assert.match(play, /href="\/fairness"/);
  assert.match(play, /github.com\/frxnnk\/memelauncher/);
  assert.match(page, /Public ledger/);
  assert.match(page, /src="\/fairness.js"/);
  assert.match(page, /github.com\/frxnnk\/memelauncher/);
});
