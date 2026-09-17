# Vault functional pilot implementation plan

> Execution guide: apply the executing-plans workflow in this task, with tests and review after each bounded component. The user authorized autonomous local preparation; no further design approval or new worktree is needed for this untracked local prototype.

**Goal:** prepare the largest coherent, tested local increment possible while retaining at least 45% of weekly Codex usage.

**Architecture:** preserve native Node services and the current English single-screen chat. Add a transactional SQLite accounting sandbox with explicit simulated units, independently testable wallet/deposit preparation, and a transparent treasury panel. Actual inference remains behind the existing API-key gate; real money remains disabled until exact assets, authority and deployment are decided.

**Tech Stack:** existing Node22.16 and browser modules; native `node:sqlite` (verified locally, experimental in this runtime). No new package dependencies. Wallet discovery uses EIP-6963/EIP-1193 browser interfaces; no account connection during agent work.

## Boundaries and checkpoints

- Weekly bucket began at 45% used /55% remaining. Read current usage after each component and before starting another large change; stop substantive work near55% used, leaving room to verify and write handoff. Do not use reserve buckets or reset credits to extend work.
- No real deposits, signatures, inference charges, token launch, publication or sponsor messages. No fake LLM responses. Simulation events are explicit and separate from genuine model receipts.
- Keep existing custodian art/palette/English chat/no document scroll. Changes to the main shell must pass viewport regression checks.
- Existing files are untracked in the parent repository; do not stage unrelated files or publish/commit the entire parent tree.

## 1. Durable accounting domain

Create `vault-lab/server/economy/{schema,ledger}.mjs` and `vault-lab/test/economy.test.mjs`.

Use integer test-token units, transactional idempotent operations, player available/reserved credits, active prize, operation reserve, next-round reserve and winner payable. Events: credit topup, seed/sponsor/creator contribution, reserve, settle locked/released, technical error release, payout, cancellation/refund. Contributions from creator fees count only when explicitly received, not estimated. Do not expose unrestricted live mutation endpoints.

Verify conservation of units after every operation, duplicate replay vs conflicting key reuse, insufficient credit, concurrent reservations/winner closure, round immutability, server restart, payout idempotency and error returns. Mark unknown outcomes for reconciliation; never reinterpret them as losses. Native SQLite writes are a local ledger, not chain proof.

## 2. Treasury sandbox service and panel

Create thin `server/economy/service.mjs` and route handler; add GET state/export and an explicit POST sandbox action. Add `public/treasury.{js,css}` and an English modal opened from the existing UI. Persist simulation receipts and show provenance: simulated units, no real deposits and no chain transaction. Render available/reserved/prize/next round/operations/payable separately and inspect every event. Controls allow review of topup, failed prompt, technical error, winner and payout without inventing a model response.

Test HTTP same-origin protection, malformed actions, genuine persistence, idempotency and JSON export. Check desktop/mobile layout and keyboard focus.

## 3. Wallet and chain deposit preparation

Create a dependency-free wallet connector for discovery and explicit user-selected account connection. Never automatically request accounts, switch networks, sign or transfer. Handle rejection, missing wallet, chain/account changes and disconnect. Display mainnet/testnet distinction and that no payment token or contract is configured.

Create/test a pure deposit receipt validator for a configured EVM ERC-20 asset: exact chain/address/destination, successful receipt, Transfer event shape, log index, value, block identity, confirmation policy, canonical-block check and idempotency key. This prepares an indexer boundary, not a running funded indexer. A wallet connection is not authenticated ownership or a deposit.

## 4. Model readiness

Review the research findings for provider pinning, reasoning defaults and multi-turn preservation. Add explicit optional evaluated model profiles only if coherent within usage margin, with published effective config and matching receipt/tests; otherwise document exact changes remaining. Do not silently change model or provider after a paid round starts. Keep the baseline eval runner usable and reconcile its docs with actual matrix.

## 5. Verification and handoff

Run relevant Node tests, browser regression checks after UI changes, syntax checks, and a real local HTTP readiness read. Save screenshots and a current handoff with implemented vs simulated vs not configured, run commands, model findings, tokenomics hypotheses, access decisions, exact weekly usage and remaining work. Complete the goal only when the bounded deliverable is actually finished, not merely because the usage threshold approaches.

## Completed preparation

Steps 1–5 implemented and verified locally. Added model-to-TEST accounting with durable job replay, explicit requested model profiles, an offline ledger verifier, a separate economic scenario calculator, source manifest/readiness capture and sponsor/launch decision drafts. Final Node suite: 81 passing tests. Browser treasury, credit chat/recovery, viewport and economics checks passed without real inference, wallet access or funds. [Handoff](../treasure-guardian/HANDOFF-2026-09-14.md) records exact scope and remaining external dependencies. Weekly quota last reported 47% used /53% remaining; no need to consume the entire allowed margin to finish this bounded preparation.
