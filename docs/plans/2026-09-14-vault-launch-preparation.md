# Vault Launch Preparation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. The user authorized autonomous execution; continue between checkpoints without requesting repeated confirmation.

**Goal:** Prepare an inspectable release of the shared-bounty game with a frozen guardian roster, Privy identity/wallet, auditable credit flow, adversarial evaluation and explicit release dependencies.

**Architecture:** Retain the existing Node/SQLite services and English, single-screen client. Treat the current TEST economy as a sandbox; production capabilities are disabled until their actual configuration and evidence exist. Authenticate before accessing user state, keep model tools unable to choose monetary amounts or recipients, and freeze round configurations independently of the moving model catalog.

**Tech Stack:** Node 22+, native SQLite, browser JavaScript/CSS; official Privy SDKs when required, with a small browser bundling step. Dependencies require an explicit purpose and pinned lockfile.

---

## Scope and execution constraints

- Product decision: one common bounty; choose from 2–3 tested guardians per round. Freeform catalog discovery remains useful in practice, but does not qualify models for money.
- User's current weekly threshold: retain at least 30% available, replacing the earlier 45% floor by explicit instruction. Resumption check: 43% available. Check between work batches; reaching the threshold does not prove launch readiness.
- No API spend, publications, wallet signing, contracts deployment or funds without concrete authorization. Local tests use fixtures and temporary databases.
- Repository is unborn and all source is untracked. There is no HEAD from which to create a worktree. Work in the existing authorized app directory on `codex/vault-launch-preparation`; do not stage unrelated parent files. Record this exception rather than committing the entire parent project to manufacture a worktree.
- Existing baseline: 84 tests passed in the prior turn. Rerun appropriate tests for this change before reporting readiness.

## Task 1: Freeze round guardian configurations

**Files:** `vault-lab/server/rounds.mjs`, `vault-lab/server/economy/service.mjs`, `vault-lab/server/economy/model-game.mjs`, `vault-lab/test/rounds.test.mjs`, affected economy tests.

1. Write tests for an immutable 2–3-model manifest, canonical hashes, reopen/restart, model rejection before credit reservation and configuration drift before inference.
2. Implement persisted manifests, published original configuration and selection validation. A manifest is operator evidence, not atestation or qualification.
3. Bind new sandbox rounds and model jobs to their manifest; do not silently reinterpret existing rounds.
4. Run affected tests and the full suite. Verify a permitted release still closes the single shared bounty and a rejected model leaves balances untouched.

## Task 2: Privy integration with explicit configuration

**Files:** `vault-lab/server/auth.mjs`, `vault-lab/client/privy.js`, `vault-lab/public/account.js`, `vault-lab/public/index.html`, `vault-lab/server/http.mjs`, `vault-lab/server.mjs`, `vault-lab/.env.example`, `vault-lab/package.json`, lockfile, auth/client tests.

1. Verify the current official SDK interfaces and install only the required client/server packages and bundler with a lockfile.
2. Implement backend verification and server-derived identity. Never use a supplied wallet address or player ID as ownership proof; do not return tokens/secrets.
3. Add login/logout and wallet readiness to the existing UI, with accurate unavailable states when IDs are missing. No wallet is created or signed automatically during verification.
4. Allow only required CSP origins for configured Privy features. Keep local sandbox access and public launch mode distinct.
5. Test missing/expired/foreign-app tokens, cross-user state, logout races and configuration absence using controlled transports. Bundle successfully and verify the UI in-browser.

## Task 3: Durable user sessions and bounded inference

**Files:** `vault-lab/server/sessions.mjs`, `vault-lab/server/limits.mjs`, `vault-lab/server/service.mjs`, `vault-lab/server/http.mjs`, relevant tests.

1. Persist sessions with owner and effective configuration; verify restart, ownership, expiry and no cross-model history reuse.
2. Add authenticated request limits and durable usage reservations for a public practice release; record unknown costs rather than calling them free.
3. Ensure public execution cannot expose anonymous inference or sandbox balance mutations. Do not remove localhost restrictions until the public configuration validates.
4. Test all gates before upstream requests and concurrency/recovery behavior. Provider cost limits remain an external dependency.

