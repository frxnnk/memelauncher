import { Store } from './store';
import { preflight } from './manifest';
import { hash } from './canonical';
import { runProcess } from './process';
import { decide } from './decision';
import { OfflineAdapter } from './adapter';
import { manifestSchema, type Manifest } from './schema';

export async function execute(store:Store,m:Manifest,timeoutMs?:number) {
  m=manifestSchema.parse(m); // Reject unrecognized fields before persisting anything.
  const run=store.create(m);
  try {
    preflight(m);store.transition(run.id,'PREFLIGHT_PASSED');
    store.artifact(run.id,'commitment',{manifest_hash:run.manifest_hash,recorded_at:new Date().toISOString(),scope:'LOCAL_ONLY',independent_timestamp:false});
    store.transition(run.id,'COMMITTED');
    preflight(m);store.transition(run.id,'RUNNING');
    const {frames,result}=await runProcess(m,f=>store.event(run.id,f),timeoutMs);
    // Re-check files after execution as well as before. This is not adversarial host attestation.
    preflight(m);
    const outcome=decide(m,frames,result,run.manifest_hash);
    store.artifact(run.id,'frames',frames);store.artifact(run.id,'runner_result',result);
    store.artifact(run.id,'decision',{decision:outcome.decision,counts:outcome.counts,provenance:m.runner});
    store.transition(run.id,outcome.decision);
    const adapter=new OfflineAdapter(store);
    store.artifact(run.id,'preview',adapter.preview(m));
    if(outcome.decision==='LAUNCH_SIGNAL') {
      const receipt=await adapter.request_once(run.id,m);
      if(!adapter.verify_receipt(receipt,m,run.id)) throw new Error('Invalid mock receipt');
      store.artifact(run.id,'receipt',receipt);
    }
  } catch {
    store.event(run.id,{type:'error',code:'PREFLIGHT_OR_RUNNER_INVALID',provenance:m.runner});
    if(!['INVALID','NO_LAUNCH','LAUNCH_SIGNAL'].includes(store.get(run.id).state)) store.transition(run.id,'INVALID');
  }
  return store.get(run.id);
}
export function exportRun(store:Store,id:string) {
  const run=store.get(id), artifacts=store.artifacts(id),events=store.events(id);
  const body={schema:'bellfly-evidence-v1',run,artifacts,events,
    limitation:'Local hashes detect changes against this record; not an independent timestamp, cryptographic execution proof or trustless system.'};
  return {...body,export_hash:hash(body)};
}
