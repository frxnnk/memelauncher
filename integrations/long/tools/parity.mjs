// Runs only the captured public SDK module in an isolated VM, with no network, wallet or filesystem APIs.
import vm from 'node:vm';
import { readFileSync,writeFileSync } from 'node:fs';
import * as viem from 'viem';
import * as noble from '@noble/hashes/sha3.js';
import { buildParams,readOnlyClient,sha256,stringify,ADDRESSES,QUOTES } from './core.mjs';
const source=readFileSync(new URL('../sources/sdk.js',import.meta.url),'utf8');
if(sha256(source)!=='a47ec4c0059e83a14d32fc06295494b6886c715a81c41a2436f993937b07a4a1')throw Error('Captured SDK changed: review before loading');
const chunks=[];
const context=vm.createContext({TURBOPACK:chunks,console:{warn(){},log(){}},Uint8Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,structuredClone});
vm.runInContext(source,context,{timeout:5000});
const chunk=chunks.find(c=>c.includes(193864));
const factory=chunk[chunk.indexOf(193864)+1];
const exported={};
factory({i(){return {...viem,...noble};},s(entries){for(let i=0;i<entries.length;){const name=entries[i++],type=entries[i++];exported[name]=type===0?entries[i++]:type();}}});
const creator='0x0000000000000000000000000000000000000001';
const input={name:'BELLFLY',symbol:'BELLFLY',quote:'GOOGL',creator,feeRecipient:creator,metadataURI:'https://bellfly.invalid/metadata.json'};
const packet=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8'),(key,value)=>typeof value==='string'&&/^\d+$/.test(value)&&['initialSupply','numTokensToSell','shares',...['assetFeesToAssetBuybackWad','assetFeesToNumeraireBuybackWad','assetFeesToBeneficiaryWad','assetFeesToLpWad','numeraireFeesToAssetBuybackWad','numeraireFeesToNumeraireBuybackWad','numeraireFeesToBeneficiaryWad','numeraireFeesToLpWad']].includes(key)?BigInt(value):value):null;
const {params,createParams}=packet??buildParams(input,612.24,'0x21E2ce70511e4FE542a97708e89520471DAa7A66',readOnlyClient());
const sdk=new exported.DopplerSDK({publicClient:readOnlyClient(),chainId:4663});
const bundled=sdk.factory.encodeCreateMulticurveParams(params);
// Independent transcription of captured builder.js stock branch, run through the captured Builder.
const selectedInput=packet?.input??input,price=packet?.snapshot.oracle.priceUsd??612.24;
const owner=packet?.snapshot.owner??'0x21E2ce70511e4FE542a97708e89520471DAa7A66';
const addresses=exported.getAddresses(4663),quote=QUOTES[selectedInput.quote].address;
const activeAddressKeys=['airlock','dopplerERC20V1Factory','dopplerERC20V1Implementation','dopplerHookInitializer','rehypeDopplerHookInitializer','noOpGovernanceFactory','noOpMigrator','poolManager'];
const activeAddressDifferences=activeAddressKeys.filter(k=>ADDRESSES[k].toLowerCase()!==addresses[k].toLowerCase());
const t=fdv=>Math.round(Math.round(Math.log(1/((fdv/1e9)/price))/Math.log(1.0001))/8)*8;
const independentParams=exported.MulticurveBuilder.forChain(4663)
  .tokenConfig({type:'dopplerERC20V1',name:selectedInput.name,symbol:selectedInput.symbol,tokenURI:selectedInput.metadataURI})
  .saleConfig({initialSupply:10n**27n,numTokensToSell:10n**27n,numeraire:quote})
  .poolConfig({fee:1000,tickSpacing:8,curves:[{tickLower:-t(20000),tickUpper:-t(1250000000),numPositions:1,shares:991000000000000000n},
    {tickLower:-t(1250000000),tickUpper:887264,numPositions:1,shares:9000000000000000n}],
    beneficiaries:[{beneficiary:owner,shares:50000000000000000n},{beneficiary:viem.getAddress(selectedInput.feeRecipient),shares:950000000000000000n}]
      .sort((a,b)=>a.beneficiary.toLowerCase()<b.beneficiary.toLowerCase()?-1:1)})
  .withGovernance({type:'noOp'}).withMigration({type:'noOp'}).withUserAddress(viem.getAddress(selectedInput.creator))
  .withIntegrator('0x92d435C96E63c43E12d6D0AB28f6b0B04072F765')
  .withRehypeDopplerHook({hookAddress:addresses.rehypeDopplerHookInitializer,buybackDestination:'0x92d435C96E63c43E12d6D0AB28f6b0B04072F765',
    startFee:800000,endFee:11200,durationSeconds:10,startingTime:0,feeRoutingMode:exported.RehypeFeeRoutingMode.DirectBuyback,farTick:887256,
    feeDistributionInfo:{assetFeesToAssetBuybackWad:0n,assetFeesToNumeraireBuybackWad:714285714285714286n,assetFeesToBeneficiaryWad:0n,assetFeesToLpWad:285714285714285714n,
      numeraireFeesToAssetBuybackWad:142857142857142857n,numeraireFeesToNumeraireBuybackWad:714285714285714286n,numeraireFeesToBeneficiaryWad:0n,numeraireFeesToLpWad:142857142857142857n}}).build();