## Task 4: Deposit and payout implementation boundary

**Files:** `vault-lab/server/economy/deposit.mjs`, new order/indexer modules as supported by selected configuration, `docs/treasure-guardian/PAYMENTS-IMPLEMENTATION.md`, tests.

1. Specify deposit ownership, exact chain/token/recipient, confirmations and deduplication from trusted RPC evidence.
2. Implement reversible order/reconciliation preparation and tests without crediting real tokens or inventing token addresses.
3. Specify payout authority, claimant binding, idempotency and unknown transaction recovery. API receipts alone do not prove that the operator cannot fabricate a winner.
4. Only implement/deploy a funded executor once the trust model and exact asset permit a concrete review. Keep payments closed until then; do not label a signed server receipt trustless.

## Task 5: Evaluation and release evidence

**Files:** `vault-lab/eval/*`, `vault-lab/audit/*`, `vault-lab/output/*`, tests.

1. Make versioned candidate configuration comparisons and tool-compatibility controls reproducible without changing the live guardian implicitly.
2. Preserve dry-run defaults, explicit dedicated key limits and complete per-attempt artifacts. No live evaluation without a configured budget.
3. Create a launch preflight report distinguishing implemented, configured, tested live and independently verified; do not accept a handwritten `ready: true` as evidence.
4. Run unit/integration tests, build and targeted UI QA; save the manifest and results without secrets.

## Task 6: Release package and remaining decisions

**Files:** `docs/treasure-guardian/LAUNCH-DECISIONS.md`, `HANDOFF-2026-09-14.md`, `README.md`, deployment/runbook docs, English social and sponsor drafts.

1. Update the accepted shared-bounty/curated-selector decision everywhere it matters; retain prior research as historical recommendations where clearly labeled.
2. Prepare deployment configuration, backup/restore, health checks, incident handling, privacy/export policy and launch checklist.
3. Keep Privy IDs/credentials, API spend, exact Long asset/stock, branding/domain, payout authority and publication approvals visible as concrete dependencies.
4. Finish all independent work before asking for missing decisions. Do not mark the broad launch goal complete while funded launch requirements remain unresolved.

## Progress

- [x] Goal created; quota verified; current source and accepted direction reviewed.
- [x] Frozen guardian roster and round enforcement in TEST; qualification for funds remains pending.
- [x] Privy client/server integration and local tests; real app/login configuration remains pending.
- [x] Durable identity-bound sessions and inference limits, including receipt-linked recovery.
- [x] Deposit/order preparation, deduplication tests and documented payout boundary; RPC and funded ledger/executor are not connected.
- [x] Versioned baseline/candidate evaluation and launch preflight evidence; real evaluation requires a dedicated key and approved budget.
- [x] Deployment templates/runbook and updated handoff; templates are not deployed and the live restore drill remains pending.

Local checkpoint: 124 tests passed, bundle built, account and operational-health browser flows passed. The first continuation added a bounded read-only RPC transport and a stopped-writer restore drill using four fixture databases. The second added public operational aggregates, the Transparency status panel, a receipt-storage failure gate and refund/uncertainty regressions. It also verified the NVDA candidate against the official issuer registry and public RPC; exact Long admission and game-token selection remain unresolved. These goal turns made implementation/evidence progress; none establishes funded launch readiness. Current release evidence lives in `vault-lab/output/release-verification.json`; run `npm run preflight` to detect changed sources. The broad goal remains active because credentials, actual evaluation, asset/authority decisions and funded execution are unresolved. Do not treat these preparation checkboxes as a completed funded launch.

Third continuation: bounded authority research reviewed current official docs and pinned Freysa/dstack sources. `PRIZE-AUTHORITY.md` now specifies the proposed executor/escrow boundary and adversarial acceptance criteria, especially hidden API resampling, cloning, rollback and KMS upgrades. Source hashes and GET timestamps are preserved under `output/authority-research`. No app code, live provider configuration or funded permissions changed. This is evidence/design progress; no actual attestation was verified and hosting/runtime/budget still need concrete configuration.

