import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Exercise the actual account module with a small DOM/event fixture. No browser,
// real Privy transport, provider call or visual-layout assertion is involved.
async function fixture(t) {
  const saved={document:globalThis.document,fetch:globalThis.fetch};
  t.after(()=>{globalThis.document=saved.document;globalThis.fetch=saved.fetch;});
  const nodes=new Map();
  const node=selector=>{
    if(!nodes.has(selector)) nodes.set(selector,{hidden:false,disabled:false,value:'',textContent:'',handlers:{},
      reportValidity:()=>true,addEventListener(type,fn){this.handlers[type]=fn;}});
    return nodes.get(selector);
  };
  const doc=new EventTarget();doc.querySelector=node;globalThis.document=doc;
  let account={accountId:'player_client',wallets:[],beta:{required:true,admitted:false,paused:false,expiresAt:null}};
  let delayedAccount=null;const calls=[];
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,options});
    if(path==='/api/account') return delayedAccount ? delayedAccount : Response.json(account);
    if(path==='/api/beta/redeem'){
      if(JSON.parse(options.body).code!=='fixture-invitation') return Response.json({error:{message:'Invalid invitation.'}},{status:403});
      account={...account,beta:{required:true,admitted:true,paused:false,expiresAt:'2026-10-01T00:00:00.000Z'}};
      return Response.json({beta:account.beta});
    }
    if(path==='/api/usage') return Response.json({perUserPerDay:25,requestsToday:3,unresolved:0});
    throw new Error('Unexpected transport');
  };
  const moduleUrl=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
  const access=moduleUrl('export const accessConfiguration=Promise.resolve({configured:true,accessMode:"public-practice",closedBeta:true});');
  const privy=moduleUrl('export async function createPrivyAccount(){return {headers:async()=>({Authorization:"Bearer fixture"}),logout:async()=>{},sendCode:async()=>{},login:async()=>{}};}');
  const funding=moduleUrl('export function localOperatorHeaders(){return {};} export async function readLocalOperatorWallet(){return null;} export async function requestLocalOperatorWallet(){return null;} export async function sendProvingRoundTransfer(){throw new Error("stub");} export async function sendProvingRoundClaim(){throw new Error("stub");} export async function recordProvingRoundClaim(){throw new Error("stub");} export function injectedPhantom(){return null;} export function requestReviewedDeposit(){throw new Error("stub");} export function requestReviewedPayout(){throw new Error("stub");} export const PROVING_ROUND_BUTTON="Send 1 AMZN to treasury"; export const PROVING_CLAIM_BUTTON="Send prize from treasury";');
  let source=await readFile(new URL('../public/account.js',import.meta.url),'utf8');
  source=source.replace("'./access.js'",JSON.stringify(access)).replace("'./funding-client.js'",JSON.stringify(funding)).replaceAll("'/vendor/privy.js'",JSON.stringify(privy));
  const accountModule=await import(moduleUrl(source+'\n// '+randomUUID()));
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  await settle();
  const fire=async(selector,event='click')=>{await node(selector).handlers[event]({preventDefault(){}});await settle();await settle();};
  return {node,fire,settle,accountModule,calls,setAccount:value=>{account=value;},delayAccount:value=>{delayedAccount=value;}};
}

test('beta account flow requires membership, redeems invitation and displays usage without exposing wallets',async t=>{
  const f=await fixture(t);
  assert.equal(f.accountModule.accountCanPlay(),false);
  await f.fire('#account-restore');
  assert.equal(f.accountModule.accountState().accountId,'player_client');
  assert.equal(f.accountModule.accountCanPlay(),false);assert.equal(f.node('#beta-invite-form').hidden,false);
  assert.equal(f.node('#account-wallet').hidden,true);assert.equal(f.node('#account-credits').hidden,true);
  f.node('#beta-invite-code').value='wrong';await f.fire('#beta-invite-form','submit');
  assert.equal(f.accountModule.accountState().accountId,'player_client');assert.equal(f.node('#account-status').textContent,'Invalid invitation.');
  f.node('#beta-invite-code').value='fixture-invitation';await f.fire('#beta-invite-form','submit');
  assert.equal(f.accountModule.accountCanPlay(),true);assert.equal(f.node('#beta-invite-form').hidden,true);
  assert.equal(f.node('#beta-invite-code').value,'');assert.match(f.node('#account-usage').textContent,/22 \/ 25/);
  assert.ok(f.calls.every(c=>c.path.startsWith('/api/')&&!c.path.includes('attempt')));
  f.accountModule.lockAccount(true);assert.equal(f.node('#beta-redeem').disabled,true);assert.equal(f.node('#account-logout').disabled,true);
  f.accountModule.lockAccount(false);await f.fire('#account-logout');
  assert.equal(f.accountModule.accountState(),null);assert.equal(f.node('#account-usage').textContent,'');
});

test('missing admission fails closed and late identity refresh cannot restore a logged-out user',async t=>{
  const f=await fixture(t);f.setAccount({accountId:'player_client',wallets:[]});await f.fire('#account-restore');
  assert.equal(f.accountModule.accountCanPlay(),false);
  let release;f.delayAccount(new Promise(resolve=>{release=resolve;}));
  const pending=f.accountModule.refreshAccountStatus();await f.settle();
  await f.fire('#account-logout');
  release(Response.json({accountId:'player_client',wallets:[],beta:{required:true,admitted:true,paused:false}}));
  await pending;assert.equal(f.accountModule.accountState(),null);assert.equal(f.accountModule.accountCanPlay(),false);
  assert.equal(f.node('#account-usage').textContent,'');
});
