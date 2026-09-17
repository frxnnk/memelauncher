// Offline review only. Reads captured JSON; never performs a network request.
import fs from 'node:fs/promises';
import {decodeFunctionData,decodeFunctionResult,parseAbi,keccak256} from '../../../integrations/long/tools/node_modules/viem/_esm/index.js';
const here=new URL('.',import.meta.url);
const depth=new URL('../round-03/depth/',here);
const read=async(name)=>JSON.parse(await fs.readFile(new URL(name,depth),'utf8'));
const quoter=(await read('quoter.json')).data;
const state=(await read('stateView.json')).data;
const erc20=parseAbi(['function decimals() view returns (uint8)']);
const Q192=1n<<192n;
const SCALE=10n**24n;
const ratio=(n,d)=>Number(n*SCALE/d)/1e24;
const norm=(v)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x).toLowerCase();
const expectedBases=new Set(['0xd6fde6a3fc6ab2d83b2be58383944ca1bade1e18','0x351ab2c51e223b28d219fe28cc3956410cc11e18']);
function manualPoolId(key){
  const word=(x)=>x.replace(/^0x/,'').padStart(64,'0');
  const numeric=(x)=>word(BigInt.asUintN(256,BigInt(x)).toString(16));
  return keccak256('0x'+word(key.currency0)+word(key.currency1)+numeric(key.fee)+numeric(key.tickSpacing)+word(key.hooks));
}
const reports=[];
for(const name of ['quotes-first.json','quotes-four-pools.json']){
  const data=await read(name);
  const errors=[];
  const poolResults=[];
  const allowedAddresses=new Set([data.addresses.quoter,data.addresses.stateView,...data.pools.flatMap(p=>[p.poolKey.currency0,p.poolKey.currency1])].map(x=>x.toLowerCase()));
  if(data.chainId!==4663)errors.push('Unexpected chainId');
  let quoteCount=0,decimalCount=0,largestShortfallDifferencePp=0;
  const decodedCalls=[];
  for(const [i,call] of data.calls.entries()){
    if(call.response.error)errors.push(`RPC error at call ${i}`);
    if(!['eth_chainId','eth_getBlockByNumber','eth_call'].includes(call.request.method))errors.push(`Disallowed method ${call.request.method}`);
    if(call.request.method==='eth_chainId'&&Number(BigInt(call.response.result))!==4663)errors.push('Chain response mismatch');
    if(call.request.method==='eth_getBlockByNumber'&&['number','hash','timestamp'].some(k=>call.response.result[k]!==data.block[k]))errors.push('Header response mismatch');
    if(call.request.method!=='eth_call')continue;
    if(call.request.params[1]!==data.block.number)errors.push(`Different block at ${i}`);
    const address=call.request.params[0].to.toLowerCase();
    if(!allowedAddresses.has(address))errors.push(`Unexpected called address ${address}`);
    const abi=address===data.addresses.quoter.toLowerCase()?quoter.abi:address===data.addresses.stateView.toLowerCase()?state.abi:erc20;
    const decoded=decodeFunctionData({abi,data:call.request.params[0].data});
    const result=decodeFunctionResult({abi,functionName:decoded.functionName,data:call.response.result});
    decodedCalls.push({address,name:decoded.functionName,args:decoded.args,result});
    if(decoded.functionName==='decimals')decimalCount++;
  }
  for(const pool of data.pools){
    const hash=manualPoolId(pool.poolKey);
    if(hash!==pool.poolId.toLowerCase())errors.push(`Hash mismatch ${pool.poolId}`);
    const baseAddress=pool.baseAddress||(expectedBases.has(pool.poolKey.currency0.toLowerCase())?pool.poolKey.currency0:pool.poolKey.currency1);
    if(!expectedBases.has(baseAddress.toLowerCase()))errors.push(`Unexpected base ${baseAddress}`);
    const baseIs0=baseAddress.toLowerCase()===pool.poolKey.currency0.toLowerCase();
    if(baseIs0!==pool.baseIsCurrency0)errors.push(`Wrong currency orientation ${pool.poolId}`);
    const slotCall=decodedCalls.find(c=>c.name==='getSlot0'&&c.args[0].toLowerCase()===pool.poolId.toLowerCase());
    if(!slotCall||slotCall.result.some((x,i)=>String(x)!==String(pool.slot0[i])))errors.push(`Slot0 mismatch ${pool.poolId}`);
    const decimals={};
    for(const currency of ['currency0','currency1']){
      const addr=pool.poolKey[currency].toLowerCase();
      const d=decodedCalls.find(c=>c.name==='decimals'&&c.address===addr)?.result;
      if(d!==undefined)decimals[currency]=Number(d);
    }
    if(name==='quotes-four-pools.json'&&(decimals.currency0!==pool.decimals0||decimals.currency1!==pool.decimals1))errors.push(`Decimals mismatch ${pool.poolId}`);
    const sqrt=BigInt(pool.slot0[0]);const sq=sqrt*sqrt;
    const protocol=Number(pool.slot0[2]);const lp=Number(pool.slot0[3]);
    const protocol0=protocol&0xfff,protocol1=protocol>>>12;
    const aggregateFeePips0=protocol0+lp-Math.floor(protocol0*lp/1e6);
    const aggregateFeePips1=protocol1+lp-Math.floor(protocol1*lp/1e6);
    let maxDiff=0;
    for(const quote of pool.quotes){
      quoteCount++;
      if(quote.error)errors.push(`Quote error ${pool.poolId}`);
      const direction=quote.side==='sell'?baseIs0:!baseIs0;
      if(direction!==quote.zeroForOne)errors.push(`Direction mismatch ${pool.poolId}`);
      const call=decodedCalls.find(c=>c.name==='quoteExactInputSingle'&&norm(c.args[0].poolKey)===norm(pool.poolKey)&&c.args[0].zeroForOne===direction&&String(c.args[0].exactAmount)===quote.exactAmount);
      if(!call||String(call.result[0])!==quote.outputRaw||String(call.result[1])!==quote.gasEstimate)errors.push(`Quote result mismatch ${pool.poolId} ${quote.side} ${quote.notionalQuoteAtSpot}`);
      const numerator=BigInt(quote.exactAmount)*(direction?sq:Q192);
      const denominator=direction?Q192:sq;
      const recalculated=ratio(numerator-BigInt(quote.outputRaw)*denominator,numerator)*100;
      const difference=Math.abs(recalculated-quote.shortfallVsSpotPct);
      maxDiff=Math.max(maxDiff,difference);
      if(difference>1e-8)errors.push(`Material numeric difference ${difference}`);
    }
    largestShortfallDifferencePp=Math.max(largestShortfallDifferencePp,maxDiff);
    poolResults.push({name:pool.name,poolId:pool.poolId,hashMatches:hash===pool.poolId.toLowerCase(),decimals,protocolPacked:protocol,protocolPips0:protocol0,protocolPips1:protocol1,lpFeePips:lp,aggregateCoreFeePct0:aggregateFeePips0/10000,aggregateCoreFeePct1:aggregateFeePips1/10000,maxShortfallDifferencePp:maxDiff});
  }
  reports.push({file:name,chainId:data.chainId,block:data.block,blockDecimal:Number(BigInt(data.block.number)),utc:new Date(Number(BigInt(data.block.timestamp))*1000).toISOString(),calls:data.calls.length,ethCalls:decodedCalls.length,quoteCount,decimalCount,largestShortfallDifferencePp,errors,pools:poolResults});
}
const result={reviewedAt:new Date().toISOString(),method:'Offline ABI decode, independent manual PoolKey encoding and BigInt raw-unit price ratios; no rerun of simulation.',reports};
await fs.writeFile(new URL('depth-review-calculations.json',here),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
