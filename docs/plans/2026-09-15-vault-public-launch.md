# Vault Public Launch Implementation Plan

**Goal:** Prepare a public Robinhood persuasion game, starting at a USD 5 equivalent per attempt, distributed through a meme-token launch and recurring social content.

**Architecture:** Public paid admission replaces invitations for the intended launch. Each wallet pays a published, capped increasing price; one valid result consumes credit and grows a round-isolated bounty. Confirmed token creator fees add funding through a separate auditable path. x402 is the first provider integration target, not yet qualified for real prizes.

**Tech Stack:** Existing Node ESM, SQLite, Privy and web client; no new dependencies for preparation. On-chain escrow, verifiable result authority and final swap/bridge integration remain required implementation work.

## Superseding decisions

The public launch is NOT limited to 20–50 invitees. Authentication, eligibility, payment and rate limits remain; invitation membership does not. Internal technical rehearsals may stay closed without making invitations part of the launched product. Do not switch off a production invite flag and accidentally open free API usage or unqualified real-money funding.

The user proposes a flat starting price of USD 5 across eligible models, then increasing prices for repeat attempts by the same wallet. This replaces the earlier 0.50 proposal. Qualify a finite catalog: USD 5 does not authorize arbitrary models, unbounded context, reasoning, tools or retries. The current 70/20/10 example leaves 1 unit for operation at a 5-unit price; model execution, conversion, system gas and incident allowance must fit inside that allocation.

Initial implementation candidate: 5, 6, 7 … 20 units per wallet per round. The +1 step and 20 cap are proposed defaults, not approved prices or historical Freysa parameters. Counter comes from settled valid attempts linked to the payout wallet, never browser state or merely a new account. Technical errors do not advance it. Freeze terms per round; reserve the price atomically with wallet/round sequence; stale quotes require reauthorization if above the user's ceiling.

Wallet rotation resets wallet-based pricing. This is a known limitation, not solved by Privy, wallet signatures or rate limits by IP. Keep global queue/throughput and operating exposure limits, one eligible execution per round at a time, cost checks before accepting money, and round closure after a valid win. A public round-wide increase could replace the wallet increase later if desired; do not silently combine both.

The earlier 500-unit maximum bounty was an assistant proposal for a small pilot, not user approval. Public launch needs an explicit total prize exposure policy distinct from the user's up-to-USD-500 seed budget. When capped, stop admitting contributions beyond the cap; do not continue displaying growth while diverting it elsewhere.

## Freysa reference, precisely

