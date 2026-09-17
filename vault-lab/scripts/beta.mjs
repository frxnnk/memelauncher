import { parseArgs } from 'node:util';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createBetaAccess } from '../server/beta-access.mjs';

export async function main(args, output = console.log) {
  const { values, positionals } = parseArgs({ args, allowPositionals:true, options:{
    db:{type:'string'}, label:{type:'string'}, days:{type:'string',default:'7'}, out:{type:'string'}, id:{type:'string'}
  } });
  const [command] = positionals;
  if (positionals.length !== 1 || !['issue','list','revoke','pause','resume'].includes(command)) throw new Error('Use issue, list, revoke, pause or resume.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const path = resolve(values.db || resolve(root, '.local/beta.sqlite'));
  await mkdir(dirname(path), {recursive:true});
  const beta = createBetaAccess({path});
  try {
    if (command === 'issue') {
      const destination = resolve(values.out || resolve(dirname(path), `beta-invite-${randomUUID()}.json`));
      if (!destination.startsWith(dirname(path) + sep)) throw new Error('Save the private invitation inside the database directory.');
      const file = await open(destination, 'wx', 0o600);
      let invitation;
      try {
        invitation = beta.issue({label:values.label,days:Number(values.days)});
        await file.writeFile(JSON.stringify(invitation,null,2)+'\n');
      } catch(error) { if(invitation) beta.revoke(invitation.id); throw error; }
      finally { await file.close(); }
      output(JSON.stringify({id:invitation.id,expiresAt:invitation.expiresAt,savedTo:destination,shared:false}));
    } else if (command === 'list') output(JSON.stringify({paused:beta.paused(),invitations:beta.list()},null,2));
    else if (command === 'revoke') output(JSON.stringify(beta.revoke(values.id)));
    else output(JSON.stringify(beta.setPaused(command === 'pause')));
  } finally { beta.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(() => {
  console.error('Beta operation failed. Check the command, invitation ID, label, expiry and private output path. No invitation code was printed.');
  process.exitCode=1;
});
