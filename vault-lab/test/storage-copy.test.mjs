import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const run = promisify(execFile);
test('stopped storage copy verifies every file and database, and rejects changed or corrupt copies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vault-storage-copy-'));
  try {
    const source = join(root,'source'), backup = join(root,'backup');
    await mkdir(source);
    const db = new DatabaseSync(join(source,'beta.sqlite'));
    db.exec('CREATE TABLE sample (n INTEGER); INSERT INTO sample VALUES (1);'); db.close();
    await writeFile(join(source,'receipt.json'), '{"decision":"keep_locked"}');
    await cp(source, backup, {recursive:true});
    const args = ['audit/verify-storage-copy.mjs',source,backup];
    const result = await run(process.execPath,args);
    assert.equal(JSON.parse(result.stdout).databases, 1);
    await writeFile(join(backup,'receipt.json'), '{}');
    await assert.rejects(run(process.execPath,args), /Backup does not match/);
    await writeFile(join(source,'receipt.json'), '{}');
    await writeFile(join(source,'beta.sqlite'), 'not a database');
    await writeFile(join(backup,'beta.sqlite'), 'not a database');
    await assert.rejects(run(process.execPath,args), /not a database/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
