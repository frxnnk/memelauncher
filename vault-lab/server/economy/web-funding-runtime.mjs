import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createAssetEconomy } from './asset-service.mjs';
import { createAuthenticatedDeposits } from './authenticated-deposits.mjs';
import { createAuthenticatedCreditGame } from './authenticated-game.mjs';
import { createDepositReader } from './deposit-rpc.mjs';
import { createDepositMonitor } from './deposit-monitor.mjs';
import { createCreditHistory } from './credit-history.mjs';
import { createWebFunding } from './web-funding.mjs';
import { units, roundTerms, id } from './schema.mjs';
import { validateDepositAsset } from './deposit.mjs';
import { FUNDING_NETWORK } from '../../public/funding-network.js';
import { applyPaidBetaFundingConfig } from './paid-beta-policy.mjs';
import { createAuthenticatedClaims } from './authenticated-claims.mjs';
import { hostingTopology } from '../hosting.mjs';
import { localOperatorEnabled } from '../local-operator.mjs';
import { createInboundObserver } from './inbound-observe.mjs';
import { provingAutoplayEnabled, createProvingAutoplay } from './proving-autoplay.mjs';
import { unsignedDepositLifetimeMs } from './deposit-orders.mjs';

function testnetProvingPrices(config) {
  if (config?.policy !== 'paid-beta' || config?.environment !== 'testnet' || !config.terms) return null;
  const proving = {};
  for (const key of ['price', 'priceStep', 'maximumPrice']) {
    if (config.terms[key] != null) proving[key] = String(config.terms[key]);
  }
  return Object.keys(proving).length ? proving : null;
}

export function validateWebFundingConfiguration(config) {
  const proving = testnetProvingPrices(config);
  if (proving) {
    const rest = { ...config.terms };
    for (const key of Object.keys(proving)) delete rest[key];
    config = applyPaidBetaFundingConfig({ ...config, terms: rest });
    config = { ...config, terms: { ...config.terms, ...proving } };
  } else {
    config = applyPaidBetaFundingConfig(config);
  }
  if (!config || config.environment !== 'testnet') throw new Error('Only testnet web funding is implemented.');
  const asset = validateDepositAsset(config.asset);
  if (asset.chainId !== FUNDING_NETWORK.chainId) throw new Error('The web rehearsal uses Robinhood Chain Testnet. Mainnet funding is disabled.');
  if (!units(config.maximumTopup) || !Array.isArray(config.rounds) || !config.rounds.length || config.rounds.length > 3) throw new Error('Explicit top-up limit and rounds are required.');
  const terms = roundTerms(config.terms);
  if (units(terms.price) > units(config.maximumTopup)) throw new Error('The attempt price exceeds the top-up limit.');
  const paidBeta = {};
  for (const key of ['winRetainBps', 'priceStep', 'maximumPrice', 'durationMonths']) {
    if (config.terms[key] != null) paidBeta[key] = config.terms[key];
  }
  if (paidBeta.winRetainBps != null && (!Number.isInteger(paidBeta.winRetainBps) || paidBeta.winRetainBps < 0 || paidBeta.winRetainBps > 10000)) {
    throw new Error('Invalid win retain split.');
  }
  if (paidBeta.priceStep != null) units(paidBeta.priceStep);
  if (paidBeta.maximumPrice != null && units(paidBeta.maximumPrice) < units(terms.price)) {
    throw new Error('The price ceiling must be at least the opening price.');
  }
  if (paidBeta.durationMonths != null && (!Number.isInteger(paidBeta.durationMonths) || paidBeta.durationMonths < 1 || paidBeta.durationMonths > 120)) {
    throw new Error('A paid round duration is a positive month count.');
  }
  const roundIds = new Set();
  for (const round of config.rounds) {
    id(round.id);
    if (roundIds.has(round.id) || !Array.isArray(round.models) || round.models.length !== 1) throw new Error('Each funding round must have one guardian and a unique ID.');
    roundIds.add(round.id);
  }
  return { ...config, asset, terms: { ...terms, ...paidBeta } };
}

