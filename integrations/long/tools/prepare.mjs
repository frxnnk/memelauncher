import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, decodeFunctionResult, parseAbi, keccak256, toHex } from 'viem';
import { airlockAbi, mineTokenAddress, isToken0Expected } from '@whetstone-research/doppler-sdk/evm';
import { RPC,QUOTES,TICKER,INTEGRATOR,ADDRESSES,readOnlyClient,validateInputs,buildParams,stringify,sha256,isEmptyCode,gasReview,oracleReview,requireLaunchableFactory } from './core.mjs';
import { reviewRuntimes } from './runtime-review.mjs';
import { verifyMetadata } from './metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const transcript = [];
const client = readOnlyClient(fetch, transcript);
const abi = parseAbi(['function owner() view returns(address)','function decimals() view returns(uint8)',
  'function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)',
  'function isTickerAvailable(string) view returns(bool)',
  'function paused() view returns(bool)',
  'function getModuleState(address) view returns(uint8)',
  'function isDopplerHookEnabled(address) view returns(uint256)']);
const snapshotOnly = process.argv.includes('--snapshot');
const rehearsal = process.argv.includes('--rehearsal');
const diagnosticStale=process.argv.includes('--diagnostic-stale-oracle');
let block, snapshot, input;
async function read(address, functionName, args=[]) {
  return client.readContract({address,abi,functionName,args,blockNumber:block});
}
async function main() {
  if (diagnosticStale && !rehearsal) throw new Error('Stale diagnostic requires fictional rehearsal mode');
  const pinnedSources={'sdk.js':'a47ec4c0059e83a14d32fc06295494b6886c715a81c41a2436f993937b07a4a1',
    'builder.js':'06f62af73a25691522d88c14d4536379e7a6a101b0cc4c73c7ec34f50ca593e5',
    'constants.js':'4b3ad440e01077f4d93c1ef26e571c45cbf1fc0417677b132e4df5493d6131d8',
    'assets.js':'0b0aace0f0f2d7f6314a3355f145afa8b730218e0356e6b1607ff7a536dda24b',
    'app-chains.js':'d2de7945f23dc229159c7d13396401538d5342644d14f4e9fbac94c2a7f6c643'};
  for(const [name,expected] of Object.entries(pinnedSources))
    if(sha256(readFileSync(resolve(root,'sources',name)))!==expected) throw new Error(`Captured source changed: ${name}; review encoding again`);
  for(const [name,version] of Object.entries({'@whetstone-research/doppler-sdk':'1.0.40',viem:'2.56.3'}))
    if(JSON.parse(readFileSync(resolve(root,'tools/node_modules',name,'package.json'),'utf8')).version!==version) throw new Error(`Wrong package version: ${name}`);
  const inputFile = process.argv.slice(2).find(arg=>!arg.startsWith('--'));
  input = JSON.parse(readFileSync(inputFile ?? resolve(root,'inputs.draft.json'),'utf8'));
  if (!Object.hasOwn(QUOTES,input.quote) || !/^[A-Z][A-Z0-9]{0,11}$/.test(input.symbol ?? '')) throw new Error('Explicit quote and ticker required');
  if (!snapshotOnly) validateInputs(input); // Reject missing public inputs before network requests.
  const quote=QUOTES[input.quote], META=quote.address, FEED=quote.feed;
  let metadata=null;
  if (!snapshotOnly) {
    const expected=JSON.parse(readFileSync(resolve(root,'metadata.draft.json'),'utf8'));
    if (input.name!==expected.name || input.symbol!==expected.symbol) throw new Error('Input identity differs from local metadata draft');
    if (rehearsal) {
      if (input.creator!=='0x0000000000000000000000000000000000000001' || input.feeRecipient!==input.creator || input.metadataURI!=='https://bellfly.invalid/metadata.json')
        throw new Error('Rehearsal requires fixed fictional address and reserved .invalid URI');
      const bytes=readFileSync(resolve(root,'metadata.draft.json'));
      if (sha256(bytes)!==input.metadataSha256) throw new Error('Local metadata hash mismatch');
      metadata={status:'LOCAL_FIXTURE_NOT_PUBLISHED',sha256:sha256(bytes),metadata:expected};
    } else metadata=await verifyMetadata(input,expected);
  }
  if (await client.getChainId() !== 4663) throw new Error('Wrong chain');
  block = await client.getBlockNumber();
  const [header, owner, tickerAvailable, decimals, round, gasPrice, factoryPaused] = await Promise.all([
    client.getBlock({blockNumber:block}),read(ADDRESSES.airlock,'owner'),read(TICKER,'isTickerAvailable',[input.symbol]),
    read(FEED,'decimals'),read(FEED,'latestRoundData'),client.getGasPrice(),read(TICKER,'paused')]);
  const targets = {tickerFactory:TICKER,integrator:INTEGRATOR,quote:META,feed:FEED,
    ...Object.fromEntries(['airlock','dopplerERC20V1Factory','dopplerERC20V1Implementation','dopplerHookInitializer','rehypeDopplerHookInitializer','noOpGovernanceFactory','noOpMigrator','poolManager'].map(k=>[k,ADDRESSES[k]]))};
  const codes = {};
  for (const [name,address] of Object.entries(targets)) {
    const code = await client.getCode({address,blockNumber:block});
    codes[name] = {address,bytes:((code?.length ?? 2)-2)/2,keccak256:keccak256(code ?? '0x')};
  }
  const moduleStates = {};
  for (const key of ['dopplerERC20V1Factory','dopplerHookInitializer','noOpGovernanceFactory','noOpMigrator'])
    moduleStates[key] = await read(ADDRESSES.airlock,'getModuleState',[ADDRESSES[key]]);
  const ageSeconds = header.timestamp - round[3];
  const hookEnabledFlags=await read(ADDRESSES.dopplerHookInitializer,'isDopplerHookEnabled',[ADDRESSES.rehypeDopplerHookInitializer]);
  const price = Number(round[1]) / 10**Number(decimals);
  snapshot = {observedAt:new Date().toISOString(),rpc:RPC,chainId:4663,quote:input.quote,quoteAddress:META,ticker:input.symbol,block,blockHash:header.hash,
    blockTimestamp:header.timestamp,owner,tickerAvailable,factoryPaused,oracle:{feed:FEED,decimals,round,priceUsd:price,ageSeconds},gasPriceWei:gasPrice,codes,moduleStates,hookEnabledFlags};
  const sourceFiles = ['builder.js','constants.js','assets.js','sdk.js','app-chains.js'];
  snapshot.sourceSha256 = Object.fromEntries(sourceFiles.map(name=>[name,sha256(readFileSync(resolve(root,'sources',name)))]));
  snapshot.packageLockSha256 = sha256(readFileSync(resolve(root,'tools/package-lock.json')));
  snapshot.toolSha256=Object.fromEntries(['prepare.mjs','core.mjs','metadata.mjs','runtime-review.mjs','frontend-encoding.mjs'].map(name=>[name,sha256(readFileSync(resolve(root,'tools',name)))]));
  snapshot.runtimeReview = reviewRuntimes(codes);
  if (snapshotOnly) { save('public-snapshot',snapshot); return; }
  if (snapshot.runtimeReview.differences.length) {
    save('runtime-review-blocked',{status:'BLOCKED_RUNTIME_REVIEW',approval:false,launch:false,snapshot});
    throw new Error('Reviewed runtime changed: inspect saved differences before simulation');
  }
  requireLaunchableFactory(factoryPaused,tickerAvailable);
  if(hookEnabledFlags!==3n)throw new Error('Rehype enabled flags differ from reviewed frontend deployment');
  snapshot.oracle.review=oracleReview(round,decimals,header.timestamp,{rehearsal,diagnosticStale});
  if (await read(META,'decimals') !== 18) throw new Error('Quote decimals mismatch');
  for (const key of Object.keys(codes).filter(k=>k!=='integrator')) if (!codes[key].bytes) throw new Error(`Missing deployed code: ${key}`);
  const expectedModules = {dopplerERC20V1Factory:1,dopplerHookInitializer:3,noOpGovernanceFactory:2,noOpMigrator:4};
  for (const [key,state] of Object.entries(expectedModules)) if (Number(moduleStates[key]) !== state) throw new Error(`Unexpected module role: ${key}`);
  const {params,createParams} = buildParams(input,price,owner,client);
  let startSalt = BigInt(input.startSalt ?? '0'), mined;
  for (let attempt=0;attempt<64;attempt++) {
    const candidate = mineTokenAddress({prefix:'',suffix:'1e18',tokenFactory:createParams.tokenFactory,
      initialSupply:createParams.initialSupply,recipient:ADDRESSES.airlock,owner:ADDRESSES.airlock,
      tokenData:createParams.tokenFactoryData,tokenVariant:'dopplerERC20V1',v2Implementation:ADDRESSES.dopplerERC20V1Implementation,
      maxIterations:1000000,startSalt});
    const ordering = isToken0Expected(META) ? BigInt(candidate.tokenAddress)<BigInt(META) : BigInt(candidate.tokenAddress)>BigInt(META);
    if (ordering && isEmptyCode(await client.getCode({address:candidate.tokenAddress,blockNumber:block}))) {mined=candidate;break;}
    startSalt=BigInt(candidate.salt)+1n;
  }
  if (!mined) throw new Error('No unused address found within bounded mining attempts');
  const finalParams = {...createParams,salt:mined.salt};
  const data = encodeFunctionData({abi:airlockAbi,functionName:'create',args:[finalParams]});
  const transaction = {from:input.creator,to:TICKER,data,value:'0x0'};
  // Explicit eth_call preserves the supplied public creator and mined salt. No SDK execute/create method.
  let callResult;
  try {callResult = await client.request({method:'eth_call',params:[transaction,toHex(block)]});}
  catch(error) {
    save('failed-unsigned-simulation',{status:'FAILED_SIMULATION_NOT_APPROVED',approval:false,launch:false,live_execution_enabled:false,snapshot,input,metadata,params,
      createParams:finalParams,transaction,mined,error:error.message,
      caveat:'Raw unsigned input only. No successful simulation, gas estimate or deployment is claimed.'});
    throw error;
  }
  const predicted = decodeFunctionResult({abi:airlockAbi,functionName:'create',data:callResult});
  if (predicted[0].toLowerCase() !== mined.tokenAddress.toLowerCase()) throw new Error('Mined/simulated token address mismatch');
  let gasEstimate=null, estimateError=null;
  try {gasEstimate=BigInt(await client.request({method:'eth_estimateGas',params:[transaction,toHex(block)]}));}
  catch(error) {estimateError=error.message;}
  const balance = await client.getBalance({address:input.creator,blockNumber:block});
  const gas=gasReview(gasEstimate,gasPrice,balance,input.maxGasCostWei);
  const costBlockers=[];
  if(gasEstimate===null)costBlockers.push('Gas estimate unavailable');
  if(gas.maxGasCostWei===null)costBlockers.push('Proposed gas cost cap missing');
  if(gas.capCoversMargin===false)costBlockers.push('Proposed gas cost cap below observed estimate plus margin');
  if(gas.balanceCoversMargin===false)costBlockers.push('Observed public ETH balance below estimated cost plus margin');
  const packet = {status:diagnosticStale?'DIAGNOSTIC_SIMULATED_PRICING_NOT_VALIDATED':rehearsal?'REHEARSAL_SIMULATED_NOT_LAUNCH_READY':'UNSIGNED_NOT_APPROVED',approval:false,launch:false,live_execution_enabled:false,snapshot,input,metadata,params,createParams:finalParams,
    transaction,predictedCreateResult:predicted,predictedTokenAddress:mined.tokenAddress,mined,
    gas:{...gas,estimateError,gasPriceTiming:'latest; not pinned with other snapshot reads'},
    creatorInitialBuy:'0',attachedETH:'0',quoteDepositConfigured:'0',chainId:4663,
    blockers:[...(diagnosticStale?['Explicit stale-oracle diagnostic; pricing not validated']:[]),...(rehearsal?['Fictional creator/recipient; no user wallet represented','Reserved metadata URI; no metadata or image published']:[]),...costBlockers,'Final terms and budget approval before an official neural run required','Exact-input encoding must be rechecked against captured frontend SDK; current frontend equivalence remains unproven','Metadata image content and persistence still require review','Live executor, neural binding and receipt verification not implemented'],
    caveat:'Simulation is public eth_call only. No signing, wallet client, spending, approval or broadcast capability is implemented.'};
  save('unsigned-packet',packet);
}
function save(prefix,payload) {
  const text=stringify(payload)+'\n',hash=sha256(text),directory=resolve(root,'outputs');
  mkdirSync(directory,{recursive:true});
  const file=resolve(directory,`${prefix}-${hash}.json`);
  writeFileSync(file,text,{flag:'wx'});
  writeFileSync(file+'.sha256',hash+'\n',{flag:'wx'});
  writeFileSync(file+'.rpc.json',stringify(transcript)+'\n',{flag:'wx'});
  console.log(file);
}
main().catch(error=>{save('blocked',{status:'BLOCKED_NOT_LAUNCH_READY',approval:false,launch:false,live_execution_enabled:false,error:error.message,snapshot,input});console.error(error.message);process.exitCode=1;});
