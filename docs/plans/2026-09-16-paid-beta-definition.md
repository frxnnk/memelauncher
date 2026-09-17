# Vault paid beta — definition

16 September 2026. Canonical product spec from founder locks plus **implemented** `vault-lab` behavior. Supersedes 0.50 USDG / 70-20-10 drip / 30-day defaults for **new** paid rounds. Does not rewrite existing testnet balances or the live AMZN rehearsal ledger (`web-funding-testnet` / `rh-test-amzn`).

This is a closed paid beta, not a public token launch. Seed-round, holders and airdrops stay out of V1.

Do not treat unbuilt work as shipped. Status tags below: **done**, **code-only**, **blocked-on-operator**.

## Locked by the founder

| Topic | Decision |
| --- | --- |
| Purchase policy | Game credits are **not refundable** during the round. Technical failures still restore the attempt credit (undelivered service, not a cash-out). |
| Price | Floor **5** units per attempt (not 0.50). If many people try, price **goes up** globally, cap **25**. |
| Split | **70%** bounty / **30%** operations / **0%** continuity drip. Operating share must cover the model call. |
| On a win | Winner takes **75%** of that round’s pot. **25% stays** as continuity. The beaten guardian is **retired** from paid play. |
| One pot | **One paid guardian per round.** Easy models never share a hard model’s bounty. Qwen and Luna are off paid pots. |
| Seed | Founder intends **USD 500** as the first bounty seed. Not sent. |
| Duration | If nobody wins in **5 months**, the round expires. |
| Sponsors / token | Deferred. No game token, no holder airdrop. |
| Live product | **Vercel**, not a new VPS. x402 is Vercel project env. Durable store is **Turso**. `vercel.json` keeps the Caddy `/api` rewrite until the operator copies `vault-lab/deploy/vercel.api-cutover.json` and approves a deploy. |

## Engineering defaults (in code)

### Price curve

- Start: **5** units of the configured asset (testnet AMZN 18 decimals, or USDG 6 decimals in policy helpers).
- Increase: **global +1** after every *valid* attempt in that round (errors do not bump).
- Cap: **25**.
- Counter is round-global.

Implemented: `vault-lab/server/economy/paid-beta-policy.mjs` (`paidBetaPricePolicy`, `roundAttemptPrice`). Tests: `test/paid-beta-policy.test.mjs`, `test/paid-beta-ledger.test.mjs`, `test/paid-beta-game.test.mjs`.

### Split per valid attempt

- **70%** round bounty.
- **30%** operations.
- **0%** next-round drip.

Integer remainder stays in operations. Continuity is funded by the **25% retained on a win**, unused operating surplus, and later seed/sponsors.

### Anti-drain

1. Each funding round has exactly one guardian (`validateWebFundingConfiguration` rejects `models.length !== 1`).
2. Paid configs: Haiku proving-ground `config/paid-beta-haiku.testnet.json`; Opus template `config/paid-beta.example.json`. Practice writes in closed beta are Gemini/Haiku (`BETA_MODELS`). Qwen stays lab-only. Luna is the practice character, not a paid pot.
3. Winning a cheap guardian does not empty another round’s prize (`test/paid-beta-ledger.test.mjs`).
4. Retirement is by guardian key, not a cooldown.

### Win / expiry

- First valid `release_prize` wins. Payable = 75% of that round’s bounty; 25% → continuity.
- Beaten configuration cannot be reopened.
- At 5 months with no winner: player-funded bounty is distributed pro rata to attempters; seed returns to seed; **unused credits stay non-refundable**. `POST /api/funding/rounds/:roundId/expire` records that on the ledger with `broadcast: false` (no on-chain send).

### Networks and boxes

