import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createVaultApplication } from './server/boot.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4319);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}
const app = await createVaultApplication({ env: process.env, root });
const server = createServer(app.listener);
server.requestTimeout = 60000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Choose a different PORT.`
    : 'Could not start the local server.');
  shutdown(1);
});
const bindAddress = app.runtime.mode === 'public-practice' ? (process.env.VAULT_BIND_ADDRESS || '127.0.0.1') : '127.0.0.1';
server.listen(port, bindAddress, () => {
  console.log(`Dear Vault practice: http://127.0.0.1:${port}`);
  console.log(app.webFunding
    ? (app.service.status().paidConfigured
      ? `Testnet funding pays inference via x402 from operating box ${app.payment.address}. Tokens have no monetary value; payouts are disabled.`
      : 'Testnet funding rehearsal enabled without an x402 operating box; credit rounds still use OpenRouter. Tokens have no monetary value; payouts are disabled.')
    : app.runtime.mode === 'public-practice' ? 'Authenticated practice only. No deposits or funded bounty. Serve behind the configured HTTPS origin.' : 'Local only. No real funds or prize.');
  if (!app.webFunding && app.service.status().paidConfigured) {
    console.log(`x402 operating box armed: ${app.payment.address}. Funded attempts will pay Base USDC; practice still uses OpenRouter.`);
  }
  if (app.hosting.name === 'vercel') {
    console.log(app.hosting.ephemeralData
      ? 'Vercel function filesystem is ephemeral; do not point this at the AMZN rehearsal ledger.'
      : 'Vercel hosting with operator-asserted durable data.');
  }
  console.log(app.service.status().configured ? 'API configured: live attempts may incur charges.' : 'API not configured: add OPENROUTER_API_KEY or VAULT_X402_PRIVATE_KEY to .env to enable inference.');
});
let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await app.close();
    process.exit(exitCode);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown());