Fourth continuation: added and ran the isolated HTTP concurrency drill (86 requests, 2 intercepted inference calls, peak 1 active). It verifies concurrent rejection without extra reservations, accounting after client disconnect, foreign-session isolation and the exhausted-budget gate. The release now has 125 passing tests and a successful build. This is implementation/evidence progress, not a production capacity claim. Public admission still has no queue; real provider/Privy, HTTPS host and funded behavior remain unverified.

Fifth continuation: implemented an owner-bound receipt index in the session SQLite database and authenticated, paginated read-only history endpoints. Public-practice users can open/download saved receipts after reload; reading does not resume inference. Four additional tests cover owner isolation, restart/session expiry, errors, pagination and HTTP authentication. Restore and disconnect drills now verify indexed receipts. Browser QA passed pagination, download, reload, account switch, cancelled stale responses and three viewports. Release: 129 tests and build passed. No live Privy app, paid inference, publication or funds. Quota check: 46% remaining; preserve the 45% floor.

Sixth continuation: added an isolated permissive tool-compatibility suite before game-resistance evaluation. Six planned calls cover keep_locked and release_prize across three candidates; four tests verify prompt isolation, real tool calls, wrong/text-only output and provider errors. Full release: 133 tests and build passed, zero real inference calls. The first proposed paid step is this six-call lot using an explicitly approved dedicated, non-renewing provider key capped at USD 5 or less; subsequent baseline/candidate comparisons share that cumulative cap. No spending occurred. Weekly quota reached 45% remaining: close current verification and stop further work to preserve the user's floor. The broad goal is unfinished and must not be marked complete or blocked just because of this quota stop.

## Resumption: atomic deposit accounting

The user now authorizes continued work down to 30% weekly remaining. The previous stop above is historical. The app goal was paused during that turn and has now been resumed by the user/system; its objective text still contains the superseded floor. The latest explicit user instruction controls: preserve 30% remaining.

- [x] Extend the existing accounting engine with an isolated, immutable asset preparation mode. Never convert a TEST database into token balances, expose simulated mint/refund/payout operations there, or enable public payments.
- [x] Commit verified deposit evidence, owner credits and the accounting event in the same SQLite transaction. Use integer token base units at 1:1 accounting value, with no invented exchange rate or adopted tokenomics.
- [x] Preserve deduplication across restart, bind credits to server identity, reject evidence changes, and hold spending if previously credited evidence becomes uncertain. Reconciliation must not silently erase a user's claim.
- [x] Verify the entire deposit/reserve/failed-attempt/contribution/winner-payable flow with synthetic RPC evidence, rollback faults and owner isolation. Run the release suite and update the factual launch boundary.

Resumption checkpoint: 142 tests and build passed; source-current preflight at 2026-09-14T20:33:28Z. The new deposit drill made 36 intercepted read-only RPC calls, no external calls, no inference and no signatures. It restored two users' deposits and a persistent reorg hold from a stopped SQLite writer; final obligations sum to the recorded 1200 synthetic base units. Original RPC records and reconciliation observations are included in the private operator export. Schema 2 prevents the older TEST-only application from opening an asset ledger. Public payment routes, authenticated credit gameplay, periodic indexing, exact asset/finality and payout remain pending; this does not qualify models or establish live custody/independent authority.

## Authenticated asset-credit gameplay

The previous turn made implementation and verification progress. Latest goal status is active; weekly remaining is 43%.

- [x] Freeze explicit asset denomination, attempt price and split alongside the 2–3 guardian roster; retain existing TEST manifests unchanged.
- [x] Reuse the current job/reservation/settlement engine for authenticated account balances. Scope idempotency, sessions, result lookup and reconciliation by verified account, never by a browser-supplied account ID.
- [x] Freeze a verified payout wallet at admission and preserve it with the attempt/winning liability; never accept wallet or amount from the model output.
- [x] Bind jobs to their ledger instance, handle restart between inference and settlement without a second model call, and preserve unknown outcomes and deposit holds.
- [x] Exercise deposits through model replies and private receipts with controlled authentication/RPC/provider transports. Keep HTTP payment enablement and payout execution closed; update evidence and dependencies after tests pass.

