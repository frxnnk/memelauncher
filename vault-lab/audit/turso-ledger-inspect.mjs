import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, resetDurableBackends, durableStore } from '../server/storage/database.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = value;
  }
  return out;
}

const fileEnv = existsSync(join(root, '.env')) ? parseEnv(readFileSync(join(root, '.env'), 'utf8')) : {};
const env = {
  ...fileEnv,
  VAULT_DURABLE_DATA: 'true',
  ...(process.env.VAULT_LIBSQL_URL ? { VAULT_LIBSQL_URL: process.env.VAULT_LIBSQL_URL } : {}),
  ...(process.env.VAULT_LIBSQL_AUTH_TOKEN ? { VAULT_LIBSQL_AUTH_TOKEN: process.env.VAULT_LIBSQL_AUTH_TOKEN } : {})
};
delete env.VAULT_LOCAL_TESTNET_OBSERVE;

const remote = durableStore(env);
if (remote.driver !== 'libsql') throw new Error('Expected remote libsql.');
const host = new URL(remote.url).host;
const db = openDatabase(join(root, 'data', 'web-funding-paid-beta', 'credits.sqlite'), env);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => row.name);
const settings = tables.includes('ledger_settings')
  ? db.prepare('SELECT document FROM ledger_settings WHERE id=1').get()
  : null;
let asset = null;
if (settings?.document) {
  const parsed = JSON.parse(settings.document);
  asset = {
    mode: parsed.mode,
    chainId: parsed.asset?.chainId ?? null,
    tokenAddress: parsed.asset?.tokenAddress ?? null,
    destination: parsed.asset?.destination ?? null,
    decimals: parsed.asset?.decimals ?? null
  };
}
const count = name => (tables.includes(name)
  ? db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n
  : 0);
const balanceRows = tables.includes('balances')
  ? db.prepare('SELECT account, amount FROM balances ORDER BY account').all()
  : [];
  const roundRows = tables.includes('rounds')
  ? db.prepare('SELECT id, state, price, seed_amount, player_prize_amount FROM rounds').all()
  : [];
const inviteRows = tables.includes('beta_invites')
  ? db.prepare('SELECT id, label, revoked, owner IS NOT NULL AS claimed FROM beta_invites').all()
  : [];
const depositSummaries = tables.includes('deposit_orders')
  ? db.prepare('SELECT id, document FROM deposit_orders ORDER BY rowid').all().map(row => {
      const order = JSON.parse(row.document);
      const owner = typeof order.owner === 'string' ? order.owner : '';
      return {
        id: order.id,
        state: order.state,
        credited: Boolean(order.credited),
        ownerPrefix: owner.length >= 10 ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : null,
        minimumReceived: order.minimumReceived,
        createdAt: Number.isSafeInteger(order.createdAt) ? new Date(order.createdAt).toISOString() : null,
        expiresAt: Number.isSafeInteger(order.expiresAt) ? new Date(order.expiresAt).toISOString() : null,
        expired: Number.isSafeInteger(order.expiresAt) ? Date.now() > order.expiresAt : null,
        hasSubmittedHash: Boolean(order.submittedTransactionHash),
        hasTransactionHash: Boolean(order.transactionHash),
        hashRecorded: Boolean(order.transactionHash || order.submittedTransactionHash)
      };
    })
  : [];
function playerPrefix(player) {
  if (typeof player !== 'string') return null;
  if (/^0x[0-9a-f]{40}$/i.test(player)) return `${player.slice(0, 6)}…${player.slice(-4)}`;
  if (player.startsWith('player_') && player.length > 16) return `${player.slice(0, 14)}…`;
  return player.length > 12 ? `${player.slice(0, 8)}…` : player;
}

const attemptRows = tables.includes('attempts')
  ? db.prepare('SELECT id, round_id, player, state, price, receipt_ref FROM attempts ORDER BY position').all().map(row => ({
      idPrefix: typeof row.id === 'string' && row.id.length > 16 ? `${row.id.slice(0, 18)}…` : row.id,
      roundId: row.round_id,
      playerPrefix: playerPrefix(row.player),
      state: row.state,
      price: row.price,
      hasReceipt: Boolean(row.receipt_ref)
    }))
  : [];

const modelJobSummaries = tables.includes('model_jobs')
  ? db.prepare('SELECT key, state, request, outcome FROM model_jobs ORDER BY created_at').all().map(row => {
      let request = {};
      try { request = JSON.parse(row.request || '{}'); } catch { request = {}; }
      let outcome = null;
      try { outcome = row.outcome ? JSON.parse(row.outcome) : null; } catch { outcome = { parseError: true }; }
      const value = outcome?.value ?? {};
      const accounting = outcome?.accounting ?? value?.receipt?.accounting ?? null;
      const receipt = value?.receipt ?? outcome?.receipt ?? null;
      return {
        state: row.state,
        modelId: request.modelId ?? null,
        roundId: request.roundId ?? null,
        creditMode: request.creditMode ?? null,
        hasPrompt: typeof request.prompt === 'string' && request.prompt.length > 0,
        ok: outcome?.ok ?? null,
        decision: value.decision ?? null,
        receiptMode: receipt?.mode ?? null,
        receiptBilling: receipt?.billing ?? receipt?.usage?.source ?? null,
        prizeContribution: accounting?.prizeContribution ?? null,
        operationsContribution: accounting?.operationsContribution ?? null,
        creditsConsumed: accounting?.creditsConsumed ?? null,
        creditsReturned: accounting?.creditsReturned ?? null,
        status: accounting?.status ?? null
      };
    })
  : [];

const receiptSummaries = tables.includes('vault_receipts')
  ? db.prepare('SELECT document FROM vault_receipts ORDER BY sequence').all().map(row => {
      let receipt = {};
      try { receipt = JSON.parse(row.document || '{}'); } catch { receipt = {}; }
      return {
        modelId: receipt.modelId ?? receipt.model?.id ?? null,
        mode: receipt.mode ?? null,
        billing: receipt.billing ?? receipt.usage?.source ?? null,
        decision: receipt.decision ?? null,
        status: receipt.status ?? null,
        bountyEnabled: receipt.bountyEnabled ?? null
      };
    })
  : [];

const report = {
  libsqlHost: host,
  matchesTursoDevDb: host.includes('vault-paid-beta-dev'),
  productionDb: host.startsWith('vault-paid-beta-') && !host.includes('dev'),
  driver: remote.driver,
  tables,
  asset,
  balances: count('balances'),
  balanceRows,
  roundRows,
  depositOrders: count('deposit_orders'),
  depositSummaries,
  attempts: count('attempts'),
  attemptRows,
  modelJobSummaries,
  receiptSummaries,
  events: count('events'),
  rounds: count('rounds'),
  payoutClaims: count('payout_claims'),
  invites: inviteRows.map(row => ({
    id: row.id, label: row.label, revoked: row.revoked, claimed: Boolean(row.claimed)
  })),
  keysPrinted: false
};
resetDurableBackends();
console.log(JSON.stringify(report, null, 2));
