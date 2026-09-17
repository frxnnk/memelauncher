import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from './store';
import { ROOT, makeManifest } from './manifest';
import { execute, exportRun } from './controller';
import { verifyBundle, replay } from './evidence';
import { canonical } from './canonical';
import { referenceOptions } from './options';

const [cmd,file,...flags]=process.argv.slice(2);
mkdirSync(resolve(ROOT,'.local'),{recursive:true});
if(cmd==='verify'||cmd==='replay') {
  if(!file) throw new Error('Provide evidence JSON path');
  const bundle=JSON.parse(readFileSync(resolve(file),'utf8'));
  console.log(JSON.stringify(cmd==='verify'?verifyBundle(bundle):await replay(bundle),null,2));
} else if(cmd==='demo'||cmd==='reference') {
  const store=new Store(resolve(ROOT,'.local/bellfly.sqlite'));
  const options=referenceOptions([file,...flags].filter(Boolean));
  const m=makeManifest(cmd==='reference',options.hz,options.silence);
  console.log(`Starting ${m.runner}; live_execution_enabled=false; seed=${m.seed.value}; stimulus_hz=${m.stimulus.hz}; silence_output=${m.stimulus.silence_output}`);
  const run=await execute(store,m);
  const path=resolve(ROOT,`examples/${run.id}.json`);
  writeFileSync(path,canonical(exportRun(store,run.id))+'\n');
  console.log(JSON.stringify({id:run.id,state:run.state,evidence:path,metrics:store.artifacts(run.id).find(a=>a.name==='runner_result')?.value},null,2));
  store.close();if(run.state==='INVALID')process.exitCode=1;
} else throw new Error('Commands: demo | reference [no-stimulus|silence-output] | verify file | replay file');