Current checkpoint: 153 tests and build passed; source-current preflight at 2026-09-14T21:03:40Z. `drill:accounts` traverses two accounts verified by the official Privy SDK with generated ES256 fixture tokens, three guardian profiles and four intercepted responses. It recovers a completed response after a usage-write interruption and a service restart, then fixes the winner liability to the original verified wallet. Eleven added tests cover account/record/session isolation, receipt discrepancies, limits, deposit holds, job binding, restart and schema migration. Asset schema 3 rejects older engines that did not require recipients; legacy attempts without a stored address cannot manufacture one during migration. No real API, wallet, money, launch transaction or publication occurred. Weekly remaining was still 43%, with the 30% floor in force.

Public HTTP/UI credit wiring, periodic exact-asset indexing/finality, payout authority/executor, real Privy/provider validation and approved tokenomics remain necessary. The prepared server composition is not a funded launch, and a database identity is not independent proof against operator cloning. Existing browser QA is historical and unchanged because this block did not edit UI files.

## Offline asset-ledger verification

The preceding goal turn made progress: authenticated accounting and recovery are implemented, with 153 passing tests. Weekly remaining is 43%; the accepted floor remains 30%.

- [x] Anchor each deposit observation to the last accounting event in the same SQLite transaction. Keep missing historical anchors explicit instead of manufacturing them.
- [x] Replay exported asset deposits, reservations, contributions, recipient bindings and settlements with the real engine in an isolated temporary database. Validate raw supplied RPC evidence and frozen round terms; do not trust exported balances or deposit summaries alone.
- [x] Reproduce reported deposit hold transitions at their accounting positions and reject spending while held, duplicate/missing deposits, changed amounts, recipients, manifests and results.
- [x] Provide a bounded offline CLI, adversarial export tests and a reproducible report. Clearly state what is not proved: live chain state, identity ownership, completeness, model execution and independence from the operator. Preserve TEST verification.

Audit checkpoint: 161 tests and build passed; source-current preflight at 2026-09-14T21:17:55Z. The saved offline report replays 15 events and two supplied synthetic deposits, with no network or signatures. Historical missing anchors/attachment times remain explicit and cannot pass strict verification. Weekly remaining is 42%, above the 30% floor. The launch goal remains active.

## Recoverable wallet deposit preparation

- [x] Prepare a standard ERC-20 transfer request from the frozen order, with exact integer amount, chain, sender and recipient. No approvals, signing, automatic wallet action or live payment enablement.
- [x] Authenticate deposit creation and private history before RPC. Persist the wallet's transaction hash before receipt lookup, allow later receipt/confirmation recovery, and never replace an accepted transaction reference.
- [x] Discover the unique matching transfer from server-fetched RPC evidence; reject ambiguous, forged or unrelated receipts. Reuse atomic reconciliation and holds.
- [x] Verify concurrent retries, expiry, reload/restart, private pagination, transferred-wallet ownership and offline replay. Update the launch boundary; HTTP/UI payment routes remain a separate integration step.

Latest checkpoint: 169 tests and build passed; preflight source-current at 2026-09-14T21:33:00Z. The expanded account drill uses 16 intercepted RPC reads, two recoverable deposit hashes, three guardians and four simulated responses. The resulting 15 accounting events replay offline. Asset schema 4 preserves submitted references; no real wallet, paid API call, publication or funds. Quota remains 42% weekly, with the 30% floor in force. The broad launch goal is active and unfinished.

## Account credit and deposit visibility

- [x] Expose authenticated read-only summaries and paginated deposit history through a thin HTTP boundary. Reject owner selectors, unknown query fields and mutations; no RPC, inference or wallet action on reads.
- [x] Add an English account panel for available/reserved/payable amounts, pending deposits, fixed references and private JSON download. Clearly distinguish recorded preparation balances from live funds.
- [x] Clear private DOM and cancel late responses on account changes/close; preserve exact integer amounts and existing one-screen layout.
- [x] Verify HTTP ownership and closed capabilities, then browser flows, empty/unconfigured/error states, pagination and mobile layout. Keep payment enablement and real app/asset/authority requirements explicit.