The [Act I FAQ](https://www.freysa.ai/act-i/faq) describes public paid messages, a public system prompt, a global increase of 0.78% per new message and 70% of message fees contributing to the prize. Its price increase is global, not per wallet. The published [agent repository](https://github.com/0xfreysa/agent) remains a reference for the game and tools; it is not proof that our eventual custody or execution is fair. Different acts have different terms; do not combine parameters from Act I, II and III.

Use the readable game loop: pay, persuade, visible rejection or win, visibly growing prize, public rules and a shareable result. Keep personality and humor, but never fabricate wins, difficulty, investment returns, model learning or receipt amounts.

## Bounded preparation in this change

1. **Shared accounting:** add `splitAttemptPrice` to `vault-lab/server/economy/schema.mjs` and use it from `operations.mjs` without changing existing allocation/rounding behavior.
2. **Pricing foundation:** create `vault-lab/server/economy/public-pricing.mjs` with integer capped wallet pricing and an operating-coverage check. No live activation or mainnet admission. Inputs must be trusted server state and conservative costs denominated in the round asset; USDG and USDC are not assumed identical.
3. **Tests:** add `vault-lab/test/public-pricing.test.mjs`; cover base/step/cap, invalid counters, costs over allocation, exact coverage, integer rounding and token amounts larger than Number precision. Run these plus `economy.test.mjs`; then release verification after the shared accounting edit.
4. **Release specification:** record public access, paid/free separation, x402 verification, escrow, pricing reservation, public receipts, fee provenance and launch operations below. Do not label the quote helper an implemented dynamic billing system.
5. **Content base:** create `docs/treasure-guardian/PUBLIC-CONTENT-LOOP.md` with English copy, share-card requirements and recurring event templates. Draft only; do not publish posts or create automations.

Git root currently has no commits and many unrelated untracked projects. Work in the current codex branch, avoid broad staging and avoid creating an unrelated baseline commit.

## Public release work still required

Preparation completed in this workspace: `VAULT_PUBLIC_ADMISSION=true` now makes the persistent beta admission public while retaining authentication, pause, model and usage gates. The default remains invitation-gated, and this flag does not enable real funds. A reusable integer pricing helper and operating-coverage check are in place; the helper is not wired into live reservations until the round manifest and payment contract support it atomically. Full local verification currently reports 252 passing tests and a passing build; this is not chain, provider or fairness evidence.

The launch config template is `vault-lab/config/public-launch.example.json`. Run `npm run audit:public-readiness` from `vault-lab` after filling a private copy. It intentionally reports `ready: false` until the asset, round, provider endpoint, terms, escrow/verifier, independent review and operating owner are explicit. It never enables funds or submits transactions.

`npm run drill:public-traffic` runs a deterministic 1,000-wallet / 10-attempt scenario against the proposed 5→20 pricing and a 500-unit exposure cap. It accepted 527 attempts before the cap and rejected 9,473; no network or wallet was touched. This is a capacity/accounting scenario, not a sybil-resistance or provider-load test.

| Work | Concrete done condition |
| --- | --- |
| Public admission | Paid routes require identity/wallet and funds, not invitation. Free practice has independent budget and limits; opening paid play cannot unlock unlimited free inference. |
| Real purchases | Confirm actual token receipt once, show net credit and purchase fees, preserve terms version and exceptional closure refunds. |
| Dynamic billing | Trusted wallet counter per round, immutable pricing policy, authoritative quote, atomic reserve, no duplicate charge/counter advance under races, errors restore credits. |
| Provider | One real x402 payment, exact model/request, maximum cost, no fallback/truncation or hidden retry, recovery and receipt reconciliation. |
| Custody and authority | Escrow with prize/credit/continuity isolation; fixed beneficiary; executable claims/timeouts; evidence sufficient to prevent discretionary winner selection. |
| Public traffic | Persistent queue, global budget and concurrency, deposit backpressure, no unpaid inference, downtime pause with accessible receipts/claims. Load test queue and storage before publicity. |
| Token fees | Verify chosen platform, chain, token/pool, fee entitlement, recipient, asset, claim/conversion method and actual received transfers. No projected volume in solvency. |
| Viral surface | Mobile chat, visible live bounty, recent verified attempts, shareable receipts, English social assets and links back to play. Sharing does not unlock a withdrawal or require spam. |
| Operations | Public rules, eligible audience, incident handling, reconciliation, monitoring, backups, independent review and an explicit exposure cap before funds. |

## Token and fees

The launchpad/token is a distribution and funding channel, not automatically the game's settlement asset. For the fastest path, existing USDG can price attempts while a verified token launch funds the bounty through its realized creator fees. Paying directly with the new token requires its actual contract and executable bounded conversion route; that is additional work, not a renamed currency label.

Long was rechecked at [app.long.xyz](https://app.long.xyz/), but its publicly retrieved page did not establish this project's Robinhood deployment, exact creator share or fee recipient. No specific launch, stock pairing or yield is verified here. Do not advertise “all trading fees” if only the creator's share is ours, or claim guaranteed income from trading.

Proposed rule: 100% of the creator-fee share designated to this game, net of disclosed unavoidable collection/conversion costs, goes to a dedicated Robinhood funding address. Only confirmed received amounts increase the displayed bounty. Record source chain/token/pool/transaction and any conversion before crediting. Fees arriving while a round is closed stay visibly unassigned until the next published round; they do not reopen a beaten model. This percentage is a founder decision and cannot be inferred from a launchpad label.

## What the founder still supplies

1. **Launch identity:** name, ticker and social accounts; selected launchpad/stock pairing if required. No need to choose a software framework or API protocol.
2. **Price defaults:** confirm or change +1 per settled wallet attempt and cap 20, starting at 5. Asset pricing vs exact USD valuation must be displayed honestly.
3. **Funding:** exact seed within the previously stated USD 500 ceiling, separate operating/review budget and maximum total bounty exposure. This plan does not authorize transfers.
4. **Creator-fee allocation:** confirm proposed net 100% of our designated creator share, exact wallet recipient and launch configuration after inspecting the platform.
5. **End-of-round terms and operator:** choose duration/expiry allocation, legal operator/country and eligible audience. Public access replaces invitation membership; it does not invent permitted jurisdictions.

No invitation decision is pending. Engineering owns provider, chain integration, accounting, model qualification, public traffic handling and verification. No launch date is promised before the payment, escrow and evidence tests resolve their current gaps.
