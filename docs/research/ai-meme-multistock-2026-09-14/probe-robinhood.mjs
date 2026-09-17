// Only public eth_chainId, eth_blockNumber, eth_getBlockByNumber, eth_getCode and eth_call.
// Reuses an already-installed viem; no wallet, private key or transaction submission.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { encodeFunctionData, decodeFunctionResult, parseAbi, keccak256 } from '../../../integrations/long/tools/node_modules/viem/_esm/index.js';

const input = process.argv[2];
if (!input) throw new Error('Pass the source-evidence directory with rh-assets.json');
const inputDir = pathToFileURL(resolve(input) + '/');
const catalog = JSON.parse(await readFile(new URL('rh-assets.json', inputDir), 'utf8'));
const output = new URL(`./evidence/rpc-${new Date().toISOString().replaceAll(':', '-')}/`, import.meta.url);
await mkdir(output, { recursive: true });
const rpcUrl = 'https://rpc.mainnet.chain.robinhood.com/';
const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call']);
const transcript = [];
let id = 0;
const stringify = (value) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
async function rpc(method, params = []) {
  if (!allowed.has(method)) throw new Error('Forbidden RPC method');
  const request = { jsonrpc: '2.0', id: ++id, method, params };
  const observation = { at: new Date().toISOString(), request };
  try {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000) });
    observation.httpStatus = response.status;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    observation.response = body;
    if (body.error) throw new Error(JSON.stringify(body.error));
    return body.result;
  } catch (error) { observation.error = error.message; throw error; }
  finally { transcript.push(observation); }
}
const abi = parseAbi([
  'function symbol() view returns(string)', 'function decimals() view returns(uint8)',
  'function totalSupply() view returns(uint256)', 'function uiMultiplier() view returns(uint256)',
  'function oraclePaused() view returns(bool)', 'function paused() view returns(bool)',
  'function owner() view returns(address)', 'function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)',
]);
const report = { observedAt: new Date().toISOString(), mode: 'READ_ONLY_RPC', rpcUrl, catalogSource: fileURLToPath(inputDir), assets: [] };
try {
  report.chainId = Number(BigInt(await rpc('eth_chainId')));
  if (report.chainId !== 4663) throw new Error('Wrong chain');
  const block = await rpc('eth_blockNumber');
  const header = await rpc('eth_getBlockByNumber', [block, false]);
  Object.assign(report, { blockNumber: BigInt(block).toString(), blockHash: header.hash, blockTimestamp: Number(BigInt(header.timestamp)), blockAt: new Date(Number(BigInt(header.timestamp)) * 1000).toISOString() });
  async function read(address, name) {
    try {
      const data = await rpc('eth_call', [{ to: address, data: encodeFunctionData({ abi, functionName: name }) }, block]);
      return { ok: true, value: decodeFunctionResult({ abi, functionName: name, data }) };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  async function code(address) {
    try { const data = await rpc('eth_getCode', [address, block]); return { bytes: (data.length - 2) / 2, keccak256: keccak256(data) }; }
    catch (error) { return { error: error.message }; }
  }
  const feeds = {
    NVDA: '0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15',
    GOOGL: '0xF6f373a037c30F0e5010d854385cA89185AE638b',
    META: '0x7C38C00C30BEe9378381E7B6135d7283356D71b1',
  };
  for (const symbol of ['NVDA', 'GOOGL', 'META', 'MSFT', 'AIQ', 'ARTY', 'QQQ', 'SPY']) {
    const asset = catalog.assets.find(a => a.tokenSymbol === symbol && a.deployments.some(d => d.chainId === 4663));
    if (!asset) { report.assets.push({ symbol, status: 'NOT_FOUND_IN_THIS_CATALOG_SNAPSHOT' }); continue; }
    const address = asset.deployments.find(d => d.chainId === 4663).contractAddress;
    const names = ['symbol', 'decimals', 'totalSupply', 'uiMultiplier', 'oraclePaused', 'paused'];
    const results = await Promise.allSettled(names.map(name => read(address, name)));
    const reads = Object.fromEntries(results.map((result, i) => [names[i], result.status === 'fulfilled' ? result.value : { ok: false, error: String(result.reason) }]));
    const entry = { symbol, address, status: asset.status, multiplierFromAPI: asset.currentMultiplier, tradingCapabilities: asset.tradingCapabilities, code: await code(address), reads };
    if (feeds[symbol]) {
      const feed = feeds[symbol];
      const [decimals, round] = await Promise.all([read(feed, 'decimals'), read(feed, 'latestRoundData')]);
      entry.oracle = { address: feed, provenance: 'Historical 2026-09-08 registry; feed authority not reverified', decimals, round };
      if (round.ok) entry.oracle.ageSeconds = report.blockTimestamp - Number(round.value[3]);
      entry.oracle.heartbeatVerified = false;
    }
    report.assets.push(entry);
  }
  const factory = '0x22e99278308B393ea1260859B181AD7E78f5eeED';
  report.historicalLongFactory = { address: factory, code: await code(factory), paused: await read(factory, 'paused'), owner: await read(factory, 'owner'), currentFrontendMappingVerified: false };
} catch (error) { report.error = error.message; }
await writeFile(new URL('snapshot.json', output), stringify(report) + '\n', { flag: 'wx' });
await writeFile(new URL('rpc-transcript.json', output), stringify(transcript) + '\n', { flag: 'wx' });
await writeFile(new URL('probe.sha256', output), createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex') + '\n', { flag: 'wx' });
console.log(stringify({ directory: fileURLToPath(output), block: report.blockNumber, blockAt: report.blockAt, error: report.error, factory: report.historicalLongFactory, assets: report.assets.map(a => ({ symbol: a.symbol, address: a.address, status: a.status, codeBytes: a.code?.bytes, paused: a.reads?.paused, oraclePaused: a.reads?.oraclePaused, multiplier: a.reads?.uiMultiplier, oracleAgeSeconds: a.oracle?.ageSeconds })) }));
