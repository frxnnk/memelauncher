import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeAbiParameters,parseAbiParameters} from 'viem';
import {readOnlyClient,validateInputs,buildParams,QUOTES,oracleReview,gasReview,requireLaunchableFactory} from './core.mjs';
const fixture=JSON.parse(readFileSync(new URL('../inputs.rehearsal.json',import.meta.url)));
test('paused or unknown factory state blocks even if ticker is available',()=>{
  requireLaunchableFactory(false,true);
  for(const paused of [true,undefined,null]) assert.throws(()=>requireLaunchableFactory(paused,true),/paused/);
  assert.throws(()=>requireLaunchableFactory(false,false),/unavailable/);
});
test('signing, broadcasting and account access cannot reach the transport',async()=>{
  let requests=0;
  const client=readOnlyClient(async()=>{requests++;throw Error('Unexpected network');});
  for(const method of ['eth_sendRawTransaction','eth_sendTransaction','eth_sign','personal_sign','eth_accounts','wallet_switchEthereumChain'])
    await assert.rejects(client.request({method,params:[]}),/forbidden/);
  assert.equal(requests,0);
});
test('public input validation rejects accidental keys, missing addresses and unsupported quote',()=>{
  validateInputs(fixture);
  for(const extra of [{privateKey:'do-not-accept'},{live_execution_enabled:true},{acceptLastPublishedOracle:true}])
    assert.throws(()=>validateInputs({...fixture,...extra}),/Unknown input/);
  for(const creator of [null,'0x0000000000000000000000000000000000000000'])
    assert.throws(()=>validateInputs({...fixture,creator}));
  assert.throws(()=>validateInputs({...fixture,quote:'GOOG'}),/supported quote/);
});
test('GOOGL calldata has selected identity and full pool supply, no OCAT identity or vesting',()=>{
  const client=readOnlyClient(async()=>{throw Error('Network not allowed');});
  const {params,createParams}=buildParams(fixture,332,'0x0000000000000000000000000000000000000002',client);
  const token=decodeAbiParameters(parseAbiParameters('string,string,(uint64 cliff,uint64 duration)[],address[],uint256[],uint256[],string,uint256,uint48,address,address[]'),createParams.tokenFactoryData);
  assert.equal(token[0],'BELLFLY'); assert.equal(token[1],'BELLFLY');
  assert.equal(createParams.numeraire.toLowerCase(),QUOTES.GOOGL.address.toLowerCase());
  assert.equal(createParams.initialSupply,10n**27n);
  assert.equal(createParams.numTokensToSell,createParams.initialSupply);
  assert.deepEqual(token[2],[]); assert.deepEqual(token[3],[]); assert.deepEqual(token[5],[]);
  assert.equal(params.pool.beneficiaries.reduce((sum,item)=>sum+item.shares,0n),10n**18n);
});
test('stale prices fail strict preparation; explicit fictional diagnosis remains unvalidated',()=>{
  const round=[10n,33200000000n,100n,100n,10n];
  assert.equal(oracleReview(round,8,3700n).stale,false);
  assert.throws(()=>oracleReview(round,8,3701n),/older than 1h/);
  assert.throws(()=>oracleReview(round,8,4000n,{diagnosticStale:true}),/fictional/);
  const diagnostic=oracleReview(round,8,4000n,{rehearsal:true,diagnosticStale:true});
  assert.equal(diagnostic.stale,true); assert.equal(diagnostic.pricingValidated,false);
  assert.throws(()=>oracleReview(round,8,99n,{rehearsal:true,diagnosticStale:true}),/Invalid/);
});
test('cost review preserves missing estimates and cannot imply funding or a budget approval',()=>{
  assert.equal(gasReview(null,10n,0n,null).capCoversMargin,null);
  const gas=gasReview(101n,10n,0n,'1210');
  assert.equal(gas.gasLimitWith20PercentMargin,122n);
  assert.equal(gas.capCoversMargin,false); assert.equal(gas.balanceCoversMargin,false);
});
