import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from './store';
import { ROOT, makeManifest } from './manifest';
import { execute, exportRun } from './controller';
import { verifyBundle } from './evidence';

function authorized(req:IncomingMessage, token:string|undefined) {
  const expected='Bearer '+token, got=req.headers.authorization||'';
  return !!token && token.length>=32 && Buffer.byteLength(expected)===Buffer.byteLength(got) && timingSafeEqual(Buffer.from(expected),Buffer.from(got));
}
export function createApp(store:Store, token?:string) {
  let busy=false;
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
    const send=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      // Reject DNS rebinding/foreign sites. Control is also bearer authenticated; no cookie authority.
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||'')) return send(403,{error:'HOST_REJECTED'});
      const url=new URL(req.url||'/','http://127.0.0.1');
      if(req.method!=='GET') {
        if(!authorized(req,token)) return send(401,{error:'CONTROL_UNAUTHORIZED'});
        if(req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)) return send(403,{error:'ORIGIN_REJECTED'});
        if(req.method!=='POST'||url.pathname!=='/api/control/rehearsal') return send(404,{error:'NO_EVENT_INGESTION_OR_LIVE_ROUTE'});
        // Only preconfigured local MOCK rehearsal; arbitrary manifests/events never accepted from UI.
        if(busy) return send(409,{error:'REHEARSAL_RUNNING'});
        let body='';for await(const chunk of req){body+=chunk;if(body.length>128)return send(413,{error:'BODY_TOO_LARGE'});}
        if(body.trim() && body.trim()!=='{}') return send(400,{error:'NO_CLIENT_PARAMETERS'});
        busy=true;
        try {const run=await execute(store,makeManifest());send(run.state==='INVALID'?422:200,{id:run.id,state:run.state});}
        finally{busy=false;}
        return;
      }
      if(url.pathname==='/api/health') return send(200,{status:'ok',live_execution_enabled:false,runner_busy:busy});
      if(url.pathname==='/api/runs') return send(200,store.list().map(({id,state,manifest,created_at})=>({id,state,created_at,provenance:manifest.runner,kind:manifest.kind,stimulus_hz:manifest.stimulus.hz,silence_output:manifest.stimulus.silence_output})));
      const match=url.pathname.match(/^\/api\/runs\/([a-f0-9-]{36})(\/evidence)?$/);
      if(match) {
        const bundle=exportRun(store,match[1]);
        if(match[2]){res.setHeader('Content-Disposition',`attachment; filename="bellfly-${match[1]}.json"`);return send(200,bundle);}
        let verification:unknown;
        try{verification=verifyBundle(bundle);}catch{verification={status:'UNVERIFIED_OR_INCOMPLETE'};}
        return send(200,{...bundle,verification});
      }
      if(url.pathname.startsWith('/api/')) return send(404,{error:'NOT_FOUND'});
      const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!/^[\w./-]+$/.test(relative)||relative.split('/').includes('..'))return send(404,{error:'NOT_FOUND'});
      const path=resolve(ROOT,'dist',relative);
      if(!path.startsWith(resolve(ROOT,'dist')+'/') && !path.startsWith(resolve(ROOT,'dist')+'\\'))return send(404,{error:'NOT_FOUND'});
      if(!existsSync(path))return send(404,{error:'BUILD_WEB_FIRST'});
      res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
      res.end(readFileSync(path));
    } catch {send(500,{error:'BACKEND_ERROR'});}
  });
}
