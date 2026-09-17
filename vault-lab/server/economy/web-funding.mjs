import { apiError } from '../errors.mjs';
import { units } from './schema.mjs';
import { FUNDING_NETWORK } from '../../public/funding-network.js';
import { withoutRewriteQuery } from '../vercel-request.mjs';
import { publicFairnessBoard } from './fairness-board.mjs';

// The web integration is deliberately restricted to a separately configured testnet
// ledger. A mainnet launch needs approved economic terms and payout infrastructure.
export function createWebFunding({ economy, deposits, game, authentication, beta, maximumTopup, testnet = false, claims, localOperatorObserve = false }) {
  const { asset } = economy.state();
  if (!testnet || ![FUNDING_NETWORK.chainId, '1337'].includes(asset?.chainId) || !units(maximumTopup)) {
    throw new Error('Web funding currently requires an explicit testnet and top-up limit.');
  }
  const preparations = new Set();
  const access = async headers => {
    const principal = await authentication.authenticate(headers);
    beta?.assertAccess(principal.accountId);
    return principal;
  };
  const present = value => {
    const transfer = value.transfer;
    return { ...value, environment: 'testnet', realFundsEnabled: false,
      ...(transfer ? { transfer: { ...transfer, signingEnabled: Boolean(transfer.transaction),
        reason: transfer.transaction ? null : transfer.reason } } : {}) };
  };
  function configuration() {
    const state = economy.state(), balance = key => state.balances.find(row => row.account === key)?.amount ?? '0';
    return { enabled: true, environment: 'testnet', realFundsEnabled: false, payoutsEnabled: false,
      testnetClaimsEnabled: Boolean(claims), localOperatorObserve: Boolean(localOperatorObserve),
      asset: state.asset, assetHash: state.assetHash, maximumTopup, network: FUNDING_NETWORK,
      custody: 'operator-controlled', evidence: 'operator-recorded-rpc-not-independent-attestation',
      rounds: state.rounds.map(round => {
        const winnerAttempt = state.attempts.find(row => row.round_id === round.id && row.state === 'released');
        return { id: round.id, state: round.state, price: round.price,
          prizeBps: round.prize_bps, operationsBps: round.operations_bps, nextRoundBps: 10000 - round.prize_bps - round.operations_bps,
          winRetainBps: round.win_retain_bps ?? 0, priceStep: round.price_step ?? '0',
          maximumPrice: round.maximum_price, expiresAt: round.expires_at, winner: round.winner ?? null,
          bounty: balance(`round:${round.id}:prize`), prizePayable: balance(`round:${round.id}:payable`),
          prizeRecipient: winnerAttempt?.recipient ?? null,
          manifest: economy.manifest(round.id) };
      }) };
  }
  return {
    configuration,
    async handle(headers, method, path, query, body) {
      query = withoutRewriteQuery(query);
      if (method === 'GET' && path === '/api/funding/config') return configuration();
      if (method === 'GET' && path === '/api/funding/fairness') return { enabled: true, ...publicFairnessBoard(economy) };
      const provingClaim = /^\/api\/funding\/claims\/([a-zA-Z0-9_-]{1,80})(?:\/(prepare|submit|check))?$/.exec(path);
      if (localOperatorObserve && claims && provingClaim && !query.size) {
        if (method === 'GET' && !provingClaim[2]) return claims.getPublic(provingClaim[1]);
        if (method === 'POST' && provingClaim[2] === 'prepare') return claims.preparePublic(provingClaim[1], body ?? {});
      }
      const principal = await access(headers);
      if (principal.localOperatorTreasury) {
        const allowed = /^\/api\/funding\/claims\//.test(path) || /^\/api\/funding\/rounds\/[a-zA-Z0-9_-]{1,80}\/expire$/.test(path);
        if (!allowed) throw apiError(400, 'WALLET_NOT_VERIFIED', 'Treasury local operator is only for prize claims.');
      }
      if (method === 'POST' && ['/api/funding/deposits', '/api/funding/attempts'].includes(path) && beta?.paused?.()) {
        throw apiError(503, 'BETA_PAUSED', 'The beta is paused. Existing deposits and receipts can still be recovered.');
      }
      if (query.size && (path !== '/api/funding/deposits' || method !== 'GET' ||
          [...query.keys()].some(key => key !== 'before') || query.getAll('before').length > 1)) {
        throw apiError(400, 'INVALID_FUNDING_QUERY', 'Only a deposit page cursor is accepted.');
      }
      if (method === 'GET' && path === '/api/funding/account') return game.account(headers);
      if (path === '/api/funding/deposits') {
        if (method === 'GET') {
          const page = await deposits.list(headers, query.has('before') ? { before: query.get('before') } : {});
          return { ...page, deposits: page.deposits.map(present) };
        }
        if (method === 'POST') {
          let amount;
          try { amount = units(body?.amountBaseUnits); } catch {}
          if (!amount || amount > units(maximumTopup)) throw apiError(400, 'TOPUP_LIMIT', 'Choose a positive amount within the published top-up limit.');
          if (preparations.has(principal.accountId) || preparations.size >= 4) throw apiError(429, 'DEPOSIT_PREPARE_BUSY', 'Retry the same top-up reference shortly.');
          preparations.add(principal.accountId);
          try {
            const existing = economy.ledger.deposits.byKey(body.key, principal);
            const page = await deposits.list(headers);
            if (!existing && page.deposits.filter(({ order }) => !order.credited && order.expiresAt >= Date.now()).length >= 5) {
              throw apiError(429, 'PENDING_DEPOSIT_LIMIT', 'Finish an existing top-up before creating another.');
            }
            return present(await deposits.prepare(headers, body));
          } finally { preparations.delete(principal.accountId); }
        }
      }
      const order = /^\/api\/funding\/deposits\/([a-zA-Z0-9_-]{1,80})(?:\/(submit|check))?$/.exec(path);
      if (order) {
        if (method === 'GET' && !order[2]) return present(await deposits.get(headers, order[1]));
        if (method === 'POST' && order[2] === 'submit') return present(await deposits.submit(headers, order[1], body));
        if (method === 'POST' && order[2] === 'check') {
          if (!body || Object.keys(body).length) throw apiError(400, 'INVALID_FUNDING_INPUT', 'Checking accepts no receipt or transaction data.');
          return present(await deposits.check(headers, order[1]));
        }
      }
      if (path === '/api/funding/attempts' && method === 'POST') return game.attempt(headers, body);
      const job = /^\/api\/funding\/attempts\/([a-zA-Z0-9_-]{1,55})(?:\/(reconcile))?$/.exec(path);
      if (job && method === 'GET' && !job[2]) return game.result(headers, job[1]);
      if (job && method === 'POST' && job[2]) {
        if (!body || Object.keys(body).length) throw apiError(400, 'INVALID_FUNDING_INPUT', 'Recovery accepts no replacement prompt.');
        return game.reconcile(headers, job[1]);
      }
      const expire = /^\/api\/funding\/rounds\/([a-zA-Z0-9_-]{1,80})\/expire$/.exec(path);
      if (expire) {
        if (!claims?.expire) throw apiError(405, 'FUNDING_METHOD_NOT_ALLOWED', 'This funding operation is unavailable.');
        if (method === 'POST') return claims.expire(headers, expire[1], body ?? {});
      }
      const claim = /^\/api\/funding\/claims\/([a-zA-Z0-9_-]{1,80})(?:\/(prepare|submit|check))?$/.exec(path);
      if (claim) {
        if (!claims) throw apiError(405, 'FUNDING_METHOD_NOT_ALLOWED', 'This funding operation is unavailable.');
        if (method === 'GET' && !claim[2]) return claims.get(headers, claim[1]);
        if (method === 'POST' && claim[2] === 'prepare') return claims.prepare(headers, claim[1], body ?? {});
        if (method === 'POST' && claim[2] === 'submit') return claims.submit(headers, claim[1], body);
        if (method === 'POST' && claim[2] === 'check') {
          if (!body || Object.keys(body).length) throw apiError(400, 'INVALID_FUNDING_INPUT', 'Checking accepts no receipt or transaction data.');
          return claims.check(headers, claim[1], body);
        }
      }
      throw apiError(405, 'FUNDING_METHOD_NOT_ALLOWED', 'This funding operation is unavailable.');
    }
  };
}
