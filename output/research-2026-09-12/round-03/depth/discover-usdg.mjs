// Public RPC reads only: locate initialization of two already-known USDG pools.
import fs from 'node:fs/promises';
import {parseAbiItem,encodeEventTopics,decodeEventLog} from '../../../../integrations/long/tools/node_modules/viem/_esm/index.js';
const rpcUrl='https://rpc.mainnet.chain.robinhood.com';
const event=parseAbiItem('event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)');
const ids=['0x2817c7a4f38cca11a4904ae67684fdbf0ac3fc4db36d796e82038b1f59725b34','0x494aac14b381472ecb618bd9fc62f2040d3e2132b1957cd01a31ca9e5cd97058'];
const result={rpcUrl,startedAt:new Date().toISOString(),calls:[],initializations:[]};
const stringify=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);
async function save(){await fs.writeFile(new URL('usdg-initializations.json',import.meta.url),stringify(result));}
async function rpc(method,params){
  if(!['eth_blockNumber','eth_getLogs'].includes(method))throw new Error('Read method not allowed');
  const request={jsonrpc:'2.0',id:result.calls.length+1,method,params};
  const response=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
  const data=await response.json();result.calls.push({at:new Date().toISOString(),request,response:data});await save();
  if(data.error)throw new Error(JSON.stringify(data.error));return data.result;
}
try{
  result.toBlock=await rpc('eth_blockNumber',[]);
  const latest=Number(BigInt(result.toBlock));
  const topic0=encodeEventTopics({abi:[event],eventName:'Initialize'})[0];
  for(let from=60652312;from<=latest;from+=40000){
    const logs=await rpc('eth_getLogs',[{address:'0x8366a39cc670b4001a1121b8f6a443a643e40951',fromBlock:'0x'+from.toString(16),toBlock:'0x'+Math.min(from+39999,latest).toString(16),topics:[topic0,ids]}]);
    for(const log of logs)result.initializations.push({log,decoded:decodeEventLog({abi:[event],data:log.data,topics:log.topics})});
    if(new Set(result.initializations.map(x=>x.decoded.args.id)).size===ids.length)break;
  }
}catch(error){result.error=error.message;}
result.completedAt=new Date().toISOString();await save();
console.log(stringify({error:result.error,initializations:result.initializations.map(x=>({block:x.log.blockNumber,transaction:x.log.transactionHash,args:x.decoded.args}))}));