export function assertLedgerMatchesFundingTerms(economy, terms) {
  const pricing = roundTerms(terms);
  const retain = terms.winRetainBps ?? 0;
  const step = String(terms.priceStep ?? '0');
  for (const round of economy.state().rounds) {
    if (round.prize_bps !== pricing.prizeBps || round.operations_bps !== pricing.operationsBps ||
        (round.win_retain_bps ?? 0) !== retain || String(round.price_step ?? '0') !== step) {
      throw new Error('This ledger already records different round terms. Use a new data directory for paid-beta; do not point it at the live rehearsal ledger.');
    }
  }
}

export async function startWebFunding({ configPath, dataDirectory, authentication, limits, vault, beta, rpcUrl, fetchImpl, hosting = hostingTopology(), env = process.env, runtime = {} }) {
  if (hosting.name === 'vercel' && hosting.ephemeralData) {
    throw new Error('Vercel web funding requires VAULT_DURABLE_DATA=true and Turso. SQLite on /tmp is not a ledger.');
  }
  const config = validateWebFundingConfiguration(JSON.parse(readFileSync(configPath, 'utf8')));
  const endpoint = rpcUrl?.trim() || FUNDING_NETWORK.rpcUrl;
  const reader = createDepositReader({ rpcUrl: endpoint, expectedChainId: config.asset.chainId, asset: config.asset, ...(fetchImpl ? { fetchImpl } : {}) });
  await reader.head(); // Fail startup before accepting top-ups on the wrong network.
  mkdirSync(dataDirectory, { recursive: true });
  const observe = localOperatorEnabled(runtime, hosting, env);
  let economy, monitor, game, inbound;
  try {
    economy = createAssetEconomy({ path: join(dataDirectory, 'credits.sqlite'), asset: config.asset, terms: config.terms, env,
      unsignedLifetimeMs: unsignedDepositLifetimeMs(config) });
    assertLedgerMatchesFundingTerms(economy, config.terms);
    for (const round of config.rounds) economy.openRound(round.id, round.models);
    monitor = createDepositMonitor({ economy, reader, policy: { batchSize: 20, intervalMs: 15000, maxAgeMs: 120000 } });
    await monitor.runBatch();
    // Funded attempts pay their own inference from the operating box. Without one they fall back to the provider key.
    const vaultStatus = vault.status?.() ?? {};
    const billing = vaultStatus.paidConfigured || vaultStatus.localRehearsalPayer ? 'x402' : null;
    game = createAuthenticatedCreditGame({ path: join(dataDirectory, 'jobs.sqlite'), economy, authentication, limits, vault, depositMonitor: monitor, billing, env });
    const autoplay = createProvingAutoplay({
      enabled: provingAutoplayEnabled({ runtime, hosting, env, vault }),
      game, roundId: config.rounds[0].id, modelId: config.rounds[0].models[0]
    });
    inbound = createInboundObserver({
      economy, reader, amount: config.terms.price, enabled: observe, onCredited: autoplay.play
    });
    if (inbound) try { await inbound.sweep(); } catch { /* Retry on the timer or next local funding request. */ }
    if (hosting.backgroundTimers) {
      monitor.start();
      inbound?.start();
    }
    const deposits = createAuthenticatedDeposits({ economy, authentication, reader });
    const claims = createAuthenticatedClaims({ economy, authentication, reader });
    const funding = createWebFunding({ economy, deposits, game, authentication, beta, claims, maximumTopup: config.maximumTopup, testnet: true, localOperatorObserve: observe });
    if (!hosting.backgroundTimers) {
      const handle = funding.handle.bind(funding);
      funding.handle = async (headers, method, path, query, body) => {
        if (inbound) try { await inbound.sweep(); } catch { /* Keep serving config; credit retries on the next request. */ }
        if (!(method === 'GET' && path === '/api/funding/config') && !monitor.status().fresh) await monitor.runBatch();
        return handle(headers, method, path, query, body);
      };
    }
    return { billing, funding, economy, inboundObserve: inbound, backgroundTimers: hosting.backgroundTimers,
      creditHistory: createCreditHistory({ game, deposits }),
      async close() { await inbound?.close(); await monitor.close(); game.close(); economy.close(); } };
  } catch (error) { await inbound?.close(); await monitor?.close(); game?.close(); economy?.close(); throw error; }
}
