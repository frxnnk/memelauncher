# Self-funding inference circuit

16 September 2026. Closes the loop: credited play → x402 inference → bounty split. Not a mainnet launch, escrow, or fairness proof.

**Player:** deposits and spends credits on Robinhood (testnet rehearsal unchanged).
**Inference:** funded attempts quote BlockRun, pay exact USDC on Base from a server operating box, never an OpenRouter key.
**Split:** existing 70/20/10 ledger. Gameplay still moves ledger allocations, not the treasury wallet, until payouts exist.
**Practice:** OpenRouter remains optional for unpaid chat.

The operating box is seeded once and paused below `VAULT_X402_FLOOR_USDC`. A payment authorization is signed at most once per attempt; timeouts after signing stay reserved (`PAYMENT_UNCERTAIN`). Empty box refunds credits without signing.

Live x402 still needs a Base USDC key in `.env`. Without it, credit rounds keep the previous OpenRouter path so the published beta does not go dark.

## Live verification, 16 September 2026

Operating box `0xf2824a8042e3597AFe5a9D420Bd69445E80E0c8f` on Base, funded by the operator with ~8.63 USDC and ~0.001 ETH.

- `audit/x402-live-smoke.mjs`: one real BlockRun call to `anthropic/claude-haiku-4.5` settled a 0.002000 USDC exact payment, finish reason `tool_calls`, guardian tool used. No OpenRouter key involved.
- `audit/x402-live-circuit.mjs`: credited deposit → attempt → real 0.002285 USDC payment → decision `locked`, split `70/20/10`, player balance 1000 → 900, round bounty 70. One payment per attempt.
- Local practice chat after arming the box: reply from `google/gemini-2.5-flash` with receipt `mode: practice`, no `payment` field, and the USDC balance unchanged. Practice does not spend the box.
- `/api/status` reports `paidConfigured: true` with `bountyEnabled: false` while no funded route is mounted, so an armed box is never advertised as a live bounty.
- Repeatability: the credited circuit ran twice with identical accounting. On-chain USDC went 8.632901 → 8.626331, exactly the three quotes charged (0.002000 + 0.002285 + 0.002285). No duplicate or unaccounted authorization.

At ~0.0023 USDC per Haiku attempt, the 8.6 USDC box covers roughly 3,300 funded attempts before it reaches the 1 USDC floor, where the game pauses instead of playing unpaid.

Not verified yet: Robinhood testnet deposits from a real wallet (needs Phantom in the operator's browser), payouts, escrow, mainnet rounds.
