import { canonical, hash } from './canonical';
import { preflight } from './manifest';
import { manifestSchema, type Frame } from './schema';
import { decide } from './decision';
import { runProcess } from './process';
import { OfflineAdapter } from './adapter';
import type { exportRun } from './controller';
export type Bundle=ReturnType<typeof exportRun>;
export function verifyBundle(bundle:Bundle) {
  const {export_hash,...body}=bundle;
  if(hash(body)!==export_hash) throw new Error('Export modified');
  const m=manifestSchema.parse(bundle.run.manifest);
  if(hash(m)!==bundle.run.manifest_hash) throw new Error('Manifest modified');
  const names=new Set<string>();
  for(const a of bundle.artifacts) {if(names.has(a.name)||hash(a.value)!==a.hash) throw new Error('Artifact modified');names.add(a.name);}
  const get=(name:string)=>{const a=bundle.artifacts.find(a=>a.name===name);if(!a) throw new Error('Missing artifact');return a.value;};
  const commit=get('commitment');
  if(commit.manifest_hash!==bundle.run.manifest_hash||commit.scope!=='LOCAL_ONLY'||commit.independent_timestamp!==false)throw new Error('Commitment mismatch');
  const states=bundle.events.filter(e=>e.type==='state').map(e=>e.state);
  if(hash(states)!==hash(['DRAFT','PREFLIGHT_PASSED','COMMITTED','RUNNING',bundle.run.state]))throw new Error('State history mismatch');
  bundle.events.forEach((e,i)=>{if(e.event_seq!==i||e.provenance!==m.runner)throw new Error('Event sequence/provenance mismatch');});
  const frames=get('frames') as Frame[];
  const decision=decide(m,frames,get('runner_result'),bundle.run.manifest_hash);
  if(decision.decision!==get('decision').decision || decision.decision!==bundle.run.state || hash(decision.counts)!==hash(get('decision').counts)) throw new Error('Decision mismatch');
  const recordedFrames=bundle.events.filter(e=>e.type==='frame').map(({event_seq: _seq,...e})=>e);
  if(hash(recordedFrames)!==hash(frames)) throw new Error('Events mismatch');
  const preview=get('preview');
  if(preview.provenance!=='MOCK'||preview.emission_enabled!==false||hash(preview.terms)!==hash(m.terms)) throw new Error('Preview mismatch');
  const receipt=bundle.artifacts.find(a=>a.name==='receipt');
  if(bundle.run.state==='NO_LAUNCH' && receipt)throw new Error('Negative result has receipt');
  if(receipt && !OfflineAdapter.prototype.verify_receipt(receipt.value,m,bundle.run.id)) throw new Error('Receipt mismatch');
  return {status:'VERIFIED_LOCAL',decision:decision.decision,provenance:m.runner,independent_timestamp:false};
}
export async function replay(bundle:Bundle) {
  verifyBundle(bundle);const m=preflight(bundle.run.manifest);
  const original=bundle.artifacts.find(a=>a.name==='frames')!.value;
  const repeated=await runProcess(m);
  const d=decide(m,repeated.frames,repeated.result,bundle.run.manifest_hash);
  if(canonical(original)!==canonical(repeated.frames)||d.decision!==bundle.run.state) throw new Error('Replay differs');
  return {status:'REPLAY_MATCH',frames:repeated.frames.length,decision:d.decision,tolerance_us:0,scope:'Pinned local environment only; cross-hardware equivalence untested'};
}
