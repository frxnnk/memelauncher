import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, formatEther, formatUnits, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createVaultApplication } from '../server/boot.mjs';
import { LOCAL_OPERATOR_HEADER } from '../server/local-operator.mjs';
import { TREASURY_BOX } from '../server/x402-operating-box-policy.mjs';
import { FUNDING_NETWORK } from '../public/funding-network.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const configPath = join(root, 'config/paid-beta-haiku.testnet.json');
const fundingDirectory = join(root, '.local', 'web-funding-paid-beta');
const DEPOSIT_ADDRESS = '0xFcF79a0D3D32791dF521A041b02Ac97Ca12842F4';
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const haikuConfig = JSON.parse(readFileSync(configPath, 'utf8'));
export function provingDepositAmount(config = haikuConfig) {
  return BigInt(config.terms.price);
}
export function canSendPlayerDeposit(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) && address.toLowerCase() !== TREASURY_BOX;
}
export function playerDepositSigner(env = process.env) {
  const raw = env.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY?.trim();
  if (!raw) return null;
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const account = privateKeyToAccount(key);
  if (!canSendPlayerDeposit(account.address)) return null;
  return { account, address: account.address.toLowerCase() };
}
const AMOUNT = provingDepositAmount();
const HAIKU = 'anthropic/claude-haiku-4.5';
const PUBLIC_RPC = FUNDING_NETWORK.rpcUrl;
const LOCAL_PORT = Number(process.env.PORT || 4319);

const chain = defineChain({
  id: FUNDING_NETWORK.id,
  name: FUNDING_NETWORK.name,
  nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency },
  rpcUrls: { default: { http: [PUBLIC_RPC] } }
});

const report = {
  ok: false,
  script: 'paid-beta:testnet-deposit',
  chainId: FUNDING_NETWORK.id,
  depositAddress: DEPOSIT_ADDRESS,
  destination: TREASURY_BOX,
  balance: null,
  transactionHash: null,
  stillZero: false,
  credited: false,
  haiku: null,
  production: {
    vercelCutover: false,
    vpsTouched: false,
    paidConfigured: false,
    privyJwtForged: false
  },
  privyAllowedOrigins: [`http://127.0.0.1:${LOCAL_PORT}`, `http://localhost:${LOCAL_PORT}`],
  note: 'Privy dashboard must already allow those origins for browser sign-in. This command does not change Privy.'
};

function finish(extra = {}) {
  Object.assign(report, extra);
  mkdirSync(join(root, 'output'), { recursive: true });
  writeFileSync(join(root, 'output', 'paid-beta-testnet-deposit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    balance: report.balance,
    transactionHash: report.transactionHash,
    stillZero: report.stillZero,
    script: report.script,
    credited: report.credited,
    haiku: report.haiku && { decision: report.haiku.decision, error: report.haiku.error ?? null },
    productionStillBlocked: true,
    privyAllowedOrigins: report.privyAllowedOrigins
  }, null, 2));
}

function depositSigner(env = process.env) {
  return playerDepositSigner(env);
}

async function readBalances(client, address) {
  const [native, amzn, chainId] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: AMZN,
      abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [address]
    }),
    client.getChainId()
  ]);
  return {
    chainId,
    nativeWei: native.toString(),
    nativeEth: formatEther(native),
    amznBaseUnits: amzn.toString(),
    amzn: formatUnits(amzn, 18),
    funded: native > 0n && amzn >= AMOUNT
  };
}

async function jsonCall(base, path, { method = 'GET', body, wallet } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(wallet ? { [LOCAL_OPERATOR_HEADER]: wallet } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, body: payload };
}

async function probeLocalServer(port) {
  try {
    const auth = await jsonCall(`http://127.0.0.1:${port}`, '/api/auth/config');
    return {
      up: auth.status === 200,
      observe: auth.body?.localOperatorObserve === true,
      paidConfigured: auth.body?.paidConfigured === true
    };
  } catch {
    return { up: false, observe: false, paidConfigured: false };
  }
}

function applyLocalPaidBetaEnv() {
  process.env.VAULT_ACCESS_MODE = 'local';
  process.env.VAULT_CLOSED_BETA = 'false';
  process.env.VAULT_TELEGRAM_ENABLED = 'false';
  process.env.VAULT_WEB_FUNDING_CONFIG = configPath;
  process.env.VAULT_FUNDING_DATA_DIRECTORY = fundingDirectory;
  process.env.VAULT_FUNDING_RPC_URL = process.env.VAULT_FUNDING_RPC_URL?.trim() || PUBLIC_RPC;
  process.env.VAULT_LOCAL_TESTNET_OBSERVE = 'true';
  delete process.env.VAULT_DURABLE_DATA;
}

