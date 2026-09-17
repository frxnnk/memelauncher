import { createCreditGame } from './model-game.mjs';
import { verifiedAccountId } from '../principal.mjs';
import { meteredAttempt } from '../metered-attempt.mjs';

// The HTTP server does not expose this preparation service until launch gates exist.
export function createAuthenticatedCreditGame({ path, economy, vault, authentication, limits, depositMonitor, billing = null, env } = {}) {
  if (!economy?.ledger.deposits || !authentication?.authenticate || !limits?.reserve || !limits?.settle || !limits?.assertReceiptSettled) {
    throw new Error('Account-credit play requires an asset ledger, server authentication and persistent usage limits.');
  }
  if (depositMonitor && (!depositMonitor.assertFresh || !depositMonitor.status)) throw new Error('Invalid deposit monitor.');
  const game = createCreditGame({ path, economy, depositMonitor, env, vault: { status: vault.status,
    assertUsageReconciled: billing === 'x402' ? undefined : limits.assertReceiptSettled,
    attempt: (input, scope) => meteredAttempt({ vault, limits, input, scope: billing ? { ...scope, billing } : scope }) } });
  const principal = async headers => {
    const account = await authentication.authenticate(headers); verifiedAccountId(account); return account;
  };
  return {
    async attempt(headers, input) { return game.attempt(input, await principal(headers)); },
    async attemptAs(input, account) { verifiedAccountId(account); return game.attempt(input, account); },
    async result(headers, key) { return game.result(key, await principal(headers)); },
    async reconcile(headers, key) { return game.reconcile(key, await principal(headers)); },
    async account(headers) {
      const result = economy.account(await principal(headers));
      if (!depositMonitor) return result;
      const monitoring = depositMonitor.status();
      return { ...result, spendingPaused: result.spendingPaused || !monitoring.fresh, depositMonitoring: monitoring };
    },
    async usage(headers) { return limits.status(verifiedAccountId(await principal(headers))); },
    close: game.close
  };
}
