import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { constants } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { sourceEvidence } from './source-evidence.mjs';

const run = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const tempRoot = resolve(tmpdir());
let workspace;
try {
  if (process.argv.length !== 2) throw new Error('This release packager accepts no paths or credentials.');
  const proof = JSON.parse(await readFile(join(root, 'output/release-verification.json'), 'utf8'));
  const files = await sourceEvidence(root);
  assert.ok(proof.build === 'passed' && proof.testsPassed > 0, 'Run verify:release first.');
  assert.deepEqual(files, proof.files, 'Source changed since verification. Run verify:release again.');
  const sourceId = digest(JSON.stringify(files));
  workspace = await mkdtemp(join(tempRoot, 'vault-package-'));
  const staging = join(workspace, 'source'), extracted = join(workspace, 'extracted');
  await mkdir(staging); await mkdir(extracted);
  for (const [relative, hash] of Object.entries(files)) {
    assert.ok(!relative.includes('..') && !relative.startsWith('/') && !relative.includes('\\'));
    assert.ok(!/(^|\/)(\.local|node_modules|output|\.env)$/.test(relative), 'Private path in source evidence.');
    assert.ok(!/\.(sqlite|pem|jsonl)$/i.test(relative), 'Private data cannot be packaged.');
    const destination = join(staging, relative);
    await mkdir(dirname(destination), { recursive:true });
    await copyFile(join(root, relative), destination, constants.COPYFILE_EXCL);
    assert.equal(digest(await readFile(destination)), hash, 'Source changed during packaging.');
  }
  const release = { format:1, createdAt:new Date().toISOString(), sourceId,
    validation:{ testsPassed:proof.testsPassed, build:proof.build, node:proof.node, checkedAt:proof.createdAt },
    scope:'Closed web beta source; deployment, real login and provider activation require separate evidence.',
    includesCredentials:false, includesPlayerData:false, paymentsEnabled:false, files };
  await writeFile(join(staging, 'RELEASE.json'), JSON.stringify(release, null, 2)+'\n', { flag:'wx' });
  const names = [...Object.keys(files), 'RELEASE.json'].sort();
  const listPath = join(workspace, 'files.txt');
  await writeFile(listPath, names.join('\n')+'\n');
  const archive = join(workspace, 'beta.tar.gz');
  await run('tar', ['-czf', archive, '-C', staging, '-T', listPath], { timeout:30000 });
  const listing = await run('tar', ['-tzf', archive], { timeout:30000 });
  assert.deepEqual(listing.stdout.trim().split(/\r?\n/).sort(), names, 'Archive contains unexpected paths.');
  await run('tar', ['-xzf', archive, '-C', extracted], { timeout:30000 });
  for (const name of names) assert.deepEqual(await readFile(join(extracted, name)), await readFile(join(staging, name)), 'Archive extraction mismatch.');
  const bytes = await readFile(archive), sha256 = digest(bytes);
  const archiveName = `vault-beta-${sourceId.slice(0,12)}-${sha256.slice(0,8)}.tar.gz`;
  await mkdir(join(root, 'output'), { recursive:true });
  await copyFile(archive, join(root, 'output', archiveName), constants.COPYFILE_EXCL);
  const report = { ...release, archive:archiveName, sha256, bytes:bytes.length,
    filesCount:names.length, extractionVerified:true, published:false };
  await writeFile(join(root, 'output/beta-package.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ archive:`output/${archiveName}`, sha256, files:names.length,
    bytes:bytes.length, testsPassed:proof.testsPassed, extractionVerified:true, published:false },null,2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (workspace) {
    const checked = resolve(workspace);
    if (!checked.startsWith(tempRoot + sep) || !checked.slice(tempRoot.length + 1).startsWith('vault-package-')) throw new Error('Unsafe package cleanup path.');
    await rm(checked, {recursive:true,force:true});
  }
}
