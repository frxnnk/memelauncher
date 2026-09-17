import { join, isAbsolute } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { createVaultService } from './service.mjs';
import { createRequestListener } from './http.mjs';
import { createEconomyService } from './economy/service.mjs';
import { createCreditGame } from './economy/model-game.mjs';
import { createAuthentication } from './auth.mjs';
import { runtimeConfiguration } from './runtime.mjs';
import { createInferenceLimits } from './limits.mjs';
import { validateKeyBudget } from './key-budget.mjs';
import { fetchJson } from './errors.mjs';
import { createTelegramApi, startTelegram } from './telegram.mjs';
import { createTelegramStore } from './telegram-store.mjs';
import { createBetaAccess } from './beta-access.mjs';
import { startWebFunding } from './economy/web-funding-runtime.mjs';
import { createLiveX402Payer, createLaptopRehearsalPayer } from './x402-payer.mjs';
import { localOperatorEnabled, wrapLocalOperatorAuth } from './local-operator.mjs';
import { hostingTopology, resolveDataDirectory } from './hosting.mjs';
import { durableStore } from './storage/database.mjs';
import { FUNDING_NETWORK } from '../public/funding-network.js';

export function resolveWebFundingRpc(env = {}) {
  const configured = env.VAULT_FUNDING_RPC_URL?.trim();
  return configured || FUNDING_NETWORK.rpcUrl;
}

function paidBetaConfig(configPath) {
  if (!configPath) return false;
  return JSON.parse(readFileSync(configPath, 'utf8')).policy === 'paid-beta';
}

export function resolveFundingConfigPath(root, configPath) {
  if (typeof configPath !== 'string') return configPath;
  const trimmed = configPath.trim();
  if (!trimmed) return trimmed;
  return isAbsolute(trimmed) ? trimmed : join(root, trimmed);
}

export function resolveWebFundingDirectory({ env = {}, dataRoot, configPath, hosting } = {}) {
  const explicit = env.VAULT_FUNDING_DATA_DIRECTORY?.trim();
  const paidBeta = paidBetaConfig(configPath);
  const topology = hosting ?? hostingTopology(env);
  const directory = explicit
    ? (isAbsolute(explicit) ? explicit : join(dataRoot, explicit))
    : join(dataRoot, (paidBeta || durableStore(env).enabled || topology.name === 'vercel') ? 'web-funding-paid-beta' : 'web-funding-testnet');
  if ((paidBeta || topology.name === 'vercel') && /web-funding-testnet|rh-test-amzn/i.test(String(directory).replaceAll('\\', '/'))) {
    throw new Error('Paid-beta funding cannot use the AMZN rehearsal ledger. Use web-funding-paid-beta.');
  }
  return directory;
}

export function assertVercelFundingRuntime({ runtime, hosting, env = {}, payment } = {}) {
  if (hosting?.name !== 'vercel' || !env.VAULT_WEB_FUNDING_CONFIG) return;
  if (hosting.ephemeralData || env.VAULT_DURABLE_DATA !== 'true') {
    throw new Error('Vercel web funding requires VAULT_DURABLE_DATA=true and Turso. SQLite on /tmp is not a ledger.');
  }
  const remote = durableStore(env);
  if (remote.driver !== 'libsql') {
    throw new Error('Vercel durable data cannot use a memory: libsql URL. Use a remote Turso database.');
  }
  if (!payment || payment.kind === 'laptop-rehearsal') {
    throw new Error('Vercel paid funding requires VAULT_X402_PRIVATE_KEY for product box 0xf670531e46ba92f49c5d9c11d2c03875cffe7d40.');
  }
  if (runtime?.mode === 'local') {
    throw new Error('Vercel web funding requires VAULT_ACCESS_MODE=public-practice.');
  }
  if (env.VAULT_LOCAL_TESTNET_OBSERVE === 'true') {
    throw new Error('VAULT_LOCAL_TESTNET_OBSERVE cannot be enabled on Vercel.');
  }
}

export function assertWebFundingAllowed(runtime, env = {}) {
  if (!env.VAULT_WEB_FUNDING_CONFIG) return;
  if (env.VAULT_TELEGRAM_ENABLED === 'true') throw new Error('Testnet funding requires Telegram disabled.');
  if (runtime.mode === 'public-practice' && !runtime.closedBeta) {
    throw new Error('Testnet funding requires a closed web beta with Telegram disabled.');
  }
}

