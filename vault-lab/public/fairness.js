import { PUBLIC_SOURCE_URL } from './source.js';

function amount(value, decimals = 18) {
  try {
    const n = BigInt(value);
    const scale = 10n ** BigInt(decimals);
    const whole = n / scale;
    const frac = (n % scale).toString().padStart(Number(decimals), '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : String(whole);
  } catch {
    return value == null ? '—' : String(value);
  }
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function read(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

function stamp(label, ok) {
  const node = el('span', `${ok ? 'Proven' : 'Open'} · ${label}`, 'fairness-stamp');
  node.dataset.ok = String(Boolean(ok));
  return node;
}

function table(headers, rows, empty) {
  if (!rows.length) return el('p', empty, 'fairness-empty');
  const tableNode = el('table', undefined, 'fairness-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const header of headers) headRow.append(el('th', header));
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const cells of rows) {
    const row = document.createElement('tr');
    for (const cell of cells) {
      const td = document.createElement('td');
      if (cell instanceof Node) td.append(cell); else td.textContent = cell;
      row.append(td);
    }
    body.append(row);
  }
  tableNode.append(head, body);
  return tableNode;
}

function rulesList(target, entries) {
  target.replaceChildren();
  for (const [label, value] of entries) {
    const row = document.createElement('div');
    row.append(el('dt', label), el('dd', value));
    target.append(row);
  }
}

try {
  const [board, receipts, rules, status] = await Promise.all([
    read('/api/funding/fairness').catch(() => ({ enabled: false, demonstrated: {}, rounds: [], attempts: [], deposits: [] })),
    read('/api/receipts/public').catch(() => ({ records: [] })),
    read('/api/rules').catch(() => null),
    read('/api/status').catch(() => ({}))
  ]);
  const round = board.rounds?.find(row => row.kind !== 'payout-proving') ?? board.rounds?.[0];
  const decimals = board.asset?.decimals ?? 18;
  const demonstrated = board.demonstrated ?? {};
  const source = document.querySelector('#fairness-source');
  if (source) source.href = board.sourceUrl || PUBLIC_SOURCE_URL;
  document.querySelector('#fairness-edition').textContent = (status.paidConfigured || board.enabled)
    ? `Closed paid beta · ${status.mode || 'x402'}` : 'Practice / operator records';
  document.querySelector('#fairness-footer').textContent = board.custody === 'operator-controlled'
    ? 'Operator custody · testnet' : 'Operator records';
  const stamps = document.querySelector('#fairness-stamps');
  stamps.replaceChildren(
    stamp('On-chain deposit', demonstrated.depositToTreasury),
    stamp('Paid attempt', demonstrated.paidAttempt),
    stamp('Bounty split', demonstrated.bountyAccrued),
    stamp('Prize sent', demonstrated.prizeSent),
    stamp('TEE / attested executor', false)
  );
  rulesList(document.querySelector('#fairness-rules'), [
    ['Source', board.sourceUrl || PUBLIC_SOURCE_URL],
    ['Round', round?.id || 'None open'],
    ['State', round?.state || '—'],
    ['Price now', round?.price ? `${amount(round.price, decimals)} AMZN` : '—'],
    ['Split', round ? `${(round.prizeBps ?? 0) / 100}% bounty / ${(round.operationsBps ?? 0) / 100}% ops` : '70% / 30%'],
    ['On a win', `${((round?.winRetainBps ?? 2500) / 100)}% stays as continuity`],
    ['Opus pot', (() => {
      const game = board.rounds?.find(row => row.kind !== 'payout-proving') ?? round;
      return game?.bounty ? `${amount(game.bounty, decimals)} AMZN` : '0';
    })()],
    ['Prize payable', board.rounds?.some(row => row.prizePayable && row.prizePayable !== '0')
      ? board.rounds.filter(row => row.prizePayable && row.prizePayable !== '0')
        .map(row => `${row.id} ${amount(row.prizePayable, decimals)}`).join(' · ') : '0'],
    ['Expiry', round?.expiresAt ? new Date(round.expiresAt).toLocaleDateString('en-US') : '5 months from open'],
    ['Custody', board.custody || 'operator-controlled'],
    ['Evidence', board.attestation || 'operator receipts']
  ]);
  document.querySelector('#fairness-limits').replaceChildren(
    el('li', 'OpenRouter still chooses the running provider. We record the requested and returned model IDs.'),
    el('li', 'A TEE in front of a normal API would attest the proxy, not the weights.'),
    el('li', 'Treasury still signs prize sends. No escrow contract on this testnet round.'),
    el('li', 'Credits are not refundable. Technical failures restore the attempt, not cash.'),
    el('li', 'Payout proving is a published drill. It does not make the Opus persuasion round easy.')
  );
  const roundsNode = document.querySelector('#fairness-rounds');
  if (roundsNode) {
    roundsNode.replaceChildren(table(
      ['Round', 'Kind', 'State', 'Pot', 'Payable', 'Prize tx'],
      (board.rounds ?? []).map(row => [
        row.id,
        row.kind === 'payout-proving' ? 'payout proving' : 'the game',
        row.state,
        `${amount(row.bounty, decimals)} AMZN`,
        `${amount(row.prizePayable, decimals)} AMZN`,
        row.prizeTransactionHash ? el('code', row.prizeTransactionHash) : '—'
      ]),
      'No paid rounds recorded yet.'
    ));
  }
  document.querySelector('#fairness-deposits').replaceChildren(table(
    ['From', 'To', 'Amount', 'Tx'],
    (board.deposits ?? []).map(row => [
      row.from, row.to, `${amount(row.amount, decimals)} AMZN`, el('code', row.transactionHash)
    ]),
    'No credited deposits yet.'
  ));
  document.querySelector('#fairness-attempts').replaceChildren(table(
    ['Player', 'State', 'Paid', 'To pot', 'Ops'],
    (board.attempts ?? []).map(row => [
      row.player, row.state, `${amount(row.price, decimals)} AMZN`,
      amount(row.prizeContribution, decimals), amount(row.operations, decimals)
    ]),
    'No attempts recorded yet.'
  ));
  const transcripts = document.querySelector('#fairness-transcripts');
  const records = receipts.records ?? [];
  if (!records.length) transcripts.append(el('p', 'No transcripts stored yet.', 'fairness-empty'));
  for (const record of records) {
    const card = el('article', undefined, 'transcript');
    const head = document.createElement('header');
    const when = record.createdAt ? new Date(record.createdAt).toLocaleString('en-US') : 'Time not recorded';
    head.append(
      el('strong', record.decision || record.status || 'unconfirmed'),
      el('span', record.player || 'player'),
      el('span', record.modelRequested || 'model'),
      el('span', when)
    );
    card.append(head);
    const lines = (record.messages ?? []).map(message => `${message.role}: ${message.content ?? ''}`).join('\n\n');
    const tools = (record.toolCalls ?? []).filter(call => call.name).map(call => `${call.name} ${call.arguments || ''}`).join('\n');
    card.append(el('pre', [lines, tools].filter(Boolean).join('\n\n')));
    transcripts.append(card);
  }
  const prompt = document.querySelector('#fairness-prompt');
  const frozen = (board.rounds ?? []).filter(row => row.systemPrompt);
  if (frozen.length) {
    for (const row of frozen) {
      prompt.append(el('h3', `${row.id} · ${row.kind === 'payout-proving' ? 'payout proving' : 'the game'} · ${row.promptVersion || 'frozen'}`));
      prompt.append(el('pre', row.systemPrompt, 'prompt-block'));
      if (Array.isArray(row.tools) && row.tools.length) {
        prompt.append(el('pre', JSON.stringify(row.tools, null, 2), 'prompt-block'));
      }
    }
  } else if (rules?.systemPrompt) {
    prompt.append(el('pre', rules.systemPrompt, 'prompt-block'));
    if (Array.isArray(rules.tools)) {
      prompt.append(el('pre', JSON.stringify(rules.tools, null, 2), 'prompt-block'));
    }
  } else {
    prompt.append(el('p', 'Rules could not be loaded.', 'fairness-empty'));
  }
} catch (error) {
  document.querySelector('#fairness-stamps').replaceChildren(el('p', 'Could not load the live ledger. Refresh.', 'fairness-empty'));
}
