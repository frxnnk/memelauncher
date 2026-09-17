// Read-only public-chain research. Never constructs, signs or sends a transaction.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
  encodeFunctionData, decodeFunctionResult, encodeAbiParameters, keccak256,
  parseAbiParameters, parseUnits, formatUnits, parseAbi,
} from '../../../../integrations/long/tools/node_modules/viem/_esm/index.js';

const folder = fileURLToPath(new URL('.', import.meta.url));
const output = new URL((process.argv[2] || 'quotes-first') + '.json', import.meta.url);
const rpcUrl = 'https://rpc.mainnet.chain.robinhood.com';
const addresses = {
  quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',
  stateView: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
};
const record = {startedAt: new Date().toISOString(), rpcUrl, addresses, calls: [], pools: []};
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
async function save() {
  await fs.writeFile(output, stringify(record));
}
async function getAbi(name) {
  try {
    const cached = JSON.parse(await fs.readFile(`${folder}${name}.json`,'utf8'));
    if (cached.data?.is_verified && Array.isArray(cached.data.abi)) return cached.data.abi;
  } catch {}
  const url = `https://robinhoodchain.blockscout.com/api/v2/smart-contracts/${addresses[name]}`;
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  const raw = await response.text();
  let data = JSON.parse(raw);
  if (typeof data === 'string') data = JSON.parse(data);
  await fs.writeFile(`${folder}${name}.json`, stringify({url, capturedAt:new Date().toISOString(), data}));
  if (!Array.isArray(data.abi)) throw new Error(`Missing verified ABI for ${name}`);
  return data.abi;
}
async function rpc(method, params) {
  if (!['eth_chainId','eth_getBlockByNumber','eth_call'].includes(method)) {
    throw new Error(`RPC method not permitted: ${method}`);
  }
  const request = {jsonrpc:'2.0', id:record.calls.length + 1, method, params};
  const response = await fetch(rpcUrl, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(request),
    signal:AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); } catch { result = {error:{message:raw.slice(0,1000)}}; }
  record.calls.push({capturedAt:new Date().toISOString(), request, response:result});
  await save();
  if (result.error) throw new Error(JSON.stringify(result.error));
  return result.result;
}
async function call(address, abi, functionName, args) {
  const data = encodeFunctionData({abi,functionName,args});
  const result = await rpc('eth_call', [{to:address,data},record.block.number]);
  return decodeFunctionResult({abi,functionName,data:result});
}

