import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { canonical, hash } from './canonical';
import { ROOT, pythonPath, runnerEnv } from './manifest';
import { validateFrame } from './decision';
import { resultSchema, type Manifest, type Frame, type RunnerResult } from './schema';

export function runProcess(m: Manifest, onFrame: (frame:Frame)=>void = ()=>{}, timeoutMs = 180000) {
  return new Promise<{frames:Frame[];result:RunnerResult}>((resolvePromise,reject) => {
    const child=spawn(pythonPath(),[resolve(ROOT,'runner/main.py')],{cwd:ROOT,env:runnerEnv(),stdio:['pipe','pipe','pipe'],windowsHide:true});
    let buffer='', bytes=0, finished=false, result:RunnerResult|undefined;
    const frames:Frame[]=[];
    const fail=()=>{if(!finished){finished=true; clearTimeout(timer);child.kill();reject(new Error('RUNNER_INVALID_OR_TIMEOUT'));}};
    const timer=setTimeout(fail,timeoutMs);
    child.on('error',fail); child.stdin.on('error',fail);
    // Drain diagnostics without publishing arbitrary third-party stderr.
    child.stderr.on('data',()=>{});
    child.stdout.on('data',(chunk:Buffer)=>{
      try {
        bytes+=chunk.length; if(bytes>32*1024*1024) return fail();
        buffer+=chunk.toString('utf8');
        let end:number;
        while((end=buffer.indexOf('\n'))>=0) {
          const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
          if(!line.trim()) continue;
          const event=JSON.parse(line);
          if(result) return fail();
          if(event.type==='frame') {const f=validateFrame(event,m,frames.length);frames.push(f);onFrame(f);}
          else result=resultSchema.parse(event);
        }
      } catch {fail();}
    });
    child.on('close',code=>{
      if(finished) return;
      if(code!==0 || !result || buffer.trim()) return fail();
      finished=true;clearTimeout(timer);resolvePromise({frames,result});
    });
    child.stdin.end(JSON.stringify({manifest:m,canonical:canonical(m),manifest_hash:hash(m)}));
  });
}
