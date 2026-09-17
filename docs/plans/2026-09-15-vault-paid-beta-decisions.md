# Vault Paid Beta Decisions and Implementation Plan

> **For Codex:** Use the existing funded-release plan for implementation; this decision record supersedes its normal cash-out assumption only for a future, explicitly accepted purchase policy. Existing balances and production behavior must not change retroactively.

**Goal:** Close the provider and credit-purchase design, verify local accounting assumptions, and separate engineering work from founder decisions before real payments.

**Architecture:** Players purchase game credits on Robinhood; credits are consumed per valid attempt. Only earned operating allocations replenish a bounded USDC wallet that pays x402 requests. Bounty and continuity remain separate. No real-money admission until custody and result authority are qualified.

**Tech Stack:** Existing Node ESM, SQLite ledger and web/Privy stack. No new dependencies or production migration in this step.

## Decision as of 15 September

The founder is willing to sell non-refundable game credit to simplify operation. Adopt this as the proposed future purchase policy, not as permission to remove existing rights, retain payment for undelivered service or treat every deposit as free operating cash.

### Engineering decisions I can own

| Topic | Selected direction | Acceptance condition |
| --- | --- | --- |
| Network | Robinhood for purchase, bounty and claims; Base only for provider payment | Final contracts, wallet, gas and transfer path tested |
| Initial asset | USDG candidate, no Long dependency | Contract/emitter controls, liquidity and jurisdiction checked before funding |
| Provider integration | BlockRun x402 first implementation target | Paid exact-request probe, no fallback/truncation, tools/configuration preserved, recovery and authority validated |
| Alternative provider | NanoGPT only if primary fails qualification | Repeat payment, configuration and evidence tests; no silent substitution within a round |
| OpenRouter | Keep current practice integration | Not the automatic crypto-funding route for paid V1 |
| Model | Haiku 4.5 first evaluation candidate; Gemini Flash comparison | Passing cost, structured decision, adversarial and evidence checks; no model declared qualified now |
| Credit accounting | Keep available and reserved obligations until consumption even without normal cash-out | Accounting conservation; no allocation of the same money twice |
| Conversion | Batch realized operating funds with router/payee/amount/slippage restrictions | Arrival and ambiguous payments reconciled; no spending prizes or unconsumed balances |
| Failure policy | Failed technical attempts restore game credit; paid supplier losses use operating error reserve | Duplicate restoration rejected; ambiguous outcomes reconciled before retries |
| Round isolation | One funded guardian initially; winner closes round; subsequent config must requalify | A second release cannot pay the same prize |
| Brute force | Invitation gate, per-account and global admission limits, one eligible execution per round at a time | Wallet rotation cannot bypass round-wide budget/queue; limits published |
| Pricing in first pilot | Fixed published price per guardian, cost floor and spend ceiling | Bounds include full allowed context/output; user accepts final tariff |
| Increasing prices | Simulate a public round-wide staircase before enabling | Cap, interval, ordering, quote expiry and user maximum tested; account-only increases rejected |
| UX | Buy credits, select model in chat, quote before admission, progressive text after validation | Mobile purchase/error/receipt/claim journey tested |
| Launch scope | Closed web beta; one funded round, practice elsewhere | Telegram, Long and autonomous reseeding deferred |

Fixed pricing is the engineering default for the first small pilot: it lets us measure difficulty and margins with fewer moving parts. A staircase is an economic option, not a substitute for protection against known winning prompts. Account-level limits help manage abuse, but neither wallets nor invitation accounts prove unique humans. Global limits, ordering and prize isolation are required independently.

## Verified provider answer

OpenRouter still documents crypto purchases through its web checkout. Its old programmatic charge endpoint `POST /api/v1/credits/coinbase` has been removed and returns 410; the replacement documented there is the web purchase flow using Coinbase Business Checkouts. No supported automatic crypto top-up API was established in this review. Do not automate dashboard clicks or assume Coinbase's own APIs can create credit for our OpenRouter account.

