// Read-only research: public HTTP GETs only. Downloaded sources are never executed.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('./evidence/', import.meta.url);
const run = new URL(`${new Date().toISOString().replaceAll(':', '-')}/`, root);
await mkdir(run, { recursive: true });
const manifest = { observedAt: new Date().toISOString(), mode: 'PUBLIC_GET_ONLY', sources: [] };
async function collect(name, url) {
  const entry = { name, url, observedAt: new Date().toISOString() };
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Codex technical research', Accept: 'application/json,text/plain,text/html' }, signal: AbortSignal.timeout(25000) });
    const body = await response.text();
    Object.assign(entry, { status: response.status, finalUrl: response.url, bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') });
    await writeFile(new URL(name, run), body, { flag: 'wx' });
    manifest.sources.push(entry);
    return response.ok ? body : null;
  } catch (error) {
    entry.error = error.message;
    manifest.sources.push(entry);
    return null;
  }
}
const results = await Promise.allSettled([
  collect('rh-assets.json', 'https://api.robinhood.com/rhj/assets'),
  collect('rh-nvda-contract.json', 'https://robinhoodchain.blockscout.com/api/v2/smart-contracts/0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'),
  collect('long-factory-contract.json', 'https://robinhoodchain.blockscout.com/api/v2/smart-contracts/0x22e99278308B393ea1260859B181AD7E78f5eeED'),
  collect('reserve-main-commit.json', 'https://api.github.com/repos/reserve-protocol/reserve-index-dtf/commits/main'),
  collect('bankr-deploy.md', 'https://docs.bankr.bot/token-launching/api-reference/deploy-token-launch.md'),
  collect('rh-stock-tokens.html', 'https://docs.robinhood.com/chain/stock-tokens/'),
  collect('rh-oracles.html', 'https://docs.robinhood.com/chain/oracles-and-price-feeds/'),
  collect('bankr-llms-full.txt', 'https://docs.bankr.bot/llms-full.txt'),
]);
for (const result of results) if (result.status === 'rejected') throw result.reason;
const commit = results[3].value ? JSON.parse(results[3].value).sha : null;
if (commit) {
  manifest.reserveCommit = commit;
  const base = `https://raw.githubusercontent.com/reserve-protocol/reserve-index-dtf/${commit}`;
  const pinned = await Promise.allSettled([
    collect('reserve-README.md', `${base}/README.md`),
    collect('reserve-Folio.sol', `${base}/contracts/Folio.sol`),
    collect('reserve-IFolio.sol', `${base}/contracts/interfaces/IFolio.sol`),
    collect('reserve-tree.json', `https://api.github.com/repos/reserve-protocol/reserve-index-dtf/git/trees/${commit}?recursive=1`),
  ]);
  for (const result of pinned) if (result.status === 'rejected') throw result.reason;
}
await writeFile(new URL('manifest.json', run), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ directory: fileURLToPath(run), reserveCommit: commit, sources: manifest.sources.map(({ name, status, error, bytes }) => ({ name, status, error, bytes })) }, null, 2));
