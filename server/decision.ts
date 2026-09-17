import { frameSchema, resultSchema, type Frame, type Manifest, type RunnerResult, type Decision } from './schema';
import { hash } from './canonical';

export function validateFrame(raw: unknown, m: Manifest, index: number): Frame {
  const f = frameSchema.parse(raw);
  if (f.provenance !== m.runner || f.seq !== index || f.t_ms !== index*m.bin_ms) throw new Error('Frame sequence/provenance mismatch');
  if (index >= m.duration_ms/m.bin_ms) throw new Error('Too many frames');
  const seen = new Set<string>();
  for (const s of f.spikes) {
    if (s.t_us < f.t_ms*1000 || s.t_us >= (f.t_ms+m.bin_ms)*1000 || s.t_us % m.dt_us !== 0) throw new Error('Spike clock mismatch');
    const key = s.neuron_id+':'+s.t_us;
    if (seen.has(key)) throw new Error('Duplicate spike');
    seen.add(key);
  }
  return f;
}
export function decide(m: Manifest, frames: Frame[], rawResult: unknown, expectedHash: string): {decision:Decision; counts:number[]; result:RunnerResult} {
  const result = resultSchema.parse(rawResult);
  if (hash(m)!==expectedHash || result.manifest_hash!==expectedHash || result.provenance!==m.runner || result.seed!==m.seed.value || result.duration_ms!==m.duration_ms || hash(result.environment)!==hash(m.environment)) throw new Error('Completion mismatch');
  if (frames.length !== m.duration_ms/m.bin_ms) throw new Error('Incomplete run');
  if(m.runner==='SHIU_REFERENCE' && m.stimulus.silence_output && result.ablated_connections===0)throw new Error('Ablation unverified');
  const counts = frames.map((f,i) => validateFrame(f,m,i).spikes.filter(s => m.rule.output_ids.includes(s.neuron_id)).length);
  let streak = 0, fired = false;
  for (const n of counts) { streak=n>=m.rule.min_spikes?streak+1:0; if(streak>=m.rule.consecutive_bins) fired=true; }
  return {decision:fired?'LAUNCH_SIGNAL':'NO_LAUNCH',counts,result};
}
