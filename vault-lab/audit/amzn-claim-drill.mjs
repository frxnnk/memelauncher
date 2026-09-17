import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { accountGameFixture, address, completion, hash, input } from '../test/fixtures/account-game.mjs';
import { createAuthenticatedClaims } from '../server/economy/authenticated-claims.mjs';
import { createWebFunding } from '../server/economy/web-funding.mjs';
import { createHttpServer } from '../server/http.mjs';
import { checkedPayoutTransaction, FUNDING_NETWORK } from '../public/funding-network.js';
import { splitWinPrize } from '../server/economy/paid-beta-policy.mjs';
import { validateWebFundingConfiguration } from '../server/economy/web-funding-runtime.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX, PRODUCT_X402_BOX } from '../server/x402-operating-box-policy.mjs';
import { durableStore } from '../server/storage/database.mjs';

delete process.env.VAULT_DURABLE_DATA;
delete process.env.VAULT_LIBSQL_URL;
delete process.env.VAULT_LIBSQL_AUTH_TOKEN;
if (durableStore(process.env).enabled) throw new Error('AMZN claim drill must use isolated sqlite, not Turso.');

const root = fileURLToPath(new URL('../', import.meta.url));
const ROUND = 'rh-amzn-claim-drill';
const OPUS = 'anthropic/claude-opus-5';
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const winner = address('2');

function refuseBroadcast() {
  throw new Error('Robinhood testnet AMZN prize broadcast is disabled for this fixture. Live treasury 0xbec4 holds round funds from the credited deposit and must not send. Mainnet is refused.');
}

const validated = validateWebFundingConfiguration(JSON.parse(readFileSync(join(root, 'config/paid-beta.vercel.json'), 'utf8')));
const f = await accountGameFixture({
  asset: validated.asset,
  terms: validated.terms,
  models: [OPUS],
  roundId: ROUND
});

let receipt = null;
const claims = createAuthenticatedClaims({
  economy: f.economy, authentication: f.authentication,
  reader: {
    evidence: async order => ({
      chainId: FUNDING_NETWORK.hexId,
      headBlockNumber: '0x66',
      canonicalBlock: { hash: hash('b'), number: '0x64' },
      receipt
    })
  }
});
const funding = createWebFunding({
  economy: f.economy, deposits: { list: async () => ({ deposits: [] }) }, game: f.game,
  authentication: f.authentication, claims, maximumTopup: validated.maximumTopup, testnet: true
});
const server = createHttpServer({
  service: f.vault, authentication: f.authentication, publicDir: '.', funding
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const call = async (path, body, owner = 'alice', wallets) => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...f.headers(owner, wallets), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
};

let broadcastError;
try {
  const amount = validated.terms.price;
  f.deposit(f.alice, amount);
  f.controls.transport = body => {
    if (body.model !== OPUS) throw new Error('Drill guardian must be Opus.');
    return completion(body.model, 'release_prize');
  };
  const won = await f.game.attempt(f.headers(), { ...input('win'), roundId: ROUND, modelId: OPUS, payoutWallet: winner });
  if (won.decision !== 'released') throw new Error('Fixture guardian did not call release_prize.');
  const contribution = (BigInt(amount) * 7000n) / 10000n;
  const operations = (BigInt(amount) * 3000n) / 10000n;
  const expected = splitWinPrize(String(contribution));
  const balances = Object.fromEntries(f.economy.state().balances.map(row => [row.account, row.amount]));
  if (balances[`round:${ROUND}:payable`] !== expected.payable) throw new Error('Payable mismatch.');
  const prepared = await call(`claims/${ROUND}/prepare`, {}, 'operator', [TREASURY_BOX]);
  if (prepared.status !== 200) throw new Error(prepared.body.error?.message || 'prepare failed');
  const payout = checkedPayoutTransaction(prepared.body);
  if (payout.from.toLowerCase() !== TREASURY_BOX) throw new Error('Prize from-address must be treasury.');
  if ([PAYER_BOX, LAPTOP_REHEARSAL_BOX, PRODUCT_X402_BOX].includes(payout.from.toLowerCase())) {
    throw new Error('Forbidden operating box cannot send the prize.');
  }
  if (payout.to.toLowerCase() !== AMZN) throw new Error('Prize transfer must target AMZN.');
  if (payout.chainId !== FUNDING_NETWORK.hexId) throw new Error('Prize transfer must be Robinhood testnet.');
  const submitted = await call(`claims/${ROUND}/submit`, { transactionHash: hash('c') }, 'operator', [TREASURY_BOX]);
  if (submitted.status !== 200) throw new Error(submitted.body.error?.message || 'submit failed');
  receipt = {
    transactionHash: hash('c'), status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
    logs: [{
      transactionHash: hash('c'), logIndex: '0x0', address: AMZN, blockHash: hash('b'),
      blockNumber: '0x64', removed: false,
      topics: [
        TRANSFER_TOPIC,
        '0x' + TREASURY_BOX.slice(2).padStart(64, '0'),
        '0x' + winner.slice(2).padStart(64, '0')
      ],
      data: '0x' + BigInt(expected.payable).toString(16).padStart(64, '0')
    }]
  };
  const checked = await call(`claims/${ROUND}/check`, {}, 'operator', [TREASURY_BOX]);
  if (checked.status !== 200 || checked.body.order?.state !== 'paid') {
    throw new Error(checked.body.error?.message || 'check did not mark paid');
  }
  try { refuseBroadcast(); } catch (error) { broadcastError = error.message; }
  const round = f.economy.state().rounds.find(row => row.id === ROUND);
  const report = {
    generatedAt: new Date().toISOString(),
    drill: 'rh-testnet-amzn-claim',
    liveRound: 'rh-paid-opus-v1',
    liveRoundMutated: false,
    productionTurso: false,
    durableStore: durableStore(process.env).driver,
    realFundsEnabled: false,
    broadcast: false,
    executedTransfer: false,
    chainId: FUNDING_NETWORK.chainId,
    tokenAddress: AMZN,
    decimals: 18,
    guardian: OPUS,
    roundId: ROUND,
    attemptPrice: amount,
    prizeBps: 7000,
    operationsBps: 3000,
    winRetainBps: 2500,
    prizeContribution: String(contribution),
    operationsContribution: String(operations),
    payable: expected.payable,
    continuity: expected.continuity,
    recipient: winner,
    treasury: TREASURY_BOX,
    decision: won.decision,
    roundStateAfterCheck: round?.state ?? null,
    unsignedTransfer: payout,
    fixtureTransactionHash: hash('c'),
    orderState: checked.body.order.state,
    paidAmount: checked.body.order.paid,
    testnetBroadcastRefused: broadcastError,
    mainnetBroadcastRefused: 'Mainnet prize broadcast is disabled. This drill is Robinhood testnet 46630 AMZN only and does not seed $500.',
    note: 'Isolated sqlite circuit. Genuine release_prize tool from the fixture guardian, then GET/prepare/submit/check. Encodes an unsigned treasury→winner AMZN transfer. Does not broadcast, does not spend live 0xbec4 round funds, and does not mutate rh-paid-opus-v1.'
  };
  await mkdir(join(root, 'output'), { recursive: true });
  const out = join(root, 'output', 'amzn-claim-drill.json');
  await writeFile(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true, out, payable: expected.payable, continuity: expected.continuity,
    broadcast: false, executedTransfer: false, liveRoundMutated: false
  }, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await f.close();
}
