import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createHttpServer } from '../server/http.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';
import { createBetaAccess, BETA_MODELS } from '../server/beta-access.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { apiError } from '../server/errors.mjs';

const runtime = runtimeConfiguration({VAULT_ACCESS_MODE:'public-practice',VAULT_PUBLIC_ORIGIN:'https://vault.example',VAULT_CLOSED_BETA:'true'});
async function fixture(t) {
  const beta=createBetaAccess(),limits=createInferenceLimits();const calls=[];
  const authentication={configured:true,publicConfig:()=>({configured:true}),authenticate:async headers=>{
    const user=/^Bearer (alice|bob)$/.exec(headers.authorization??'')?.[1];
    if(!user) throw apiError(401,'AUTH_REQUIRED','Sign in.');
    return {accountId:`player_${user}`,wallets:[]};
  }};
  const service={status:()=>({configured:true}),models:async()=>({models:[...BETA_MODELS,'other/guard'].map(id=>({id}))}),
    attempt:async(input,scope)=>{calls.push({input,scope});return {receipt:{usage:{cost:0.001}}};},
    receiptHistory:owner=>({owner,records:[]}), receipt:(owner,id)=>({owner,id}),
    operationalState:()=>({receiptStore:'last-write-succeeded',busy:false})};
  const server=createHttpServer({service,authentication,limits,beta,runtime,publicDir:'.'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));limits.close();beta.close();});
  const send=(path,{user,method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{host:'vault.example',origin:'https://vault.example',
      'content-type':'application/json',...(user?{authorization:`Bearer ${user}`} : {}),...headers}},res=>{
      let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));
    });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  return {beta,limits,calls,send};
}

test('closed beta denies unauthenticated and uninvited users before reservations or model calls',async t=>{
  const {send,limits,calls}=await fixture(t);
  const body={modelId:BETA_MODELS[0],prompt:'Open.'};
  assert.equal((await send('/api/attempt',{method:'POST',body})).status,401);
  const denied=await send('/api/attempt',{user:'alice',method:'POST',body,headers:{'x-player-id':'player_member'}});
  assert.equal(denied.status,403);assert.equal(denied.body.error.code,'BETA_INVITE_REQUIRED');
  for(const path of ['/api/usage','/api/receipts','/api/receipts/example','/api/credits']) assert.equal((await send(path,{user:'alice'})).status,403);
  assert.equal(limits.status('player_alice').globalRequestsToday,0);assert.equal(calls.length,0);
  assert.equal((await send('/api/account',{user:'alice'})).body.beta.admitted,false);
  assert.equal((await send('/api/auth/config')).body.closedBeta,true);
  assert.deepEqual((await send('/api/models')).body.models.map(m=>m.id),BETA_MODELS);
});

test('invitation endpoint binds server identity; replay, extra models, pause and revocation cannot spend',async t=>{
  const {send,beta,calls,limits}=await fixture(t);const invite=beta.issue({label:'HTTP tester',days:7});
  assert.equal((await send('/api/beta/redeem',{method:'POST',body:{code:invite.code}})).status,401);
  assert.equal((await send('/api/beta/redeem',{user:'alice',method:'POST',body:{code:invite.code,owner:'player_bob'}})).status,400);
  assert.equal((await send('/api/beta/redeem',{user:'alice',method:'POST',body:{code:invite.code}})).body.beta.admitted,true);
  assert.equal((await send('/api/beta/redeem',{user:'bob',method:'POST',body:{code:invite.code}})).status,403);
  assert.equal((await send('/api/beta/redeem',{user:'alice',method:'POST',body:{code:invite.code},headers:{origin:'https://evil.example'}})).status,403);
  const play=modelId=>send('/api/attempt',{user:'alice',method:'POST',body:{modelId,prompt:'Hello'}});
  assert.equal((await play('other/guard')).body.error.code,'BETA_MODEL_NOT_ALLOWED');
  assert.equal((await play(BETA_MODELS[0])).status,200);assert.equal(calls.length,1);
  assert.equal(calls[0].scope.ownerId,'player_alice');
  beta.setPaused(true);assert.equal((await play(BETA_MODELS[0])).body.error.code,'BETA_PAUSED');
  assert.equal((await send('/api/health')).body.requestGateOpen,false);
  assert.equal((await send('/api/receipts',{user:'alice'})).status,200);
  beta.revoke(invite.id);assert.equal((await play(BETA_MODELS[0])).body.error.code,'BETA_INVITE_REQUIRED');
  assert.equal((await send('/api/receipts',{user:'alice'})).status,403);
  assert.equal(limits.status('player_alice').globalRequestsToday,1);assert.equal(calls.length,1);
});

test('closed-beta configuration fails closed for missing admission or invalid modes',()=>{
  assert.throws(()=>runtimeConfiguration({VAULT_CLOSED_BETA:'true'}));
  assert.throws(()=>runtimeConfiguration({VAULT_CLOSED_BETA:'yes'}));
  assert.throws(()=>createHttpServer({runtime,authentication:{configured:true},limits:{},service:{}}),/admission/);
});
