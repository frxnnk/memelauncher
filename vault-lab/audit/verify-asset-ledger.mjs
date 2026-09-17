import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createLedger } from '../server/economy/ledger.mjs';
import { roundTerms, units } from '../server/economy/schema.mjs';
import { verifyRoundManifests, equal } from './verify-ledger.mjs';
import { prepareDepositReplay } from './asset-deposit-replay.mjs';

const fail = message => { throw new Error(message); };
function verifyTerms(snapshot) {
  const manifests = verifyRoundManifests(snapshot);
  if (manifests.length !== snapshot.rounds.length) fail('Every asset round needs its frozen manifest; export from the asset economy service.');
  for (const { manifest } of manifests) {
    const round = snapshot.rounds.find(row => row.id === manifest.roundId), config = manifest.configuration;
    if (config?.version !== 'shared-vault-round-v2' || config.mode !== 'rpc-credit-preparation' || config.realFunds !== false ||
        config.assetHash !== snapshot.assetHash || !equal(config.unit, snapshot.unit) ||
        !Array.isArray(config.guardians) || config.guardians.length < (config.mode === 'rpc-credit-preparation' ? 1 : 2) ||
        config.guardians.length > 3 ||
        config.guardians.some(guardian => typeof guardian?.modelId !== 'string' || !guardian.modelId.includes('/') ||
          !Object.hasOwn(config.rules?.profiles ?? {}, guardian.modelId) || !equal(guardian.configuration, config.rules.profiles[guardian.modelId])) ||
        new Set(config.guardians.map(guardian => guardian.modelId)).size !== config.guardians.length) fail('Asset round configuration or roster is inconsistent.');
    const pricing = roundTerms(config);
    const price = units(round.price), floor = units(pricing.price), ceiling = units(round.maximum_price ?? pricing.price);
    if (price < floor || price > ceiling || pricing.prizeBps !== round.prize_bps || pricing.operationsBps !== round.operations_bps ||
        pricing.nextRoundBps !== config.nextRoundBps) fail('Frozen round pricing differs from accounting.');
  }
  return manifests.length;
}

export function verifyAssetLedgerExport(snapshot) {
  if (snapshot?.unit?.mode !== 'rpc-credit-preparation' || snapshot.realFundsEnabled !== false ||
      snapshot.evidence !== 'rpc-credit-preparation-not-independent-proof' || !/^[a-f0-9-]{36}$/.test(snapshot.instanceId ?? '') ||
      !Array.isArray(snapshot.events) || snapshot.events.length > 10000 || snapshot.eventCount !== snapshot.events.length ||
      !['balances', 'rounds', 'attempts', 'depositHolds'].every(key => Array.isArray(snapshot[key]))) {
    fail('A complete asset preparation export with at most 10,000 events is required.');
  }
  const manifestsChecked = verifyTerms(snapshot);
  const root = resolve(tmpdir()), directory = mkdtempSync(join(root, 'vault-asset-audit-'));
  let ledger, db, timestamp;
  const setTime = milliseconds => { timestamp = new Date(milliseconds).toISOString(); };
  try {
    const path = join(directory, 'replay.sqlite');
    ledger = createLedger({ path, asset: snapshot.asset, now: () => timestamp });
    db = new DatabaseSync(path);
    const initial = ledger.snapshot();
    if (!equal(initial.unit, snapshot.unit) || initial.assetHash !== snapshot.assetHash || !equal(initial.asset, snapshot.asset)) {
      fail('Asset denomination or configuration hash is inconsistent.');
    }
    const deposits = prepareDepositReplay({ snapshot, ledger, db, setTime });
    deposits.observeAt(0);
    const keys = new Set();
    for (const [index, event] of snapshot.events.entries()) {
      if (!event || event.sequence !== index + 1 || keys.has(event.key) || typeof event.createdAt !== 'string' || !Number.isFinite(Date.parse(event.createdAt))) {
        fail('Invalid accounting sequence, key or timestamp.');
      }
      keys.add(event.key); timestamp = event.createdAt;
      if (['verified-deposit', 'verified-prize-funding'].includes(event.request?.type)) deposits.credit(event);
      else ledger.execute(event.key, event.request);
      const last = ledger.snapshot().events[0];
      if (!equal(last, event)) fail('Accounting event does not reproduce its key, request hash, result or timestamp.');
      deposits.observeAt(event.sequence);
    }
    const depositReport = deposits.verifyFinal(), rebuilt = ledger.exportAll();
    for (const field of ['balances', 'rounds', 'attempts', 'events', 'audit', 'depositHolds']) {
      if (!equal(rebuilt[field], snapshot[field])) fail('Exported ' + field + ' differ from replay.');
    }
    return { status: 'internally-consistent', evidence: 'offline-replay-of-operator-supplied-records',
      eventsChecked: rebuilt.eventCount, roundManifestsChecked: manifestsChecked, ...depositReport,
      custodyBaseUnits: rebuilt.audit.custody, unit: rebuilt.unit, reportedHoldTimelineReplayed: true,
      externalNetworkCalls: 0, realFundsEnabled: false, independentExecutionProof: false,
      notVerified: ['Live chain state, canonicality/finality and RPC authenticity.', 'Privy identity, wallet ownership and actual attachment time.',
        'Sponsor affiliation, creator-fee origin or authorization to advertise a contributor.',
        'Model execution, accepted prompt provenance, provider signatures or hidden resampling.',
        'Completeness against external records, untampered history, singleton execution or freedom from operator rewriting.'],
      meaning: 'The supplied raw RPC records conform to the supplied orders and accounting. Replayed movements, recipients, frozen terms and reported hold transitions match the export; no actual money or independent source was verified.' };
  } finally {
    db?.close(); ledger?.close();
    if (!resolve(directory).startsWith(root + sep) || !directory.includes('vault-asset-audit-')) throw new Error('Unsafe audit cleanup path.');
    rmSync(directory, { recursive: true, force: true });
  }
}

export function run(args, write = value => process.stdout.write(value + '\n')) {
  const wrapped = args[0] === '--report';
  if (args.length !== (wrapped ? 2 : 1)) fail('Usage: node audit/verify-asset-ledger.mjs [--report] <export.json>. No network requests are made.');
  const path = resolve(args[wrapped ? 1 : 0]), info = statSync(path);
  if (!info.isFile() || info.size > 64 * 1024 * 1024) fail('This verifier accepts regular JSON files up to 64 MiB.');
  const raw = readFileSync(path);
  if (raw.length > 64 * 1024 * 1024) fail('Export grew beyond the 64 MiB limit.');
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { fail('Invalid export JSON.'); }
  const report = { ...verifyAssetLedgerExport(wrapped ? data.ledger : data), inputFormat: wrapped ? 'report-wrapper' : 'ledger-export',
    fileSha256: createHash('sha256').update(raw).digest('hex') };
  write(JSON.stringify(report, null, 2)); return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { run(process.argv.slice(2)); }
  catch (error) { console.error('Asset ledger verification failed: ' + error.message); process.exitCode = 1; }
}
