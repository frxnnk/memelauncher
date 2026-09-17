# Vault closed beta Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare an invite-only web beta with verified admission, bounded inference, testable gameplay, useful failure reports and an exact deployable release.

**Architecture:** Reuse the existing Node HTTP service, Privy identity verification, SQLite persistence and OpenRouter routes. Add a small admission service with hashed single-use invitations bound to the verified account. Keep public mode closed until the provider budget, actual identity flow and HTTPS destination are verified.

**Tech Stack:** Node >=22.16, native SQLite, existing vanilla client and Privy SDKs; no new dependencies.

## Scope and decisions

- Default: web first, three candidates (Gemini Flash, Haiku, Qwen 9B), 25 requests per person/day and 250 globally, existing USD 5 provider cap. Usage already consumed remains part of that cap.
- Single-use invitations are preferable here to a shared password (cannot revoke one person cleanly) or email allowlists (requires collecting and maintaining addresses). Codes are random, stored only as hashes, expire, bind once and can be revoked through a local CLI. No messages/invitations will be sent by the agent.
- Closed beta guards inference, private history and consumption before model calls. Anonymous landing/rules remain readable. Public beta has no wallet requirement or payment flow. Telegram remains disabled in this release to avoid a second ungated admission surface.
- Existing explicit user direction authorizes implementation. Work remains in the existing `codex/vault-launch-preparation` checkout: parent repository has no initial commit, so creating a worktree would require staging unrelated untracked work. No parent staging or publication.
- Host/domain is being clarified asynchronously. Prepare package/configuration before asking for any concrete external publication or new administrative credential. Do not create broad OpenRouter administration access without action-time confirmation.

## Tasks

1. **Admission service and integration.** Add `vault-lab/server/beta-access.mjs`, meaningful expiry/replay/revocation tests and public HTTP admission tests. Wire runtime, HTTP/account/usage/attempt/history and a three-model allowlist. Verify denial occurs before reservation or inference. Support a pause switch through the local CLI, preserve receipt reads for admitted users.
2. **Invitation CLI and user flow.** Add an offline CLI for issuing/listing/revoking invitations and pausing/resuming. Print newly created codes only on explicit issue; do not list hashes or codes later. Add the invite form to the existing account dialog, membership/limit states, English beta copy and a clear route to sign in. Preserve drafts and handle logout/late requests correctly.
3. **Operations and feedback.** Provide a local exportable issue report from a result (receipt ID, model, error, no access token), visible usage allowance, a concise data notice and launch checklist. Existing transcript/receipt downloads suffice for raw feedback; avoid another messaging service.
4. **Provider and identity activation.** Complete the budget flag through supported provider controls if available; otherwise prepare the exact narrow change for confirmation. Do not weaken the existing validator. Run permissive opening/closing controls before an adversarial comparison once enabled. Verify Privy in a real session when available; never invent a successful login.
5. **Verification and release.** Run focused admission tests, the full release suite, HTTP checks and permitted visual QA. Regenerate the source-verified deployment package, demonstrate restart/restore, update current readiness and supply exact remaining host/access steps. Keep test fixtures separate from actual user state.

## Progress

- [x] Admission, expiration, revoke, pause, restricted models and HTTP tests.
- [x] Client invitation and usage flow, CLI, beta copy/data notice.
- [ ] Provider controls and meaningful model tests; actual Privy session.
- [x] Full checks, package/restore and deployment handoff.

15 September verification: 212 tests, build, stopped-writer restore of five fixture databases, current local HTTP smoke and extracted archive hashes passed. New model calls: zero. Provider flag change is implemented and tested with controlled transport, but not applied; administrative access requires action-time confirmation. Actual Privy login, browser visual QA and HTTPS deployment are still open. See `docs/treasure-guardian/CLOSED-BETA-STATUS.md`.

Validation is specific: no unauthorized inference, no invitation replay by another account, no expired/revoked access, no extra-model calls, no client-forged identity, and persistence across restart. Unit tests and browser fixtures do not count as real login or independent execution proof.
