import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, decodeFunctionResult, formatUnits, decodeEventLog } from '../../../../integrations/long/tools/node_modules/viem/_esm/index.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = name => {
  let value = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const rpcUrl = 'https://rpc.mainnet.chain.robinhood.com';
const calls = [];
let id = 0;
async function rpc(method, params) {
  if (!['eth_chainId', 'eth_getBlockByNumber', 'eth_call', 'eth_getLogs'].includes(method)) throw new Error('Read-only RPC allowlist');
  const request = {jsonrpc:'2.0', id:++id, method, params};
  const startedAt = new Date().toISOString();
  const response = await fetch(rpcUrl, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(request)});
  const body = await response.json();
  calls.push({startedAt, request, response:body});
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}
const chainId = await rpc('eth_chainId', []);
if (Number(BigInt(chainId)) !== 4663) throw new Error('Wrong chain');
const head = await rpc('eth_getBlockByNumber', ['latest', false]);
const stake = {address:'0x4fefDd560c076CfE9EA0b8f4d21E60Af5A39fE96', abi:read('seusd-implementation.json').abi};
const eusd = {address:'0x8B84D644CECaeE6d21373F37E1bA00f85eD7CdB7', abi:read('eusd.json').abi};
const output = {capturedAt:new Date().toISOString(), chainId:Number(BigInt(chainId)), block:head, values:[], calls};
async function call(contract, fn, args=[]) {
  try {
    const data = encodeFunctionData({abi:contract.abi, functionName:fn, args});
    const result = await rpc('eth_call', [{to:contract.address, data}, head.number]);
    const decoded = decodeFunctionResult({abi:contract.abi, functionName:fn, data:result});
    output.values.push({address:contract.address, fn, args, decoded});
    return decoded;
  } catch (error) { output.values.push({address:contract.address, fn, args, error:String(error)}); return null; }
}
const ed = await call(eusd, 'decimals');
const sd = await call(stake, 'decimals');
for (const fn of ['name','symbol','totalSupply']) await call(eusd, fn);
for (const fn of ['asset','totalSupply','totalAssets','getUnvestedAmount','vestingAmount','vestingPeriod','lastDistributionTimestamp','registry','incentivesController']) await call(stake, fn);
await call(eusd, 'balanceOf', [stake.address]);
await call(stake, 'convertToAssets', [10n ** BigInt(sd)]);
output.decimals = {eusd:ed, stake:sd};
output.rewardsEventAbi = stake.abi.filter(x => x.type === 'event' && /Reward|Deposit|Withdraw/.test(x.name));
const json = JSON.stringify(output, (_,v)=>typeof v==='bigint'?v.toString():v, 2);
fs.writeFileSync(path.join(dir, 'state-first.json'), json);
console.log(JSON.stringify({capturedAt:output.capturedAt, block:Number(BigInt(head.number)), time:new Date(Number(BigInt(head.timestamp))*1000).toISOString(), values:output.values, events:output.rewardsEventAbi}, (_,v)=>typeof v==='bigint'?v.toString():v, 2));
