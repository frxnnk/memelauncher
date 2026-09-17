import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { makeManifest, preflight, runnerEnv } from '../server/manifest';
import { canonical, hash } from '../server/canonical';
import { Store } from '../server/store';
import { execute, exportRun } from '../server/controller';
import { decide, validateFrame } from '../server/decision';
import { verifyBundle, replay } from '../server/evidence';
import { OfflineAdapter, requestLive } from '../server/adapter';
import { createApp } from '../server/http';
import type { Manifest } from '../server/schema';
import { referenceOptions } from '../server/options';

test('canonical hash ignores object key order and rejects non-finite/undefined',()=>{
  assert.equal(hash({b:2,a:1}),hash({a:1,b:2}));
  for(const v of [NaN,Infinity,undefined,{a:undefined}])assert.throws(()=>canonical(v));
});
test('manifest rejects corrupt data, changed code/configuration and enabled live mode',()=>{
  const m=makeManifest();
  assert.throws(()=>preflight({}));
  assert.throws(()=>preflight({...m,code_hash:'0'.repeat(64)}));
  assert.throws(()=>preflight({...m,files:{...m.files,'runner/mock.py':'0'.repeat(64)}}));
  assert.throws(()=>preflight({...m,duration_ms:105}));
  assert.throws(()=>preflight({...m,live_execution_enabled:true}));
  assert.throws(()=>preflight({...m,kind:'OFFICIAL'}));
});
test('MOCK end-to-end with actual Python subprocess and replay; tampering is detected',async()=>{
  const store=new Store(':memory:');const m=makeManifest();const run=await execute(store,m);
  assert.notEqual(run.state,'INVALID');const bundle=exportRun(store,run.id);
  assert.equal(verifyBundle(bundle).status,'VERIFIED_LOCAL');
  assert.equal((await replay(bundle)).status,'REPLAY_MATCH');
  for(const mutate of [
    (b:typeof bundle)=>b.run.manifest.seed.value++,
    (b:typeof bundle)=>b.run.manifest.stimulus.hz++,
    (b:typeof bundle)=>{b.run.manifest.files['runner/mock.py']='0'.repeat(64);},
    (b:typeof bundle)=>{b.artifacts.find(a=>a.name==='frames')!.value[0].spikes=[];},
    (b:typeof bundle)=>{b.run.state='NO_LAUNCH';},
  ]){const copy=structuredClone(bundle);mutate(copy);assert.throws(()=>verifyBundle(copy));}
  const receipt=bundle.artifacts.find(a=>a.name==='receipt')!.value;
  assert.equal(receipt.provenance,'MOCK');assert.equal(receipt.tx_hash,null);assert.equal(receipt.token_address,null);
  store.close();
});
test('negative result and timeout never reserve an emission attempt',async()=>{
  for(const timeout of [false,true]){
    const store=new Store(':memory:');const m=makeManifest(false,0);
    const run=await execute(store,m,timeout?1:undefined);
    assert.equal(run.state,timeout?'INVALID':'NO_LAUNCH');
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM attempts').get()!.n,0);
    if(!timeout)assert.equal(verifyBundle(exportRun(store,run.id)).decision,'NO_LAUNCH');
    store.close();
  }
});
test('missing/corrupt/mismatched final data and duplicate/fake events fail closed',async()=>{
  const store=new Store(':memory:');const m=makeManifest();const run=await execute(store,m);
  const artifacts=store.artifacts(run.id);const frames=artifacts.find(a=>a.name==='frames')!.value;
  const result=artifacts.find(a=>a.name==='runner_result')!.value;
  assert.throws(()=>decide(m,frames.slice(1),result,run.manifest_hash));
  assert.throws(()=>decide(m,frames,null,run.manifest_hash));
  assert.throws(()=>decide(m,frames,{...result,seed:1},run.manifest_hash));
  assert.throws(()=>decide(m,frames,{...result,provenance:'SHIU_REFERENCE'},run.manifest_hash));
  assert.throws(()=>decide(m,frames,{...result,duration_ms:1},run.manifest_hash));
  assert.throws(()=>validateFrame(frames[0],m,1));
  assert.throws(()=>validateFrame({...frames[0],spikes:[...frames[0].spikes,...frames[0].spikes]},m,0));
  assert.throws(()=>validateFrame({...frames[0],provenance:'FRONTEND'},m,0));
  assert.throws(()=>validateFrame({...frames[0],spikes:[{neuron_id:'x',t_us:-1}]},m,0));
  store.close();
});
test('durable atomic reservation, concurrent duplicate calls and restart do not resubmit',async()=>{
  const dir=mkdtempSync(resolve(tmpdir(),'bellfly-test-')),path=resolve(dir,'test.sqlite');
  const store=new Store(path),m=makeManifest(),run=await execute(store,m);
  // Execute already generated one offline receipt; verify repeated concurrent calls cannot simulate again.
  let calls=0;const second=new Store(path),adapter=new OfflineAdapter(second,async()=>{calls++;});
  const responses=await Promise.all(Array.from({length:10},()=>adapter.request_once(run.id,m)));
  assert.equal(calls,0);assert.ok(responses.every(r=>r?.status==='SIMULATED'));
  second.close();store.close();const reopened=new Store(path);reopened.recover();
  const again=await new OfflineAdapter(reopened,async()=>{calls++;}).request_once(run.id,m);
  assert.equal(again?.status,'SIMULATED');assert.equal(calls,0);reopened.close();rmSync(dir,{recursive:true});
});
function signalRun(store:Store,m:Manifest){const r=store.create(m);for(const state of ['PREFLIGHT_PASSED','COMMITTED','RUNNING','LAUNCH_SIGNAL'] as const)store.transition(r.id,state);return r;}
test('ambiguous timeout is reconciled without another request, even after restart',async()=>{
  const store=new Store(':memory:'),m=makeManifest(),run=await execute(store,m);
  store.db.prepare('DELETE FROM attempts WHERE run_id=?').run(run.id);
  let calls=0;const adapter=new OfflineAdapter(store,async()=>{calls++;throw new Error('ambiguous');});
  assert.equal(await adapter.request_once(run.id,m),null);store.recover();
  assert.equal(await adapter.request_once(run.id,m),null);assert.equal(calls,1);
  assert.equal(store.db.prepare('SELECT status FROM attempts WHERE run_id=?').get(run.id)!.status,'AMBIGUOUS');store.close();
});
test('interrupted active run becomes INVALID and cannot restart its state machine',()=>{
  const store=new Store(':memory:'),m=makeManifest(),r=store.create(m);
  for(const state of ['PREFLIGHT_PASSED','COMMITTED','RUNNING'] as const)store.transition(r.id,state);
  store.recover();assert.equal(store.get(r.id).state,'RUNNING');
  store.recover(()=>false);assert.equal(store.get(r.id).state,'INVALID');assert.throws(()=>store.transition(r.id,'RUNNING'));store.close();
});
test('unexpected chain, issuer, quote, beneficiary, fee and budget are blocked',async()=>{
  const s=new Store(':memory:'),m=makeManifest(),r=signalRun(s,m),a=new OfflineAdapter(s);
  for(const [key,value] of Object.entries({chain_id:1,issuer:'attacker',quote_asset:'WETH',beneficiary:'attacker',fee_bps:10,max_budget_wei:'1',disable_vesting:false})){
    const altered={...m,terms:{...m.terms,[key]:value}} as Manifest;
    assert.throws(()=>a.preview(altered));await assert.rejects(a.request_once(r.id,altered));
  }
  assert.equal(a.verify_receipt({provenance:'MOCK',tx_hash:'0x123'},m,r.id),false);s.close();
});
test('live execution impossible even with credentials present; runner receives no credentials',()=>{
  process.env.BANKR_API_KEY='BELLFLY_TEST_SECRET_SENTINEL';process.env.BELLFLY_CONTROL_TOKEN='BELLFLY_TEST_SECRET_SENTINEL';
  assert.throws(()=>requestLive({...makeManifest(),live_execution_enabled:true}));
  assert.equal(runnerEnv().BANKR_API_KEY,undefined);assert.equal(runnerEnv().BELLFLY_CONTROL_TOKEN,undefined);
  delete process.env.BANKR_API_KEY;delete process.env.BELLFLY_CONTROL_TOKEN;
});
test('HTTP denies unauthenticated control, injected events and foreign origins; backend errors are not success',async()=>{
  const s=new Store(':memory:'),token='a'.repeat(40),server=createApp(s,token);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};const url=`http://127.0.0.1:${address.port}`;
  try{
    assert.equal((await fetch(url+'/api/control/rehearsal',{method:'POST'})).status,401);
    assert.equal((await fetch(url+'/api/events',{method:'POST',headers:{authorization:'Bearer '+token}})).status,404);
    assert.equal((await fetch(url+'/api/control/rehearsal',{method:'POST',headers:{authorization:'Bearer '+token,origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(url+'/api/control/rehearsal',{method:'POST',headers:{authorization:'Bearer '+token},body:'{"signal":"LAUNCH"}'})).status,400);
    assert.equal((await fetch(url+'/api/runs/00000000-0000-0000-0000-000000000000')).status,500);
    assert.equal((await fetch(url+'/api/health')).status,200);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));s.close();}
});

