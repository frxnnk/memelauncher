# One-time provider budget activation

**Completed 2026-09-15 UTC.** The inference key named **Vault MVP** retains its approved cumulative USD 5 cap, no reset, and now has `include_byok_in_limit=true`. The target was read, patched only for that flag, read again, and verified through the inference key's own endpoint. The temporary management key was then disabled in the dashboard; no management secret was retained or deployed. Evidence: `output/provider-activation.json` and `output/beta-provider-budget.json`. Do not repeat activation, reenable the management key, weaken the guard or increase the cap. Account credit is a separate balance.

The following procedure records the approved operation for review and recovery; it is not outstanding work.

`node scripts/prepare-provider-budget.mjs` prints the exact prepared operation without credentials or network access. It targets only the verified public key hash and sends `{"include_byok_in_limit":true}`. The implementation reads the key first, refuses a different name, limit, reset or disabled state, then reads it again and checks the unchanged cap. It never retries a write automatically.

The [official key update endpoint](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys) requires an administrative [management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys). Such a credential has broad administrative powers; the script limits its own action, not the credential's provider permissions.

After explicit approval: create a temporary management key in the authenticated dashboard, pass it only through the one-shot process environment as `OPENROUTER_MANAGEMENT_KEY`, and run `node scripts/prepare-provider-budget.mjs --apply`. Never place it in the app `.env`, package, browser client or shell history. Check the inference key's own `/api/v1/key` endpoint afterward. Revoke the temporary management key in the dashboard and verify revocation before resuming other work. If any write response is uncertain, inspect the existing target first.

Compatibility controls and the bounded baseline evaluation have now run; see `eval/README.md` and `output/beta-evaluation.json`. Future evaluations must stop competing consumers and map the already approved app key to `OPENROUTER_EVAL_API_KEY` in the evaluation process only. All runs share the original USD 5 cumulative cap.
