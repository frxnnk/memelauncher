# Live Vault closed beta

Verified 2026-09-15, 06:50 UTC. Web: https://vault-closed-beta.vercel.app/play. Privy authentication and an active invitation are required. Robinhood testnet credits are enabled; real funds, cash prizes and payouts remain disabled.

Canonical paid-beta locks and phase evidence: [paid-beta definition](../../docs/plans/2026-09-16-paid-beta-definition.md). Live product is **Vercel**. Do not deploy a new VPS. Do not SSH, SCP, or write `C:\vault-beta` from a paid-beta coding session.

## Paid beta status (16 September 2026)

Phase 1 economics are in ledger/policy for **new** rounds only. `config/paid-beta.example.json` uses `policy: "paid-beta"` (5→25, 70/30, 25% retain, 5-month expiry, single boss `anthropic/claude-opus-5`). Startup refuses to attach that file to a ledger that already has 70/20/10 rehearsal rounds. Do **not** point `VAULT_WEB_FUNDING_CONFIG` at that file for the live AMZN rehearsal ledger; use a new data directory. Practice catalog stays Gemini/Haiku; credit play lists the funding-round guardian.

Phase 2 x402 is **Vercel project env**, not a VPS box. Set `VAULT_X402_PRIVATE_KEY` / `VAULT_X402_FLOOR_USDC` / `VAULT_X402_RPC_URL` on the Vercel project that serves `vault-closed-beta` when you approve a cutover. Do not upload `0xf282…0c8f`, treasury `0xbec4…396d`, or payer `0x686c…2f79`. Until a dedicated key is set there **and** `/api` is cut over, live `/api/status` stays on the Caddy process (`paidConfigured` will be absent).

**LIVE-BETA is not already on the Node `/api` in this tree.** Production still rewrites `/api` to `vault-beta-api.173.212.246.68.sslip.io` (Via: Caddy). `vercel.json` in this tree keeps that rewrite on purpose so an accidental deploy does not steal API traffic. The Node handler lives at `api/index.mjs` → `server/vercel-handler.mjs`. To cut Caddy out later, copy `deploy/vercel.api-cutover.json` over `vercel.json` and deploy **only after** you approve it. Do not run `vercel --prod` from a paid-beta coding session.

Durable store (not live): local `node:sqlite` remains default. Set `VAULT_DURABLE_DATA=true` with `VAULT_LIBSQL_URL` (`libsql://` or `https://`) and `VAULT_LIBSQL_AUTH_TOKEN` to use a **new** Turso database. Optional `VAULT_FUNDING_DATA_DIRECTORY` defaults to `web-funding-paid-beta` when durable is on. The adapter refuses `web-funding-testnet` / AMZN rehearsal paths. Sandbox `economy-sandbox.sqlite` / `model-jobs.sqlite` stay on local sqlite because they share table names with the funding ledger. `memory:` is a unit-test stand-in and is not production. Do not migrate the rehearsal ledger onto Turso or `/tmp`.

Phase 3 claim path records a payable and can mark the round paid from mocked Robinhood testnet AMZN evidence (`broadcast: false`). Local proving UI: `/play` **Send prize from treasury** is the unsigned Phantom path (switch `0xb626`, from treasury `0xbec4…396d`, recorded payable, then submit/check), matching **Send 1 AMZN to treasury**. Signed-in Top up still has Review prize transfer → Confirm prize transfer. Endpoints: `GET /api/funding/claims/:roundId`, `POST .../prepare`, `/submit`, `/check`. This tree has no treasury signer in gitignored env, so it does not broadcast. The 0.1 AMZN historical deposit cannot be prepared as a fake win.

Expiry (5 months, no winner): player-funded bounty returns pro rata to attempters; seed returns to seed; **unused credits stay non-refundable**. `POST /api/funding/rounds/:roundId/expire` is treasury-gated and records the ledger only (`broadcast: false`). It does not send AMZN. On-chain prize/refund transfers are a separate treasury Phantom step after an approved cutover.

Phase 4 is a fixture 1 USDG escrow drill (`node audit/usdg-claim-drill.mjs`, evidence `output/usdg-claim-drill.json`). No mainnet 500 seed. Attested executor is not required yet.

Local paid-beta circuit (16 September 2026, laptop BlockRun smoke only): `.local/paid-beta-circuit-2026-09-16T21-15-07-178Z`, round `haiku-v1`, receipt `9abd64cb-9ec8-4295-8a6d-1e60a97371d5`. Split 3/2/0 (70/30), bounty 3, x402 quote 0.002285 USDC settled on Base. `createLiveX402Payer` stayed unarmed. Deposit was synthetic chain 1337 (does **not** satisfy Phase 2).