test('explicit reference control commands preserve zero stimulus and ablation; typos are rejected',()=>{
  assert.deepEqual(referenceOptions(['no-stimulus']),{hz:0,silence:false});
  assert.deepEqual(referenceOptions(['silence-output']),{hz:100,silence:true});
  assert.throws(()=>referenceOptions(['silenc-output']));
});
test('fresh concurrent reservations across connections create one offline result',async()=>{
  const dir=mkdtempSync(resolve(tmpdir(),'bellfly-concurrency-')),path=resolve(dir,'test.sqlite');
  const s=new Store(path),m=makeManifest(),r=await execute(s,m);
  s.db.prepare('DELETE FROM attempts WHERE run_id=?').run(r.id);
  const second=new Store(path);let count=0;
  const simulate=async()=>{count++;await new Promise<void>(resolve=>setTimeout(resolve,20));};
  const a=new OfflineAdapter(s,simulate),b=new OfflineAdapter(second,simulate);
  await Promise.all([a.request_once(r.id,m),b.request_once(r.id,m),a.request_once(r.id,m)]);
  assert.equal(count,1);assert.equal(b.reconcile(r.id)?.status,'SIMULATED');
  second.close();s.close();rmSync(dir,{recursive:true});
});
test('forged LAUNCH state without verified runner evidence cannot request even offline',async()=>{
  const s=new Store(':memory:'),m=makeManifest(),r=signalRun(s,m);
  await assert.rejects(new OfflineAdapter(s).request_once(r.id,m));
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM attempts').get()!.n,0);s.close();
});
test('credentials never appear in generated evidence and unknown secret fields are not persisted',async()=>{
  const secret='BELLFLY_TEST_SECRET_SENTINEL',s=new Store(':memory:');process.env.BANKR_API_KEY=secret;
  const m=makeManifest(),r=await execute(s,m);
  assert.equal(JSON.stringify(exportRun(s,r.id)).includes(secret),false);
  await assert.rejects(execute(s,{...m,BANKR_API_KEY:secret} as Manifest));
  assert.equal(s.list().length,1);delete process.env.BANKR_API_KEY;s.close();
});
