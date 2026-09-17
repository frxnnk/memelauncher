# Decision-changing research — 2026-09-10

**Later evidence update:** the user found [flybrain.online](https://flybrain.online/). Its FLYBRAIN deployment through Pons V2 is independently confirmed in the public explorer. See `competitor-flybrain/REVIEW.md`. This strengthens Pons as an integration candidate and supersedes any blanket implication below that public deployment is unavailable. Account-specific permissions and quote compatibility remain unresolved. Bankr is still a candidate, not a final selection.

Initial pass was bounded; code construction followed it. These are observed sources and limitations, not approved launch terms. The name BELLFLY, ticker, domain and economics remain provisional. No volume/FDV/market-cap claims are used.

## Provisional route

Keep **Robinhood Chain + Bankr** as the first integration to validate. The network is reachable; it is not a mainnet-availability blocker. Bankr's documented simulation is promising, but no eligible authenticated simulation was performed and durable remote idempotency is unestablished. Retain **Pons v2** as a separately versioned alternative, subject to launcher eligibility and verified economics. Solana remains an unselected fallback requiring its own provider/quote research; no silent chain or asset substitution.

## Evidence table

| Item | Observed | Status / architectural implication |
|---|---|---|
| Robinhood network | Official configuration gives mainnet 4663/testnet 46630, ETH gas, mainnet RPC `https://rpc.mainnet.chain.robinhood.com`, testnet RPC `https://rpc.testnet.chain.robinhood.com`, explorers `https://robinhoodchain.blockscout.com` / `https://explorer.testnet.chain.robinhood.com`. Local read-only RPC returned `0x1237`, a current block and nonempty NVDA bytecode. | VERIFIED network read. No deployment or testnet transaction attempted; deployment eligibility still provider-specific. [Connection documentation](https://docs.robinhood.com/chain/connecting/) and `rpc-verification.json`. |
| NVDA identity | Official `/rhj/assets` returned active NVIDIA Robinhood Token at `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` on 4663. `eth_call decimals()` returned 18. | VERIFIED registry identity and code presence, not a signer/provider/pool audit or executable liquidity proof. `rhj-assets-response.json`, `rpc-verification.json`. [API schema](https://docs.robinhood.com/chain/stock-token-apis/). |
| Stock-token nature/access | RHJ issues tokenised debt securities providing economic exposure, without ownership rights in underlying shares. Direct issuance is restricted to onboarded Authorised Participants. Existing tokens can trade onchain. U.S. persons and additional jurisdictions are restricted. | Pairing does not issue NVIDIA equity. Operator-specific eligibility, acquisition/redemption access and restrictions remain PENDING. [Issuer documentation](https://docs.robinhood.com/chain/stock-tokens/). |

## Bankr — first candidate, not integrated

[Current deploy documentation](https://docs.bankr.bot/token-launching/api-reference/deploy-token-launch/) describes `POST /token-launches/deploy` and `simulateOnly:true`: no broadcast or quota consumption, omitted transaction hash. Retail simulations still require a wallet aged 24h; live retail launch additionally requires 0.002 ETH and pays gas on Robinhood. User API keys deploy from their owning wallet; partner-key deployment is Base-only. Current documentation lists Robinhood, Base and Arbitrum, with three counted attempts per rolling 24h. No idempotency header or safe retry guarantee was verified. The signer is a provider-managed wallet, not the Python process; underlying signing permissions/custody require review. A timeout after submission is an ambiguous attempt, never authorization to resubmit.

[Economics overview](https://docs.bankr.bot/token-launching/overview/) documents standard supply 100B, default 15% creator vesting, and `disableVesting:true` to remove it. This is necessary for the user's no-insider-allocation proposal. The published current swap split totals 1.75% with distinct pool, hook, protocol and buyback components; creator's direct share is distinct from liquidity compounding. Anti-snipe and early holding limits add separate behavior. These are provider descriptions, **not frozen BELLFLY terms**. No quote, actual beneficiary, launch budget or current deployed hook configuration was verified. `pairedStockAddress` is referenced, but NVDA acceptance and entry/exit depth remain untested. The local preview therefore deliberately keeps quote compatibility UNVERIFIED.

Search-cached Bankr excerpts initially claimed different quotas/gas/defaults. Opening current pages corrected those; CLI/web defaults also differ from API/chat defaults. Never infer live terms from a cached excerpt, social reply or omitted chain field.

## Pons — separate versions and identity

The relevant project is [ponsfamily documentation](https://docs.ponsfamily.com/), not `pons.finance` or a similarly named L3. V1 describes fixed-supply WETH-only Uniswap V3 launches, distinct active/legacy factories, 1% pool fee and 0.0005 ETH creation fee. It is not the same mechanism as V2. A direct documentation open was region-blocked (`country=GB` on the tool's route); indexed material was visible. We did not change location or bypass access controls.

[V2 documentation](https://docs.ponsfamily.com/v2) describes a curve then Uniswap V4 graduation, approved quote assets, wallet-signed contract calls, `canLaunch`, `previewLaunchEconomics` and deterministic CREATE2 addresses using a salt and caller. No REST launch endpoint is assumed. Documentation lists factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`, but the deployed ABI/code/configuration was not independently verified. Current indexed text says public launching is closed to non-whitelisted addresses and audit engagements have not closed. No authenticated/account-specific eligibility check, quote approval, fee read, unsigned call simulation or receipt check was performed. WETH-only V1 cannot satisfy NVDA pairing; V2 needs a separate verified integration.

## Entry and exit path: unresolved execution evidence

Proposed path: eligible operator obtains native ETH for gas and the exact supported quote asset; launch uses the approved provider flow without an initial own buy; subsequent users would trade through the resulting curve/pool. NVDA ownership cannot be inferred from ticker; identity is verified above. No launch pool exists for BELLFLY, so there is no executable entry/exit quote or liquidity measurement to publish. Provider quote allowlists, token restrictions, router, slippage, current block/deadline, fees and redemption route must all be checked for the concrete future action. No funds/wallets were used.

## Scientific sources and license boundaries

[Shiu original repository](https://github.com/philshiu/Drosophila_brain_model) is MIT; commit and hashes are recorded in `vendor/shiu.pin.json`. Its example uses FlyWire v630 and includes sugarR neuron IDs and MN9. The paper is [Nature 2024, DOI 10.1038/s41586-024-07763-9](https://www.nature.com/articles/s41586-024-07763-9). We ran its functions and equations with a modern pinned Brian2/NumPy environment, not the original environment. Metrics are locally measured in execution records; no claims of a complete biological brain or scientific replication of all figures.

[FlyWire principles](https://edit.flywire.ai/principles.html) state published data are CC BY-NC 4.0. The actual intended public use needs clarification; MIT code does not automatically relicense data. This is not a determination that every token experiment is commercial, nor a reason to stop the authorized local test. What other teams do does not establish their permissions. Dataset distribution/public token use remains separately reviewed.

[MaleCNS / FlyEM](https://www.janelia.org/project-team/flyem/male-cns-connectome) offers a male CNS dataset including nerve cord and states CC-BY. It is a research dataset, not a token competitor or a validated drop-in for the female FlyWire model. A migration requires neuron mapping, dynamics and reference validation. [Eon fly-brain](https://github.com/eonsystemspbc/fly-brain/blob/main/README.md) offers GPU implementations and v783 data; current top-level licensing is GPL-2.0-or-later with upstream MIT portions, so a blanket MIT claim would be wrong. CPU reference execution worked here; no GPU migration was needed.

## Grok second opinion

At user request, two private queries were submitted through Grok in Brave's existing X session. Conversation: [Grok review](https://x.com/i/grok?conversation=2098113986323472716). Its useful recommendation is prior commitment + controls + replay + one auditable submission. It supplied competitor leads, but its answers are not primary evidence. We corrected its initial claim that a valid quiet run is INVALID and its suggestion of guaranteed cross-hardware bitwise replay. Its categorical licensing conclusions and suggestion that keeping weights away from the signer solves data rights are **not adopted**; actual usage, rights and provenance require assessment. No public post or bot-tag launch request was sent.
