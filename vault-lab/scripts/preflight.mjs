import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { createAuthentication } from '../server/auth.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';
import { DEFAULT_GUARDIANS } from '../server/rounds.mjs';
import { sourceEvidence } from './source-evidence.mjs';

export function assessReadiness({ env = {}, sourceCurrent = false, testsPassed = 0 } = {}) {
  let runtime, runtimeError = null;
  try { runtime = runtimeConfiguration(env); } catch { runtimeError = 'Access mode, exact HTTPS origin or numeric usage limits are invalid.'; }
  const auth = createAuthentication({ appId:env.PRIVY_APP_ID, clientId:env.PRIVY_CLIENT_ID,
    verificationKey:env.PRIVY_VERIFICATION_KEY?.replaceAll('\\n', '\n') });
  const apiKeyPresent = Boolean(env.OPENROUTER_API_KEY?.trim());
  return { generatedAt:new Date().toISOString(), evidence:'local-preflight-not-external-attestation',
    implementation:{ sourceCurrent, testsPassed:sourceCurrent ? testsPassed : null },
    configuration:{ runtimeValid:!runtimeError, runtimeError, accessMode:runtime?.mode ?? null,
      privyConfigured:auth.configured, apiKeyPresent, closedBeta:runtime?.closedBeta ?? false,
      providerBudgetVerified:false, publicOrigin:runtime?.publicOrigin ?? null },
    practice:{ launchReady:false, remaining:[...(runtime?.closedBeta ? ['Verify invitation issue/redeem/revoke, pause, and actual admitted/denied users on the chosen host.'] : []), auth.configured
      ? 'Verify real Privy login, account identity and allowed origins for the intended host.'
      : 'Complete Privy configuration; verify allowed origins, real login and account identity.',
      apiKeyPresent ? 'Verify the provider key budget and run authorized model evaluation.'
        : 'Configure an explicitly budgeted provider key and run authorized model evaluation.',
      'Review retention/terms, HTTPS deployment, backup restore, monitoring and operational ownership.'] },
    funded:{ launchReady:false, paymentsEnabled:false, candidateGuardians:DEFAULT_GUARDIANS,
      remaining:['Qualify and freeze the shared-bounty guardian roster using real evidence.',
        'Select and verify exact chain, game token, stock/quote asset and Long contracts/permissions.',
        'Decide and implement payout authority that meets the operator-trust requirement.',
        'Expose the prepared authenticated credit services only after exact-asset indexing/finality, wallet transaction UX and verified payout execution are ready.',
        'Approve tokenomics, prize seed, contract review and the exact launch transactions.'] },
    callsMade:0, signsTransactions:false, publishes:false };
}

export async function main({ env = process.env } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let previous, current;
  try { previous = JSON.parse(await readFile(join(root, 'output/release-verification.json'), 'utf8')); current = await sourceEvidence(root); } catch {}
  const sourceCurrent = Boolean(previous?.build === 'passed' && previous.testsPassed > 0 && JSON.stringify(previous.files) === JSON.stringify(current));
  const report = assessReadiness({ env, sourceCurrent, testsPassed:previous?.testsPassed });
  await mkdir(join(root, 'output'), { recursive:true });
  await writeFile(join(root, 'output/launch-preflight.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Preflight could not be completed.'); process.exitCode = 1; });
