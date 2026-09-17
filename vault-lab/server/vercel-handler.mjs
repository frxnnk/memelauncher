import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVaultApplication } from './boot.mjs';
import { restoreApiUrl } from './vercel-request.mjs';

export const config = { maxDuration: 60 };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let starting;

function application() {
  starting ??= createVaultApplication({ env: process.env, root });
  return starting;
}

export default async function handler(request, response) {
  try {
    const app = await application();
    request.url = restoreApiUrl(request);
    await app.listener(request, response);
  } catch (error) {
    starting = undefined;
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('VAULT_BOOT_FAILED', detail);
    if (response.headersSent || response.destroyed) return;
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({
      error: { code: 'BOOT_FAILED', message: 'The Vercel API process could not start.' }
    }));
  }
}
