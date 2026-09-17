import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileHash, hash } from './canonical';
import { manifestSchema, type Manifest } from './schema';

export const ROOT = resolve(import.meta.dirname, '..');
export function pythonPath() {
  return process.env.BELLFLY_PYTHON || resolve(ROOT, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
}
export function runnerEnv(): NodeJS.ProcessEnv {
  // Explicit allowlist. Launch keys/control tokens are never inherited by the runner.
  return { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR,
    PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP,
    PYTHONHASHSEED: '0', PYTHONNOUSERSITE:'1', PYTHONDONTWRITEBYTECODE:'1',
    OPENBLAS_NUM_THREADS:'1', OMP_NUM_THREADS:'1', MKL_NUM_THREADS:'1' };
}
export function codeFiles() {
  return ['server','runner'].flatMap(dir => readdirSync(resolve(ROOT,dir)).filter(f => /\.(ts|py)$/.test(f)).map(f => dir+'/'+f)).concat(['package.json','package-lock.json','requirements.lock.txt','vendor/shiu.pin.json']);
}
export function codeHash() { return hash(Object.fromEntries(codeFiles().map(p => [p,fileHash(resolve(ROOT,p))]))); }
const scientificFiles = ['model.py','LICENSE','example.ipynb','2023_03_23_completeness_630_final.csv','2023_03_23_connectivity_630_final.parquet'].map(f => 'vendor/shiu/'+f);
export function makeManifest(real = false, hz = 100, silence = false): Manifest {
  const notebook = JSON.parse(readFileSync(resolve(ROOT,'vendor/shiu/example.ipynb'),'utf8'));
  const source = notebook.cells.map((c: {source:string[]}) => c.source.join('')).find((s:string) => s.startsWith('neu_sugar =')) as string;
  const ids = source.match(/720\d+/g)!;
  const files = ['runner/main.py','runner/mock.py','runner/reference.py', ...(real ? scientificFiles : [])];
  const environment = JSON.parse(execFileSync(pythonPath(), [resolve(ROOT,'runner/main.py'),'--environment', ...(real ? ['--real'] : [])], {env:runnerEnv(),encoding:'utf8'}));
  return manifestSchema.parse({schema:'bellfly-manifest-v1',kind:'ENGINEERING_REHEARSAL',live_execution_enabled:false,
    created_at:new Date().toISOString(),runner:real?'SHIU_REFERENCE':'MOCK',
    model_commit:real?'91bdd1e7dcf193f3e7ca5a8933497fcef63b7960':'synthetic-fixture-v1',
    files:Object.fromEntries(files.map(p => [p,fileHash(resolve(ROOT,p))])), code_hash:codeHash(), environment,
    seed:{mechanism:'FIXED_LOCAL',value:20260910},duration_ms:1000,dt_us:100,bin_ms:10,
    stimulus:{type:'sugarR',hz,neuron_ids:ids,silence_output:silence},
    rule:{output_ids:['720575940660219265'],min_spikes:1,consecutive_bins:3,
      rationale:'MN9 identified in upstream example.ipynb. Three consecutive 10ms bins with >=1 MN9 spike is a provisional engineering bell rule, not a validated biological or financial threshold. Frozen before this rehearsal; no optimization for LAUNCH.'},
    terms:{chain:'robinhood',chain_id:4663,platform:'bankr-proposed',issuer:'UNSET',quote_asset:'NVDA_UNVERIFIED',beneficiary:'UNSET',supply:null,creator_allocation:0,initial_buy:0,disable_vesting:true,fee_bps:null,max_budget_wei:'0',status:'PROPOSED'},
    commitment:{scope:'LOCAL_ONLY',independent_timestamp:false}});
}
export function preflight(input: unknown): Manifest {
  const m = manifestSchema.parse(input);
  if (m.duration_ms % m.bin_ms !== 0 || m.rule.consecutive_bins > m.duration_ms/m.bin_ms) throw new Error('Invalid window');
  if (new Set(m.rule.output_ids).size !== m.rule.output_ids.length) throw new Error('Duplicate output');
  if (m.code_hash !== codeHash()) throw new Error('Code mismatch');
  const expectedFiles = ['runner/main.py','runner/mock.py','runner/reference.py',...(m.runner==='SHIU_REFERENCE'?scientificFiles:[])];
  if (hash(Object.keys(m.files).sort()) !== hash(expectedFiles.sort())) throw new Error('File set mismatch');
  for (const [p,h] of Object.entries(m.files)) {
    if (!existsSync(resolve(ROOT,p)) || fileHash(resolve(ROOT,p)) !== h) throw new Error('File mismatch');
  }
  if(m.runner==='SHIU_REFERENCE' && m.model_commit!=='91bdd1e7dcf193f3e7ca5a8933497fcef63b7960') throw new Error('Model mismatch');
  if(m.runner==='SHIU_REFERENCE') {
    const pin=JSON.parse(readFileSync(resolve(ROOT,'vendor/shiu.pin.json'),'utf8').replace(/^\uFEFF/,''));
    for(const name of scientificFiles) if(m.files[name]!==pin.files[name.split('/').at(-1)!].sha256) throw new Error('Upstream pin mismatch');
  }
  return m;
}
