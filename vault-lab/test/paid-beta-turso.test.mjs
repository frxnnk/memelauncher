import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  PAID_BETA_TURSO_DB,
  TURSO_WSL_BIN,
  tursoOperatorLoginCommand,
  tursoProvisionPlan
} from '../scripts/paid-beta-turso.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const loginScript = join(root, 'scripts/turso-wsl-login.sh');

test('paid-beta Turso plan names a new empty dev database and local env keys only', () => {
  assert.equal(PAID_BETA_TURSO_DB, 'vault-paid-beta-dev');
  assert.equal(TURSO_WSL_BIN, '/root/.turso/turso');
  const plan = tursoProvisionPlan(PAID_BETA_TURSO_DB, { cwd: root });
  const login = tursoOperatorLoginCommand(root);
  assert.match(plan, /turso auth login/);
  assert.doesNotMatch(plan, /auth login --headless/);
  assert.match(plan, /does not wait|exits immediately/i);
  assert.match(plan, /callback/i);
  assert.match(plan, /turso-wsl-login\.sh/);
  assert.match(plan, /turso db create vault-paid-beta-dev/);
  assert.match(plan, /turso db show vault-paid-beta-dev --url/);
  assert.match(plan, /turso db tokens create vault-paid-beta-dev/);
  assert.match(plan, /VAULT_LIBSQL_URL/);
  assert.match(plan, /VAULT_LIBSQL_AUTH_TOKEN/);
  assert.match(plan, /Leave VAULT_DURABLE_DATA unset/);
  assert.match(plan, /web-funding-paid-beta/);
  const commands = plan.split('\n').filter(line => line && !line.startsWith('#'));
  assert.deepEqual(commands, [
    login,
    `wsl -u root -- ${TURSO_WSL_BIN} db create vault-paid-beta-dev`,
    `wsl -u root -- ${TURSO_WSL_BIN} db show vault-paid-beta-dev --url`,
    `wsl -u root -- ${TURSO_WSL_BIN} db tokens create vault-paid-beta-dev`
  ]);
  assert.doesNotMatch(plan, /173\.212\.246\.68/);
  assert.doesNotMatch(plan, /vault-closed-beta/);
  assert.doesNotMatch(plan, /web-funding-testnet/);
});

test('operator login command waits on a PTY and does not use --headless', () => {
  const cmd = tursoOperatorLoginCommand(root);
  assert.equal(cmd, `wsl --cd "${root}" -u root -- bash scripts/turso-wsl-login.sh`);
  assert.doesNotMatch(cmd, /--headless/);
  const script = readFileSync(loginScript, 'utf8');
  assert.match(script, /script -q -e -c/);
  assert.match(script, /auth login/);
  assert.doesNotMatch(script, /auth login --headless/);
  assert.match(script, /xdg-open/);
  assert.match(script, /cmd\.exe/);
  assert.match(script, /vault-paid-beta-dev/);
  assert.match(script, /VAULT_LIBSQL_URL/);
  assert.match(script, /VAULT_LIBSQL_AUTH_TOKEN/);
  assert.match(script, /VAULT_DURABLE_DATA/);
  assert.match(script, /4319/);
  assert.doesNotMatch(script, /turso db tokens create/);
});

test('npm run paid-beta:turso prints the plan without creating a production database', () => {
  const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
  assert.match(packageJson, /paid-beta:turso/);
  const testnet = readFileSync(join(root, 'scripts/paid-beta-testnet.mjs'), 'utf8');
  assert.match(testnet, /delete process\.env\.VAULT_DURABLE_DATA/);
  const run = spawnSync(process.execPath, ['scripts/paid-beta-turso.mjs', '--print-only'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '' }
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /turso-wsl-login\.sh/);
  assert.match(run.stdout, /turso db create vault-paid-beta-dev/);
  assert.doesNotMatch(run.stdout, /auth login --headless/);
  assert.match(run.stdout, /"created":false/);
  assert.doesNotMatch(run.stdout, /eyJ/);
  assert.ok(!run.stdout.split('\n').some(line => line.startsWith('vercel ')));
});

test('turso WSL login --help is a dry-run and does not start auth login', () => {
  const help = spawnSync('wsl', ['--cd', root, '-u', 'root', '--', 'bash', 'scripts/turso-wsl-login.sh', '--help'], {
    encoding: 'utf8'
  });
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /--headless/);
  assert.match(help.stdout, /callback|Waiting for authentication/i);
  assert.match(help.stdout, /script -q -e -c/);
  assert.doesNotMatch(help.stdout, /Opening your browser/);
  assert.doesNotMatch(help.stdout, /https:\/\/api\.turso\.tech/);
  assert.doesNotMatch(help.stdout, /eyJ/);
});

test('xdg-open wrapper does not split an OAuth URL on & for cmd.exe', (t) => {
  const script = readFileSync(loginScript, 'utf8');
  const match = script.match(/<< 'OPEN'\r?\n([\s\S]*?)\nOPEN/);
  assert.ok(match, 'expected xdg-open heredoc');
  let wrapper = match[1];
  if (/Start-Process/i.test(wrapper)) {
    wrapper = wrapper.replace(/Start-Process/gi, 'Write-Output');
  } else {
    wrapper = wrapper.replace(/\bstart(?:\s+""|\s+\\"\\")\s+/g, 'echo ');
  }
  assert.match(wrapper, /\becho\b|Write-Output/i);
  const url = 'https://api.turso.tech/oauth?redirect=http://127.0.0.1:9/callback&state=abc';
  mkdirSync(join(root, '.local'), { recursive: true });
  const dir = mkdtempSync(join(root, '.local', 'xdg-open-ampersand-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const toWslPath = (windowsPath) => windowsPath.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replaceAll('\\', '/');
  const bashSingleQuote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;
  writeFileSync(join(dir, 'xdg-open'), wrapper.replaceAll('\r\n', '\n'), { encoding: 'utf8' });
  writeFileSync(join(dir, 'run.sh'), [
    '#!/bin/sh',
    `cd ${bashSingleQuote(toWslPath(dir))}`,
    'chmod +x ./xdg-open',
    `./xdg-open ${bashSingleQuote(url)}`
  ].join('\n') + '\n', { encoding: 'utf8' });
  const run = spawnSync('wsl', ['-u', 'root', '--', 'bash', toWslPath(join(dir, 'run.sh'))], {
    encoding: 'utf8'
  });
  const combined = `${run.stdout || ''}\n${run.stderr || ''}`;
  assert.doesNotMatch(combined, /is not recognized/i);
  assert.match((run.stdout || '').replaceAll('\r', ''), /redirect=http:\/\/127\.0\.0\.1:9\/callback&state=abc/);
});
