import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { recordSocialBatch, readLatestSocial } from './social-history.mjs';
import { collectXRecent } from './x-search.mjs';

const help = `Local narrative follow-up. No scheduler or token execution.

Usage:
  node market-agent/followup.mjs import batch.json
  node market-agent/followup.mjs status
  node market-agent/followup.mjs x-search --story id --query text --out new-batch.json --allow-paid-read [--max-results 10] [--since-id id] [--next-token token]

import compares a recorded batch with cumulative local history and writes a new run.
x-search requires X_BEARER_TOKEN (or TWITTER_BEARER_TOKEN), and may incur X charges.
It reads one page only, without user expansions or automatic retries/pagination.
It saves a batch for review; import it explicitly after inspecting its coverage.
An existing --out path is rejected before making a request. No cursor advances automatically.
`;

export function parseXSearchArgs(args) {
  const options = { maxResults: 10, allowPaidRead: false }, seen = new Set();
  const names = { '--story': 'storyKey', '--query': 'query', '--out': 'outputFile',
    '--max-results': 'maxResults', '--since-id': 'sinceId', '--next-token': 'nextToken' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Repeated option: ${flag}`);
    seen.add(flag);
    if (flag === '--allow-paid-read') { options.allowPaidRead = true; continue; }
    if (!names[flag] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown or incomplete option: ${flag}`);
    const value = args[++i];
    options[names[flag]] = flag === '--max-results' ? Number(value) : value;
  }
  if (!options.storyKey || !options.query || !options.outputFile) throw new Error('--story, --query and --out are required');
  if (path.extname(options.outputFile).toLowerCase() !== '.json') throw new Error('--out must be a JSON file');
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (!command || command === '--help') { console.log(help); return; }
  if (command === 'status') {
    if (rest.length) throw new Error('status takes no arguments');
    const latest = await readLatestSocial();
    console.log(JSON.stringify({ configuredXCredential: Boolean(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN),
      continuousIngestionActive: false, latestFolder: latest?.folder ?? null,
      latestBatchAt: latest?.state.recordedAt ?? null, rememberedSources: latest?.state.observations.length ?? 0 }));
    return;
  }
  if (command === 'import') {
    if (rest.length !== 1) throw new Error('import requires exactly one batch file');
    const batch = JSON.parse(await readFile(path.resolve(rest[0]), 'utf8'));
    const run = await recordSocialBatch(batch);
    console.log(JSON.stringify({ folder: run.folder, needsReview: run.result.needsReview,
      changes: run.result.changes.length, rememberedSources: run.result.nextState.observations.length }));
    return;
  }
  if (command === 'x-search') {
    const { outputFile, ...options } = parseXSearchArgs(rest);
    const { open, unlink } = await import('node:fs/promises');
    const destination = path.resolve(outputFile), reservation = await open(destination, 'wx');
    let saved = false;
    try {
      const batch = await collectXRecent({ ...options, bearerToken: process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN });
      await reservation.writeFile(JSON.stringify(batch, null, 2) + '\n');
      saved = true;
      console.log(JSON.stringify({ outputFile: destination, coverage: batch.coverage, provider: batch.provider }));
      if (batch.coverage.some(item => item.status === 'unavailable')) process.exitCode = 2;
    } finally {
      await reservation.close();
      if (!saved) await unlink(destination);
    }
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
