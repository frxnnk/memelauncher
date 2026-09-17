# Validation — 2026-09-10

- `node --test tools/core.test.mjs`: 6/6 passed. Covers forbidden RPC methods before network access, strict public inputs, GOOGL decoded token/supply/vesting, oracle diagnostic boundary, pause gate and gas-review arithmetic.
- Root `npm.cmd test`: 15/15 passed, including actual Python MOCK subprocess and replay.
- Root `npm.cmd run build`: passed, Vite artifact `index-LS-mTxmY.js`.
- Offline fixture parity and exact failed-packet parity: zero differences against captured SDK/builder. No claim of equivalence to the new live frontend build.
- Final strict rehearsal at block 59698697: expected nonzero exit, `Long ticker factory paused or pause state unverified`; snapshot records `factoryPaused: true`. It stops before address mining or simulated create. Evidence: `outputs/blocked-d5e8d838c0aff059a023cc46b3d7c91c4bb1335972c9768cbeb9f1a683506d7a.json` and its transcript.
- Earlier explicit stale-price diagnostic: calldata reached `eth_call`, which returned `EnforcedPause()`. No successful launch simulation or gas estimate. All prior oracle and occupied-address failures are preserved.
- Local browser reloaded the new build with `review=long-googl`; the launch summary reads `Long → GOOGL`, states the dated pause/uncertainty, and has no horizontal overflow at the observed viewport.

No changes to `server/`, `runner/` or the root dependency manifests were needed. Long dependencies and evidence are isolated. No credentials, signing, broadcasting, metadata upload, publication or paid actions occurred.
