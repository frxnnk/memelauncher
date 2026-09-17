# Separate checklist for a future issuance

Nothing here authorizes a transaction. All items remain required for the exact proposed run.

- [ ] Experiment policy: review and freeze the concrete model/input/output/threshold, preserve reference and negative/ablation controls, and specify circuit coverage/environment limitations. Current controls pass locally; broader paper replication and cross-hardware validation are research work, not claims or mandatory scope for an honestly labeled engineering experiment.
- [ ] Dataset terms: resolve the actual public use of FlyWire data under its terms (local testing is not blocked); do not infer a data license from MIT code. If selecting MaleCNS, adapt and validate a separately identified model with its own neuron mapping rather than substituting IDs.
- [ ] Terms/account: operator jurisdiction and provider eligibility; quote-token acquisition, transfer/redemption restrictions; no circumvention. No automatic classification based on others' usage.
- [ ] Provider: exact production version and ABI/API schema; enabled chain, issuer/signer, quote allowlist, immutable economics, zero creator allocation/initial buy, fee beneficiaries, fee schedule/anti-snipe costs and budget.
- [ ] Preview: authenticated official simulation confirmed to have no broadcast, debit or paid side effect; compare to manifest. Today's only preview is MOCK offline.
- [ ] Idempotency: remote request identifiers/CREATE2 terms/persisted transaction before broadcast; atomic one-attempt reservation. An uncertain timeout requires reconciliation, no blind retry. Current Bankr docs did not establish a durable Idempotency-Key contract.
- [ ] Security: isolated identities, restricted signer, key custody, signer allowlist and cost limits, authenticated signed internal records, dependency/code review, recovery drills, public API read-only, logs scrubbed.
- [ ] Official commitment + future beacon: externally observed prior publication, verified round/signature, no substitute seed, all trial attempts logged.
- [ ] Approval: exact manifest hash, budget, signer/beneficiaries, target platform and chain explicitly approved before start.
- [ ] Confirmation: receipt status, finality, chain ID, emitter/code and effective supply/vesting/fees/beneficiaries/quote. Only then publish verified token/curve/pool identifiers as applicable.

Public hosting, public posts and financial execution are separate future authorizations. None happened in this session.
