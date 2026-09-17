// Offline verification of the two read-only finalized RPC receipts.
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const mint='4pAM2FFrXN7wGVjhADY3fsDYE7jGcE1ARsfhYH6z5aCd';
const creator='HEjnRRCNEqcEom6rSRj518GJBMyFEwv9ixpCdM8CxfSV';
const treasury='EoppPB2YkVWnMHP3VoMi6CpqeRdoZYtSjfRK6ne9BYZg';
const token2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const wsol='So11111111111111111111111111111111111111112';
const amm='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const errors=[];
const check=(ok,label)=>{if(!ok)errors.push(label)};
const u=(raw,decimals)=>`${raw/10n**BigInt(decimals)}.${(raw%10n**BigInt(decimals)).toString().padStart(decimals,'0')}`;
const results=[];
for(const file of ['revcat-burn-rpc.json','revcat-treasury-rpc.json']) {
 const raw=read(file),r=raw.response.result,msg=r.transaction.message;
 check(raw.request.method==='getTransaction'&&raw.request.params[1].commitment==='finalized','Not finalized read');
 check(raw.request.params[0]===r.transaction.signatures[0],'Signature mismatch');
 check(raw.response.error===undefined&&r.meta.err===null,'Transaction/RPC error');
 check(msg.accountKeys.filter(x=>x.signer).length===1&&msg.accountKeys[0].pubkey===creator&&msg.accountKeys[0].signer,'Unexpected signer');
 const creatorDebit=BigInt(r.meta.preBalances[0])-BigInt(r.meta.postBalances[0]);
 const result={file,signature:r.transaction.signatures[0],url:'https://solscan.io/tx/'+r.transaction.signatures[0],capturedAt:raw.capturedAt,slot:r.slot,utc:new Date(r.blockTime*1000).toISOString(),signer:creator,networkFeeLamports:String(r.meta.fee),creatorDebitLamports:String(creatorDebit),creatorDebitSol:u(creatorDebit,9)};
 if(file.includes('burn')) {
  const burns=msg.instructions.filter(x=>x.parsed?.type==='burnChecked');
  check(burns.length===1,'Expected one burn');
  const burn=burns[0];
  check(burn.programId===token2022&&burn.parsed.info.mint===mint&&burn.parsed.info.authority===creator,'Burn identity mismatch');
  const buyIndex=msg.instructions.findIndex(x=>x.programId===amm);
  const burnIndex=msg.instructions.indexOf(burn);
  check(buyIndex===4&&burnIndex===6,'Instruction order mismatch');
  check(r.meta.logMessages.includes('Program log: Instruction: Buy'),'Missing Buy log');
  const inner=r.meta.innerInstructions.find(x=>x.index===buyIndex).instructions;
  const delivered=inner.find(x=>x.parsed?.type==='transferChecked'&&x.parsed.info.mint===mint&&x.parsed.info.destination===burn.parsed.info.account);
  check(delivered?.parsed.info.tokenAmount.amount===burn.parsed.info.tokenAmount.amount,'Delivered != burned');
  const tokenIndex=msg.accountKeys.findIndex(x=>x.pubkey===burn.parsed.info.account);
  const pre=r.meta.preTokenBalances.find(x=>x.accountIndex===tokenIndex);
  const post=r.meta.postTokenBalances.find(x=>x.accountIndex===tokenIndex);
  check(pre?.uiTokenAmount.amount==='0'&&post?.uiTokenAmount.amount==='0','Burn token account not zero both sides');
  const wsolTransfers=inner.filter(x=>x.parsed?.type==='transferChecked'&&x.parsed.info.mint===wsol&&x.parsed.info.authority===creator);
  const wsolSpent=wsolTransfers.reduce((a,x)=>a+BigInt(x.parsed.info.tokenAmount.amount),0n);
  check(creatorDebit===wsolSpent+BigInt(r.meta.fee),'Creator SOL net != WSOL spend + network fee');
  check(wsolSpent<=50000000n,'Exceeds 0.05 SOL nominal ceiling');
  Object.assign(result,{mint,buyInstructionOneBased:buyIndex+1,burnInstructionOneBased:burnIndex+1,burnProgram:burn.programId,tokenRaw:burn.parsed.info.tokenAmount.amount,tokenDecimals:burn.parsed.info.tokenAmount.decimals,tokensBurned:u(BigInt(burn.parsed.info.tokenAmount.amount),burn.parsed.info.tokenAmount.decimals),quoteSpentLamports:String(wsolSpent),quoteSpentSol:u(wsolSpent,9),creatorTokenBefore:pre.uiTokenAmount.amount,creatorTokenAfter:post.uiTokenAmount.amount,wsolTransfers:wsolTransfers.map(x=>({destinationTokenAccount:x.parsed.info.destination,amountLamports:x.parsed.info.tokenAmount.amount}))});
 } else {
  const payments=msg.instructions.filter(x=>x.program==='system'&&x.parsed?.type==='transfer');
  check(payments.length===1,'Expected one treasury payment');
  const p=payments[0].parsed.info;
  check(p.source===creator&&p.destination===treasury,'Treasury identity mismatch');
  const index=msg.accountKeys.findIndex(x=>x.pubkey===treasury);
  const credit=BigInt(r.meta.postBalances[index])-BigInt(r.meta.preBalances[index]);
  check(credit===BigInt(p.lamports)&&creatorDebit===credit+BigInt(r.meta.fee),'Treasury balance mismatch');
  Object.assign(result,{destination:treasury,treasuryCreditLamports:String(credit),treasuryCreditSol:u(credit,9),classification:'Transfer to published treasury; percentage, fee origin and ledger category not established by this receipt'});
 }
 results.push(result);
}
const app=fs.readFileSync(new URL('app.js',import.meta.url));
const out={verifiedAt:new Date().toISOString(),method:'Offline parsed-instruction and balance checks against two finalized public Solana RPC receipts',errors,appSha256:crypto.createHash('sha256').update(app).digest('hex'),results};
fs.writeFileSync(new URL('receipt-check.json',import.meta.url),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(errors.length)process.exitCode=1;
