# FLYBRAIN — verified competitor update, 2026-09-10

The user identified https://flybrain.online/. The site was opened in a normal browser, followed to its source repository and independently to Blockscout. Public source files in this folder are research snapshots, **not an installed integration or instructions to execute**. No competitor code was run, wallet connected or transaction sent.

## Confirmed token launch

- Token: `flybrain` / `FLYBRAIN`, `0x4Eb990547BCe4a982432CA88Cf5fae7EED1A2d35`.
- Creation: `0x63b2164f3d784e46538cc81d3c48095bd7252a3d12398fdad9991870d12a4f1c`.
- Explorer showed Success, method `launchToken`, block 59,614,342, 2026-09-10 15:23:09 Argentina / 18:23:09 UTC.
- Chain 4663; interacted with `PonsV2LaunchFactory` at `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`.
- Sender `0x6ce4085EfB52a6eBDb7d6989beb8860847f4b42A`; minted 1,000,000,000 FLYBRAIN.
- That transaction transferred 0.0005 ETH and incurred 0.000476844685872 ETH transaction fee. These are historical actual amounts, not a quote for our launch.

[Contract](https://robinhoodchain.blockscout.com/address/0x4eb990547bce4a982432ca88cf5fae7eed1a2d35) · [Creation transaction](https://robinhoodchain.blockscout.com/tx/0x63b2164f3d784e46538cc81d3c48095bd7252a3d12398fdad9991870d12a4f1c).

Shell RPC and explorer REST requests returned HTTP 403 on that route (`rpc.json`). The ordinary public explorer UI loaded and supplied the findings above; no geographical/access-control bypass was attempted. The website itself reports GOOGL pairing and 1% creator tax; those two fields were not independently decoded in this bounded review.

## What the fly actually does, according to published material

The project describes a MaleCNS model, 165,122 traced neurons and 10,228,000 signed connections, receiving browser screenshots via 892 visual columns. Descending-neuron outputs control cursor movement/clicks. It reports learned per-cell-type gains and partial form completion. These scientific/training figures are author claims here, not our measured results.

The current site says the token launched but later unrestricted operation has not been released. These statuses are compatible: a token exists while their broader autonomous-agent experiment remains unfinished.

Source pin: `9381313152906571b859fc24897f7d6d27859afd`, from [fruitflydev/flycoinrh](https://github.com/fruitflydev/flycoinrh).

The authors explicitly disclose that their rig fills missing fields, selects the quote and creator fee, and confirms the launch. Inspected `rhlive.py` lines 988–1061 implement those actions: select quote, set fee, locate launch button, move cursor there, and when `live_flag` is true call `page.mouse.click`; then programmatically locate and click the confirmation. It is not evidence of a separate precommitted neural yes/no launch decision. It also does not independently prove which exact version ran for this historical transaction.

The repository README gives older **TEST** deployments, wallet and 2% fee. Those are not the current FLYBRAIN address, live sender or website's 1% claim. Keep their evidence separate.

## Implication for BELLFLY

This is a direct relevant competitor with a real deployment, not merely a themed landing. They are ahead of our current demo on live launch integration and have a richer browser-control experiment. We should not defend novelty by dismissing the scripted portions; all such systems require an execution layer.

Our intended distinction is specific: does the frozen neural rule determine **whether** emission happens, with valid NO_LAUNCH preserved, prior commitment and auditable artifacts? A script interpreting that rule is acceptable; a script always launching after the demo is a different experiment. This distinction remains to be demonstrated in our official run and is not evidence of market demand or world-first status.

Next integration research should inspect this exact Pons V2 factory, current `canLaunch`/quote eligibility and preview semantics alongside Bankr. Prior indexed documentation suggesting restricted public launching cannot support a blanket claim that Pons deployment is unavailable: this confirmed transaction is contrary evidence. It does not prove our account is eligible or NVDA is accepted. No launch authorization follows from the competitor existing.
