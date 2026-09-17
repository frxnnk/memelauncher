import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { FUNDING_NETWORK } from '../public/funding-network.js';
import { TREASURY_BOX } from '../server/x402-operating-box-policy.mjs';
import {
  allowedTestnetSigner, fundingRpcUrl, inspectTestnetEnv
} from './inspect-testnet-env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = '.env';
const AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const outPath = join(root, 'output', 'paid-beta-rh-testnet.json');

const robinhoodTestnet = rpcUrl => defineChain({
  id: FUNDING_NETWORK.id,
  name: FUNDING_NETWORK.name,
  nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency },
  rpcUrls: { default: { http: [rpcUrl] } }
});

const report = {
  generatedAt: new Date().toISOString(),
  keysPrinted: false,
  broadcast: false,
  realFundsEnabled: false,
  vpsTouched: false,
  productionDeploy: false,
  robinhoodTestnetTx: 'none',
  chainId: FUNDING_NETWORK.chainId,
  asset: AMZN,
  unsignedDepositPrepared: true,
  unsignedClaimPrepared: true,
  liveDeposit: null,
  liveClaim: { sent: false, broadcast: false }
};

async function readOnlyChainId() {
  const client = createPublicClient({
    chain: robinhoodTestnet(FUNDING_NETWORK.rpcUrl),
    transport: http(FUNDING_NETWORK.rpcUrl)
  });
  const id = await client.getChainId();
  return { rpcHost: new URL(FUNDING_NETWORK.rpcUrl).host, chainId: id };
}

async function maybeLiveDeposit() {
  const rpcUrl = fundingRpcUrl(envFile);
  const signer = allowedTestnetSigner(envFile, 'VAULT_TESTNET_DEPOSIT_PRIVATE_KEY');
  if (!rpcUrl || !signer) {
    return { sent: false, reason: 'missing-or-forbidden-signer-or-rpc' };
  }
  const chain = robinhoodTestnet(rpcUrl);
  const account = privateKeyToAccount(signer.key);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const [native, amzn, chainId] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: AMZN,
      abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [account.address]
    }),
    publicClient.getChainId()
  ]);
  if (chainId !== FUNDING_NETWORK.id) {
    return { sent: false, reason: 'rpc-chain-mismatch', chainId };
  }
  const amount = 10n ** 15n;
  if (native === 0n || amzn < amount) {
    return {
      sent: false, reason: 'insufficient-testnet-balance', chainId,
      hasNativeGas: native > 0n, hasAmzn: amzn >= amount
    };
  }
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const hash = await wallet.writeContract({
    address: AMZN,
    abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
    functionName: 'transfer',
    args: [TREASURY_BOX, amount]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return {
    sent: true,
    chainId,
    asset: AMZN,
    amount: String(amount),
    destination: TREASURY_BOX,
    transactionHash: hash,
    status: receipt.status
  };
}

const env = inspectTestnetEnv(envFile);
report.env = env;
report.liveClaim.reason = env.liveClaimBlocked;
report.missingForLiveDeposit = env.missingForLiveDeposit ?? [
  'VAULT_FUNDING_RPC_URL',
  'VAULT_WEB_FUNDING_CONFIG (config/paid-beta-haiku.testnet.json on a NEW data directory, not web-funding-testnet)',
  'VAULT_TESTNET_DEPOSIT_PRIVATE_KEY (dedicated Robinhood testnet signer; never treasury, payer, or laptop)'
];
report.missingForLiveClaim = env.missingForLiveClaim ?? [
  'VAULT_FUNDING_RPC_URL',
  'VAULT_TESTNET_CLAIM_PRIVATE_KEY (dedicated Robinhood testnet signer; never treasury 0xbec4… or payer 0x686c…)'
];

try {
  report.readOnlyRpc = await readOnlyChainId();
} catch (error) {
  report.readOnlyRpc = { ok: false, error: error.message };
}

try {
  report.liveDeposit = await maybeLiveDeposit();
} catch (error) {
  report.liveDeposit = { sent: false, reason: 'rpc-or-send-failed', error: error.message };
}

if (report.liveDeposit?.sent) {
  report.robinhoodTestnetTx = {
    hash: report.liveDeposit.transactionHash,
    chainId: report.liveDeposit.chainId,
    asset: report.liveDeposit.asset
  };
} else {
  report.robinhoodTestnetTx = 'none';
}

await mkdir(join(root, 'output'), { recursive: true });
await writeFile(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: true,
  out: 'output/paid-beta-rh-testnet.json',
  robinhoodTestnetTx: report.robinhoodTestnetTx,
  broadcast: false,
  missingForLiveDeposit: report.missingForLiveDeposit,
  missingForLiveClaim: report.missingForLiveClaim,
  readOnlyChainId: report.readOnlyRpc?.chainId ?? null,
  vpsTouched: false,
  productionDeploy: false
}, null, 2));