async function withFundingApi(serverState, run) {
  if (serverState.up && serverState.observe) {
    return run(`http://127.0.0.1:${LOCAL_PORT}`);
  }
  if (serverState.up && !serverState.observe) {
    throw new Error('Local paid-beta is running without VAULT_LOCAL_TESTNET_OBSERVE. Restart npm run paid-beta:testnet, then re-run this command.');
  }
  applyLocalPaidBetaEnv();
  const app = await createVaultApplication({ env: process.env, root });
  const server = createServer(app.listener);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await app.close();
  }
}

async function creditObservedHash(base, wallet, transactionHash) {
  const prepared = await jsonCall(base, '/api/funding/deposits', {
    method: 'POST', wallet,
    body: { key: `rh-paid-haiku-${transactionHash.slice(2, 10)}`, wallet, amountBaseUnits: AMOUNT.toString() }
  });
  if (prepared.status !== 200) {
    throw new Error(prepared.body?.error?.message || 'Deposit prepare failed.');
  }
  const id = prepared.body.order.id;
  const submitted = await jsonCall(base, `/api/funding/deposits/${id}/submit`, {
    method: 'POST', wallet, body: { transactionHash }
  });
  if (submitted.status !== 200) {
    throw new Error(submitted.body?.error?.message || 'Deposit submit failed.');
  }
  for (let i = 0; i < 20; i++) {
    const checked = await jsonCall(base, `/api/funding/deposits/${id}/check`, { method: 'POST', wallet, body: {} });
    if (checked.body?.order?.credited) {
      return { orderId: id, credited: true, available: (await jsonCall(base, '/api/funding/account', { wallet })).body?.available };
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return { orderId: id, credited: false };
}

async function attemptHaiku(base, wallet) {
  const result = await jsonCall(base, '/api/funding/attempts', {
    method: 'POST', wallet,
    body: {
      key: `haiku-${Date.now()}`,
      roundId: 'rh-paid-haiku-v1',
      modelId: HAIKU,
      prompt: 'Local paid-beta Haiku after an observed Robinhood testnet deposit. Keep the vault locked.',
      payoutWallet: wallet,
      creditMode: 'asset-preparation'
    }
  });
  if (result.status !== 200) {
    return { error: result.body?.error?.code || result.body?.error?.message || String(result.status) };
  }
  return {
    decision: result.body.decision,
    prizeContribution: result.body.accounting?.prizeContribution,
    operations: result.body.accounting?.operations,
    transport: result.body.receipt?.mode || result.body.receipt?.payment?.network || null
  };
}

const client = createPublicClient({ chain, transport: http(PUBLIC_RPC) });
export async function runPaidBetaTestnetDeposit() {
  try {
    const signer = depositSigner();
    const from = signer?.address ?? DEPOSIT_ADDRESS.toLowerCase();
    report.depositAddress = from;
    report.balance = await readBalances(client, from);
    if (report.balance.chainId !== FUNDING_NETWORK.id) {
      finish({ error: `Unexpected chain ${report.balance.chainId}` });
      process.exitCode = 1;
      return;
    }
    if (!report.balance.funded) {
      report.stillZero = report.balance.amznBaseUnits === '0' && report.balance.nativeWei === '0';
      finish({
        ok: true,
        transactionHash: 'still 0',
        stillZero: true,
        note: `${report.note} Operator Phantom must send 1 AMZN from a funded player EOA. One balance check only.`
      });
      return;
    }

    if (!signer) {
      finish({ error: 'VAULT_TESTNET_DEPOSIT_PRIVATE_KEY missing or maps to treasury, which cannot send a player deposit.' });
      process.exitCode = 1;
      return;
    }

    const wallet = createWalletClient({ account: signer.account, chain, transport: http(PUBLIC_RPC) });
    const transactionHash = await wallet.writeContract({
      address: AMZN,
      abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
      functionName: 'transfer',
      args: [TREASURY_BOX, AMOUNT]
    });
    report.transactionHash = transactionHash;
    await client.waitForTransactionReceipt({ hash: transactionHash, confirmations: 1, timeout: 60_000 });

    const serverState = await probeLocalServer(LOCAL_PORT);
    const credit = await withFundingApi(serverState, async base => {
      const observed = await creditObservedHash(base, signer.address, transactionHash);
      let haiku = null;
      if (observed.credited) haiku = await attemptHaiku(base, signer.address);
      return { ...observed, haiku, base };
    });
    finish({
      ok: credit.credited,
      credited: credit.credited,
      orderId: credit.orderId,
      available: credit.available,
      haiku: credit.haiku,
      usedRunningServer: serverState.up && serverState.observe
    });
    process.exitCode = credit.credited ? 0 : 1;
  } catch (error) {
    finish({
      ok: false,
      error: error.status ? error.message : 'The testnet deposit command failed.',
      transactionHash: report.transactionHash,
      stillZero: report.stillZero
    });
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runPaidBetaTestnetDeposit();
}
