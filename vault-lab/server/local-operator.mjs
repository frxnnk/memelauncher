import { apiError } from './errors.mjs';
import { LAPTOP_REHEARSAL_BOX, TREASURY_BOX } from './x402-operating-box-policy.mjs';

export const LOCAL_OPERATOR_HEADER = 'x-vault-local-operator-wallet';

export function localOperatorEnabled(runtime = {}, hosting = {}, env = {}) {
  return env.VAULT_LOCAL_TESTNET_OBSERVE === 'true'
    && runtime.mode === 'local'
    && hosting.name === 'local';
}

export function localOperatorAccountId(wallet) {
  return 'player_rh' + wallet.slice(2).toLowerCase();
}

function loopbackHost(headers = {}) {
  const host = typeof headers.host === 'string' ? headers.host : '';
  return /^127\.0\.0\.1(?::\d+)?$/.test(host) || /^localhost(?::\d+)?$/i.test(host);
}

export function localOperatorPrincipal(wallet) {
  if (typeof wallet !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim()) || /^0x0{40}$/i.test(wallet)) {
    throw apiError(400, 'WALLET_NOT_VERIFIED', 'Choose a wallet verified for your account.');
  }
  const address = wallet.trim().toLowerCase();
  // Player identity only. classifyOperatingBox belongs to VAULT_X402, not inbound Phantom senders.
  if (address === TREASURY_BOX || address === LAPTOP_REHEARSAL_BOX) {
    throw apiError(400, 'WALLET_NOT_VERIFIED', 'Choose a wallet verified for your account.');
  }
  return {
    authenticated: true,
    accountId: localOperatorAccountId(address),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    wallets: [{ address, chainType: 'ethereum', kind: 'external' }],
    walletOwnershipVerified: true,
    realFunds: false,
    localOperatorObserve: true
  };
}

export function localOperatorTreasuryPrincipal() {
  return {
    authenticated: true,
    accountId: localOperatorAccountId(TREASURY_BOX),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    wallets: [{ address: TREASURY_BOX, chainType: 'ethereum', kind: 'external' }],
    walletOwnershipVerified: true,
    realFunds: false,
    localOperatorObserve: true,
    localOperatorTreasury: true
  };
}

export function wrapLocalOperatorAuth(authentication, { runtime, hosting, env } = {}) {
  const enabled = localOperatorEnabled(runtime, hosting, env);
  return {
    ...authentication,
    localOperatorObserve: enabled,
    publicConfig: () => ({ ...authentication.publicConfig(), localOperatorObserve: enabled }),
    async authenticate(headers) {
      if (!enabled) return authentication.authenticate(headers);
      const raw = headers?.[LOCAL_OPERATOR_HEADER];
      if (raw === undefined) return authentication.authenticate(headers);
      if (!loopbackHost(headers)) {
        throw apiError(403, 'LOCAL_ONLY', 'This lab only allows local access through 127.0.0.1 or localhost.');
      }
      const address = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      if (address === TREASURY_BOX) return localOperatorTreasuryPrincipal();
      return localOperatorPrincipal(raw);
    }
  };
}
