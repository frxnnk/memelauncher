# BELLFLY local MVP — design and review

Prepared 2026-09-10. User authorization: local development, tests and public reads; later a private Grok consultation in the existing X session. No issuance, spend, funding, deployment, contact with people or public posts.

The workspace had no commits/remotes/app, only two existing generated images in `output/`. The five suggested preparation documents/zip were absent. Existing images were preserved. No chain, ticker or economics were silently adopted as final.

## Chosen design

React/Vite displays records; a small Node/TypeScript controller uses built-in SQLite for immutable manifests, events, artifacts and atomic attempt reservation. Python runs a reviewed, pinned model in a child process. Zod validates the data boundary. No wallet library, deployment contract, cloud service or networked executor exists. An alternative all-Python backend would simplify dependencies but depart from the requested default; a GPU fork would increase validation and licensing work. CPU Brian2 was sufficient for the first reference.

```
private CLI / authenticated local control
  -> DRAFT -> PREFLIGHT_PASSED -> COMMITTED -> RUNNING
  -> private child stdout (schema + clock + provenance checks)
  -> INVALID | NO_LAUNCH | LAUNCH_SIGNAL
  -> offline preview; positive only -> one durable MOCK request
  -> export / verifier / credential-free replay / read-only UI
```

The manifest includes exact code and file hashes, environment, seed, stimulus, output IDs, clock, rule, duration and proposed terms. Output, runtime metrics and simulated receipts are separate. The decoder waits for complete valid data even if a threshold was crossed earlier. No state or neural event supplied by the public frontend can authorize anything.

## Explicit limits

- Only engineering rehearsals accepted. Official manifests are rejected. `live_execution_enabled` is the literal false. `requestLive` always throws; credentials do not change that.
- The offline provider is synthetic; it cannot validate Bankr's actual payload, pricing, signer, receipts or remote idempotency. An ambiguous request stays ambiguous and is never automatically resubmitted.
- The child receives an environment allowlist, not launcher/control credentials. It is process-separated, **not an OS sandbox**: a hostile same-user process could read local files. Prior to any real signer, use separate OS identities/containers, least-privilege signer policy and network restrictions. Low balance does not provide those guarantees.
- Local SQLite/hash records are not an external timestamp or proof against a malicious host. A host can replace code plus evidence. Replay/integrity validate against the supplied commitment and pinned local code, not against an independent witness.
- Same-host restart recovery uses owner PID liveness, preserves active CLI work and invalidates interrupted runs. PID reuse across long intervals and independently hosted controllers need leases/stronger ownership before live deployment.
- Node 22's built-in SQLite API is experimental in the installed Node version. Local persistence is adequate for this prototype; do not infer production readiness.
- Unknown/malformed child messages and stderr do not get copied to public logs. The public UI polls stored events and clearly labels playback; it is not a claim of biological real-time simulation.

## Review focus

Validated state transitions, exact pinned model data, end-of-window semantics, child transport, artifact recomputation, absence of live route, request reservation, ambiguous outcomes, restart ownership and public read/control separation. Bugs caught during actual work are recorded in `RUN_LOG.md`; no attempts are hidden.