- Player credits: Robinhood. Rehearsal / paid-beta proving ground: chain **46630** AMZN. Mainnet **4663 USDG** is disabled in `startWebFunding`.
- Inference: EIP-3009 USDC on Base via x402. Product payer is a **dedicated** key. Local `:4319` is armed as `0xf670…7d40` (`paidConfigured` true). Laptop `0xf282…0c8f` is BlockRun rehearsal only and does not arm `paidConfigured`. Treasury `0xbec4…396d` and payer `0x686c…2f79` are forbidden operating boxes. Vercel project env is still behind the Caddy rewrite until an approved cutover.
- Prize and player credits never sit in the x402 key.
- Operator box size for a live seed is ~50 USDC, not 500. 500 is prize seed. Not funded on Vercel.

### Hosting (implemented topology, not a VPS plan)

| Surface | What is true now |
| --- | --- |
| Frontend | Vercel project `vault-closed-beta`, static output from `scripts/build-vercel.mjs`. |
| Live `/api` | `vercel.json` rewrites `/api/:path*` to Caddy `vault-beta-api.173.212.246.68.sslip.io`. That is **today’s** production API. It is not this working tree. |
| Intended `/api` | `api/index.mjs` → `server/vercel-handler.mjs`. Cutover file: `deploy/vercel.api-cutover.json`. Copy over `vercel.json` only when the operator approves a deploy. Do not `vercel --prod` from a paid-beta coding session. |
| x402 | Vercel project env `VAULT_X402_PRIVATE_KEY` / `VAULT_X402_FLOOR_USDC` / `VAULT_X402_RPC_URL`. Not a Windows service, not a VPS box. |
| Durable store | Local `node:sqlite` default. Turso via `VAULT_DURABLE_DATA=true` + `VAULT_LIBSQL_URL` + `VAULT_LIBSQL_AUTH_TOKEN` on a **new** database. Refuses `web-funding-testnet`. Not live. CLI is in Ubuntu WSL; login is still open. |
| Local proving ground | `npm run paid-beta:testnet` on `127.0.0.1:4319`. Ledger `.local/web-funding-paid-beta`. `paidConfigured` true, ops `0xf670…7d40`, sqlite (`VAULT_DURABLE_DATA` unset). |

Paid-beta sessions must not SSH, SCP, or write `C:\vault-beta`. Historical Caddy-host recovery commands stay in `vault-lab/deploy/LIVE-BETA.md` as archive only.

### Custody

Until mainnet escrow is live, copy must say **operator-controlled custody**. SQLite/Turso is a recoverable projection, not the cash register. Claims: win payable, expiry unwind, technical restore — executable in ledger; on-chain send is a separate treasury transfer.

## What is actually built

### Phase 1 — Economics in new ledgers only — **done** (code + tests)

- Policy module + `applyPaidBetaFundingConfig`.
- `startWebFunding` → `assertLedgerMatchesFundingTerms`: attaching paid-beta terms to a 70/20/10 rehearsal ledger throws; use a new data directory.
- Configs refuse more than one guardian per round.
- Evidence: `test/paid-beta-policy.test.mjs`, `test/paid-beta-ledger.test.mjs`, `test/paid-beta-game.test.mjs`, `test/paid-beta-rh-deposit.test.mjs`, `test/boot-funding.test.mjs`, `server/economy/web-funding-runtime.mjs`.

### Phase 2 — Deposit → paid Haiku → bounty — **code-only** locally, **blocked-on-operator** for live

| Path | Status |
| --- | --- |
| Synthetic chain-1337 deposit + laptop BlockRun Haiku x402 | Done. `audit/paid-beta-local-circuit.mjs`, receipt in `vault-lab/output/paid-beta-local-circuit.json`. Split 3/2/0. `paidConfigured` stayed false. Does **not** satisfy Robinhood deposit. |
| Unsigned RH testnet prepare (46630 AMZN → treasury) | Done. HTTP prepare against public RPC; `broadcast: false`. Tests in `test/paid-beta-rh-deposit.test.mjs`. Browser unsigned Top up on `:4319` already shows chain / AMZN / 5 / 70/30 / treasury before Privy. |
| Phantom Top up on `:4319` (sign-in → Connect Phantom → Pay from linked wallet) | **Not done.** Cursor browser has no Phantom. Operator must sign in a real wallet. Existing testnet AMZN in that wallet is enough. |
| Product `paidConfigured` on Vercel | **Not done.** Needs dedicated x402 env **and** approved copy of `deploy/vercel.api-cutover.json`. Live `/api/status` is still the Caddy process (`mode: practice`, no `paidConfigured`). |

