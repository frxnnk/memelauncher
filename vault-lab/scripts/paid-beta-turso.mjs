import { spawnSync } from 'node:child_process';

export const PAID_BETA_TURSO_DB = 'vault-paid-beta-dev';
export const TURSO_WSL_BIN = '/root/.turso/turso';

export function tursoOperatorLoginCommand(cwd = process.cwd()) {
  return `wsl --cd "${cwd}" -u root -- bash scripts/turso-wsl-login.sh`;
}

export function tursoProvisionPlan(db = PAID_BETA_TURSO_DB, { cwd = process.cwd() } = {}) {
  return [
    '# New empty Turso database for paid-beta durable store. Not attached to production.',
    '# Install the Turso Cloud CLI: https://docs.turso.tech/cli/installation',
    '# Do not use npm npx turso (that is a local SQL shell, not db create).',
    '# --headless prints a URL and exits immediately; it does not wait for the OAuth callback.',
    '# Run this in a persistent PowerShell. It allocates a PTY, opens the Windows browser, and waits for the callback.',
    '# Inner command is: script -q -e -c "/root/.turso/turso auth login" /dev/null',
    tursoOperatorLoginCommand(cwd),
    `wsl -u root -- ${TURSO_WSL_BIN} db create ${db}`,
    `wsl -u root -- ${TURSO_WSL_BIN} db show ${db} --url`,
    `wsl -u root -- ${TURSO_WSL_BIN} db tokens create ${db}`,
    '# Copy the URL into gitignored .env as VAULT_LIBSQL_URL',
    '# Copy the token into gitignored .env as VAULT_LIBSQL_AUTH_TOKEN',
    '# Leave VAULT_DURABLE_DATA unset so local :4319 paid-beta:testnet stays on sqlite',
    '# (scripts/paid-beta-testnet.mjs also deletes VAULT_DURABLE_DATA on boot).',
    '# Optional later: VAULT_FUNDING_DATA_DIRECTORY for web-funding-paid-beta only.',
    '# Do not enable VAULT_DURABLE_DATA on Vercel project env until cutover is approved.',
    '# Do not deploy production, git push, or overwrite live vercel.json.'
  ].join('\n');
}

function tursoAvailable() {
  const probe = spawnSync('turso', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return probe.status === 0;
}

function tursoLoggedIn() {
  const status = spawnSync('turso', ['auth', 'status'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (status.status !== 0) return false;
  const text = `${status.stdout}\n${status.stderr}`;
  return /logged in|email|username/i.test(text) && !/not logged|unauthoriz|please login/i.test(text);
}

function createDevDatabase(db) {
  const created = spawnSync('turso', ['db', 'create', db], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (created.status !== 0) {
    return { created: false, error: (created.stderr || created.stdout || 'turso db create failed').trim() };
  }
  const show = spawnSync('turso', ['db', 'show', db, '--url'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const url = (show.stdout || '').trim();
  return {
    created: true,
    urlPresent: /^libsql:\/\//.test(url) || /^https:\/\//.test(url),
    note: 'Token not printed. Run: turso db tokens create ' + db + ' and paste VAULT_LIBSQL_AUTH_TOKEN into gitignored .env. Leave VAULT_DURABLE_DATA unset.'
  };
}

export function runPaidBetaTurso({ argv = process.argv.slice(2), env = process.env, cwd = process.cwd() } = {}) {
  const printOnly = argv.includes('--print-only') || env.VAULT_TURSO_PRINT_ONLY === 'true';
  const plan = tursoProvisionPlan(PAID_BETA_TURSO_DB, { cwd });
  const report = {
    database: PAID_BETA_TURSO_DB,
    created: false,
    durableDataEnabled: false,
    productionTouched: false,
    cli: 'missing'
  };
  if (printOnly || !tursoAvailable()) {
    return { plan, report };
  }
  report.cli = 'present';
  if (!tursoLoggedIn()) {
    report.cli = 'logged-out';
    return { plan, report };
  }
  report.cli = 'logged-in';
  const result = createDevDatabase(PAID_BETA_TURSO_DB);
  report.created = result.created;
  if (result.error) report.error = result.error;
  if (result.note) report.note = result.note;
  if (result.urlPresent) report.urlWritten = false;
  return { plan, report };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('paid-beta-turso.mjs')) {
  const { plan, report } = runPaidBetaTurso();
  console.log(plan);
  console.log(JSON.stringify(report));
}
