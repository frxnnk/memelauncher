import { createHash } from 'node:crypto';
import { createLedger } from './ledger.mjs';
import { roundTerms, playerAccount, units } from './schema.mjs';
import { createRoundRegistry } from '../rounds.mjs';
import { verifiedAccountId } from '../principal.mjs';
import { apiError } from '../errors.mjs';

// Server composition only; there is no route enabling real deposits or payments.
export function createAssetEconomy({ path, asset, terms, env, now, unsignedLifetimeMs } = {}) {
  if (!asset) throw new Error('An explicit asset is required for account-credit gameplay.');
  const pricing = roundTerms(terms), ledger = createLedger({ path, asset, env, now, unsignedLifetimeMs });
  const staircase = {
    ...(terms?.winRetainBps != null ? { winRetainBps: terms.winRetainBps } : {}),
    ...(terms?.priceStep != null ? { priceStep: terms.priceStep } : {}),
    ...(terms?.maximumPrice != null ? { maximumPrice: terms.maximumPrice } : {}),
    ...(terms?.durationMonths != null ? { durationMonths: terms.durationMonths } : {})
  };
  const { unit, assetHash, instanceId } = ledger.snapshot();
  if (!assetHash) { ledger.close(); throw new Error('An explicit asset is required for account-credit gameplay.'); }
  let rounds;
  try { rounds = createRoundRegistry({ path, accounting: { unit, assetHash, ...pricing }, env }); }
  catch (error) { ledger.close(); throw error; }
  function openRound(roundId, models) {
    const manifest = rounds.freeze(roundId, models);
    const retireKey = createHash('sha256').update(JSON.stringify(manifest.manifest.configuration.guardians.map(g => g.modelId))).digest('hex');
    return ledger.execute('round-' + createHash('sha256').update(roundId).digest('hex'), { type: 'open-round', roundId,
      price: pricing.price, prizeBps: pricing.prizeBps, operationsBps: pricing.operationsBps, configuration: manifest.hash,
      retireKey, ...staircase });
  }
  const state = () => ledger.snapshot();
  function assertModel(roundId, modelId) {
    const manifest = rounds.assertCurrent(roundId, modelId), round = state().rounds.find(row => row.id === roundId);
    const price = units(round?.price ?? '0'), floor = units(pricing.price);
    const ceiling = units(staircase.maximumPrice ?? pricing.price);
    if (!round || round.configuration !== manifest.hash ||
        round.prize_bps !== pricing.prizeBps || round.operations_bps !== pricing.operationsBps ||
        price < floor || price > ceiling) {
      throw apiError(409, 'ROUND_MANIFEST_INVALID', 'The accounting round does not match its frozen terms.');
    }
    return manifest;
  }
  function account(principal) {
    const owner = verifiedAccountId(principal), snapshot = state();
    const balance = bucket => snapshot.balances.find(row => row.account === playerAccount(owner, bucket))?.amount ?? '0';
    return { unit, available: balance('available'), reserved: balance('reserved'), realFunds: false,
      accountingMode: 'rpc-credit-preparation', spendingPaused: Boolean(snapshot.depositHolds.length),
      attempts: snapshot.attempts.filter(row => row.player === owner),
      prizes: snapshot.rounds.filter(row => row.winner === owner).map(round => ({ roundId: round.id, state: round.state,
        payable: snapshot.balances.find(row => row.account === 'round:' + round.id + ':payable')?.amount ?? '0',
        recipient: snapshot.attempts.find(attempt => attempt.round_id === round.id && attempt.state === 'released')?.recipient ?? null })) };
  }
  return { ledger, state, account, openRound, assertModel, manifest: rounds.get,
    sessionRound: roundId => 'credit-' + createHash('sha256').update(instanceId + '\0' + roundId).digest('hex'),
    export: () => ({ ...ledger.exportAll(), roundManifests: state().rounds.map(round => rounds.get(round.id)).filter(Boolean) }),
    close: () => { rounds.close(); ledger.close(); } };
}
