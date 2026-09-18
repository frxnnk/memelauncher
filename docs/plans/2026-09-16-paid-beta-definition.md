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
| Live product | **Vercel** project `vault-closed-beta`, not a VPS. Node `/api` (`api/index.mjs` → `server/vercel-handler.mjs`). Durable store is production Turso `vault-paid-beta`. Caddy rewrite is rollback only (`deploy/vercel.caddy-rewrite.json`). |

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
2. Paid configs: Haiku proving-ground `config/paid-beta-haiku.testnet.json`; Opus template `config/paid-beta.example.json`; live Vercel `config/paid-beta.vercel.json` has **two** rounds on the same ledger: `rh-paid-opus-v1` (persuasion game, frozen default prompt) and `rh-payout-prove-v1` (Haiku, published `eval-payout-prove-v1` prompt). Easy models never share a hard model’s bounty. Practice writes in closed beta are Gemini/Haiku (`BETA_MODELS`). Qwen stays lab-only.
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
| Frontend | Vercel project `vault-closed-beta`, static output from `scripts/build-vercel.mjs`. Public ledger at `/fairness`. |
| Live `/api` | Node function `api/index.mjs` → `server/vercel-handler.mjs`. Rewrite `/api/:path*` → `/api/index?__vault_path=/api/:path*`. |
| x402 | Vercel project env. Product ops `0xf670…7d40`. Laptop/treasury/payer boxes forbidden. |
| Durable store | Production Turso `vault-paid-beta`. Refuses rehearsal `web-funding-testnet`. Local `:4319` stays sqlite. |
| Local proving ground | `npm run paid-beta:testnet` on `127.0.0.1:4319`. Ledger `.local/web-funding-paid-beta`. |

Paid-beta sessions must not SSH, SCP, or write `C:\vault-beta`. Historical Caddy-host recovery commands stay in `vault-lab/deploy/LIVE-BETA.md` as archive only.

### Custody

Until mainnet escrow is live, copy must say **operator-controlled custody**. SQLite/Turso is a recoverable projection, not the cash register. Claims: win payable, expiry unwind, technical restore — executable in ledger; on-chain send is a separate treasury transfer.

## What is actually built

### Phase 1 — Economics in new ledgers only — **done** (code + tests)

- Policy module + `applyPaidBetaFundingConfig`.
- `startWebFunding` → `assertLedgerMatchesFundingTerms`: attaching paid-beta terms to a 70/20/10 rehearsal ledger throws; use a new data directory.
- Configs refuse more than one guardian per round.
- Evidence: `test/paid-beta-policy.test.mjs`, `test/paid-beta-ledger.test.mjs`, `test/paid-beta-game.test.mjs`, `test/paid-beta-rh-deposit.test.mjs`, `test/boot-funding.test.mjs`, `server/economy/web-funding-runtime.mjs`.

### Phase 2 — Deposit → paid attempt → bounty — **done on live Vercel** (17 September 2026)

Live round `rh-paid-opus-v1` (Opus, not Haiku). Player stays on Robinhood testnet AMZN; Base USDC x402 is behind the scenes.

| Path | Status |
| --- | --- |
| Live `/api/status` | `paidConfigured: true`, `mode: x402-exact`, `bountyEnabled: true`. |
| Phantom Top up 5 AMZN | Done. tx `0x46d046c571ba6a2c8640ef9a1f432fe60c8f7482b01eeb99186ca90c1a3b2057` FROM `0x686c…2f79` TO treasury `0xbec4…396d`. Turso `credit-recorded`. |
| Paid Opus attempt | Done. 1 attempt, `locked`, credits 0, model `anthropic/claude-opus-5`. |
| Bounty split | Done on a miss: pot **3.5 AMZN** (70%), operations **1.5** (30%). Next price **6**. Public at `/fairness`. |

### Phase 3 — Claim path on testnet — **path done**; live prize send **blocked-on-operator**

- Endpoints: `GET /api/funding/claims/:roundId`, `POST .../prepare`, `/submit`, `/check`. UI: Review prize / Confirm prize (`phantom.ethereum`, same-click).
- Isolated drill `output/amzn-claim-drill.json`: genuine fixture `release_prize`, 5→3.5/1.5, payable 2.625 / continuity 0.875, prepare/submit/check marks `paid`, unsigned treasury→winner AMZN, `broadcast: false`. Does not mutate `rh-paid-opus-v1` or spend live `0xbec4`.
- Live round is a miss: `prizePayable` 0. A treasury Phantom send after a real win is still operator work. Do not fake `release_prize` on production Turso.

### Phase 4 — Escrow + 1 USDG fixture — **done** (unsigned; mainnet refused)

- `server/economy/round-escrow.mjs`, `audit/usdg-claim-drill.mjs`, evidence `output/usdg-claim-drill.json` (1e6 base units, 75/25 split, unsigned 0.75 USDG transfer encoded, mainnet broadcast refused). Fixture-drill mode rejects a $500 seed.
- **1 USDG is still a fixture.** No mainnet 1 USDG send. No $500 seed.

### Phase 5 — TEE / attested executor — **not required**

- Not built. Not required for paid beta. Do not market cryptographic fairness. Operator-recorded RPC evidence only.

## Blocked on operator (not remaining coding-session ship items)

1. **Live prize send** after a genuine win: treasury `0xbec4…396d` in Phantom, Robinhood testnet. No key in this tree. Do not spend the live pot as a fake payout.
2. **1 USDG on mainnet** remains a fixture. No $500 seed.
3. **TEE is not required.** Public ledger is operator receipts. Do not market cryptographic fairness.

## Still open (does not block Phase 1)

- Exact invite list and jurisdictions.
- Whether a lawyer later forces exceptional return of unused credits at expiry.
- Sponsor instrument.
- Public launch vs staying invite-only after the first win.

## Fairness note

Freysa Act I was transparent, not sovereign. Copy: public prompt + tools, win via published tool, majority of fee to prize, rising global price, expiry to players not token holders, retire beaten guardian. Do not copy “cryptographically guaranteed.” A TEE that calls a normal API attests the proxy, not Claude.

Public surface (17 September 2026): `/fairness`, `GET /api/funding/fairness`, `GET /api/receipts/public`. Operator records. Playing publishes the argument.
