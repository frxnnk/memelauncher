# Autonomous radar implementation plan

> **For Codex:** Use executing-plans to implement this plan task-by-task.

**Goal:** Execute one autonomous, auditable research pass from current web sources through competing interpretations, actual market queries, editorial review and an interactive map.

**Architecture:** A Node orchestrator invokes the installed Codex CLI with structured outputs and web search, using existing ChatGPT login. It disables shell, apps, plugins, hooks and delegation in that product runtime. Deterministic code performs bounded public market queries, validates the model output, and persists complete runs atomically. Existing BELLFLY and historical research stay unchanged.

**Tech Stack:** Node standard library, installed Codex CLI, existing collector/idea validator/map template. No new dependencies, account connections, token execution or recurring job.

## 1. Structured research and validation

Create `market-agent/scout-schema.mjs` and `scout-evidence.mjs`. Define bounded discovery and review schemas; require source IDs, multiple interpretations, explicit coverage and falsification. Validate cross-references, source URLs, real recorded clocks, market query evidence and exact pair identities. Incomplete source access must remain explicit; it cannot establish exclusivity or social demand. Preserve original proposals before review.

## 2. Model execution

Create `market-agent/scout-model.mjs`. Spawn the installed binary with argument arrays, stdin prompt, JSONL events, structured final output, read-only sandbox, ignored user config and disabled mutation-capable tools. Use existing login without reading secrets. Bound duration, output and search calls; retain stage diagnostics and fail on unsuccessful/incomplete output. No automatic retry of costly model calls. CLI feature compatibility and authentication are tested separately from mocked output.

## 3. End-to-end orchestration

Create `market-agent/scout.mjs` and `scout-render.mjs`. Provide `status` and `run [--focus text]`. Lock concurrent runs; load prior complete research; generate candidates; freeze discovery; collect the model's bounded market queries; review candidates against those results; validate; render using the existing template; save provenance and cumulative source memory; update the latest pointer only after completion. Empty and failed runs remain explicit. Read a bounded summary of historical ideas on the first run.

## 4. Verification and actual run

Create `market-agent/scout.test.mjs` with isolated directories and injected model/collector: successful two-stage flow, abstention, invalid source/query/pair references, missing reviews, source time preservation, failure preserves last good output, concurrent run rejection, and runtime process/error handling. Run existing radar tests and new tests. Then run the actual CLI/model and real collector, inspect the resulting evidence and map, and report coverage or access failures honestly. Do not replace a failed autonomous result with manual curation.

## 5. Documentation

Update `market-agent/README.md` and `AGENT.md` with exact commands, runtime requirements, supported autonomy and limits. Record actual validation separately. No scheduler starts implicitly; recurring operation and real token launch remain separate deliverables.

## Execution decisions

The existing repository has no commits; preserve the authorized workspace and do not manufacture a base commit or copy unrelated BELLFLY state into a worktree. Implement directly in the isolated `market-agent` module. The user's instruction authorizes implementation and an actual research pass, so no repeated design approval is necessary. No coding subagents are used; the spawned Codex process is the product's research runtime under test.