const canonical=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const independentEncoded=sdk.factory.encodeCreateMulticurveParams(independentParams);
const builderDifferences=[...new Set([...Object.keys(params),...Object.keys(independentParams)])].filter(k=>canonical(params[k])!==canonical(independentParams[k]));
const independentEncodedDifferences=Object.keys(createParams).filter(k=>k!=='salt'&&canonical(createParams[k])!==canonical(independentEncoded[k]));
const tokenData=viem.decodeAbiParameters(viem.parseAbiParameters('string,string,(uint64 cliff,uint64 duration)[],address[],uint256[],uint256[],string,uint256,uint48,address,address[]'),createParams.tokenFactoryData);
const differences=Object.keys(createParams).filter(k=>k!=='salt' && stringify(createParams[k])!==stringify(bundled[k]));
const wordDifferences=[];
for(let offset=2;offset<Math.max(createParams.poolInitializerData.length,bundled.poolInitializerData.length);offset+=64){
  const npm=createParams.poolInitializerData.slice(offset,offset+64),frontend=bundled.poolInitializerData.slice(offset,offset+64);
  if(npm!==frontend)wordDifferences.push({word:(offset-2)/64,npm,frontend});
}
const result={scope:packet?'Exact supplied packet parameters, frontend versus adapted encoder; mined salt excluded.':'Offline fixture only. Same rebuilt parameters passed to captured frontend SDK and pinned npm SDK plus static Rehype adapter; random salt excluded.',
  sourceSha256:sha256(source),npmVersion:'1.0.40',differences,wordDifferences,fieldsCompared:Object.keys(createParams).filter(k=>k!=='salt'),
  independentBuilderComparison:{scope:'Separately transcribed captured stock branch plus captured MulticurveBuilder; same selected external inputs. Not an executed React form or onchain semantic audit.',builderDifferences,independentEncodedDifferences,
    differingValues:Object.fromEntries(builderDifferences.map(k=>[k,{tool:params[k],frontend:independentParams[k]}]))},
  decodedTokenDefaults:{schedules:tokenData[2],vestingBeneficiaries:tokenData[3],scheduleIds:tokenData[4],amounts:tokenData[5],maxBalanceLimit:tokenData[7],balanceLimitEnd:tokenData[8],controller:tokenData[9],excludedFromBalanceLimit:tokenData[10]},
  activeAddressRegistry:{addresses:Object.fromEntries(activeAddressKeys.map(k=>[k,addresses[k]])),differences:activeAddressDifferences},
  notCovered:['Live React form or metadata upload behavior','Oracle source/status selection including indicative fallback','Ticker race and state changes','Actual founder inputs when fixture mode is used','EVM execution, LP or role semantics','Salt equality: random SDK salt is deliberately replaced by independently mined salt']};
result.inputPacketSha256=process.argv[2]?sha256(readFileSync(process.argv[2])):null;
writeFileSync(new URL(`../outputs/parity-${sha256(stringify(result))}.json`,import.meta.url),stringify(result)+'\n',{flag:'wx'});
console.log(stringify(result));
if(differences.length||builderDifferences.length||independentEncodedDifferences.length||activeAddressDifferences.length)process.exitCode=1;