Phase 2 Robinhood testnet deposit (16 September 2026, localhost proving ground): `npm run paid-beta:testnet` serves http://127.0.0.1:4319/play against `config/paid-beta-haiku.testnet.json` and `.local/web-funding-paid-beta`. Browser Top up sends FROM the linked Phantom/Privy wallet (not the CLI faucet address). Public RPC default is `rpc.testnet.chain.robinhood.com`. Optional CLI faucet address for `npm run paid-beta:testnet-deposit` only (gitignored key, not printed): `0xFcF79a0D3D32791dF521A041b02Ac97Ca12842F4`. Deposit destination remains treasury `0xbec4…396d`. No claim key generated. Unsigned prepare verified on live 46630 RPC without broadcast. The faucet (`faucet.testnet.chain.robinhood.com`) still needs Google Sign-In in a real browser. `npm run paid-beta:testnet-deposit` checks that CLI address once. Browser sign-in still needs Privy allowed origins `http://127.0.0.1:4319` and `http://localhost:4319`. Production Vercel is unchanged. No local copy of the 15 September rehearsal ledger (`web-funding-testnet`); that 0.1 AMZN credit lives on the historical Caddy host and was not pulled.

Phase 3 live prize send remains blocked-on-operator: Phantom must sign as treasury `0xbec4…396d`. Gitignored env has no treasury signer.

Source tests: 322 passing locally on 16 September 2026. Live `GET /api/status` via https://vault-closed-beta.vercel.app still reports `mode: "practice"` and `bountyEnabled: false` (no `paidConfigured` field yet) because production still rewrites `/api` to the historical Caddy process. That backend is not this working tree. Do not SSH there to change it.

## Deployment

- Frontend: Vercel project `vault-closed-beta`, team `frxn`, static output from `scripts/build-vercel.mjs`. Character/reply UI deployed and file hashes verified 2026-09-15 at 07:26 UTC.
- **Live API (until you cut over):** Vercel rewrite `/api/:path*` → Caddy at `vault-beta-api.173.212.246.68.sslip.io`. That is production today. This tree's `vercel.json` matches it.
- **Not live:** Node `/api` in `deploy/vercel.api-cutover.json`. Same Vercel project, env names as `.env.example`, no Windows service. Requires a new x402 ops key, Turso credentials, and a deploy you approve. Do not treat this file as already shipped.
- Git remains local without a required remote. Never print or publish secrets.

Backend archive: `vault-beta-6ea42baf2d4d-c612cfea.tar.gz`, SHA256 `c612cfea6624f4654a9d7e1bec195ce17f5d7a073ce48212cdf82168081c9a42`. The later frontend-only receipt wording and dialog gesture fix do not alter this backend release. Latest source validation includes those frontend changes.

## Live testnet evidence

- Chain 46630; official faucet AMZN `0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02`, 18 decimals, no monetary value.
- Payer `0x686c6cd47d0a09b5b77fff3f76e2786425dc2f79`; treasury `0xbec4fdb33ed39844956d9078fd232aca92d7396d`.
- One deposit of 0.1: `0x2df3f5c1c1b97c0e89011daaa436bb4fa165056dd5bcda3a98f42423eaa2ba31`; credited order `47777acc-dc07-404b-8a40-79125b548bcb`. Do not send it again.
- Gemini failed with an explicit empty upstream error; the player received the full credit back. Its missing API cost was reconciled using OpenRouter's published zero completion insurance policy, with raw receipt unchanged and corroborating unchanged key usage. This is policy evidence, not an API-reported numeric cost. Network timeouts and ambiguous outputs still block for reconciliation.
- Haiku then returned `locked`, receipt `fc156278-9597-4db3-b34b-28cbe527906c`, reported API cost USD 0.001795.
- Available 0, reserved 0, Haiku bounty 0.07, operations 0.02, next round reserve 0.01. Treasury still holds the 0.1 on chain: gameplay moves ledger allocations, not additional wallet transfers.
- Rehearsal split 70/20/10 and price 0.1 are illustrative test settings, not approved mainnet economics.

Evidence: `output/live-circuit-20260915.json`, `output/usage-policy-recovery-20260915.json`, `output/robinhood-first-order.json`, `output/robinhood-transfer-recovery.json`, `output/robinhood-web-deployment.json`.

## Controls and limitations

25 requests per account/day, 250 globally/day, UTC reset; one inference at a time. Dedicated OpenRouter key cumulative USD 5, no reset, BYOK included. No automatic replenishment. Gemini and Haiku are candidates, not qualified for real-money rounds. Qwen remains in the lab. Prompt `vault-practice-v2-en-2026-09-14`.

