import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateKeyBudget } from '../server/key-budget.mjs';

export const TARGET = Object.freeze({ name:'Vault MVP', limit:5, limit_reset:null,
  hash:'08cd2f71d914bc14fbddc89c5cc1bbc28371124e29faa9524f072e71ac984a26' });
export const CHANGE = Object.freeze({ include_byok_in_limit:true });

export async function applyBudgetFlag({ managementKey, fetchImpl = fetch }) {
  if (!managementKey?.trim()) throw new Error('A temporary management credential is required.');
  const url = `https://openrouter.ai/api/v1/keys/${TARGET.hash}`;
  async function request(method) {
    const response = await fetchImpl(url, { method, redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{ Authorization:`Bearer ${managementKey.trim()}`, 'Content-Type':'application/json' },
      ...(method === 'PATCH' ? {body:JSON.stringify(CHANGE)} : {}) });
    if (!response.ok) throw new Error('Provider request failed. No automatic retry is performed.');
    return (await response.json()).data;
  }
  function assertTarget(data) {
    if (data?.hash !== TARGET.hash || data.name !== TARGET.name || data.limit !== TARGET.limit ||
      data.limit_reset !== null || data.disabled !== false) throw new Error('The target key does not match the reviewed key and budget.');
  }
  const before = await request('GET');
  assertTarget(before);
  let changed = false;
  if (before.include_byok_in_limit !== true) { await request('PATCH'); changed = true; }
  const after = await request('GET');
  assertTarget(after);
  if (after.expires_at !== before.expires_at || after.workspace_id !== before.workspace_id) throw new Error('Unrelated key settings changed. Inspect the provider dashboard.');
  const budget = validateKeyBudget(after, TARGET.limit);
  return { state:'verified', target:TARGET.name, hash:TARGET.hash, changed, budget,
    inferenceCalls:0, managementCredentialPersisted:false,
    next:'Verify the inference key directly, then revoke the temporary management credential in the dashboard.' };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) return console.log(JSON.stringify({ state:'prepared-only', target:TARGET,
    request:{method:'PATCH',path:`/api/v1/keys/${TARGET.hash}`,body:CHANGE},
    networkCalls:0, requires:'Explicit approval for a temporary administrative key before --apply.',
    note:'This key has broad administration access. Use it once and revoke it; never deploy or save it in the app .env.' },null,2));
  if (args.length !== 1 || args[0] !== '--apply') throw new Error('Use no arguments for the plan, or --apply after approval.');
  console.log(JSON.stringify(await applyBudgetFlag({ managementKey:process.env.OPENROUTER_MANAGEMENT_KEY }),null,2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => {
  console.error('Budget operation did not complete. Inspect the reviewed target in the dashboard; do not repeat an uncertain write or raise its cap. No credential was printed.');
  process.exitCode = 1;
});