OpenRouter also states that crypto purchases are not refundable. Account credit is a prepaid service balance; an API key is a credential, not a token wallet. Sources: [crypto API status](https://openrouter.ai/docs/cookbook/administration/crypto-api), [FAQ](https://openrouter.ai/docs/faq). Checked today, no account purchase made.

x402 is a payment protocol, not an account to top up. BlockRun's documented flow quotes a request, accepts a restricted payment authorization and settles payment; the client can keep unspent USDC liquid. Its signed quoted amount is charged, without a refund merely because fewer output tokens were generated. Sources: [flow](https://blockrun.ai/docs/x402/payment-flow), [chat](https://blockrun.ai/docs/api-reference/chat-completions). This does not mean every technical failure is reimbursed or that the upstream model is independently proven.

Prior unsigned quotes and the Robinhood-to-Base route were saved in [payment research](../treasure-guardian/PER-PROMPT-PAYMENTS-RESEARCH-2026-09-15.md) and [system map](../treasure-guardian/ROBINHOOD-SYSTEM-MAP-2026-09-15.md). No payment, paid x402 inference or inverse bridge was verified. BlockRun documents fallback and context truncation signals: a funded round must reject those results and establish how to prevent hidden extra samples, not merely hide the warnings.

## Proposed purchase policy

- Sell game credits, not a redeemable token or bank-like balance. No ordinary cash-out for a change of mind. This is a commercial proposal subject to applicable rights, not a claim that a checkbox overrides them.
- A purchase quote states the received credit amount and every purchase fee. Credit only confirmed received funds. To sell exactly 10 units of game credit, quote total payment including costs or explicitly subsidize them. Do not show 10 backed units after receiving 9.94 net.
- Price and split apply when a valid attempt consumes credit. Until then, keep the entire unconsumed credit liability allocated to delivering future games or exceptional restitution. Non-refundable does not mean unencumbered revenue.
- Loss to the guard is a delivered attempt and consumes credit. Technical failure restores credit; it does not increase bounty or give the operator revenue. A paid upstream failure is an operating cost.
- If the operator closes the beta or cannot provide the purchased service, return unused credit value under a published process. No forced purchase of another model or indefinite wait for another round. Keep enough liquid backing for this contingency.
- For the initial one-round pilot, stop purchases as soon as the round closes and return unused credit through that exceptional closure process. A multi-round carryover policy can be offered later with explicit terms. Do not sell large packs when the end of the round makes them unusable.
- The separate refund when a round expires without a winner remains a distribution of the eligible bounty to the people who paid valid attempts. Removing normal cash-out does not remove this agreed product feature. Founder must select percentage, duration and seed/sponsor treatment.
- Do not apply any of these changed conditions to existing testnet balances or historical accepted terms. Future credits need a policy version and accepted terms hash.

Draft English copy, not published: “Game credits are for paid attempts and cannot normally be withdrawn. Technical failures restore your credits. If this beta round closes with unused credits, you can claim their remaining value under the published closure rules. Network fees and expired-round bounty refunds are shown separately.”

## Concrete founder choices

These are product/budget choices. The founder does not need to choose SDKs, bridge calldata, database design, signing formats or test cases.

| Choice needed | My proposed default | Why the founder must decide |
| --- | --- | --- |
| Purchase policy and pack | 10 USDG game-credit pack; no ordinary cash-out; exceptional return at closure/non-delivery | Changes the product promise; all-in displayed cost and purchase minimum need acceptance |
| Seed and total exposure | 250 USDG initial seed, within the stated USD 500 limit; bounded maximum bounty proposed at USD 500 equivalent | Seed cap is not a cap on prize growth from players; decide acceptable total prize exposure |
| Separate operating budget | USD 50 liquidity/error pilot envelope as a proposal, NOT an authorization; measure allocation before funding | Founder supplies working capital; this excludes infrastructure, legal and independent review fees |
| Tariff and allocation | Start evaluation at 0.50 USDG/attempt, 70% bounty / 20% operation / 10% continuity | Numbers remain hypotheses until cost stress checks; final price is a business choice |
| Round duration / expiry payout | 30-day pilot proposed; 75% of player-funded bounty returned pro rata on no win | Earlier six-month idea is an alternative; percentages change expected player economics |
| Seed/sponsor remainder | Founder seed returned to its source if no win; sponsor destination agreed on receipt | Do not silently distribute sponsor funds or take money allocated to player refund |
| Legal operator and audience | Closed list of adults, 20–50 invitations proposed; permitted jurisdictions established with review | Entity/country, terms and audience cannot be invented by engineering |

Price and budget proposals are for a stable-asset pilot, not predictions or a transfer authorization. 75% of a 70% eligible bounty allocation means 52.5% of eligible spending. The remaining 25% of player-funded bounty must have a published destination; proposed continuity reserve, not discretionary founder withdrawal. Any claimed USD cap must be implemented in asset units with a stated valuation rule; do not assume permanent USD parity.

## Work that proceeds without those answers

1. Reuse the current simulation ledger to check a 10-unit purchase, partial use, service errors and an immediate winner with unused credit. Run `node audit/paid-beta-purchase-drill.mjs`; every invariant must pass. This does not implement the changed purchase terms.
2. Re-run the existing economy tests. Report local accounting evidence separately from chain settlement, custody and model proof.
3. Keep mainnet admission disabled. Finish the actual signed x402 and bridge test only with a funded restricted test wallet and concrete spend authority; never extract the user's wallet key or put funds in a provider merely to remove cash-out.
4. Prepare the custody/evidence work described in the funded-release plan: round escrow, executable claims/timeouts, immutable authority/configuration and adversarial execution tests. A successful API response cannot substitute for these gates.
5. After accepted policy, adapt future purchase UI and versioned terms, exceptional-return claims and backing reports together. Do not merely remove a Withdraw button while leaving contract or ledger permissions inconsistent.

## Launch gates

| Gate | Current evidence / remaining work |
| --- | --- |
| Commercial specification | Defaults above ready for founder decision; none applied to production |
| Financing provider | x402 selected for implementation; primary docs and unsigned quotes; signed payment/recovery pending |
| Robinhood route | Unsigned quotes exist; definitive escrow/router integration and transfer pending |
| Purchase accounting | Existing local ledger supports conservation, reservation, error restoration and win isolation; drill added below |
| Custody | On-chain escrow and independent review pending |
| Fair execution | Unique eligible sample, attestation scope and immutable authority pending; blocks the requested trust claim |
| Launch operations | Cost reserves, monitored reconciliation, incident drill, terms/eligibility and funding pending |

No live changes, signatures, vendor purchases or fund movements are part of this decision update. The remaining technical work is owned by engineering; unresolved proof or external review is reported as a blocker rather than delegated to the founder as a model-selection question.

## Local validation completed

Executed `node audit/paid-beta-purchase-drill.mjs`: five scenarios passed conservation, no double prize and error-restoration assertions. A full 10-unit pack consumed at 0.50 produced 7 bounty / 2 operation / 1 continuity. A win on the first attempt with a 250-unit seed paid 250.35 and left 9.50 unused, which the closure simulation returned without taking the operational or continuity allocations.

The drill correctly exposes two deficits: all provider-billed technical errors produce no earned operating income; a hypothetical 0.20 cost per call exceeds the 0.10 operating allocation. These cases require an error reserve or a different admitted price/model. They are not evidence of actual provider prices. [Report](../../vault-lab/output/payment-research/paid-beta-purchase-drill-20260915.json).

Executed `node --test test/economy.test.mjs`: 15/15 passed. This verifies the existing local ledger, not deployed escrow, cross-chain payments, changed refund policy or AI fairness. No production source behavior was changed.

The public-admission preparation also passes the new public beta access test and the complete `node scripts/verify-release.mjs` check: 252 tests and build passed. The runtime flag remains off unless explicitly configured; no funds or production access changed.