try {
  const [quoterAbi,stateAbi] = await Promise.all([getAbi('quoter'),getAbi('stateView')]);
  record.chainId = Number(BigInt(await rpc('eth_chainId',[])));
  if (record.chainId !== 4663) throw new Error('Unexpected chain');
  record.block = await rpc('eth_getBlockByNumber',['latest',false]);
  // Use only a compact block header in the artifact. All calls below pin its number.
  record.block = {number:record.block.number,hash:record.block.hash,timestamp:record.block.timestamp};
  const captures = JSON.parse(await fs.readFile(new URL('../../deep/forensics/fee-and-creation-logs.json',import.meta.url),'utf8'));
  const definitions = captures.flatMap(c => (typeof c.data === 'object' && c.data?.items) || [])
    .filter(item => item.decoded?.method_call?.startsWith('Initialize('))
    .map(item => Object.fromEntries(item.decoded.parameters.map(p => [p.name,p.value])));
  if (process.argv.includes('--include-usdg')) {
    const usd = JSON.parse(await fs.readFile(new URL('usdg-initializations.json',import.meta.url),'utf8'));
    definitions.push(...usd.initializations.map(item => item.decoded.args));
  }
  const bases = new Map([
    ['0xd6fde6a3fc6ab2d83b2be58383944ca1bade1e18','CATGPT'],
    ['0x351ab2c51e223b28d219fe28cc3956410cc11e18','ANTHROPIG'],
  ]);
  const decimalsCache = new Map();
  const erc20Abi = parseAbi(['function decimals() view returns (uint8)']);
  for (const fields of definitions) {
    const poolKey = {currency0:fields.currency0,currency1:fields.currency1,fee:Number(fields.fee),
      tickSpacing:Number(fields.tickSpacing),hooks:fields.hooks};
    const poolId = keccak256(encodeAbiParameters(
      parseAbiParameters('(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'),[poolKey]));
    if (poolId.toLowerCase() !== fields.id.toLowerCase()) throw new Error('PoolKey hash mismatch');
    const baseIsCurrency0 = bases.has(poolKey.currency0.toLowerCase());
    const baseAddress = baseIsCurrency0 ? poolKey.currency0 : poolKey.currency1;
    const quoteAddress = baseIsCurrency0 ? poolKey.currency1 : poolKey.currency0;
    const pool = {name:bases.get(baseAddress.toLowerCase()),baseAddress,quoteAddress,poolId,poolKey,baseIsCurrency0,quotes:[]};
    if (!pool.name) throw new Error('Unexpected base token');
    record.pools.push(pool);
    try {
      pool.slot0 = await call(addresses.stateView,stateAbi,'getSlot0',[poolId]);
      pool.activeLiquidity = await call(addresses.stateView,stateAbi,'getLiquidity',[poolId]);
      for (const address of [poolKey.currency0,poolKey.currency1]) {
        if (!decimalsCache.has(address)) decimalsCache.set(address,Number(await call(address,erc20Abi,'decimals',[])));
      }
      pool.decimals0=decimalsCache.get(poolKey.currency0);
      pool.decimals1=decimalsCache.get(poolKey.currency1);
      pool.baseDecimals=baseIsCurrency0 ? pool.decimals0 : pool.decimals1;
      pool.quoteDecimals=baseIsCurrency0 ? pool.decimals1 : pool.decimals0;
      const ratio = (Number(pool.slot0[0]) / 2**96)**2 * 10**(pool.decimals0-pool.decimals1);
      pool.spotQuotePerBase = baseIsCurrency0 ? ratio : 1/ratio;
      // Size is in quote units, not necessarily USD. Sells use the number of
      // memes worth that size at pre-swap spot. Token decimals are read onchain.
      for (const size of [1,100,1000,5000,10000,25000]) {
        for (const side of ['buy','sell']) {
          const inputUnits = side === 'buy' ? size : size/pool.spotQuotePerBase;
          const inputDecimals = side === 'buy' ? pool.quoteDecimals : pool.baseDecimals;
          const outputDecimals = side === 'buy' ? pool.baseDecimals : pool.quoteDecimals;
          const exactAmount = parseUnits(inputUnits.toFixed(Math.min(12,inputDecimals)),inputDecimals);
          const zeroForOne = side === 'buy' ? !baseIsCurrency0 : baseIsCurrency0;
          const quote = {side,notionalQuoteAtSpot:size,inputUnits,exactAmount,zeroForOne};
          pool.quotes.push(quote);
          try {
            const result = await call(addresses.quoter,quoterAbi,'quoteExactInputSingle',[
              {poolKey,zeroForOne,exactAmount,hookData:'0x'},
            ]);
            quote.outputRaw=result[0];
            quote.outputUnits=Number(formatUnits(result[0],outputDecimals));
            quote.gasEstimate=result[1];
            quote.expectedOutputAtSpot=side === 'buy' ? size/pool.spotQuotePerBase : size;
            quote.shortfallVsSpotPct=(1-quote.outputUnits/quote.expectedOutputAtSpot)*100;
          } catch (error) { quote.error=error.message; }
          await save();
        }
      }
    } catch (error) { pool.error=error.message; }
    await save();
  }
} catch (error) { record.error=error.message; }
record.completedAt=new Date().toISOString();
await save();
console.log(stringify({chainId:record.chainId,block:record.block,error:record.error,pools:record.pools}));
