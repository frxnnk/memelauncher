# Fairness surface and production checklist

17 September 2026. What is public, what is proven on the live Vercel paid beta, and what is still required before a real-funds production round.

## Public fairness (this change)

- `/fairness` is the public ledger. No sign-in.
- `GET /api/funding/fairness` lists credited deposits (tx hash, truncated wallets, amounts), every ledger attempt (state, price, 70/30 split), round pot, and boolean stamps: deposit, paid attempt, bounty, prize sent, TEE.
- `GET /api/receipts/public` lists every stored transcript (prompt, tool, decision). Playing publishes the argument. API keys stay redacted. Owner-scoped `/api/receipts` is unchanged.
- Copy is explicit: operator-recorded receipts, operator-controlled custody, not a TEE. A TEE in front of OpenRouter would attest the proxy, not Claude.

## Demonstrated on live `vault-closed-beta` (2026-09-17)

| Item | Evidence |
| --- | --- |
| Price 5→25, +1 per valid attempt, 70/30, 25% retain on win, 5-month expiry, one guardian | Code + live round `rh-paid-opus-v1` now priced at 6 after one valid miss |
| Robinhood testnet deposit 5 AMZN | tx `0x46d046c571ba6a2c8640ef9a1f432fe60c8f7482b01eeb99186ca90c1a3b2057` to treasury `0xbec4…396d` |
| Paid Opus attempt via x402-exact | Turso: 1 attempt, model `anthropic/claude-opus-5`, credits 0 |
| Bounty split on a miss | Pot 3.5 AMZN (70%), operations 1.5 (30%). `prizePayable` 0 because `locked` |
| USDG escrow fixture | `vault-lab/output/usdg-claim-drill.json` — 1 USDG, 75/25, unsigned, mainnet refused |
| TEE | Not built. Not claimed. |

Not demonstrated: a live `release_prize`, a treasury prize send, mainnet USDG, or independent attestation.

## What production still needs

Real-funds production means Robinhood **mainnet USDG** (or an approved settlement asset), not testnet AMZN. Do not treat the live beta as that.

1. **Win + executed prize.** A genuine `release_prize`, then treasury `0xbec4` signs the recorded payable on-chain. Pipeline exists; live payable is 0.
2. **Custody upgrade.** Today the copy is operator-controlled. Production should move prize funds into the escrow design (`round-escrow.mjs`) or an equivalent on-chain hold, not a hot treasury wallet the operator can empty.
3. **Mainnet money drill.** Repeat the 1 USDG fixture with a real unsigned-then-broadcast send on the approved chain. No $500 seed until that path is boring.
4. **x402 ops box.** Dedicated payer, never laptop/treasury/player. Floor sized for inference, not the prize. Keys only in Vercel env.
5. **Invite policy.** Closed beta vs public admission, jurisdictions, ToS, non-refundable credits, expiry unwind (pro rata to attempters, seed back to seed).
6. **Do not market TEE.** Keep “public prompt, public tools, public attempts, operator receipts.” If a lawyer or partner later requires attestation, that is a new project.
7. **Ops.** Domain, status page, Turso backups, Vercel log alerts, incident runbook for stuck x402 / unsigned deposits / prize send. `X-Robots-Tag: noindex` until you want SEO.
8. **Fairness page on production** must keep showing misses, not only wins. Hide unsigned deposits. Never publish secrets or invite codes.

## Honest stamps for players

| Stamp | Meaning |
| --- | --- |
| Proven · On-chain deposit | A credited Transfer into the published treasury |
| Proven · Paid attempt | Ledger settled locked/released after x402 |
| Proven · Bounty split | 70% of that price is in the round pot |
| Open · Prize sent | False until a payout tx is recorded |
| Open · TEE | Always false on this product |
