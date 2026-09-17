# Sources consulted — 2026-09-10

The actionable observations, contradictions and verification boundaries are in [docs/RESEARCH.md](docs/RESEARCH.md). Competitor-by-competitor records are in [competidores.json](competidores.json). Neither source pages nor Grok responses grant execution authority.

| Primary source | Why consulted | Verification |
|---|---|---|
| https://docs.robinhood.com/chain/connecting/ | Network configuration | Read; corroborated via public RPC |
| https://docs.robinhood.com/chain/stock-tokens/ | Instrument, issuer, restrictions | Read; operator eligibility not determined |
| https://docs.robinhood.com/chain/stock-token-apis/ | Official asset registry contract | Read; assets endpoint queried |
| https://api.robinhood.com/rhj/assets | Exact NVDA identity | Response saved locally |
| https://docs.bankr.bot/token-launching/api-reference/deploy-token-launch/ | Simulation, auth, supported routes | Read; no authenticated API execution |
| https://docs.bankr.bot/token-launching/overview/ | Supply, optional vesting, fees | Read; no effective contract configuration audit |
| https://docs.ponsfamily.com/ | V1 identity and mechanism | Indexed page read; direct route region-blocked |
| https://docs.ponsfamily.com/v2 | V2 contracts, gates, economics | Indexed current text read; version discrepancies noted |
| https://github.com/philshiu/Drosophila_brain_model | Original runnable model | Commit pinned, files downloaded and hashed, local execution |
| https://www.nature.com/articles/s41586-024-07763-9 | Model's scientific reference | Read; full paper replication not claimed |
| https://edit.flywire.ai/principles.html | Data usage terms | Read; intended public use remains a separate question |
| https://www.janelia.org/project-team/flyem/male-cns-connectome | Alternative dataset/license | Read; no substitute model executed |
| https://github.com/eonsystemspbc/fly-brain/blob/main/README.md | GPU alternative and license | Read; not selected |
| https://www.flybrain.finance/ | Direct competitor claims | Page read; actual trading not verified |
| https://www.minefly.site/ | Themed token claims | Page read; emission cause not verified |
| https://github.com/blendi-remade/fly-brain-minecraft | Embodiment software | Original repository indexed; not run |
| https://x.com/i/grok?conversation=2098113986323472716 | User-requested second opinion | Two private queries in Brave; model-generated advice, not evidence |

Local public RPC snapshots are in `docs/rpc-verification.json`. The RPC block numbers are hex values, not human calendar dates. Registry and RPC requests were separate observations, not an atomic market quote. No prices, estimated returns or competing volumes are adopted.
