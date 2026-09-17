import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBetaAccess } from '../server/beta-access.mjs';
import { resetDurableBackends } from '../server/storage/database.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function wslTurso(args) {
  return spawnSync('wsl', ['-u', 'root', '--', '/root/.turso/turso', ...args], {
    encoding: 'utf8',
    cwd: root
  });
}

const shown = wslTurso(['db', 'show', 'vault-paid-beta', '--url']);
const url = (shown.stdout || '').trim().split(/\s+/).find(part => /^libsql:\/\//.test(part) || /^https:\/\//.test(part));
if (!url) throw new Error('Could not read Turso URL.');
const host = new URL(url).host;
if (!host.startsWith('vault-paid-beta-') || host.includes('dev')) {
  throw new Error('Refusing to issue invites against a non-production database.');
}

const tokened = wslTurso(['db', 'tokens', 'create', 'vault-paid-beta']);
const token = (tokened.stdout || '').trim().split(/\s+/).find(part => part.length > 20);
if (!token) throw new Error('Could not create Turso token.');

const env = {
  VAULT_DURABLE_DATA: 'true',
  VAULT_LIBSQL_URL: url,
  VAULT_LIBSQL_AUTH_TOKEN: token
};

mkdirSync(join(root, '.local'), { recursive: true });
const dbPath = join(root, '.local', 'beta.sqlite');
const beta = createBetaAccess({ path: dbPath, env });
try {
  const existing = beta.list().filter(row => !row.revoked && row.expires_at > Date.now());
  const founderOpen = existing.find(row => row.label === 'Founder' && !row.owner);
  if (founderOpen) {
    console.log(JSON.stringify({
      ok: true, issued: false, reason: 'unclaimed-founder-exists',
      id: founderOpen.id, expiresAt: new Date(founderOpen.expires_at).toISOString(),
      host, keysPrinted: false
    }));
  } else {
    const invitation = beta.issue({ label: 'Founder', days: 30 });
    const out = join(root, '.local', `beta-invite-${invitation.id}.json`);
    writeFileSync(out, JSON.stringify(invitation, null, 2) + '\n');
    console.log(JSON.stringify({
      ok: true, issued: true, id: invitation.id, expiresAt: invitation.expiresAt,
      savedTo: out, shared: false, host, keysPrinted: false
    }));
  }
} finally {
  beta.close();
  resetDurableBackends();
}
