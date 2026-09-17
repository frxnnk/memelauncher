import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createPublicClient, defineChain, formatUnits, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { accountGameFixture, completion, input } from '../test/fixtures/account-game.mjs';
import { splitWinPrize } from '../server/economy/paid-beta-policy.mjs';
import { verifyAssetLedgerExport } from './verify-asset-ledger.mjs';
import { createOperatingBox } from '../server/operating-box.mjs';
import { signExactPayment } from '../server/x402-blockrun.mjs';
import { createLiveX402Payer } from '../server/x402-payer.mjs';
import { startWebFunding } from '../server/economy/web-funding-runtime.mjs';
import { createHttpServer } from '../server/http.mjs';
import { checkedDepositTransaction, FUNDING_NETWORK } from '../public/funding-network.js';
import { PAYER_BOX, PRODUCT_X402_BOX, TREASURY_BOX } from '../server/x402-operating-box-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const vercelPath = join(root, 'config/paid-beta.vercel.json');
const vercelPaid = JSON.parse(readFileSync(vercelPath, 'utf8'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dataDirectory = join(root, '.local', `paid-beta-opus-${stamp}`);
const OPUS = 'anthropic/claude-opus-5';
const PRICE = '5000000000000000000';
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const TEST_FILES = [
  'test/paid-beta-game.test.mjs',
  'test/paid-beta-circuit.test.mjs',
  'test/paid-beta-rh-deposit.test.mjs'
];

const report = {
  generatedAt: new Date().toISOString(),
  cursorGoalComplete: false,
  liveFloorLowered: false,
  productionTursoCredited: false,
  ssh: false,
  broadcast: false,
  realFundsEnabled: false,
  keysPrinted: false,
  inference: 'mocked-inference',
  liveX402Opus: {
    attempted: false,
    reason: 'A real anthropic/claude-opus-5 x402 call would spend Base USDC from 0xf670. Mocked inference asserts 5e18 / 70/30 / 25% retain without spending Franco AMZN or USDC.'
  },
  production: {
    liveDeposit: 'blocked-on-faucet',
    payFrom: '0x686c6cd47d0a09b5b77fff3f76e2786425dc2f79',
    requiredAmzn: '5',
    requiredBaseUnits: PRICE,
    faucet: FUNDING_NETWORK.faucetUrl,
    note: 'Production live deposit is still blocked on faucet until a linked Pay-from wallet holds ≥5 AMZN. Do not lower the live 5 AMZN floor.'
  },
  config: 'config/paid-beta.vercel.json',
  roundId: vercelPaid.rounds[0].id,
  modelId: OPUS,
  policy: vercelPaid.policy,
  dataDirectory: `.local/paid-beta-opus-${stamp}`,
  productPayer: null,
  paymentsSubmitted: 0,
  usdcSpent: '0'
};

function fixtureRpc() {
  const rpcUrl = 'https://fixture.invalid/paid-beta-opus';
  const methods = [];
  const fetchImpl = async (url, init) => {
    if (url !== rpcUrl) throw new Error(`unexpected rpc ${url}`);
    const { id, method } = JSON.parse(init.body);
    methods.push(method);
    if (/send|sign|personal_/i.test(method)) throw new Error('Deposit preparation must not sign or broadcast.');
    const results = {
      eth_chainId: FUNDING_NETWORK.hexId,
      eth_blockNumber: '0x66',
      eth_getTransactionReceipt: null,
      eth_getBlockByNumber: { hash: '0x' + 'b'.repeat(64), number: '0x64' }
    };
    return Response.json({ jsonrpc: '2.0', id, result: results[method] ?? null });
  };
  return { rpcUrl, fetchImpl, methods };
}

async function livePayFromBalance() {
  const chain = defineChain({
    id: FUNDING_NETWORK.id,
    name: FUNDING_NETWORK.name,
    nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency },
    rpcUrls: { default: { http: [FUNDING_NETWORK.rpcUrl] } }
  });
  const client = createPublicClient({ chain, transport: http(FUNDING_NETWORK.rpcUrl) });
  const value = await client.readContract({
    address: AMZN,
    abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [PAYER_BOX]
  });
  return { baseUnits: value.toString(), formatted: formatUnits(value, 18) };
}

try {
  if (vercelPaid.terms.price !== PRICE) throw new Error('Vercel paid-beta price is not 5e18.');
  if (vercelPaid.rounds[0].models[0] !== OPUS) throw new Error('Vercel paid-beta guardian is not Opus.');
  if (vercelPaid.asset.destination.toLowerCase() !== TREASURY_BOX) throw new Error('Vercel destination must stay the disclosed treasury.');

  let productPayer = null;
  try { productPayer = createLiveX402Payer(process.env); } catch (error) {
    report.productPayerError = error.message;
  }
  report.productPayerArmed = Boolean(productPayer);
  report.productPayer = productPayer?.address?.toLowerCase() ?? null;
  if (report.productPayer === PRODUCT_X402_BOX) {
    report.liveX402Opus.skippedDedicatedBox = true;
  }

  await mkdir(dataDirectory, { recursive: true });
  const box = createOperatingBox({ readBalance: async () => 1_000_000n, floor: 1000n });
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const f = await accountGameFixture({
    asset: vercelPaid.asset,
    terms: vercelPaid.terms,
    models: [OPUS],
    roundId: vercelPaid.rounds[0].id,
    paidInference: {
      assertCoverage: amount => box.assertCoverage(amount),
      sign: requirement => signExactPayment({ account, requirement, now: () => 1_700_000_000 })
    }
  });
  try {
    f.deposit(f.alice, vercelPaid.maximumTopup);
    const locked = await f.game.attempt(f.headers(), {
      ...input('opus-5e18-lock'), roundId: vercelPaid.rounds[0].id, modelId: OPUS
    });
    f.controls.transport = body => completion(body.model, 'release_prize');
    const won = await f.game.attempt(f.headers(), {
      ...input('opus-5e18-win'), roundId: vercelPaid.rounds[0].id, modelId: OPUS
    });
    const expected = splitWinPrize('7700000000000000000');
    const snapshot = JSON.parse(JSON.stringify(f.economy.export()));
    report.ledger = {
      credit: {
        kind: 'operator-test-credit',
        chainId: vercelPaid.asset.chainId,
        amount: vercelPaid.maximumTopup,
        chainTransactionHash: null,
        note: 'Throwaway sqlite credit. Not a Robinhood broadcast and not Franco AMZN.'
      },
      locked: {
        decision: locked.decision,
        prizeContribution: locked.accounting.prizeContribution,
        operations: locked.accounting.operations,
        nextRound: locked.accounting.nextRound,
        transport: f.calls[0]?.transport ?? null,
        model: f.calls[0]?.model ?? null
      },
      won: {
        decision: won.decision,
        prizeContribution: won.accounting.prizeContribution,
        payable: f.economy.state().balances.find(row => row.account === `round:${vercelPaid.rounds[0].id}:payable`)?.amount ?? null,
        continuity: f.economy.state().balances.find(row => row.account === 'treasury:next')?.amount ?? null,
        expected,
        state: f.economy.state().rounds.find(row => row.id === vercelPaid.rounds[0].id)?.state ?? null
      },
      ledgerStatus: verifyAssetLedgerExport(snapshot).status,
      guardian: snapshot.roundManifests[0].manifest.configuration.guardians[0].modelId
    };
    report.paymentsSubmitted = f.calls.length;
  } finally {
    await f.close();
  }

  const { rpcUrl, fetchImpl, methods } = fixtureRpc();
  const depositFixture = await accountGameFixture();
  const runtime = await startWebFunding({
    configPath: vercelPath,
    dataDirectory: join(dataDirectory, 'unsigned-deposit'),
    authentication: depositFixture.authentication,
    limits: depositFixture.limits,
    vault: depositFixture.vault,
    rpcUrl,
    fetchImpl,
    hosting: { name: 'local', ephemeralData: false, backgroundTimers: false }
  });
  const server = createHttpServer({
    service: depositFixture.vault, authentication: depositFixture.authentication, publicDir: '.', funding: runtime.funding
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/funding/deposits`, {
      method: 'POST',
      headers: { ...depositFixture.headers('alice'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'rh-opus-prep', wallet: '0x' + '2'.repeat(40), amountBaseUnits: PRICE })
    });
    const prepared = await response.json();
    const tx = checkedDepositTransaction(prepared);
    report.unsignedDeposit = {
      http: response.status,
      roundId: runtime.funding.configuration().rounds[0].id,
      price: runtime.funding.configuration().rounds[0].price,
      model: runtime.funding.configuration().rounds[0].manifest.manifest.configuration.guardians[0].modelId,
      minimumReceived: prepared.order?.minimumReceived ?? null,
      from: tx.from,
      to: tx.to,
      chainId: tx.chainId,
      broadcast: prepared.broadcast ?? false,
      realFundsEnabled: prepared.realFundsEnabled,
      signedOrSent: methods.some(method => /send|sign/i.test(method)),
      availableAfterPrepare: (await runtime.funding.handle(depositFixture.headers('alice'), 'GET', '/api/funding/account', new URLSearchParams())).available
    };
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await runtime.close();
    await depositFixture.close();
  }

  try {
    report.production.payFromBalance = await livePayFromBalance();
    report.production.payFromHasFive = BigInt(report.production.payFromBalance.baseUnits) >= BigInt(PRICE);
    if (!report.production.payFromHasFive) report.production.liveDeposit = 'blocked-on-faucet';
  } catch (error) {
    report.production.payFromBalanceError = error.message;
    report.production.liveDeposit = 'blocked-on-faucet';
  }

  const tests = spawnSync(process.execPath, ['--test', ...TEST_FILES], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  });
  report.tests = {
    files: TEST_FILES,
    exitCode: tests.status,
    stdout: tests.stdout?.trim().split(/\r?\n/).filter(line => /# (?:tests|pass|fail|cancelled|skipped|todo)|ok |not ok /.test(line)).slice(-24),
    fail: tests.status !== 0
  };

  report.ok = report.ledger?.locked?.decision === 'locked'
    && report.ledger?.locked?.prizeContribution === '3500000000000000000'
    && report.ledger?.locked?.operations === '1500000000000000000'
    && report.ledger?.locked?.nextRound === '0'
    && report.ledger?.locked?.transport === 'x402'
    && report.ledger?.locked?.model === OPUS
    && report.ledger?.won?.decision === 'released'
    && report.ledger?.won?.payable === '5775000000000000000'
    && report.ledger?.won?.continuity === '1925000000000000000'
    && report.ledger?.won?.state === 'won'
    && report.ledger?.ledgerStatus === 'internally-consistent'
    && report.unsignedDeposit?.minimumReceived === PRICE
    && report.unsignedDeposit?.broadcast === false
    && report.unsignedDeposit?.signedOrSent === false
    && report.unsignedDeposit?.availableAfterPrepare === '0'
    && report.liveX402Opus.attempted === false
    && report.cursorGoalComplete === false
    && report.tests?.exitCode === 0
    && report.production.liveDeposit === 'blocked-on-faucet';
  if (!report.ok && !report.error) {
    report.error = { message: 'Opus 5e18 local circuit, unsigned 5 AMZN prepare, tests, or faucet blocker did not match.' };
  }
  report.summaryEs = [
    'Camino Opus local a 5 AMZN (5e18, 70/30, 25% retain) comprobado en ledger sqlite de usar-y-tirar; inferencia mockeada, 0 USDC gastados.',
    `Tests ${report.tests?.stdout?.find(line => line.startsWith('# pass '))?.slice(8) ?? '?'}/${report.tests?.stdout?.find(line => line.startsWith('# tests '))?.slice(9) ?? '?'} (paid-beta-game, paid-beta-circuit, paid-beta-rh-deposit). Artefacto output/paid-beta-opus-local.json.`,
    `Live Pay-from ${report.production.payFrom} sigue en ${report.production.payFromBalance?.formatted ?? '?'} AMZN; depósito de producción bloqueado en faucet (≥5). Piso 5 intacto. Goal de Cursor no completo.`
  ];
} catch (error) {
  report.ok = false;
  report.error = { code: error.code ?? null, message: error.message };
}

const out = join(root, 'output', 'paid-beta-opus-local.json');
await mkdir(join(root, 'output'), { recursive: true });
await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: report.ok,
  out,
  inference: report.inference,
  locked: report.ledger?.locked ?? null,
  won: report.ledger?.won ?? null,
  unsignedDeposit: report.unsignedDeposit ?? null,
  tests: report.tests ? { files: report.tests.files, exitCode: report.tests.exitCode, fail: report.tests.fail } : null,
  production: report.production,
  liveX402Opus: report.liveX402Opus,
  cursorGoalComplete: report.cursorGoalComplete,
  error: report.error ?? null
}, null, 2));
if (!report.ok) process.exitCode = 1;
