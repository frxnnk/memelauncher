# Engineering run log — 2026-09-10

All records below are local engineering attempts, not official public trials. Seed 20260910, 1000 ms duration and the provisional three-consecutive-bin rule were fixed before the first reference run. No seed search or post-result threshold tuning was performed. Repeated runs below were implementation/debugging checks, not independent statistical evidence. The SQLite store and UUID exports preserve the history, including failures. Named examples are copies, not additional trials.

## Final delivery records

| Evidence | Run ID | Stimulus | MN9 intervention | Total spikes / MN9 spikes | Decision | Wall time |
|---|---|---|---|---|---|---|
| `examples/reference-positive.json` | 12a959cf-4a7e-48a9-9547-90d3c9d3a41e | 100 Hz | None | 9,735 / 66 | LAUNCH_SIGNAL | 28.246 s |
| `examples/reference-negative.json` | 6e3ef0af-7bde-47c1-ae64-1dc634cec8f3 | 0 Hz | None | 0 / 0 | NO_LAUNCH | 31.842 s |
| `examples/reference-ablated.json` | 0886c3de-2fcd-44f7-b7de-ee4b0d01df69 | 100 Hz | 229 incoming connection weights verified zero | 10,062 / 0 | NO_LAUNCH | 33.402 s |
| `examples/mock-demo.json` | 66e85426-aaae-4e6d-b20e-5f7af1603c1f | Synthetic | None | 112 / 112 | MOCK LAUNCH_SIGNAL | 0.988 ms |

All three final real records loaded 127,400 neuron table rows and 14,687,178 connectivity rows. These counts describe the supplied model, not a claim that every biological neuron or synapse is represented. Peak reference process RAM was 2,082,181,120–2,083,434,496 bytes. NumPy CPU backend; VRAM usage zero. One second of simulated time is not one second of wall time.

All three final real records passed fresh subprocess replay: 100 frames, identical integer-microsecond spike rasters and identical decisions, tolerance 0, in this pinned local environment. This is not cross-hardware validation. The negative test has a legitimately quiet complete simulation. In the ablation, the remaining network is still active while MN9 is silent. These controls support local circuit dependence, not a claim of understanding tokens or of scientific replication of the entire paper.

## Complete chronological history

| Run ID | Recorded outcome | Interpretation / correction |
|---|---|---|
| 33e61341-b1f3-45d6-8bc9-512b0696915e | INVALID | Brian2 first-import CPU cache blocked by sandbox. Initial export retrieval also omitted artifacts/events because the SQL bind argument was missing; this export is incomplete. Persistent DB retained events. |
| f443e6d5-7ac3-408c-a792-975ce4d7fa07 | INVALID | Same Brian2 cache problem during diagnosis. |
| c4d957cc-61b4-43af-958a-c4b03c28584f | INVALID | Same cache problem after export fix. A scoped normal first import resolved it. |
| 1d3fa839-7bf4-4274-8327-9d7a6c43318a | MOCK LAUNCH_SIGNAL | First synthetic end-to-end controller/export check. |
| 1e98e46a-dccf-4cc4-a40a-1b0f3554ee8d | LAUNCH_SIGNAL | First successful real reference; its local replay matched. |
| 4bc06a0f-8139-4e1f-8acd-1b654ed624fa | LAUNCH_SIGNAL | Intended no-stimulus option was swallowed by the PowerShell npm wrapper. Actual manifest had 100 Hz. This is a repeated positive, not a negative control. |
| a99367e9-cbb4-4f8b-9a1c-1681e589e616 | LAUNCH_SIGNAL | Intended ablation option was similarly swallowed. Actual manifest had no ablation. CLI now uses validated positional options and explicit npm scripts. |
| 126e9aab-5c7d-48e7-af66-411b638c6a32 | NO_LAUNCH | Correct 0 Hz negative control. |
| 1a770b59-bcf8-4d6d-9bca-8284269347e8 | LAUNCH_SIGNAL | Requested ablation was defective: Brian2 Boolean indexing was interpreted as integer indices. It did not remove the intended input connections. Not valid ablation evidence. |
| 7e5b2251-7420-4671-bee7-c4d6c6f07dc2 | INVALID | Corrected selection then exposed Brian2 unit mismatch with scalar zero. Correct implementation uses a Brian2 target expression and `0 * mV`, verifies selected weights, and has an actual Brian2 regression test. |
| 72d53888-02ee-463c-9662-0f367d154862 | NO_LAUNCH | First correctly verified 229-connection ablation. |
| ab944795-990b-43c0-9eab-fdb5f076af47 | LAUNCH_SIGNAL | Reference repeat after hardening; superseded by final all-transitive environment pin. |
| 8ba1b1d7-8731-411e-8603-d9250768a71e | NO_LAUNCH | No-stimulus repeat before final environment pin. |
| 12a959cf-4a7e-48a9-9547-90d3c9d3a41e | LAUNCH_SIGNAL | Final positive above. |
| 6e3ef0af-7bde-47c1-ae64-1dc634cec8f3 | NO_LAUNCH | Final negative above. |
| 0886c3de-2fcd-44f7-b7de-ee4b0d01df69 | NO_LAUNCH | Final ablation above. |
| 66e85426-aaae-4e6d-b20e-5f7af1603c1f | MOCK LAUNCH_SIGNAL | Final explicit synthetic example. |

Replays validate existing experiments and do not reserve emission attempts. Automated test fixtures use disposable stores. Older evidence predates strict schema/code changes and may be marked unverified by the current UI/verifier; it is retained as history, not silently upgraded to current evidence.

No live request, signed transaction, token, curve or pool was created by any run. Positive runs reached only our offline MOCK adapter.
