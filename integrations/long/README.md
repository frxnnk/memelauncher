# Long / GOOGL — unsigned preparation

User selected Google as the quote on 2026-09-10. This module uses **GOOGL (Alphabet)** on chain 4663, not GOOG, a stock purchase, or an affiliation claim. BELLFLY name/ticker remain provisional. No transaction is signed or broadcast; no wallet credentials or account connections are used.

## Result at 20:40 UTC, 10 September 2026

- GOOGL registry address: `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3`; oracle: `0xF6f373a037c30F0e5010d854385cA89185AE638b`.
- BELLFLY ticker available at sampled block 59693460. No reservation was made.
- Six reviewed runtime identities match the OCAT baseline. Other recorded contracts are explicitly outside that compiled-proof set.
- GOOGL oracle age was 12,865 seconds. Strict preparation stopped at its one-hour freshness limit. This limit is our preparer's policy, not a claim about Long's policy.
- An explicitly separate diagnostic with last-published pricing, fictional addresses and a reserved `.invalid` metadata URI constructed calldata and reached `eth_call`. It reverted with `0xd93c0665`, the selector for `EnforcedPause()`.
- Independent `paused()` read confirmed **true** at block 59696393 for ticker factory `0x22e99278308B393ea1260859B181AD7E78f5eeED`.
- Exact diagnostic input encoding matches the captured Long SDK and independent builder transcription (salt excluded). This is byte/parameter parity, not EVM success.
- No successful gas estimate, usable launch packet, deployed token, or live neural-to-transaction link exists.

The current `/create` browser page requires a wallet and loads different chunk filenames from the September 8 capture. Public shell GETs returned HTTP 403; browser navigation to a script was blocked by the client. Therefore **current frontend/factory equivalence is unverified**. Do not generalize the old factory's pause to every possible current Long route. Verify the current factory before choosing to wait or switching to Pons.

## Run from this directory

```powershell
Push-Location tools
npm.cmd ci --ignore-scripts --no-audit --no-fund
Pop-Location
node --test tools/core.test.mjs
node tools/prepare.mjs inputs.draft.json --snapshot
node tools/prepare.mjs inputs.rehearsal.json --rehearsal
node tools/parity.mjs
```

`--snapshot` needs only an explicit supported quote/ticker and records public state; a snapshot is not approval. Normal preparation requires public creator/recipient addresses and exact published metadata bytes. `inputs.draft.json` deliberately fails preparation until these are supplied. The module never uploads metadata.

`--rehearsal` permits only the fixed fictional `0x...0001` address and `https://bellfly.invalid/metadata.json`, with the SHA256 of the local metadata draft. Its output is never launch-ready. A deliberately priced-only diagnostic is available as `--rehearsal --diagnostic-stale-oracle`; it cannot bypass a paused factory, invalid oracle, changed reviewed runtime or wrong chain. It always labels pricing as unvalidated. Do not present it as an executable quote.

The local address search is bounded. Early salt ranges were occupied by existing clones, so the rehearsal now uses a large fixed starting salt. Failed attempts remain under `outputs/`; the initial two searches started at zero. There is no retry of a broadcast because this module has no broadcast capability.

## Scope and proposed economics

Reuses the OCAT preparer and captured Long stock route, independently installed with exact `viem 2.56.3` and `doppler-sdk 1.0.40` lockfile. These dependencies provide ABI encoding, CREATE2 address calculation and public RPC; they are isolated from the neural runtime and app dependency lockfile.

The encoded **proposal**, not approved BELLFLY economics, retains the captured route's 1 billion supply, full curve allocation, empty vesting arrays and zero initial buy. Hook settings include startFee 800000, endFee 11200, a 10-second duration, an integrator buyback destination, fee routing shares, and sorted 5%/95% beneficiary shares. Do not reduce these settings to a claim of “zero fees” or “95% to the creator”: actual fee flow requires separate economic/role review. All exact parameters are in the saved diagnostic packet.

Public transport permits only chain/block/code/call/gas/balance reads. It rejects signing, wallet and submission RPCs. Source hashes, tool hashes, block and RPC transcript accompany preparation outputs. Source copies are historical evidence, not maintained production dependencies. Proof paths in `runtime-review.mjs` refer to the OCAT research project.

This directory is independent of `server/` and `runner/`. Historical neural manifests and their code hashes remain unchanged, including their older proposed Bankr/NVDA labels. A future binding requires a **new** approved manifest; do not relabel existing outcomes as GOOGL-authorized runs.

## Next work

1. Establish the current Long factory/encoding or validate Pons as the alternative; do not bypass the paused wrapper by calling Airlock directly.
2. Supply final public addresses, identity, image/metadata, economic terms and gas cap; recheck a fresh oracle and exact transaction at a common block.
3. Implement a separate signer/executor, prior neural-manifest binding, durable reconciliation and receipt/configuration verification. These are not implemented by this preparer.
4. Approve exact terms/budget before an official neural run. No publication, spending or issuance is authorized by this local work.

## Evidence

`outputs/failed-unsigned-simulation-06c3e255c792616904e519e302c432239372181a57e1ef1d251c464620d6dc7e.json` contains the diagnostic transaction, parameters, snapshot and error; its adjacent `.rpc.json` contains the RPC response. `factory-pause-*.json` confirms the independent state read. `parity-*.json` with `inputPacketSha256` set to that packet's hash records exact-input comparison. The older blocked files and their tool hashes preserve the preceding code revisions.
