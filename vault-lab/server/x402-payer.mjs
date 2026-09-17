import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createOperatingBox } from './operating-box.mjs';
import { BASE_USDC, signExactPayment } from './x402-blockrun.mjs';
import { operatingBoxDecision } from './x402-operating-box-policy.mjs';
import { hostingTopology } from './hosting.mjs';

const BASE_CHAIN_ID = '8453';

export function assertX402RpcUrl(rpc, env = {}) {
  const url = new URL(rpc);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('VAULT_X402_RPC_URL must be HTTPS without credentials.');
  }
  if (/robinhood|0xb626|46630/i.test(url.href)) {
    throw new Error('VAULT_X402_RPC_URL must be Base mainnet (8453), not Robinhood.');
  }
  const chain = String(env.VAULT_X402_CHAIN_ID || BASE_CHAIN_ID).trim();
  if (chain !== BASE_CHAIN_ID && chain !== '0x2105') {
    throw new Error('VAULT_X402_CHAIN_ID must be 8453 (Base).');
  }
  return url.href;
}

const USDC_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

export function createX402Payer({ privateKey, readBalance, floor = 1_000_000n, now } = {}) {
  const account = privateKeyToAccount(privateKey);
  const box = createOperatingBox({ readBalance, floor });
  return {
    address: account.address,
    assertCoverage: amount => box.assertCoverage(amount),
    sign: requirement => signExactPayment({ account, requirement, now })
  };
}

export function createLiveX402Payer(env = process.env) {
  const key = env.VAULT_X402_PRIVATE_KEY?.trim();
  if (!key) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('VAULT_X402_PRIVATE_KEY must be a 32-byte hex private key.');
  const floorUsd = Number(env.VAULT_X402_FLOOR_USDC ?? '1');
  if (!Number.isFinite(floorUsd) || floorUsd < 0 || floorUsd > 10000) throw new Error('VAULT_X402_FLOOR_USDC must be a nonnegative USDC amount.');
  const rpc = assertX402RpcUrl(env.VAULT_X402_RPC_URL || 'https://mainnet.base.org', env);
  const account = privateKeyToAccount(key);
  if (operatingBoxDecision(account.address, hostingTopology(env).name, env) === 'ignore') return null;
  const client = createPublicClient({ chain: base, transport: http(rpc) });
  return {
    ...createX402Payer({
      privateKey: key,
      floor: BigInt(Math.round(floorUsd * 1e6)),
      readBalance: () => client.readContract({ address: BASE_USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [account.address] })
    }),
    kind: 'x402-exact'
  };
}

export function createLaptopRehearsalPayer(env = process.env) {
  if (hostingTopology(env).name !== 'local') return null;
  const key = env.VAULT_X402_PRIVATE_KEY?.trim();
  if (!key) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('VAULT_X402_PRIVATE_KEY must be a 32-byte hex private key.');
  const floorUsd = Number(env.VAULT_X402_FLOOR_USDC ?? '1');
  if (!Number.isFinite(floorUsd) || floorUsd < 0 || floorUsd > 10000) throw new Error('VAULT_X402_FLOOR_USDC must be a nonnegative USDC amount.');
  const rpc = assertX402RpcUrl(env.VAULT_X402_RPC_URL || 'https://mainnet.base.org', env);
  const account = privateKeyToAccount(key);
  if (operatingBoxDecision(account.address, 'local', env) !== 'ignore') return null;
  const client = createPublicClient({ chain: base, transport: http(rpc) });
  return {
    ...createX402Payer({
      privateKey: key,
      floor: BigInt(Math.round(floorUsd * 1e6)),
      readBalance: () => client.readContract({ address: BASE_USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [account.address] })
    }),
    kind: 'laptop-rehearsal'
  };
}
