import { apiError } from './errors.mjs';

export function runtimeConfiguration(env = {}) {
  const mode = env.VAULT_ACCESS_MODE || 'local';
  if (!['local', 'public-practice'].includes(mode)) throw new Error('Only local and public-practice access modes are implemented. Funded mode is disabled.');
  if (env.VAULT_CLOSED_BETA !== undefined && !['true', 'false', ''].includes(env.VAULT_CLOSED_BETA)) throw new Error('VAULT_CLOSED_BETA must be true or false.');
  const closedBeta = env.VAULT_CLOSED_BETA === 'true';
  if (env.VAULT_PUBLIC_ADMISSION !== undefined && !['true', 'false', ''].includes(env.VAULT_PUBLIC_ADMISSION)) throw new Error('VAULT_PUBLIC_ADMISSION must be true or false.');
  const publicAdmission = env.VAULT_PUBLIC_ADMISSION === 'true';
  if (publicAdmission && !closedBeta) throw new Error('Public admission requires the persistent beta service.');
  if (closedBeta && mode !== 'public-practice') throw new Error('Closed beta requires authenticated public-practice mode.');
  let publicOrigin = null;
  if (mode === 'public-practice') {
    const url = new URL(env.VAULT_PUBLIC_ORIGIN || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('An exact HTTPS public origin is required.');
    publicOrigin = url.origin;
  }
  const perUserPerDay = Number(env.VAULT_REQUESTS_PER_USER_DAY || '25');
  const totalPerDay = Number(env.VAULT_REQUESTS_PER_DAY || '250');
  const budgetUsd = Number(env.VAULT_API_BUDGET_USD || '5');
  if (![perUserPerDay, totalPerDay].every(n => Number.isInteger(n) && n > 0 && n <= 10000) ||
      !Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 25) throw new Error('Invalid practice usage limits.');
  return { mode, publicOrigin, perUserPerDay, totalPerDay, budgetUsd, closedBeta, publicAdmission, sandboxEnabled: mode === 'local', realFunds: false };
}

export function checkPublicRequest(request, runtime) {
  const origin = new URL(runtime.publicOrigin);
  if (request.headers.host !== origin.host || (request.headers.origin && request.headers.origin !== origin.origin) ||
      (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) {
    throw apiError(403, 'ORIGIN_REJECTED', 'This request does not belong to the configured application origin.');
  }
}
