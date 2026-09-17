import { createHash } from 'node:crypto';
import { createPublicClient, custom, getAddress, parseEther, zeroAddress } from 'viem';
import { DopplerSDK, MulticurveBuilder, RehypeFeeRoutingMode, getAddresses } from '@whetstone-research/doppler-sdk/evm';
import { frontendPoolInitializerData } from './frontend-encoding.mjs';

export const RPC = 'https://rpc.mainnet.chain.robinhood.com/';
// Captured Long stock registry, 2026-09-08. Recheck deployed identity and oracle per snapshot.
export const QUOTES = Object.freeze({
  GOOGL: {address:'0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',feed:'0xF6f373a037c30F0e5010d854385cA89185AE638b'},
  META: {address:'0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35',feed:'0x7C38C00C30BEe9378381E7B6135d7283356D71b1'},
  NVDA: {address:'0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',feed:'0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15'}
});
export const TICKER = '0x22e99278308B393ea1260859B181AD7E78f5eeED';
export const INTEGRATOR = '0x92d435C96E63c43E12d6D0AB28f6b0B04072F765';
// Long's captured SDK deployment registry predates npm1.0.40. Use its explicit Rehype initializer.
export const ADDRESSES = {...getAddresses(4663),rehypeDopplerHookInitializer:'0x6f02324d20CC679d0E585290CAa6b16baCbC0F77'};
export const ALLOWED = new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance']);
export const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const isEmptyCode = code => code === undefined || code === '0x';
export function requireLaunchableFactory(paused,tickerAvailable) {
  if (paused !== false) throw new Error('Long ticker factory paused or pause state unverified');
  if (tickerAvailable !== true) throw new Error('Selected ticker unavailable or availability unverified');
}
export function oracleReview(round, decimals, timestamp, {rehearsal=false,diagnosticStale=false}={}) {
  const ageSeconds=timestamp-round[3];
  if (diagnosticStale && !rehearsal) throw new Error('Stale diagnostic requires fictional rehearsal mode');
  if (round[1]<=0n || round[3]===0n || ageSeconds<0n || round[4]<round[0] || Number(decimals)!==8)
    throw new Error('Invalid oracle observation');
  const stale=ageSeconds>3600n;
  if (stale && !diagnosticStale) throw new Error('Oracle older than 1h: no stale-price fallback');
  return {ageSeconds,stale,pricingValidated:!stale,mode:diagnosticStale?'EXPLICIT_DIAGNOSTIC_ONLY':'STRICT_1H'};
}
export function gasReview(estimate,gasPrice,balance,cap) {
  const gasLimitWith20PercentMargin=estimate===null?null:(estimate*120n+99n)/100n;
  const marginCostWei=gasLimitWith20PercentMargin===null?null:gasLimitWith20PercentMargin*gasPrice;
  return {estimate,gasPriceWei:gasPrice,estimatedGasCostWei:estimate===null?null:estimate*gasPrice,
    gasLimitWith20PercentMargin,marginCostWei,balanceWei:balance,maxGasCostWei:cap??null,
    capCoversMargin:cap==null||marginCostWei===null?null:BigInt(cap)>=marginCostWei,
    balanceCoversMargin:marginCostWei===null?null:balance>=marginCostWei,
    fundingDeficitWei:marginCostWei===null?null:marginCostWei>balance?marginCostWei-balance:0n,
    interpretation:'Cost comparisons at observed gas price, not a maxFeePerGas transaction ceiling or funding authorization'};
}
export function readOnlyClient(fetcher = fetch, transcript = []) {
  let id = 0;
  return createPublicClient({ transport: custom({ async request({ method, params }) {
    if (!ALLOWED.has(method)) throw new Error(`RPC method forbidden: ${method}`);
    const response = await fetcher(RPC, { method: 'POST', signal:AbortSignal.timeout(20000), headers: {'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0', id:++id, method, params}) });
    if (!response.ok) { transcript.push({method,params,httpStatus:response.status}); throw new Error(`Public RPC HTTP ${response.status}`); }
    const body = await response.json();
    transcript.push({method,params,result:body.result,error:body.error});
    if (body.error) throw new Error(stringify(body.error));
    return body.result;
  } }, {retryCount:0}) });
}
export function validateInputs(input) {
  const allowed = new Set(['name','symbol','quote','creator','feeRecipient','metadataURI','metadataSha256','metadataGateway','maxGasCostWei','startSalt','purpose']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`Unknown input field: ${key}`);
  if (input.purpose !== 'UNSIGNED_REVIEW_ONLY') throw new Error('purpose must be UNSIGNED_REVIEW_ONLY');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 64) throw new Error('Valid name required');
  if (!/^[A-Z][A-Z0-9]{0,11}$/.test(input.symbol ?? '')) throw new Error('Uppercase symbol required (1-12 characters)');
  if (!Object.hasOwn(QUOTES,input.quote)) throw new Error('Explicit supported quote required: GOOGL, NVDA or META');
  for (const key of ['creator','feeRecipient']) {
    if (!input[key] || getAddress(input[key]) === zeroAddress) throw new Error(`Missing valid public ${key}`);
  }
  if (!/^https:\/\/[^\s]+$|^ipfs:\/\/[^\s]+$/.test(input.metadataURI ?? '') || /TODO|example|placeholder/i.test(input.metadataURI)) throw new Error('Final metadataURI required; no upload is performed');
  if (!/^[a-f0-9]{64}$/i.test(input.metadataSha256 ?? '')) throw new Error('metadataSha256 required for exact final metadata bytes');
  if (input.maxGasCostWei != null && !/^[1-9][0-9]*$/.test(input.maxGasCostWei)) throw new Error('maxGasCostWei must be a positive decimal string');
  if (!/^[0-9]+$/.test(input.startSalt ?? '0')) throw new Error('startSalt must be a nonnegative decimal string');
}
export function curvesForPrice(price) {
  if (!Number.isFinite(price) || price <= 0) throw new Error('Positive finite oracle price required');
  // Exact two-stage Math.round and sign inversion in Long builder y(), then poolConfig.
  const tick = fdv => Math.round(Math.round(Math.log(1 / ((fdv / 1e9) / price)) / Math.log(1.0001)) / 8) * 8;
  return [{tickLower:-tick(20000),tickUpper:-tick(1250000000),numPositions:1,shares:parseEther('0.991')},
    {tickLower:-tick(1250000000),tickUpper:887264,numPositions:1,shares:parseEther('0.009')}];
}
export function buildParams(input, price, airlockOwner, publicClient) {
  const quote = QUOTES[input.quote];
  if (!quote) throw new Error('Unsupported quote');
  const beneficiaries = [{beneficiary:airlockOwner,shares:parseEther('0.05')},{beneficiary:getAddress(input.feeRecipient),shares:parseEther('0.95')}]
    .sort((a,b)=>a.beneficiary.toLowerCase()<b.beneficiary.toLowerCase()?-1:1);
  if (airlockOwner.toLowerCase() === input.feeRecipient.toLowerCase()) throw new Error('Recipient equals Airlock owner: reconcile duplicate frontend beneficiaries');
  const params = MulticurveBuilder.forChain(4663)
    .tokenConfig({type:'dopplerERC20V1',name:input.name,symbol:input.symbol,tokenURI:input.metadataURI})
    .saleConfig({initialSupply:parseEther('1000000000'),numTokensToSell:parseEther('1000000000'),numeraire:quote.address})
    .poolConfig({fee:1000,tickSpacing:8,curves:curvesForPrice(price),beneficiaries})
    .withGovernance({type:'noOp'}).withMigration({type:'noOp'})
    .withUserAddress(getAddress(input.creator)).withIntegrator(INTEGRATOR)
    .withRehypeDopplerHook({hookAddress:ADDRESSES.rehypeDopplerHookInitializer,buybackDestination:INTEGRATOR,
      startFee:800000,endFee:11200,durationSeconds:10,startingTime:0,feeRoutingMode:RehypeFeeRoutingMode.DirectBuyback,farTick:887256,
      feeDistributionInfo:{assetFeesToAssetBuybackWad:0n,assetFeesToNumeraireBuybackWad:714285714285714286n,assetFeesToBeneficiaryWad:0n,assetFeesToLpWad:285714285714285714n,numeraireFeesToAssetBuybackWad:142857142857142857n,numeraireFeesToNumeraireBuybackWad:714285714285714286n,numeraireFeesToBeneficiaryWad:0n,numeraireFeesToLpWad:142857142857142857n}}).build();
  const sdk = new DopplerSDK({publicClient,chainId:4663}); // Deliberately no wallet client.
  const createParams=sdk.factory.encodeCreateMulticurveParams(params);
  createParams.poolInitializerData=frontendPoolInitializerData(params,params.dopplerHook);
  return {params,createParams};
}
