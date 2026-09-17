import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import {
  classifyOperatingBox, TREASURY_BOX, PAYER_BOX, LAPTOP_REHEARSAL_BOX, PRODUCT_X402_BOX
} from '../server/x402-operating-box-policy.mjs';
import { inspectTestnetEnv } from './inspect-testnet-env.mjs';

export { PRODUCT_X402_BOX };

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

function classifyValue(raw) {
  const key = (raw || '').trim();
  if (!key) return { present: false };
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) return { present: true, format: 'non-hex64' };
  const address = privateKeyToAccount(normalized).address.toLowerCase();
  return {
    present: true,
    format: 'hex-64',
    address,
    kind: classifyOperatingBox(address),
    isTreasury: address === TREASURY_BOX,
    isPayer: address === PAYER_BOX,
    isLaptop: address === LAPTOP_REHEARSAL_BOX,
    isProduct: address === PRODUCT_X402_BOX
  };
}

export function inspectEnvBoxes(paths = ['.env', '.env.local']) {
  const files = {};
  const treasurySignerNames = [];
  const productSignerNames = [];
  for (const file of paths) {
    if (!existsSync(file)) {
      files[file] = { exists: false };
      continue;
    }
    const env = parseEnv(readFileSync(file, 'utf8'));
    const classified = {};
    for (const name of Object.keys(env).filter(key => /KEY|SECRET|TOKEN|PRIVATE/i.test(key))) {
      classified[name] = classifyValue(env[name]);
      if (classified[name].isTreasury) treasurySignerNames.push(`${file}:${name}`);
      if (classified[name].isProduct) productSignerNames.push(`${file}:${name}`);
    }
    files[file] = {
      exists: true,
      durableData: env.VAULT_DURABLE_DATA ?? null,
      libsqlUrlSet: Boolean(env.VAULT_LIBSQL_URL?.trim()),
      fundingConfigSet: Boolean(env.VAULT_WEB_FUNDING_CONFIG?.trim()),
      fundingRpcSet: Boolean(env.VAULT_FUNDING_RPC_URL?.trim()),
      classified
    };
  }
  return {
    keysPrinted: false,
    treasurySignerPresent: treasurySignerNames.length > 0,
    treasurySignerNames,
    productSignerPresent: productSignerNames.length > 0,
    productSignerNames,
    inspect: inspectTestnetEnv(paths[0]),
    files
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(inspectEnvBoxes(process.argv.slice(2).length ? process.argv.slice(2) : ['.env', '.env.local']), null, 2));
}
