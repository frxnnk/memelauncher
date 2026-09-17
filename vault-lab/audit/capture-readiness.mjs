import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyLedgerExport } from './verify-ledger.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url))),origin='http://127.0.0.1:4319';
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
async function get(path) {
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`Readiness GET ${path} failed (${response.status}).`);
  return response.json();
}
async function files(path) {
  const found=[];
  for(const item of await readdir(path,{withFileTypes:true})) {
    if(item.isDirectory())found.push(...await files(join(path,item.name)));
    else if(item.isFile())found.push(join(path,item.name));
  }
  return found;
}
try {
  const [status,rules,catalog,ledger]=await Promise.all(['/api/status','/api/rules','/api/models','/api/sandbox/export'].map(get));
  const verification=verifyLedgerExport(ledger),output=join(root,'output');
  await mkdir(output,{recursive:true});
  const sources=[join(root,'server.mjs'),join(root,'package.json')];
  for(const dir of ['server','public','eval','audit','test'])sources.push(...await files(join(root,dir)));
  const sourceFiles=[];
  for(const path of sources.sort())sourceFiles.push({path:relative(root,path).replaceAll('\\','/'),sha256:hash(await readFile(path))});
  const sourceManifest={createdAt:new Date().toISOString(),meaning:'Local file hashes, without external timestamp, signature or deployment attestation.',files:sourceFiles};
  const manifestText=JSON.stringify(sourceManifest,null,2);
  await writeFile(join(output,'source-manifest.json'),manifestText);
  await writeFile(join(output,'local-ledger-export.json'),JSON.stringify(ledger,null,2));
  const report={checkedAt:new Date().toISOString(),origin,runtime:process.version,method:'GET requests and offline ledger replay',
    status,rulesVersion:rules.version,configurationVersion:rules.configurationVersion,profileCount:Object.keys(rules.profiles??{}).length,
    catalog:{models:catalog.models.map(model=>model.id),fetchedAt:catalog.fetchedAt,source:catalog.source},
    ledger:verification,sourceManifestSha256:hash(manifestText),inferenceCallsFromThisCheck:0,
    chainTransactionsFromThisCheck:0,limits:'API configuration is not successful inference. Local hashes and balanced events do not prove independent execution or deployment.'};
  await writeFile(join(output,'local-readiness.json'),JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
} catch(error) {process.stderr.write(`Readiness capture failed: ${error.message}\n`);process.exitCode=1;}
