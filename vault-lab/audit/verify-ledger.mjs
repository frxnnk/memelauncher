import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createLedger } from '../server/economy/ledger.mjs';
import { UNIT } from '../server/economy/schema.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const hash = value => createHash('sha256').update(value).digest('hex');

export function verifyRoundManifests(snapshot) {
  const manifests = snapshot.roundManifests ?? [];
  if (!Array.isArray(manifests) || manifests.length > snapshot.rounds.length) throw new Error('Invalid round manifests.');
  const manifestIds = new Set();
  for (const entry of manifests) {
    const round = snapshot.rounds.find(round => round.id === entry?.manifest?.roundId);
    if (!round || manifestIds.has(round.id) || hash(JSON.stringify(entry.manifest)) !== entry.hash || round.configuration !== entry.hash) {
      throw new Error('A round manifest does not match its recorded ledger configuration.');
    }
    manifestIds.add(round.id);
  }
  for (const round of snapshot.rounds) {
    if (/^[a-f0-9]{64}$/.test(round.configuration) && !manifestIds.has(round.id)) throw new Error('A hashed round configuration is missing its manifest.');
  }
  return manifests;
}

export function verifyLedgerExport(snapshot) {
  if (!snapshot || !equal(snapshot.unit, UNIT) || snapshot.realFundsEnabled !== false || snapshot.evidence !== 'local-simulation-ledger') {
    throw new Error('This verifier accepts this version of the TEST simulation ledger only.');
  }
  if (!Array.isArray(snapshot.events) || snapshot.events.length > 10000 || snapshot.eventCount !== snapshot.events.length ||
    !['balances','rounds','attempts'].every(key=>Array.isArray(snapshot[key]))) throw new Error('A complete ledger export with at most 10,000 events is required.');
  const keys = new Set(), manifests = verifyRoundManifests(snapshot);
  let timestamp;
  const ledger = createLedger({ now:()=>timestamp });
  try {
    for (const [index,event] of snapshot.events.entries()) {
      if (!event || event.sequence !== index+1 || keys.has(event.key) || typeof event.createdAt !== 'string' || !Number.isFinite(Date.parse(event.createdAt))) throw new Error(`Invalid event order, key or timestamp at position ${index+1}.`);
      keys.add(event.key); timestamp=event.createdAt;
      const result = ledger.execute(event.key,event.request);
      const {replayed,eventSequence,...recorded} = result;
      if (replayed || eventSequence !== event.sequence || !equal(recorded,event.result)) throw new Error(`Event ${event.sequence} does not reproduce its recorded result.`);
    }
    const rebuilt=ledger.exportAll();
    for(const field of ['balances','rounds','attempts','events','audit']) {
      if (!equal(rebuilt[field],snapshot[field])) throw new Error(`The exported ${field} do not match event replay.`);
    }
    return {status:'internally-consistent',eventsChecked:rebuilt.eventCount,roundManifestsChecked:manifests.length,custody:rebuilt.audit.custody,unit:'TEST',
      evidence:'replayed-operator-export',realFunds:false,independentExecutionProof:false,
      meaning:'Every supplied event reproduces the supplied balances. This does not verify deposits, model execution, completeness against an external source, or freedom from operator rewriting.'};
  } finally {ledger.close();}
}

export async function run(args, write=value=>process.stdout.write(value+'\n')) {
  if (args.length !== 1) throw new Error('Usage: node audit/verify-ledger.mjs <export.json>. No network requests are made.');
  const path=resolve(args[0]);
  if ((await stat(path)).size > 64*1024*1024) throw new Error('This local verifier accepts exports up to 64 MiB.');
  const raw=await readFile(path);
  const result=verifyLedgerExport(JSON.parse(raw.toString('utf8')));
  write(JSON.stringify({...result,fileSha256:hash(raw)},null,2));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run(process.argv.slice(2)).catch(error=>{process.stderr.write(`Ledger verification failed: ${error.message}\n`);process.exitCode=1;});
}
