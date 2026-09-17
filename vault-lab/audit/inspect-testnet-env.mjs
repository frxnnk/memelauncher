import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import { classifyOperatingBox } from '../server/x402-operating-box-policy.mjs';

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

function classifyKey(raw) {
  const key = (raw || '').trim();
  if (!key) return { present: false };
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) return { present: true, format: 'invalid', allowed: false };
  const address = privateKeyToAccount(normalized).address.toLowerCase();
  const kind = classifyOperatingBox(address);
  return {
    present: true,
    format: 'hex-64',
    kind,
    allowed: kind === 'dedicated'
  };
}

export function allowedTestnetSigner(envFile, name) {
  if (!existsSync(envFile)) return null;
  const env = parseEnv(readFileSync(envFile, 'utf8'));
  const classified = classifyKey(env[name]);
  if (!classified.allowed) return null;
  const raw = (env[name] || '').trim();
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  return { address: privateKeyToAccount(key).address.toLowerCase(), key };
}

export function fundingRpcUrl(envFile) {
  if (!existsSync(envFile)) return null;
  const env = parseEnv(readFileSync(envFile, 'utf8'));
  const url = env.VAULT_FUNDING_RPC_URL?.trim() || '';
  try { return url && new URL(url).protocol === 'https:' ? url : null; }
  catch { return null; }
}

export function inspectTestnetEnv(path = '.env') {
  const result = { path, exists: existsSync(path), keysPrinted: false };
  if (!result.exists) return result;
  const env = parseEnv(readFileSync(path, 'utf8'));
  result.VAULT_FUNDING_RPC_URL = Boolean(env.VAULT_FUNDING_RPC_URL?.trim());
  result.VAULT_WEB_FUNDING_CONFIG = Boolean(env.VAULT_WEB_FUNDING_CONFIG?.trim());
  result.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY = classifyKey(env.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY);
  result.VAULT_TESTNET_CLAIM_PRIVATE_KEY = classifyKey(env.VAULT_TESTNET_CLAIM_PRIVATE_KEY);
  result.VAULT_X402_PRIVATE_KEY = classifyKey(env.VAULT_X402_PRIVATE_KEY);
  result.VAULT_DURABLE_DATA = env.VAULT_DURABLE_DATA ?? null;
  result.VAULT_LIBSQL_URL = Boolean(env.VAULT_LIBSQL_URL?.trim());
  if (env.VAULT_FUNDING_RPC_URL?.trim()) {
    try { result.fundingRpcHost = new URL(env.VAULT_FUNDING_RPC_URL).host; }
    catch { result.fundingRpcHost = 'invalid-url'; }
  }
  result.missingForLiveDeposit = [
    ...(!result.VAULT_FUNDING_RPC_URL ? ['VAULT_FUNDING_RPC_URL'] : []),
    ...(!result.VAULT_WEB_FUNDING_CONFIG ? ['VAULT_WEB_FUNDING_CONFIG (config/paid-beta-haiku.testnet.json on a NEW data directory, not web-funding-testnet)'] : []),
    ...(!result.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY.present
      ? ['VAULT_TESTNET_DEPOSIT_PRIVATE_KEY (dedicated Robinhood testnet signer; never treasury, payer, or laptop)']
      : !result.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY.allowed
        ? ['VAULT_TESTNET_DEPOSIT_PRIVATE_KEY is present but maps to a forbidden box']
        : [])
  ];
  result.missingForLiveClaim = [
    ...(!result.VAULT_FUNDING_RPC_URL ? ['VAULT_FUNDING_RPC_URL'] : []),
    ...(!result.VAULT_TESTNET_CLAIM_PRIVATE_KEY.present
      ? ['VAULT_TESTNET_CLAIM_PRIVATE_KEY (dedicated Robinhood testnet signer; never treasury 0xbec4… or payer 0x686c…)']
      : !result.VAULT_TESTNET_CLAIM_PRIVATE_KEY.allowed
        ? ['VAULT_TESTNET_CLAIM_PRIVATE_KEY is present but maps to a forbidden box']
        : [])
  ];
  result.canLiveDeposit = Boolean(result.VAULT_FUNDING_RPC_URL && result.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY.allowed);
  result.canLiveClaim = false;
  result.liveClaimBlocked = 'Prize transfer from is the disclosed treasury; that key is a forbidden product box in this session.';
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(inspectTestnetEnv(process.argv[2] || '.env'), null, 2));
}
