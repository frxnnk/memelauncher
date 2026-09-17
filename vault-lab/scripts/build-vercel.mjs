import './build.mjs';
import { cp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.vercel-static');
if (!output.startsWith(resolve(root) + sep) || output !== resolve(root, '.vercel-static')) throw new Error('Invalid static output path.');
await rm(output, {recursive:true,force:true});
await cp(resolve(root,'public'), output, {recursive:true,errorOnExist:true,force:false});
// Vercel serves an existing index before a root rewrite. Give each entry a file.
await writeFile(resolve(output,'chat.html'), await readFile(resolve(root,'public/index.html')));
await writeFile(resolve(output,'index.html'), await readFile(resolve(root,'public/landing.html')));
