import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export async function sourceEvidence(root) {
  const files = [];
  async function collect(relative) {
    for (const entry of await readdir(join(root, relative), { withFileTypes:true })) {
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) await collect(name);
      else if (entry.isFile()) files.push(name);
    }
  }
  for (const dir of ['server', 'client', 'public', 'scripts', 'audit', 'eval', 'test', 'deploy', 'api']) await collect(dir);
  files.push('server.mjs', 'package.json', 'package-lock.json', '.env.example', 'vercel.json', '.vercelignore');
  const result = {};
  for (const file of files.sort()) result[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
  return result;
}
