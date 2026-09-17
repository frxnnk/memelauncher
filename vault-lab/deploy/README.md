# Run Vault practice

This package contains the verified application source, built browser client, tests and deployment templates. It contains no configured credentials, player databases, logs or installed dependencies. Start with private testing; a funded bounty is not implemented as a live product.

For the invitation-only release, follow [Closed beta operation](CLOSED-BETA.md) and `beta.env.example`. Set both `VAULT_ACCESS_MODE=public-practice` and `VAULT_CLOSED_BETA=true`; public practice on its own does not require invitations. The data notice is served at `/beta.html`.

After a successful `npm run verify:release`, `npm run package:release` creates an archive under `output`, verifies the extracted files against the tested source, and writes `output/beta-package.json`. It refuses stale test evidence. `RELEASE.json` inside the archive contains the per-file hashes and validation scope; it is local evidence, not independent attestation.

## Requirements and local smoke test

Node >=22.16 with native SQLite support, npm and a persistent writable `.local` directory. Use a dedicated service user. Install dependencies from the included lockfile:

```sh
npm ci --ignore-scripts
npm run verify:release
npm start
```

Without configuration, the server binds only to `127.0.0.1:4319`. `/` serves the landing and `/play` serves the game. Rules can be inspected without credentials; model inference is disabled. Do not copy a development `.local` directory or credentials into an archive for distribution.

## Public practice configuration

Create the host's `.env` from `.env.example`, retaining any existing local configuration. Supply the approved HTTPS origin, public Privy app/client identifiers and verification key, and a dedicated OpenRouter key with a finite non-renewing budget that includes BYOK. The server checks the provider budget on public startup. Configure that exact origin in Privy too.

Set `VAULT_ACCESS_MODE=public-practice`. Keep `VAULT_BIND_ADDRESS=127.0.0.1` when using the included same-host Caddy template. Review `/opt/vault`, the service user and the actual hostname in the templates before installing them. Create `.local` before starting the systemd service; it is the only writable application directory permitted by that template. `.env` must be readable only by its owner/service account. Never expose the application as local mode through a public tunnel.

Use one application process and one persistent disk. A static site host or an ephemeral serverless function cannot run this SQLite-backed application unchanged. Deploy a new archive without replacing the existing `.env` or `.local` directory. Stop the old process before switching versions. Restoring an older usage database or Telegram cursor can forget already processed work; preserve the current data and reconcile against provider evidence.

## Optional Telegram

Telegram cannot be enabled together with closed beta. Bot commands currently lack invitation admission, so startup rejects that combination. The following instructions apply only to a separately approved public-practice bot.

Use a product bot created through BotFather, not a personal Telegram account. Put its secret in `TELEGRAM_BOT_TOKEN`, set `VAULT_TELEGRAM_ENABLED=true` and restart. This requires public-practice mode and uses the same model service and global spend limit as the web. There must be no other poller or webhook consuming the bot's updates. Startup verifies the bot with `getMe`; `/api/channels` reports its state and the landing only links a running, verified bot.

Users can send private arguments and use `/start`, `/models`, `/model <id>`, `/rules`, `/new`, `/last` and `/receipt`. Telegram and Privy accounts remain separate. Commands do not infer wallet ownership. A validated release action wins the practice session only. No money moves.

If Telegram stops, inspect its warning and configuration/connectivity before restarting. A saved update is not inferred again. `/last` recovers the last saved response after restart; a crash before result persistence can require operator investigation. Unknown or pending provider cost pauses new inference in both channels. Never reset the usage database or invent a zero cost to resume.

## Before inviting players

Check the live HTTPS origin, an actual Privy sign-in, a real model response and its receipt, and one private bot conversation when enabled. Check `/api/health` and `/api/channels` independently: a stopped bot does not necessarily make the web service unhealthy. Confirm the response can be recovered without another paid call.

Define who operates the host and the actual retention/deletion policy before accepting public prompts. Session expiration and sign-out do not delete receipts. Back up the persistent data consistently with the process stopped, including Telegram state when enabled. The automated tests use controlled transports; they do not prove provider availability, model resistance, independent execution or a live payout system.
