# Closed beta operation

The actual deployed beta is documented in [Live beta inventory and recovery](LIVE-BETA.md). **Live product is Vercel:** static web on `vault-closed-beta`, with `/api` still rewritten to the historical Caddy host until the operator copies `deploy/vercel.api-cutover.json` over `vercel.json` and approves a deploy. Paid-beta x402 is Vercel project env; durable store is a new Turso database. Do not deploy a new VPS and do not SSH `C:\vault-beta` from a paid-beta session.

Linux service/proxy files remain unused templates. The closed beta adds `.local/beta.sqlite` (or Turso after cutover) to persistent state. It requires Privy and a provider key whose total, non-resetting budget includes BYOK. Telegram is deliberately rejected when closed beta is enabled, so it cannot provide an ungated alternative to invitation admission.

## Activate

1. Run `npm ci --ignore-scripts`, `npm run verify:release` and `npm run preflight` from the extracted release.
2. Copy the public Privy settings and dedicated inference key into a private `.env`. Use `beta.env.example` for the beta flags. Add the exact HTTPS origin to both Privy app and client allowed origins. Do not deploy a management key.
3. Verify the provider budget, test the permissive opening/closing controls, start through the supplied service/proxy and verify real sign-in with the owner first. Invites alone do not bypass authentication.
4. Issue the owner's invitation, redeem it in Account and check the restricted model list, usage and a real reply. Verify a separate uninvited account is denied before opening invitations to testers.
5. Issue and share invitations yourself. Begin with five testers. Confirm the beta data notice and the person who will receive feedback before distributing codes.

The source package alone does not establish deployment. Actual origin, release identifiers and live evidence are recorded separately in `LIVE-BETA.md`. Public origin verification is exact; a proxy must preserve the canonical expected host.

## Invitations

From the application directory:

```sh
node scripts/beta.mjs issue --label "Founder" --days 7
node scripts/beta.mjs list
node scripts/beta.mjs revoke --id INVITATION_ID
node scripts/beta.mjs pause
node scripts/beta.mjs resume
```

Issue saves the code to a new private JSON file under `.local` and prints its path. It does not send it. Do not expose `.local` over HTTP or put a code in a public URL. A code binds to one verified account. Its expiry ends access, including for an already admitted member. Use a new invitation to extend expired/revoked access. Labels should be aliases rather than emails. Listing never returns codes or their hashes. An explicit `--db` path supports controlled restore testing; on the host, always use the actual deployed `.local/beta.sqlite`.

Pause is persistent and blocks new model calls immediately; an in-flight call can still finish. Admitted users retain receipt reads. Revocation and expiry deny subsequent protected requests, including private reads; they cannot remove copies already downloaded by the player.

## Operations

- Check `/api/health`, provider spend and service logs. `beta-paused`, `reconciliation-required`, `daily-limit` and `budget-exhausted` are distinct states. No one should interpret a provider error as a defended attempt.
- The provider's existing USD 5 cap is cumulative and includes previous tests. Adding USD 10 to the account does not increase that key cap. The SQLite counter is post-response accounting, not an independent exact-price reservation.
- If cost is unknown, stop and reconcile using an existing receipt through `scripts/reconcile-usage.mjs`. Never erase usage, fabricate a zero cost, rerun an uncertain request or raise the provider limit automatically. A provider 429 without cost may require operator review before play resumes.
- For feedback ask for receipt ID, model, time and expected/observed behavior. Full prompts are optional for the tester to share, although server logs already contain them. Treat player content as untrusted input.
- For backup: pause, stop the service, copy the complete `.local` directory, verify hashes and database integrity, then restart. Keep the copy private. Restore membership, revocation and pause state together with sessions, receipts and usage. Restoring an older provider budget snapshot never restores credit on OpenRouter.
- The automated restore drill uses artificial accounts and responses. Run `npm run drill:restore`; it does not operate the live server or back up actual data.
- The data notice accurately states that automatic deletion is not implemented. The beta host handles removal requests and chooses the final retention schedule before inviting testers. Never claim signing out deletes server records.

Before calling the beta open: retain evidence of actual HTTPS availability, owner login/redemption, uninvited denial, one real reply with receipt, restart, provider budget and rollback. Unit tests alone do not satisfy those checks.