Visibility checkpoint: 173 tests and build passed; preflight source-current at 2026-09-14T21:45:47Z. Browser QA passed after a clean CLI browser session, with actual unconfigured-server verification and mocked account/record APIs for positive cases. It checked exact amounts, 20/1 pagination, matching JSON download, reload, failure/hold states, cancellation and three viewports; zero writes, RPC, inference or wallet actions. The normal server is running locally without Privy or an API key and does not instantiate asset credits. Weekly remaining is now 40%; preserve the 30% floor. This turn made implementation/verification progress; the funded launch remains unfinished.

## Periodic deposit reconciliation and stale-admission gate

Privy access was checked in the in-app browser: the developer dashboard presents login/sign-up, with no active session. No identity or credentials were entered and no app was created. A user login request is pending asynchronously; independent local work continues. Weekly remaining: 39%, floor 30%.

- [x] Reuse a single RPC inspection/reconciliation implementation for account checks and a bounded worker.
- [x] Persist worker identity/asset/policy binding, sweep cursor and lease; resume batches without re-crediting and reject the tested stale response. Cross-process atomic fencing remains unproved.
- [x] Expose freshness status and an admission/settlement gate for the authenticated credit composition. Preserve completed model responses if reconciliation becomes unavailable before settlement.
- [x] Verify pending deposits, loss of evidence, outage, concurrency, worker restart, stale checks and recovery with synthetic transports; keep live scheduling and payments unconfigured.

Monitor checkpoint: 181 tests and build passed. `drill:monitor` uses two synthetic accounts, 30 intercepted RPC reads and one simulated inference; its completed response settles after renewed deposit checks without resampling. Six accounting events and eight deposit observations replay offline. The optional monitor has not been wired into the ordinary app, deployed or proved atomic with the ledger across processes. See `DEPOSIT-MONITOR.md` for the exact boundary.

## Real Privy development configuration

The user provided the authenticated Privy tab in Brave. Created Vault in development mode, a web client, exact loopback origins, and enabled identity tokens. Email was already enabled; automatic wallet creation and smart wallets remain disabled. Public IDs and verification key are stored only in the ignored local `.env`; no App Secret was retrieved or used. The restarted server recognizes this configuration. Current source-current preflight: 2026-09-14T22:09:16Z, 181 tests, Privy configured, provider key absent, payments closed.

Brave blocked automated navigation to localhost with ERR_BLOCKED_BY_CLIENT. No browser protection was bypassed. A manual login request is pending; real OTP/login/wallet/CSP verification is unfinished. Dashboard setup is documented in `PRIVY-SETUP.md`. Weekly remaining: 37%, with the 30% floor still in force. This turn made implementation and configuration progress; the broad launch goal remains active.

## Atomic worker fencing

Previous turn: progress (181 passing tests, monitor drill, real Privy development setup). Current quota: 36% remaining; preserve 30% per the latest user instruction, superseding the old objective wording.

- [x] Move monitor binding/cursor/lease into the owning asset ledger connection; reject the obsolete separate-path option rather than silently importing a stale freshness claim.
- [x] Validate worker permission inside each deposit write transaction, including error/hold observations; serialize takeover and writes through the same SQLite lock.
- [x] Prove exclusion with a competing process, preserve restart/recovery and offline audit, bump the asset schema so older engines cannot ignore this boundary.
- [x] Regenerate release/drill evidence and update operational limits. Keep login verification pending and live payments closed.

Atomic fencing checkpoint: asset schema 5 preserves previous records and adds monitor state to the ledger connection. Three takeover tests cover attachment, reconciliation and unavailable/error observations; a separate Node process cannot acquire the SQLite write lock inside any of those guards. The monitor drill still passes and replays offline. Release: 185 tests/build passed; source-current preflight at 2026-09-14T22:22:12Z. No live API, wallet action or publication. The normal process remains in local mode and does not instantiate the asset worker; no funded operation or independent authority was claimed.

## Current Long launch path

Previous turn: progress (atomic monitor fencing, asset schema 5, 185 tests/build and current preflight). Weekly remaining: 36%, floor 30%.

