import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// Run only with the service stopped. Never export private filenames or rows.
const [source, backup] = process.argv.slice(2).map(value => resolve(value));
assert.ok(source && backup && source !== backup, 'Supply two different storage directories.');
async function hashes(root, relative = '') {
  const result = {};
  for (const entry of await readdir(join(root, relative), { withFileTypes:true })) {
    const name = join(relative, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Storage contains an unexpected link.');
    if (entry.isDirectory()) Object.assign(result, await hashes(root, name));
    else if (entry.isFile()) result[name] = createHash('sha256').update(await readFile(join(root, name))).digest('hex');
  }
  return result;
}
const before = await hashes(source);
assert.deepEqual(await hashes(backup), before, 'Backup does not match stopped storage.');
let databases = 0;
for (const name of Object.keys(before).filter(name => name.endsWith('.sqlite'))) {
  for (const root of [source, backup]) {
    const db = new DatabaseSync(join(root, name), { readOnly:true });
    try { assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row => row.integrity_check), ['ok']); }
    finally { db.close(); }
  }
  databases++;
}
assert.ok(databases > 0, 'No SQLite databases found.');
// Read-only SQLite can touch SHM sidecars. Content hashes above precede opening it.
console.log(JSON.stringify({ files:Object.keys(before).length, databases, copyHashes:'matched', sqliteIntegrity:'ok' }));
