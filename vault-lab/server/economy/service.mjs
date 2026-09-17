import { apiError } from '../errors.mjs';
import { createLedger } from './ledger.mjs';
import { createRoundRegistry } from '../rounds.mjs';

const PLAYER = 'local-demo';
const fields = {
  topup: ['amount'], refund: ['amount'], seed: ['roundId', 'amount'], sponsor: ['roundId', 'amount'],
  'creator-fees': ['roundId', 'amount'], reserve: ['roundId'], start: ['attemptId'],
  locked: ['attemptId'], released: ['attemptId'], error: ['attemptId'], unknown: ['attemptId'],
  cancel: ['attemptId'], payout: ['roundId'], 'new-round': [], 'use-reserve': ['roundId', 'amount'],
  'reconcile-locked': ['attemptId'], 'reconcile-released': ['attemptId'], 'reconcile-error': ['attemptId']
};

export function createEconomyService({ path, env } = {}) {
  const ledger = createLedger({ path, env });
  const rounds = createRoundRegistry({ path, env });
  const opening = roundId => ({ type: 'open-round', roundId, price: '100', prizeBps: 7000, operationsBps: 2000, configuration: rounds.freeze(roundId).hash });
  // Existing ledgers retain their original rules and references. Do not retrofit
  // an immutable manifest onto a round that was already opened without one.
  if (!ledger.snapshot().rounds.length) ledger.execute('initial-round-v2', opening('round-1'));
  const state = () => { const snapshot = ledger.snapshot(); return { ...snapshot, player: PLAYER, sharedLocalSandbox: true,
    roundManifests: snapshot.rounds.map(round => rounds.get(round.id)).filter(Boolean),
    policy: { attemptPrice: '100', prizeBps: 7000, operationsBps: 2000, nextRoundBps: 1000,
      splitStatus: 'illustrative-not-adopted', walletAuthentication: false, paymentsConfigured: false } }; };

  function action(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(fields, input.action) ||
      typeof input.key !== 'string' || !/^[a-zA-Z0-9_-]{1,55}$/.test(input.key) ||
      Object.keys(input).some(k => !['key', 'action', ...fields[input.action]].includes(k))) {
      throw apiError(400, 'INVALID_SANDBOX_ACTION', 'Choose a valid accounting sandbox action.');
    }
    if (fields[input.action].some(field => typeof input[field] !== 'string')) {
      throw apiError(400, 'INVALID_SANDBOX_ACTION', 'Accounting amounts and identifiers must be strings.');
    }
    const { key, action: name, roundId, amount, attemptId } = input;
    if (attemptId?.startsWith('model-')) throw apiError(409, 'MODEL_ATTEMPT_PROTECTED', 'Model-linked attempts are settled from their API receipts, not manual simulation controls.');
    const execute = request => ledger.execute(key, request);
    let result;
    try {
      if (name === 'topup') result = execute({ type: 'topup', player: PLAYER, amount });
      else if (name === 'refund') result = execute({ type: 'refund-credits', player: PLAYER, amount });
      else if (['seed', 'sponsor', 'creator-fees'].includes(name)) result = execute({ type: 'contribution', source: name, roundId, amount, received: true });
      else if (name === 'reserve') result = execute({ type: 'reserve', player: PLAYER, roundId, attemptId: `attempt-${key}` });
      else if (name === 'new-round') result = execute(opening(`round-${key}`));
      else if (name === 'use-reserve') result = execute({ type: 'seed-next-round', roundId, amount });
      else if (name === 'payout') result = execute({ type: 'payout', roundId });
      else if (name === 'cancel') result = execute({ type: 'cancel-reservation', attemptId });
      else if (['start', 'unknown'].includes(name)) result = execute({ type: name, attemptId });
      else {
        const a = ledger.snapshot().attempts.find(row => row.id === attemptId);
        if (a?.state === 'reserved') ledger.execute(`${key}-start`, { type: 'start', attemptId });
        result = execute({ type: 'settle', attemptId, outcome: name.replace('reconcile-', ''),
          receiptRef: `simulation-${key}`, reconciled: name.startsWith('reconcile-') });
      }
    } catch (error) {
      const message = error.code?.startsWith('ERR_SQLITE') ? 'This simulation record already exists or the ledger is busy.' : error.message;
      throw apiError(409, 'SANDBOX_ACTION_REJECTED', message || 'The sandbox could not complete that action.');
    }
    return { result, state: state() };
  }
  const assertModel = (roundId, modelId) => {
    const manifest = rounds.assertCurrent(roundId, modelId);
    const round = ledger.snapshot().rounds.find(row => row.id === roundId);
    if (!round || round.configuration !== manifest.hash) throw apiError(409, 'ROUND_MANIFEST_INVALID', 'The ledger does not reference this round manifest.');
    return manifest;
  };
  return { state, action, ledger, assertModel,
    export: () => ({ ...ledger.exportAll(), player: PLAYER, sharedLocalSandbox: true, roundManifests: state().roundManifests }),
    close: () => { rounds.close(); ledger.close(); } };
}