Five private tester codes exist in `.local/beta-testers.json`; they were not sent. The URL does not grant access. Telegram is not live. There is no multisig, independent model attestation, automatic payout or claim of jailbreak resistance. Current custody is operator-controlled and disclosed; user + agent multisig, minimum reserve and variable pricing remain design proposals.

After reload, use Sign in → Restore existing session. Receipts are stored server-side; the conversation and credit-play selection are not automatically restored. The footer count reflects this tab. The per-model bounty is visible in Account → Top up & bounty.

## Operations and recovery

Paid-beta work in this tree targets **Vercel Node + Turso** after an approved cutover (`deploy/vercel.api-cutover.json` copied over `vercel.json`). It does **not** deploy to a VPS and does not mutate the still-live Caddy host.

The archive below is the **historical** Caddy API (`vault-beta-api.173.212.246.68.sslip.io` / `C:\vault-beta`). Do not SSH, SCP, or run it from a paid-beta coding session. Pause, backup and upgrades on that host stay an operator choice until the Vercel cutover is approved.

Historical Caddy-host commands (do not run from this tree):

```powershell
# ARCHIVE ONLY — still-live Caddy host, not this working tree.
$vaultRelease='C:\vault-beta\releases\6ea42baf2d4d'
$vaultDb='C:\vault-beta\shared\data\beta.sqlite'
Set-Location $vaultRelease
node scripts/beta.mjs list --db $vaultDb
node scripts/beta.mjs pause --db $vaultDb
node scripts/beta.mjs resume --db $vaultDb
```

Pause admissions, drain inference, stop the service and its monitor, copy the entire data directory, compare hashes and check every SQLite database, then restart and verify before resuming. Latest stopped backup: `C:\vault-beta\shared\backups\data-before-6ea42baf2d4d-20260915084752`; eleven files and seven databases verified. It includes the funded ledger. Backup contains private records and must not be published.

`deploy/upgrade-windows-beta.ps1 -AllowTestnetFunding` supports explicit Robinhood testnet upgrades only. It rejects real funds and payouts, verifies the archive, backs up all storage, compares funding configuration and balances, and preserves sessions and usage. Code rollback retains current data; never restore an earlier ledger, order set or usage database. Previous backend `1c1d381b940f` lacks automatic no-charge error handling; use the new release for normal operation.

Recover a wallet hash/order instead of signing twice. Confirmed provider errors return credits; uncertain model requests stay reserved until reconciled. Never fabricate a zero cost. Automatic no-charge handling only accepts the narrow empty-error condition backed by the provider policy; `scripts/reconcile-usage.mjs` uses an existing receipt and preserves its provenance.

244 automated tests and build passed, including validated progressive reply delivery, cancellation, Unicode preservation and reduced-motion behavior. Concurrency, deposit and account-game drills passed with synthetic transport. Those drills complement the single live deposit and successful Haiku attempt; they are not a production load test or independent security audit.

Authenticated responsive review completed at 390×844 and 360×740: funding, recovery, custody disclosure and model selection work without horizontal overflow. The chat fits both viewports; testnet attempt price is now a separate visible line below the composer, since the mobile turn counter was hidden. The credited deposit was rechecked without another transfer; ledger verification at 07:09 UTC still showed 12 events and the same balances. This is desktop responsive QA, not a physical-phone wallet-signing test. Phantom logged an extension injection collision; no wallet signature was requested in this review. Evidence: `output/mobile-circuit-review-20260915.json`. Browser size was restored.

## Character and dialogue update

The door now shows the selected model's reported test-token bounty (Haiku 0.07, Gemini 0), with unavailable states instead of invented balances. The introduction disappears during play. Validated replies appear progressively inside a scrollable speech bubble; this is presentation after validation, not upstream streaming. Face expressions, colors and speaking motion react to game states. Optional synthesized sounds are off by default and require an explicit click; no microphone or voice service is used.

A live free-practice Haiku request at 07:26:35 UTC returned locked: 1,168 input tokens, 171 output tokens, reported cost 0.002023 OpenRouter credits, server inference duration 3.05 seconds. The UI visibly showed partial validated text and a speaking face, then the full scrollable response. This practice request did not consume testnet credits or increase the bounty. The existing 0.07 bounty remained visible.

Reviewed 390×844, 360×740, compact 390×480, and desktop 1536×646. No page overflow; long replies scroll within the bubble and keyboard PageUp works. Compact viewport emulation is not a physical mobile-keyboard test. Sound enabled/disabled successfully; physical-device audibility has not been independently checked. Browser size restored and sound muted after review. Backend release and economic configuration are unchanged. Full notes: `docs/treasure-guardian/CHARACTER-UX-REVIEW-2026-09-15.md` in the parent workspace.
