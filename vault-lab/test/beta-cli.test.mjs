import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { main } from '../scripts/beta.mjs';

test('offline beta CLI saves codes privately, never lists them, and supports pause/revoke', async t => {
  const root=resolve(tmpdir()),dir=await mkdtemp(join(root,'vault-beta-cli-'));assert.ok(resolve(dir).startsWith(root+sep));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const db=join(dir,'beta.sqlite'),out=join(dir,'invitation.json');const output=[];
  await main(['issue','--db',db,'--out',out,'--label','CLI test','--days','7'],text=>output.push(text));
  const invitation=JSON.parse(await readFile(out,'utf8'));assert.match(invitation.code,/^vault_/);
  assert.ok(!output.join('').includes(invitation.code));
  await assert.rejects(main(['issue','--db',db,'--out',out,'--label','No overwrite']));
  await assert.rejects(main(['issue','--db',db,'--out',join(dir,'..','outside.json'),'--label','Outside']));
  await main(['pause','--db',db],text=>output.push(text));
  await main(['revoke','--db',db,'--id',invitation.id],text=>output.push(text));
  await main(['list','--db',db],text=>output.push(text));
  const state=JSON.parse(output.at(-1));assert.equal(state.paused,true);assert.equal(state.invitations.length,1);assert.equal(state.invitations[0].revoked,1);
  assert.ok(!output.join('').includes(invitation.code));assert.ok(!output.join('').includes('code_hash'));
  await main(['resume','--db',db],text=>output.push(text));assert.equal(JSON.parse(output.at(-1)).paused,false);
});
