// Public reads only. Availability of old chunks does not establish current React-form parity.
import {readFileSync,writeFileSync} from 'node:fs';
import {sha256,stringify} from './core.mjs';
const manifest=JSON.parse(readFileSync(new URL('../sources/ocat-source-manifest.json',import.meta.url),'utf8'));
const report={observedAt:new Date().toISOString(),currentForm:'https://app.long.xyz/create',sources:[],
  caveat:'Pinned chunk byte identity and direct HTML references only; not a full current frontend dependency-graph review.'};
let html='';
try {
  const response=await fetch(report.currentForm,{signal:AbortSignal.timeout(20000)});
  html=await response.text();
  report.form={status:response.status,sha256:sha256(html),walletRequired:html.includes('Connect Wallet')};
} catch(error) {report.form={error:error.message};}
report.sources=await Promise.all(manifest.capturedSources.map(async item=>{
  const result={url:item.url,expectedSha256:item.sha256,directlyReferencedInHTML:html.includes(new URL(item.url).pathname)};
  try {
    const response=await fetch(item.url,{signal:AbortSignal.timeout(20000)});
    result.status=response.status;
    if(response.ok) {const bytes=Buffer.from(await response.arrayBuffer());result.sha256=sha256(bytes);result.matches=result.sha256===item.sha256;}
  } catch(error) {result.error=error.message;}
  return result;
}));
const output=new URL(`../outputs/source-check-${sha256(stringify(report))}.json`,import.meta.url);
writeFileSync(output,stringify(report)+'\n',{flag:'wx'});
console.log(stringify(report));
