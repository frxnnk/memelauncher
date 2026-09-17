import { encodeAbiParameters,parseAbiParameters } from 'viem';

// Exact static Rehype tuple in captured Long SDK a47ec4c... (2026-09-08).
// SDK npm 1.0.40 adds fields/dynamic encoding; do not substitute that newer ABI here.
const hookABI=parseAbiParameters('(address numeraire,address buybackDst,uint24 startFee,uint24 endFee,uint32 durationSeconds,uint32 startingTime,uint8 feeRoutingMode,(uint256 assetFeesToAssetBuybackWad,uint256 assetFeesToNumeraireBuybackWad,uint256 assetFeesToBeneficiaryWad,uint256 assetFeesToLpWad,uint256 numeraireFeesToAssetBuybackWad,uint256 numeraireFeesToNumeraireBuybackWad,uint256 numeraireFeesToBeneficiaryWad,uint256 numeraireFeesToLpWad) feeDistributionInfo)');
const poolABI=parseAbiParameters('(uint24 fee,int24 tickSpacing,int24 farTick,(int24 tickLower,int24 tickUpper,uint16 numPositions,uint256 shares)[] curves,(address beneficiary,uint96 shares)[] beneficiaries,address dopplerHook,bytes onInitializationDopplerHookCalldata,bytes graduationDopplerHookCalldata)');
export function frontendPoolInitializerData(params,hook) {
  const hookData=encodeAbiParameters(hookABI,[{numeraire:params.sale.numeraire,buybackDst:hook.buybackDestination,
    startFee:hook.startFee,endFee:hook.endFee,durationSeconds:hook.durationSeconds,
    startingTime:hook.startingTime,feeRoutingMode:hook.feeRoutingMode,feeDistributionInfo:hook.feeDistributionInfo}]);
  return encodeAbiParameters(poolABI,[{fee:params.pool.fee,tickSpacing:params.pool.tickSpacing,farTick:hook.farTick,
    curves:params.pool.curves,beneficiaries:params.pool.beneficiaries,dopplerHook:hook.hookAddress,
    onInitializationDopplerHookCalldata:hookData,graduationDopplerHookCalldata:'0x'}]);
}

