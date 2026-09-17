import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createVaultApplication } from '../server/boot.mjs';
import { FUNDING_NETWORK } from '../public/funding-network.js';
import { classifyOperatingBox } from '../server/x402-operating-box-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = join(root, '.env');
const configPath = join(root, 'config/paid-beta-haiku.testnet.json');
const fundingDirectory = join(root, '.local', 'web-funding-paid-beta');
const PUBLIC_RPC = FUNDING_NETWORK.rpcUrl;

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

function upsertEnvVar(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, line);
  return `${text.replace(/\s*$/, '')}\n${line}\n`;
}

function dedicatedDeposit(raw) {
  const key = (raw || '').trim();
  if (!key) return null;
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) return null;
  const account = privateKeyToAccount(normalized);
  if (classifyOperatingBox(account.address) !== 'dedicated') return null;
  return { address: account.address, key: normalized };
}

function ensureGitignoredEnv() {
  let text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const env = parseEnv(text);
  const writes = {};
  if (!env.VAULT_FUNDING_RPC_URL?.trim()) writes.VAULT_FUNDING_RPC_URL = PUBLIC_RPC;
  let deposit = dedicatedDeposit(env.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY);
  let generated = false;
  if (!deposit) {
    let key;
    do { key = generatePrivateKey(); }
    while (classifyOperatingBox(privateKeyToAccount(key).address) !== 'dedicated');
    writes.VAULT_TESTNET_DEPOSIT_PRIVATE_KEY = key;
    deposit = dedicatedDeposit(key);
    generated = true;
  }
  if (Object.keys(writes).length) {
    for (const [key, value] of Object.entries(writes)) text = upsertEnvVar(text, key, value);
    writeFileSync(envPath, text);
  }
  return {
    depositAddress: deposit.address,
    generated,
    rpcUrl: env.VAULT_FUNDING_RPC_URL?.trim() || writes.VAULT_FUNDING_RPC_URL || PUBLIC_RPC,
    privyConfigured: Boolean(env.PRIVY_APP_ID?.trim() && env.PRIVY_CLIENT_ID?.trim() && env.PRIVY_VERIFICATION_KEY?.trim())
  };
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

const local = ensureGitignoredEnv();
mkdirSync(fundingDirectory, { recursive: true });
applyLocalPaidBetaEnv();

const port = Number(process.env.PORT || 4319);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const app = await createVaultApplication({ env: process.env, root });
const server = createServer(app.listener);
server.requestTimeout = 60000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Choose a different PORT.`
    : 'Could not start the local paid-beta server.');
  shutdown(1);
});

const url = `http://127.0.0.1:${port}`;
server.listen(port, '127.0.0.1', () => {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  console.log(`Paid-beta Haiku testnet: ${url}/play`);
  console.log(`Deposit destination (treasury): ${config.asset.destination}`);
  console.log('Browser Top up: send 1 AMZN to treasury on Robinhood testnet; localhost login optional for this proving round. After the send, refresh /play; proving round will pick up player_rh{your address}. Phantom can transfer from any EOA. Sign-in remains optional for this local proving round.');
  console.log('After a recorded win: Send prize from treasury on /play (Phantom as 0xbec4…, chain 0xb626). Do not sign as the x402 operating box. Historical 0.1 AMZN is not a prize.');
  console.log(`CLI faucet address (npm run paid-beta:testnet-deposit only): ${local.depositAddress}`);
  console.log(`Faucet: ${FUNDING_NETWORK.faucetUrl} (AMZN + native gas on chain ${FUNDING_NETWORK.chainId}). This session did not request faucet funds.`);
  console.log(`Ledger: ${fundingDirectory}`);
  console.log(`RPC: ${new URL(process.env.VAULT_FUNDING_RPC_URL).host}`);
  console.log(local.generated ? 'Generated VAULT_TESTNET_DEPOSIT_PRIVATE_KEY into gitignored .env (address only printed).' : 'Reused existing dedicated VAULT_TESTNET_DEPOSIT_PRIVATE_KEY.');
  console.log(`Privy allowed origins for browser sign-in must include http://127.0.0.1:${port} and http://localhost:${port}. This command does not change the Privy dashboard.`);
  console.log(local.privyConfigured
    ? 'Privy is configured locally. Local operator observe is also on for npm run paid-beta:testnet-deposit (no Privy JWT).'
    : 'Privy is not configured. After a 1 AMZN send, refresh /play to pick up player_rh{your address} without Privy. npm run paid-beta:testnet-deposit can still observe a broadcast hash.');
  console.log('No claim key generated: prize from is the disclosed treasury.');
  console.log(app.service.status().paidConfigured
    ? `x402 operating box armed: ${app.payment.address}`
    : 'Laptop x402 stays unarmed for product paidConfigured.');
});

let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await app.close();
    process.exit(exitCode);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown());
