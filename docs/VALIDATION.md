# Executed validation — 2026-09-10

## Memecoin redesign and OCAT reference update

The later user-requested visual redesign touched `web/main.tsx`, `web/identity.tsx`, `web/styles.css`, `web/index.html` and project documentation. OCAT's live site and local CSS were read as a visual reference. OCAT's project and deployment were not modified.

- TypeScript/Vite build passed after the final OCAT-inspired revision (assets `index-Dl-3bKgd.js`, `index-CAS7Ln5s.css`). No new dependency or font network request.
- All 15 existing TypeScript tests were rerun and passed during the redesign; later refinements only changed presentation and documentation.
- The final positive real example still verified as `VERIFIED_LOCAL`. The final MOCK example freshly replayed with 100 identical frames and `REPLAY_MATCH`, confirming the existing core pins remain compatible. No new scientific trial or live request was made.
- Final OCAT-inspired desktop screenshot inspected at 1280 px (document client and scroll width both 1265); mobile screenshot inspected at 390 px (client and scroll width both 375). No horizontal overflow in either measured view.
- Prelaunch state, undecided ticker, no token issued, decorative-mascot provenance, live deployment disarmed, actual recorded positive and launch-gap content remain visible. Navigation to the model and record selection were exercised.
- Focused static secret scan during the redesign passed for 79 files; it remains a known-pattern check rather than a guarantee against every credential format.

The earlier validation record below describes the initial lab delivery; its original asset names are historical.

These checks were executed locally, not proposed. No onchain operation was part of validation.

| Check | Observed result |
|---|---|
| `npm.cmd test` | 15 passed, 0 failed. Full TAP output: `docs/tests-node.txt`. |
| `.venv\Scripts\python.exe -m unittest discover -s tests -p test_reference.py -v` | 1 passed. Actual Brian2 connection selection/units test. Output: `docs/tests-python.txt`. Non-failing dependency deprecation/unused-test-object warnings remain. |
| `npm.cmd run build` | TypeScript check and Vite 6.4.3 build succeeded. Final assets: `index-CZibyypU.js`, `index-BHUKWDdm.css`. |
| Real positive, negative and ablated runs | Each completed; full counts and IDs in `RUN_LOG.md`. |
| Fresh subprocess replay of each final real example | Three `REPLAY_MATCH` results, 100 frames each, exact integer-microsecond raster and decision, tolerance 0 in pinned local environment. |
| Actual Python MOCK integration/replay | Passed, explicitly synthetic and never eligible for live execution. |
| Evidence endpoint | HTTP 200, JSON attachment, positive run export 975,279 bytes; downloaded to `.local/qa-download.json` then CLI verifier returned `VERIFIED_LOCAL`, `SHIU_REFERENCE`, `LAUNCH_SIGNAL`, independent timestamp false. |
| Focused secret scan | 75 text/source/evidence/vendor files checked before this report was added; no known key-format matches and no selected server/secret sentinels in public bundle. The final count may grow with documentation. This is a bounded static check, not proof against unknown credential formats. |
| npm advisory audit | After upgrading Vite from vulnerable 6.3.5 to 6.4.3, audit reported zero vulnerabilities. Final `npm.cmd audit --omit=dev --json` also reported zero production vulnerabilities. |

The 15 TypeScript tests cover manifest corruption and drift, deterministic MOCK subprocess/replay and tampering, negative/timeout behavior, missing/duplicate/fake events and clock/provenance, durable atomic/concurrent reservations, restart ownership, ambiguous response reconciliation, unexpected economic terms, hard-disabled live execution with credential sentinels, restricted child environment, private HTTP auth/foreign origins/fake event routes/backend failure, explicit CLI control parsing, forged positive state rejection, and preventing unknown secret fields from being persisted/exported.

## Browser checks actually performed

Codex in-app browser used the built UI served on loopback 8787. Grok review separately used Brave as requested.

- Positive real record displayed 127,400 neurons, 14,687,178 connection rows, 28.25 s, LAUNCH SIGNAL, VERIFIED_LOCAL, DEPLOYMENT DISARMED and no onchain receipt.
- Pressing Play changed the raster to RECORDED PLAYBACK and advanced from the start (observed 40/1000 ms and slider value 3). End-of-record rendering was also inspected.
- Selecting the 0 Hz record showed a complete quiet raster, NO LAUNCH and zero MN9 spikes.
- Selecting the ablation showed 100 Hz input, 229 incoming weights verified disconnected, NO LAUNCH and zero MN9 spikes, while other neurons remained active.
- Selecting the final MOCK record showed MOCK / SYNTHETIC, no connectome, one loaded fixture neuron and no onchain receipt.
- Mobile viewport 390×844: screenshot inspected; document/body scroll width 375 CSS pixels with 390-pixel viewport (scrollbar allowance), no horizontal overflow. Raster, controls and result stacked visibly. Desktop panel screenshot inspected at 1440×1000.
- A deliberately nonexistent record returned a visible evidence error and BACKEND UNAVAILABLE. Its selector showed Record unavailable and no download link. Returning to the positive record recovered the real data and VERIFIED_LOCAL status without a page restart. This fixed a misleading native-select fallback during development.
- Evidence download URL in the UI matched the selected run. Its response was independently fetched and verified as above; browser download-manager behavior was not separately asserted.

No full accessibility audit, cross-browser matrix, cross-hardware numerical comparison, original-environment scientific replication, official provider simulation, signer integration, independent timestamp or real transaction was tested. No earlier Git snapshot exists for historical code hashes; current named examples target the delivered core implementation.
