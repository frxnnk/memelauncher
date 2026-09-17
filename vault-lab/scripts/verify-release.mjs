import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { sourceEvidence } from './source-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
try {
  const tests = (await readdir(join(root, 'test'))).filter(name => name.endsWith('.test.mjs')).sort().map(name => 'test/' + name);
  const results = await run(process.execPath, ['--test', ...tests], { cwd:root, timeout:60000, maxBuffer:4 * 1024 * 1024 });
  const count = Number(results.stdout.match(/^# pass (\d+)$/m)?.[1]);
  if (!count || !/^# fail 0$/m.test(results.stdout)) throw new Error('The complete test suite did not pass.');
  await run(process.execPath, ['scripts/build.mjs'], { cwd:root, timeout:30000 });
  await mkdir(join(root, 'output'), { recursive:true });
  await writeFile(join(root, 'output/launch-tests.tap'), results.stdout);
  const evidence = { createdAt:new Date().toISOString(), node:process.version, testsPassed:count, build:'passed',
    files:await sourceEvidence(root), source:'local-tests-and-build', independentAttestation:false,
    realInferenceTested:false, privyLiveLoginTested:false, paymentsEnabled:false };
  await writeFile(join(root, 'output/release-verification.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ testsPassed:count, build:'passed', evidence:'output/release-verification.json', realInferenceCalls:0 }, null, 2));
} catch (error) { console.error(error.stdout || error.message); process.exitCode = 1; }