### Phase 3 — Claim path — **code-only**; live send **blocked-on-operator**

- Win records `round:…:payable`. Local proving UI: `/play` **Send prize from treasury** matches **Send 1 AMZN to treasury** (Phantom switch `0xb626`, from treasury `0xbec4…396d`, recorded payable, then submit/check). Signed-in Top up still has Review / Confirm for Privy. Live send remains treasury Phantom.
- Endpoints: `GET /api/funding/claims/:roundId`, `POST .../prepare`, `/submit`, `/check`. Prepare encodes treasury → winner AMZN on 46630 with `broadcast: false`. Submit + check with mocked 46630 AMZN evidence marks the round `paid` (`test/paid-beta-rh-deposit.test.mjs`).
- The 0.1 AMZN historical deposit cannot be prepared as a prize payout.
- Expiry: `POST /api/funding/rounds/:roundId/expire` (treasury-gated). Ledger only. `broadcast: false`.
- Live prize send is **not done**: from-address is treasury `0xbec4…396d`. Gitignored env has no treasury signer. Do not spend the historical 0.1 AMZN as a fake win.

### Phase 4 — Escrow + 1 USDG fixture — **code-only**

- `server/economy/round-escrow.mjs`, `audit/usdg-claim-drill.mjs`, evidence `output/usdg-claim-drill.json` (1e6 base units, 75/25 split, unsigned 0.75 USDG transfer encoded, mainnet broadcast refused). Fixture-drill mode rejects a $500 seed.
- **1 USDG is still a fixture.** No mainnet 1 USDG send. No $500 seed.

### Phase 5 — TEE / attested executor — **not required**

- Not built. Not required for paid beta. Do not market cryptographic fairness. Operator-recorded RPC evidence only.

## Blocked on operator

None of the following is done. Do not bypass them in a coding session.

1. **Phantom Top up on `http://127.0.0.1:4319`.** Sign in → Connect Phantom → Pay from the linked wallet. Unsigned prepare is in the UI; no Phantom signature yet.
2. **Turso login** at https://api.turso.tech?redirect=false, then create empty `vault-paid-beta-dev` and write gitignored `VAULT_LIBSQL_URL` / `VAULT_LIBSQL_AUTH_TOKEN`. Leave `VAULT_DURABLE_DATA` unset so `:4319` stays sqlite. Not attached to Vercel.
3. **Approved** copy of `vault-lab/deploy/vercel.api-cutover.json` over live `vercel.json`, plus an approved deploy. Not this session.
4. **Live claim** needs the treasury signer in Phantom. This tree does not hold that key.
5. **1 USDG** remains a fixture. No mainnet send.
6. **TEE is not required.** Do not treat it as a remaining ship item.

## Still open (does not block Phase 1)

- Exact invite list and jurisdictions.
- Whether a lawyer later forces exceptional return of unused credits at expiry.
- Sponsor instrument.
- Public launch vs staying invite-only after the first win.

## Fairness note

Freysa Act I was transparent, not sovereign. Copy: public prompt + tools, win via published tool, majority of fee to prize, rising global price, expiry to players not token holders, retire beaten guardian. Do not copy “cryptographically guaranteed.” A TEE that calls a normal API attests the proxy, not Claude.

Public surface (17 September 2026): `/fairness`, `GET /api/funding/fairness`, `GET /api/receipts/public`. Operator records. Playing publishes the argument.
