import { join } from 'node:path';

const REHEARSAL = /web-funding-testnet|rh-test-amzn|[\\/]vault-beta(?:[\\/]|$)/i;

export function hostingTopology(env = {}) {
  const vercel = env.VERCEL === '1' || env.VAULT_HOSTING === 'vercel';
  return {
    name: vercel ? 'vercel' : 'local',
    ephemeralData: vercel && env.VAULT_DURABLE_DATA !== 'true',
    backgroundTimers: !vercel
  };
}

export function resolveDataDirectory(root, env = {}) {
  const configured = env.VAULT_DATA_DIRECTORY?.trim();
  const hosting = hostingTopology(env);
  if (hosting.name === 'vercel') {
    if (configured && REHEARSAL.test(configured)) {
      throw new Error('Vercel cannot use the AMZN rehearsal data directory (web-funding-testnet).');
    }
    if (configured && !configured.startsWith('/tmp/')) {
      throw new Error('Vercel writable data must be under /tmp; durable ledgers use Turso, not a VPS disk.');
    }
    return configured || '/tmp/vault-data';
  }
  if (configured) return configured;
  return join(root, '.local');
}
