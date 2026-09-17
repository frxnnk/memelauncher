import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

function wslTurso(args) {
  return spawnSync('wsl', ['-u', 'root', '--', '/root/.turso/turso', ...args], {
    encoding: 'utf8',
    cwd: root
  });
}

const shown = wslTurso(['db', 'show', 'vault-paid-beta', '--url']);
const url = (shown.stdout || '').trim().split(/\s+/).find(part => /^libsql:\/\//.test(part) || /^https:\/\//.test(part));
if (!url) throw new Error('Could not read production Turso URL.');
const host = new URL(url).host;
if (!host.startsWith('vault-paid-beta-') || host.includes('dev')) {
  throw new Error('Refusing to inspect a non-production database.');
}

const tokened = wslTurso(['db', 'tokens', 'create', 'vault-paid-beta']);
const token = (tokened.stdout || '').trim().split(/\s+/).find(part => part.length > 20);
if (!token) throw new Error('Could not create Turso token.');

const child = spawn(process.execPath, [join(root, 'audit/turso-ledger-inspect.mjs')], {
  cwd: root,
  env: {
    ...process.env,
    VAULT_LIBSQL_URL: url,
    VAULT_LIBSQL_AUTH_TOKEN: token,
    VAULT_DURABLE_DATA: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';
child.stdout.on('data', chunk => { stdout += chunk; });
child.stderr.on('data', chunk => { stderr += chunk; });
child.on('close', code => {
  if (code !== 0) {
    console.error(stderr || `inspect exit ${code}`);
    process.exit(code || 1);
  }
  console.log(stdout.trimEnd());
});
