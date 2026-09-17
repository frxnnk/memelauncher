import { id, units, playerAccount, roundAccount, PENDING, roundTerms, splitAttemptPrice } from './schema.mjs';
import { addCalendarMonths, expireDistribution, splitWinPrize } from './paid-beta-policy.mjs';

export function applyOperation(db, balances, request, now = () => new Date().toISOString()) {
  const clock = typeof now === 'function' ? now() : now;
  const { get, add, move } = balances;
  const positive = value => { const n = units(value); if (!n) throw new Error('Amount must be positive.'); return n; };
  const round = value => {
    const row = db.prepare('SELECT * FROM rounds WHERE id = ?').get(id(value));
    if (!row) throw new Error('Round not found.');
    return row;
  };
  const attempt = value => {
    const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id(value));
    if (!row) throw new Error('Attempt not found.');
    return row;
  };
  const changeAttempt = (a, state, reference = null) => db.prepare('UPDATE attempts SET state = ?, receipt_ref = ? WHERE id = ?').run(state, reference, a.id);
  const firstPending = roundId => db.prepare("SELECT * FROM attempts WHERE round_id = ? AND state IN ('reserved','processing','unknown') ORDER BY position LIMIT 1").get(roundId);
  const refund = a => {
    move(playerAccount(a.player, 'reserved'), playerAccount(a.player, 'available'), units(a.price));
    changeAttempt(a, 'cancelled');
  };
  const reachedExpiry = row => row.expires_at && new Date(clock).getTime() >= new Date(row.expires_at).getTime();
  const assertOpenForPlay = (row, closedMessage) => {
    if (row.state !== 'open') throw new Error(closedMessage);
    if (reachedExpiry(row)) throw new Error('This round has reached its expiry.');
  };

  if (request.type === 'open-round') {
    id(request.roundId);
    const { price, prizeBps, operationsBps } = roundTerms(request);
    if (typeof request.configuration !== 'string' || !request.configuration.trim() || request.configuration.length > 200) throw new Error('A public configuration reference is required.');
    const retireKey = request.retireKey ?? request.configuration;
    if (typeof retireKey !== 'string' || !retireKey.trim() || retireKey.length > 200) throw new Error('A public configuration reference is required.');
    if (db.prepare('SELECT configuration FROM retired_configurations WHERE configuration = ?').get(retireKey)) {
      throw new Error('This guardian configuration is retired and cannot open another paid round.');
    }
    const winRetainBps = request.winRetainBps ?? 0;
    if (!Number.isInteger(winRetainBps) || winRetainBps < 0 || winRetainBps > 10000) throw new Error('Invalid win retain split.');
    const priceStep = request.priceStep ?? '0';
    units(priceStep);
    const maximumPrice = request.maximumPrice ?? String(price);
    if (units(maximumPrice) < units(price)) throw new Error('The price ceiling must be at least the opening price.');
    let expiresAt = null;
    if (request.durationMonths != null) {
      if (!Number.isInteger(request.durationMonths) || request.durationMonths < 1 || request.durationMonths > 120) {
        throw new Error('A paid round duration is a positive month count.');
      }
      expiresAt = addCalendarMonths(clock, request.durationMonths);
    }
    db.prepare(`INSERT INTO rounds(id,state,price,prize_bps,operations_bps,configuration,win_retain_bps,price_step,maximum_price,opened_at,expires_at,retire_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(request.roundId, 'open', String(price), prizeBps, operationsBps, request.configuration, winRetainBps, priceStep, maximumPrice, clock, expiresAt, retireKey);
    return { roundId: request.roundId, state: 'open', expiresAt };
  }
  if (request.type === 'topup') {
    const amount = positive(request.amount);
    add('custody', amount); add(playerAccount(request.player, 'available'), amount);
    return { player: request.player, received: String(amount), source: 'simulated-topup' };
  }
  if (request.type === 'refund-credits') {
    const amount = positive(request.amount);
    add(playerAccount(request.player, 'available'), -amount); add('custody', -amount);
    return { player: request.player, refunded: String(amount), source: 'simulated-refund' };
  }
  if (request.type === 'contribution') {
    const r = round(request.roundId);
    assertOpenForPlay(r, 'Contributions require an open round.');
    if (!['seed', 'sponsor', 'creator-fees'].includes(request.source)) throw new Error('Unknown contribution source.');
    if (request.received !== true) throw new Error('An estimate or promised contribution is not received funds.');
    const amount = positive(request.amount);
    add('custody', amount); add(roundAccount(r.id, 'prize'), amount);
    if (request.source === 'seed') {
      db.prepare('UPDATE rounds SET seed_amount = ? WHERE id = ?').run(String(units(r.seed_amount ?? '0') + amount), r.id);
    }
    return { roundId: r.id, received: String(amount), source: request.source };
  }
  if (request.type === 'seed-next-round') {
    const r = round(request.roundId);
    assertOpenForPlay(r, 'Seed requires an open round.');
    const amount = positive(request.amount);
    move('treasury:next', roundAccount(r.id, 'prize'), amount);
    return { roundId: r.id, assigned: String(amount), source: 'next-round-reserve' };
  }
  if (request.type === 'reserve') {
    const r = round(request.roundId);
    assertOpenForPlay(r, 'This round no longer accepts attempts.');
    id(request.attemptId); id(request.player);
    move(playerAccount(request.player, 'available'), playerAccount(request.player, 'reserved'), units(r.price));
    db.prepare('INSERT INTO attempts(id,round_id,player,state,price) VALUES (?, ?, ?, ?, ?)').run(request.attemptId, r.id, request.player, 'reserved', r.price);
    return { attemptId: request.attemptId, state: 'reserved', price: r.price };
  }
  if (request.type === 'start') {
    const a = attempt(request.attemptId);
    const r = round(a.round_id);
    if (a.state !== 'reserved' || firstPending(a.round_id)?.id !== a.id || r.state !== 'open') throw new Error('Only the first reserved attempt can start.');
    if (reachedExpiry(r)) throw new Error('This round has reached its expiry.');
    changeAttempt(a, 'processing');
    return { attemptId: a.id, state: 'processing' };
  }
  if (request.type === 'unknown') {
    const a = attempt(request.attemptId);
    if (a.state !== 'processing') throw new Error('Only a processing attempt can become uncertain.');
    changeAttempt(a, 'unknown');
    return { attemptId: a.id, state: 'unknown', creditsReserved: a.price };
  }
  if (request.type === 'cancel-reservation') {
    const a = attempt(request.attemptId);
    if (a.state !== 'reserved') throw new Error('A started or uncertain attempt must be reconciled, not cancelled.');
    refund(a);
    return { attemptId: a.id, state: 'cancelled', creditsReturned: a.price };
  }
  if (request.type === 'settle') {
    const a = attempt(request.attemptId);
    const r = round(a.round_id);
    if (!['processing', 'unknown'].includes(a.state) || firstPending(a.round_id)?.id !== a.id || r.state !== 'open') throw new Error('Attempt cannot be settled in this state or order.');
    if (a.state === 'unknown' && request.reconciled !== true) throw new Error('An uncertain outcome requires explicit reconciliation.');
    if (!['locked', 'released', 'error'].includes(request.outcome)) throw new Error('Invalid settlement outcome.');
    const reference = id(request.receiptRef);
    const price = units(a.price);
    const reserved = playerAccount(a.player, 'reserved');
    if (request.outcome === 'error') {
      move(reserved, playerAccount(a.player, 'available'), price);
      changeAttempt(a, 'error', reference);
      return { attemptId: a.id, state: 'error', creditsReturned: a.price, prizeContribution: '0' };
    }
    const split = splitAttemptPrice({ price: a.price, prizeBps: r.prize_bps, operationsBps: r.operations_bps });
    const prize = units(split.prize), operations = units(split.operations), next = units(split.nextRound);
    move(reserved, roundAccount(r.id, 'prize'), prize);
    move(reserved, 'treasury:operations', operations);
    move(reserved, 'treasury:next', next);
    db.prepare('UPDATE rounds SET player_prize_amount = ? WHERE id = ?')
      .run(String(units(r.player_prize_amount ?? '0') + prize), r.id);
    if (units(r.price_step ?? '0')) {
      const bumped = units(r.price) + units(r.price_step);
      const cap = units(r.maximum_price ?? r.price);
      db.prepare('UPDATE rounds SET price = ? WHERE id = ?').run(String(bumped > cap ? cap : bumped), r.id);
    }
    changeAttempt(a, request.outcome, reference);
    let winnerPayable = 0n, continuityRetained = 0n;
    if (request.outcome === 'released') {
      const bounty = get(roundAccount(r.id, 'prize'));
      const splitPrize = splitWinPrize(String(bounty), r.win_retain_bps ?? 0);
      winnerPayable = units(splitPrize.payable);
      continuityRetained = units(splitPrize.continuity);
      move(roundAccount(r.id, 'prize'), roundAccount(r.id, 'payable'), winnerPayable);
      if (continuityRetained) move(roundAccount(r.id, 'prize'), 'treasury:next', continuityRetained);
      db.prepare("UPDATE rounds SET state = 'won', winner = ? WHERE id = ?").run(a.player, r.id);
      if (r.win_retain_bps) {
        db.prepare('INSERT INTO retired_configurations(configuration, round_id, retired_at) VALUES (?, ?, ?)')
          .run(r.retire_key || r.configuration, r.id, clock);
      }
      for (const pending of db.prepare("SELECT * FROM attempts WHERE round_id = ? AND state = 'reserved'").all(r.id)) refund(pending);
    }
    return { attemptId: a.id, state: request.outcome, prizeContribution: String(prize), operations: String(operations),
      nextRound: String(next), winnerPayable: String(winnerPayable), continuityRetained: String(continuityRetained) };
  }
  if (request.type === 'expire-round') {
    const r = round(request.roundId);
    if (r.state !== 'open') throw new Error('Only an open round can expire.');
    if (!r.expires_at || new Date(clock).getTime() < new Date(r.expires_at).getTime()) throw new Error('This round is not expired.');
    for (const pending of db.prepare("SELECT * FROM attempts WHERE round_id = ? AND state = 'reserved'").all(r.id)) refund(pending);
    const prize = get(roundAccount(r.id, 'prize'));
    const rows = db.prepare("SELECT player, price FROM attempts WHERE round_id = ? AND state IN ('locked','released')").all(r.id)
      .map(row => ({ player: row.player, prizeContribution: splitAttemptPrice({ price: row.price, prizeBps: r.prize_bps, operationsBps: r.operations_bps }).prize }));
    const distribution = expireDistribution({
      prize: String(prize), seedAmount: r.seed_amount ?? '0', playerPrizeAmount: r.player_prize_amount ?? '0',
      contributions: rows
    });
    for (const refundRow of distribution.playerRefunds) {
      const amount = units(refundRow.amount);
      if (amount) move(roundAccount(r.id, 'prize'), playerAccount(refundRow.player, 'available'), amount);
    }
    const seed = units(distribution.seedReturn);
    if (seed) move(roundAccount(r.id, 'prize'), 'treasury:seed', seed);
    const leftover = get(roundAccount(r.id, 'prize'));
    if (leftover) move(roundAccount(r.id, 'prize'), 'treasury:unassigned', leftover);
    db.prepare("UPDATE rounds SET state = 'expired' WHERE id = ?").run(r.id);
    return { roundId: r.id, state: 'expired', seedReturn: distribution.seedReturn, playerRefunds: distribution.playerRefunds,
      unassigned: String(leftover) };
  }
  if (request.type === 'record-payout') {
    const r = round(request.roundId);
    if (r.state !== 'won' || !r.winner) throw new Error('Only an unpaid winning round can be paid.');
    const amount = get(roundAccount(r.id, 'payable'));
    if (!amount || String(amount) !== request.amount) throw new Error('Payout amount must match the recorded payable.');
    add(roundAccount(r.id, 'payable'), -amount); add('custody', -amount);
    db.prepare("UPDATE rounds SET state = 'paid' WHERE id = ?").run(r.id);
    return { roundId: r.id, player: r.winner, paid: String(amount), recipient: request.recipient,
      transactionHash: request.transactionHash, logIndex: request.logIndex, source: 'verified-rpc-standard-transfer' };
  }
  if (request.type === 'payout') {
    const r = round(request.roundId);
    if (r.state !== 'won' || !r.winner) throw new Error('Only an unpaid winning round can be paid.');
    const amount = get(roundAccount(r.id, 'payable'));
    add(roundAccount(r.id, 'payable'), -amount); add('custody', -amount);
    db.prepare("UPDATE rounds SET state = 'paid' WHERE id = ?").run(r.id);
    return { roundId: r.id, player: r.winner, paid: String(amount), source: 'simulated-payout' };
  }
  throw new Error('Unknown accounting operation.');
}

export function auditLedger(db, get) {
  const rows = db.prepare('SELECT account, amount FROM balances').all();
  const held = get('custody');
  const obligations = rows.filter(row => row.account !== 'custody').reduce((sum, row) => sum + units(row.amount), 0n);
  if (held !== obligations) throw new Error('Ledger conservation failed.');
  const reserved = new Map();
  for (const a of db.prepare('SELECT * FROM attempts').all()) if (PENDING.includes(a.state)) {
    const account = playerAccount(a.player, 'reserved');
    reserved.set(account, (reserved.get(account) ?? 0n) + units(a.price));
  }
  for (const row of rows.filter(row => row.account.endsWith(':reserved'))) if (units(row.amount) !== (reserved.get(row.account) ?? 0n)) throw new Error('Reserved credit reconciliation failed.');
  for (const [account, amount] of reserved) if (get(account) !== amount) throw new Error('Missing reserved credits.');
  return { balanced: true, custody: String(held), liabilitiesAndAllocations: String(obligations) };
}
