import { hash } from './canonical';
import { type Manifest, termsSchema } from './schema';
import { Store } from './store';
import { decide } from './decision';

export interface MockReceipt { provenance:'MOCK'; status:'SIMULATED'; run_id:string; terms_hash:string; tx_hash:null; token_address:null; curve_address:null; pool_id:null; }
export interface LaunchAdapter {
  preview(m:Manifest): unknown;
  request_once(id:string,m:Manifest): Promise<MockReceipt|null>;
  reconcile(id:string): MockReceipt|null;
  verify_receipt(receipt:unknown,m:Manifest,id:string): boolean;
}
// Own interface names; NOT provider endpoints. This class has no HTTP client or signer.
export class OfflineAdapter implements LaunchAdapter {
  constructor(private store:Store, private simulate:()=>Promise<void>=async()=>{}) {}
  preview(m:Manifest) {
    termsSchema.parse(m.terms);
    return {provenance:'MOCK',status:'OFFLINE_PREVIEW',terms:m.terms,terms_hash:hash(m.terms),
      emission_enabled:false,blocking:['Live executor absent','Economics/issuer/beneficiary unapproved','NVDA route unverified','Scientific validation incomplete']};
  }
  async request_once(id:string,m:Manifest):Promise<MockReceipt|null> {
    termsSchema.parse(m.terms);
    if(m.live_execution_enabled!==false) throw new Error('Live execution disabled');
    const run=this.store.get(id);
    if(run.manifest_hash!==hash(m) || run.state!=='LAUNCH_SIGNAL') throw new Error('No verified launch signal');
    const artifacts=this.store.artifacts(id);
    const frames=artifacts.find(a=>a.name==='frames'),result=artifacts.find(a=>a.name==='runner_result');
    if(!frames||!result||hash(frames.value)!==frames.hash||hash(result.value)!==result.hash||decide(m,frames.value,result.value,run.manifest_hash).decision!=='LAUNCH_SIGNAL') throw new Error('Signal evidence invalid');
    const reserved=this.store.atomic(()=>{
      const old=this.store.db.prepare('SELECT * FROM attempts WHERE run_id=?').get(id);
      if(old) {if(old.terms_hash!==hash(m.terms)) throw new Error('Terms mismatch');return false;}
      this.store.db.prepare('INSERT INTO attempts VALUES(?,?,?,NULL)').run(id,'RESERVED',hash(m.terms));return true;
    });
    if(!reserved) return this.reconcile(id);
    try {
      await this.simulate();
      const receipt:MockReceipt={provenance:'MOCK',status:'SIMULATED',run_id:id,terms_hash:hash(m.terms),tx_hash:null,token_address:null,curve_address:null,pool_id:null};
      this.store.db.prepare('UPDATE attempts SET status=?,receipt=? WHERE run_id=?').run('SIMULATED',JSON.stringify(receipt),id);
      return receipt;
    } catch {
      this.store.db.prepare('UPDATE attempts SET status=? WHERE run_id=?').run('AMBIGUOUS',id);
      return null; // Never resubmit on uncertain completion, including across restart.
    }
  }
  reconcile(id:string) {
    const row=this.store.db.prepare('SELECT receipt FROM attempts WHERE run_id=?').get(id);
    return row?.receipt?JSON.parse(row.receipt as string) as MockReceipt:null;
  }
  verify_receipt(raw:unknown,m:Manifest,id:string) {
    if(!raw || typeof raw!=='object') return false;
    const r=raw as MockReceipt;
    return hash(r)===hash({provenance:'MOCK',status:'SIMULATED',run_id:id,terms_hash:hash(m.terms),tx_hash:null,token_address:null,curve_address:null,pool_id:null});
  }
}
export function requestLive(_input:unknown):never { throw new Error('LIVE_EXECUTOR_NOT_IMPLEMENTED'); }
