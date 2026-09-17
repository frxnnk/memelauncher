import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const required = (value, label, errors) => { if (typeof value !== 'string' || !value.trim()) errors.push(`${label} is required.`); };

export function assessPublicLaunch(config) {
  const errors = [], warnings = [], c = config ?? {};
  if (c.status !== 'approved') errors.push('status must be approved only after the founder has accepted the terms.');
  if (c.network?.chainId !== 4663 || c.network?.name !== 'Robinhood Chain') errors.push('The game settlement network must be Robinhood Chain (4663).');
  required(c.network?.asset, 'network.asset', errors);
  if (!address(c.network?.assetAddress)) errors.push('network.assetAddress must be the verified token contract.');
  if (c.network?.assetDecimals !== 6) errors.push('network.assetDecimals must match the verified token contract.');
  const pricing = c.pricePolicy ?? {};
  if (![pricing.baseUsd, pricing.stepUsd, pricing.maximumUsd].every(positive) || pricing.maximumUsd < pricing.baseUsd) errors.push('pricePolicy must have positive base/step/maximum with maximum >= base.');
  if (pricing.baseUsd !== 5) warnings.push('The proposed public default starts at USD 5; this config changes it.');
  required(c.round?.id, 'round.id', errors); required(c.round?.guardianModel, 'round.guardianModel', errors); required(c.round?.manifestHash, 'round.manifestHash', errors);
  if (!positive(c.round?.bountyCapUsd) || !positive(c.round?.durationDays)) errors.push('round bounty cap and duration must be positive.');
  const allocation = c.allocationBps ?? {};
  if (![allocation.bounty, allocation.operations, allocation.continuity].every(Number.isInteger) || allocation.bounty + allocation.operations + allocation.continuity !== 10000) errors.push('allocationBps must be integer basis points summing to 10000.');
  const funding = c.funding ?? {};
  if (![funding.seedUsd, funding.operatingReserveUsd, funding.errorReserveUsd].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) errors.push('funding amounts must be finite nonnegative numbers.');
  if (!Number.isInteger(funding.creatorFeeShareBps) || funding.creatorFeeShareBps < 0 || funding.creatorFeeShareBps > 10000) errors.push('funding.creatorFeeShareBps must be 0..10000.');
  if (funding.creatorFeeShareBps > 0 && !address(funding.feeRecipient)) errors.push('A creator fee recipient is required when a share is configured.');
  const provider = c.provider ?? {};
  required(provider.name, 'provider.name', errors); required(provider.payment, 'provider.payment', errors); required(provider.endpoint, 'provider.endpoint', errors);
  if (provider.fallbacks !== false || provider.contextTruncation !== false) errors.push('Fallbacks and context truncation must be explicitly disabled for a funded round.');
  if (provider.payment !== 'x402' || provider.network !== 'eip155:8453' || provider.asset !== 'USDC') warnings.push('Provider payment is not the currently researched BlockRun Base USDC x402 route.');
  const terms = c.terms ?? {};
  required(terms.creditPolicyVersion, 'terms.creditPolicyVersion', errors); required(terms.closureReturnPolicy, 'terms.closureReturnPolicy', errors); required(terms.expiryPolicy, 'terms.expiryPolicy', errors);
  if (terms.ordinaryCashout !== false || terms.technicalErrorRestoresCredit !== true) errors.push('The proposed credit policy requires no ordinary cashout and technical error restoration.');
  const authority = c.authority ?? {};
  if (!address(authority.escrowAddress) || !address(authority.verifierAddress)) errors.push('Escrow and verifier addresses must be deployed and verified.');
  if (authority.independentReview !== true || authority.fairExecutionStatus !== 'passed') errors.push('Independent review and fair execution proof must pass before launch.');
  const operations = c.operations ?? {};
  required(operations.operatorName, 'operations.operatorName', errors); required(operations.publicOrigin, 'operations.publicOrigin', errors);
  if (!Array.isArray(operations.jurisdictions) || !operations.jurisdictions.length) errors.push('At least one permitted jurisdiction must be documented.');
  if (operations.monitoring !== true || operations.backupRestoreDrill !== true) errors.push('Monitoring and restore drill must pass before public promotion.');
  return { ready:errors.length === 0, errors, warnings, checks:{ publicAdmission:true, robinhoodOnlySettlement:true, boundedPricing:true, noProviderFallbacks:provider.fallbacks === false && provider.contextTruncation === false, realFundsEnabled:false } };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const path = process.argv[2] ?? 'config/public-launch.example.json';
  const config = JSON.parse(await readFile(path, 'utf8'));
  const report = { checkedAt:new Date().toISOString(), source:path, ...assessPublicLaunch(config) };
  await writeFile('output/public-launch-readiness.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
