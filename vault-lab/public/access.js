import { paidBetaAccountCopy } from './paid-beta-copy.js';

// One configuration request shared by account, chat and accounting controls.
export const accessConfiguration = fetch('/api/auth/config', { signal: AbortSignal.timeout(10000) })
  .then(async response => {
    if (!response.ok) throw new Error('Account configuration unavailable.');
    const config = await response.json();
    document.documentElement.dataset.access = config.accessMode;
    if (config.accessMode === 'public-practice') {
      document.querySelector('#treasury-title').textContent = 'Your account.';
      document.querySelector('.treasury-label').textContent = 'Practice / no real prize';
      document.querySelector('.treasury-intro').textContent = 'Sign in to challenge the guardians. Each reply has a receipt. Deposits and payouts are disabled.';
      document.querySelector('#use-test-credits').checked = false;
      document.querySelector('#practice-footer').textContent = 'Practice / No real prize';
      if (config.closedBeta && !config.publicAdmission) {
        document.querySelector('#practice-footer').textContent = 'Closed beta / No cash prize';
        document.querySelector('.treasury-intro').textContent = 'Sign in and enter your invitation to challenge the AI guardians. Your account shows your access and daily allowance.';
        document.querySelector('.treasury-section:has(#account-status) > h3').textContent = 'Your beta access';
        document.querySelector('#account-mode-note').textContent = config.webFundingEnabled
          ? 'Testnet only. Tokens have no cash value. Link a wallet to test credits and the bounty.'
          : 'Practice beta. Linking a wallet is optional. Deposits and cash prizes are disabled.';
      }
      if (config.closedBeta && config.publicAdmission) {
        document.querySelector('#practice-footer').textContent = 'Public beta / rules apply';
        document.querySelector('.treasury-intro').textContent = 'Sign in to challenge the AI guardians. Prices, rules and receipts are public.';
        document.querySelector('#account-mode-note').textContent = config.webFundingEnabled
          ? 'Public beta. Robinhood credits and the bounty are shown with their current status.'
          : 'Public beta preparation. Payments and cash prizes are disabled.';
      }
      const paid = paidBetaAccountCopy(config);
      if (paid) {
        document.querySelector('.treasury-label').textContent = paid.treasuryLabel;
        document.querySelector('.treasury-intro').textContent = paid.treasuryIntro;
        document.querySelector('#practice-footer').textContent = paid.footer;
        document.querySelector('#account-mode-note').textContent = paid.modeNote;
        for (const node of document.querySelectorAll('[data-local-sandbox]')) node.hidden = true;
      }
    }
    return config;
  }).catch(() => ({ configured: false, accessMode: 'unavailable', sandboxEnabled: false }));
