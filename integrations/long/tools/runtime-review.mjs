// Exact compiled-runtime proofs, including getter-resolved immutable slots.
// These are six reviewed contracts, not an audit of every launch dependency.
export const REVIEWED_RUNTIMES = Object.freeze({
  airlock: Object.freeze({address:'0xeb7C034704eF8Dcd2D32324c1545f62fB4aD0862',bytes:5695,
    keccak256:'0x86b37100cbe9841771c452a592985b4e921254b127a380246073b84ec953f7f8',
    proof:'research/infrastructure-verification/comparison.json'}),
  dopplerERC20V1Implementation: Object.freeze({address:'0x3Be8B97Fd0e713B5aBE0649Fa830223B6B4BC599',bytes:13927,
    keccak256:'0x67a382a66d2b14a7032698e11c9ae4432435d2c803429d5c660692289ad10e12',
    proof:'research/token-verification/comparison.json'}),
  dopplerHookInitializer: Object.freeze({address:'0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544',bytes:25533,
    keccak256:'0xc41a91106002f15bf70ae266824317f3f3ac638ac72ca5253bae395fa47ee631',
    proof:'research/infrastructure-verification/explorer-review/immutable-comparison.json'}),
  rehypeDopplerHookInitializer: Object.freeze({address:'0x6f02324d20CC679d0E585290CAa6b16baCbC0F77',bytes:14564,
    keccak256:'0x5d33a1d867ba0d17cc7af077786b1356848c72f8e0bf960ef88aa15f7a6962d1',
    proof:'research/infrastructure-verification/hook-review/immutable-comparison.json'}),
  noOpGovernanceFactory: Object.freeze({address:'0x85f37f74Ef2478A770318bc810177a9835911aD7',bytes:180,
    keccak256:'0x306dda9c8ef29935e569bb402c1626e8ef2048acd6b52a06bc3417bb4752c43f',
    proof:'research/infrastructure-verification/comparison.json'}),
  noOpMigrator: Object.freeze({address:'0xba2F330EDb16cD8056f5988d8CE19BbC63475A0e',bytes:524,
    keccak256:'0x7bf5115543e8e0769ceabe4da9b8e23547c9e95c1cce15d24d96f164406129e3',
    proof:'research/infrastructure-verification/migrator-immutable-comparison.json'})
});

export function reviewRuntimes(codes) {
  const differences=[];
  for(const [name,expected] of Object.entries(REVIEWED_RUNTIMES)) {
    const actual=codes[name];
    if(!actual) { differences.push({name,field:'contract',expected:'present',actual:null}); continue; }
    for(const field of ['address','bytes','keccak256']) {
      const normalize=value=>typeof value==='string'?value.toLowerCase():value;
      if(normalize(actual[field])!==normalize(expected[field]))
        differences.push({name,field,expected:expected[field],actual:actual[field]??null});
    }
  }
  return {status:differences.length?'REVIEWED_RUNTIME_CHANGED':'REVIEWED_RUNTIMES_MATCH',differences,
    reviewedContracts:Object.keys(REVIEWED_RUNTIMES),
    recordedWithoutCompiledProof:Object.keys(codes).filter(name=>!Object.hasOwn(REVIEWED_RUNTIMES,name)),
    caveat:'Code identity only. Does not prove storage, authority, proxy implementation, oracle freshness or future token state. Proof paths refer to the OCAT source project.'};
}