export async function createVaultApplication({ env = process.env, root, fetchImpl = fetch } = {}) {
  if (typeof root !== 'string' || !root) throw new Error('An application root directory is required.');
  const runtime = runtimeConfiguration(env);
  const hosting = hostingTopology(env);
  if (env.VAULT_DURABLE_DATA === 'true') durableStore(env);
  const dataRoot = resolveDataDirectory(root, env);
  const telegramEnabled = env.VAULT_TELEGRAM_ENABLED === 'true';
  if (telegramEnabled && runtime.mode !== 'public-practice') throw new Error('Telegram requires public-practice mode so web and bot share persistent usage limits.');
  if (telegramEnabled && runtime.closedBeta) throw new Error('Telegram is disabled for the web closed beta until bot admission is implemented.');
  if (telegramEnabled && hosting.name === 'vercel') throw new Error('Telegram polling cannot run inside a Vercel function.');
  const productPayment = createLiveX402Payer(env);
  const payment = productPayment
    ?? (localOperatorEnabled(runtime, hosting, env) ? createLaptopRehearsalPayer(env) : null);
  assertVercelFundingRuntime({ runtime, hosting, env, payment });
  mkdirSync(dataRoot, { recursive: true });
  const fundingConfigPath = env.VAULT_WEB_FUNDING_CONFIG
    ? resolveFundingConfigPath(root, env.VAULT_WEB_FUNDING_CONFIG)
    : null;
  const service = createVaultService({
    apiKey: env.OPENROUTER_API_KEY || '', payment, logDir: dataRoot, sessionsPath: join(dataRoot, 'sessions.sqlite'), env
  });
  // Sandbox ledgers stay on local sqlite even when Turso is on: they share table
  // names with the funding ledger and must not share that remote schema.
  const economy = createEconomyService({ path: join(dataRoot, 'economy-sandbox.sqlite'), env });
  const creditGame = createCreditGame({ path: join(dataRoot, 'model-jobs.sqlite'), economy, vault: service, env });
  const authentication = wrapLocalOperatorAuth(createAuthentication({ appId: env.PRIVY_APP_ID, clientId: env.PRIVY_CLIENT_ID,
    verificationKey: env.PRIVY_VERIFICATION_KEY?.replaceAll('\\n', '\n') }), { runtime, hosting, env });
  let limits;
  if (runtime.mode === 'public-practice') {
    if (!authentication.configured || !env.OPENROUTER_API_KEY) throw new Error('Public practice requires Privy configuration and a dedicated limited API key.');
    const x402Armed = Boolean(payment) && payment.kind !== 'laptop-rehearsal';
    if (!x402Armed) {
      try {
        const keyInfo = await fetchJson(fetchImpl, 'https://openrouter.ai/api/v1/key', {
          headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }
        }, 15000);
        validateKeyBudget(keyInfo.data, runtime.budgetUsd);
      } catch { throw new Error('Public practice cannot start: the provider key budget could not be verified. No inference was requested.'); }
    }
    limits = createInferenceLimits({ path: join(dataRoot, 'usage.sqlite'), env, ...runtime });
  } else if (fundingConfigPath) {
    limits = createInferenceLimits({ path: join(dataRoot, 'usage.sqlite'), env, ...runtime });
  }
  const beta = runtime.closedBeta ? createBetaAccess({ path: join(dataRoot, 'beta.sqlite'), publicAdmission: runtime.publicAdmission, env }) : undefined;
  assertWebFundingAllowed(runtime, env);
  const fundingDirectory = fundingConfigPath
    ? resolveWebFundingDirectory({ env, dataRoot, configPath: fundingConfigPath, hosting })
    : null;
  const webFunding = fundingConfigPath ? await startWebFunding({
    configPath: fundingConfigPath, dataDirectory: fundingDirectory,
    authentication, limits, vault: service, beta, rpcUrl: resolveWebFundingRpc(env),
    fetchImpl, hosting, env, runtime
  }) : null;
  let telegram, telegramStore;
  if (telegramEnabled) {
    telegramStore = createTelegramStore(join(dataRoot, 'telegram.sqlite'));
    telegram = await startTelegram({ api: createTelegramApi({ token: env.TELEGRAM_BOT_TOKEN }),
      vault: service, limits, store: telegramStore, defaultModel: env.TELEGRAM_MODEL_ID || 'google/gemini-2.5-flash', onWarning: console.warn });
  }
  const listener = createRequestListener({ service, economy, creditGame, authentication, limits, beta, runtime,
    funding: webFunding?.funding, creditHistory: webFunding?.creditHistory,
    channels: () => ({ telegram: telegram?.state ?? { enabled: false } }), publicDir: join(root, 'public') });
  return {
    listener, hosting, runtime, service, payment, webFunding,
    async close() {
      await telegram?.stop(); telegramStore?.close(); await webFunding?.close();
      beta?.close(); limits?.close(); service.close(); creditGame.close(); economy.close();
    }
  };
}