- [x] Recheck Long through the current browser using the existing session read-only. The catalog and AI/NVDA detail load; the creation form remains on Preparing after one reload. No connection/signature/claim/launch or terms acceptance.
- [x] Identify the exact evidence still needed for contracts, launch amounts and fee beneficiaries; do not inherit another token's defaults.
- [x] Update the asset/treasury decision with current primary evidence and a concrete next step. Keep the stock/token selection provisional unless authorized.

Long checkpoint: live UI identifies Artificial Inu (AI) at 0x2e8c31162b855a2ffa90f6f8634643ad6f111e18 as paired with NVDA, and its fee recipient as a Community Vault at 0xd14D2eEb9648f53fA153A218eeEd908789C28630. The interface describes burning AI fees and distributing the rest; neither percentages nor contract execution were verified. Full quote copying was unavailable, so the display is not treated as a full address/PoolKey proof. The current decision keeps Long fees and the prize ledger separate. CLIPPY/MSFT is already displayed in the catalog, a naming collision signal only. The form and contract simulation remain pending. See LONG-LAUNCH-CHECK-2026-09-14.md. No application source changed this turn; the prior 185-test release is still the latest implementation evidence.

## Verified prize-reserve contributions

Previous turn: progress (current Long catalog/Community Vault evidence changed the treasury integration proposal). Weekly remaining: 34%, preserve 30%.

- [x] Reuse authenticated deposit preparation and RPC reconciliation for an explicit prize-reserve contribution intent, with immutable purpose/source and no player credits.
- [x] Post confirmed receipts into the existing next-round reserve atomically; preserve deduplication/holds and reject arbitrary source/asset changes. Label source as a declaration, not proof of sponsor identity or fee origin.
- [x] Extend offline replay and private record projection to distinguish contributions from player top-ups; keep HTTP payment enablement and real signatures closed.
- [x] Verify receipt replay, failure rollback, restart, purpose changes, wrong evidence and reserve seeding. Update launch evidence and disclose the remaining live integration.

Funding checkpoint: asset schema 6, five contribution tests plus private HTTP coverage, 191 total tests/build passed. Synthetic drill: 5000 sponsor + 1000 player base units, 5070 payable with no transfer, sponsor credits 0; seven events, two deposits and four observations replay offline. Source-current preflight 2026-09-14T22:43:50Z. The declared sponsor source is not affiliation or fee verification. Allocation to rounds remains an operator preparation movement, not independent prize authority. No paid API, wallet signature or publication. Weekly remaining 33%; preserve the 30% floor. Real Privy login remains pending. See PRIZE-FUNDING.md.

## Official verifier probe preparation

Previous turn: progress (schema 6 contributions, 191 tests/build, reproducible funding drill). Weekly remaining 32%; preserve the latest 30% floor.

- [x] Resolve the official verifier release separately from the dstack runtime and prereleases; pin its published image digest and record source evidence.
- [ ] Validate and, if the local Docker engine starts, run an isolated loopback verifier with negative controls and no secrets, wallet or host data; do not treat startup or a rejected quote as an attestation of Vault.
- [x] Produce a concrete confidential-VM proof proposal with current pricing, evidence requirements and remaining anti-replay/governance decisions. No hosting purchase or publication.
- [x] Refresh release evidence after local deployment configuration changes and record runtime limits truthfully.

Official verifier checkpoint: published verifier-v0.5.11 digest and source commit recorded; current prereleases were distinguished from the still-unselected runtime. Compose syntax passed. Docker Desktop was started hidden; docker info did not return and its query session 64385 was explicitly cancelled (exit 1). No image pull, container, quote or cloud resource was created. Runtime negative controls remain unchecked. Docker Desktop remains started. Proposal records current medium-CVM compute/disk estimate (USD 0.24556 for two hours at listed rates, not a billing cap) and the clone/governance acceptance criteria. Source-current preflight 2026-09-14T22:53:51Z: 191 tests/build, Privy configured, no model key, payments closed. Weekly remaining 31%, floor 30%. This turn made source/preparation and primary-research progress; the full launch goal remains active.
