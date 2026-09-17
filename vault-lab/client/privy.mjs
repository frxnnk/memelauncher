import Privy, { LocalStorage, getUserEmbeddedEthereumWallet, getUserEmbeddedSolanaWallet, getEntropyDetailsFromUser } from '@privy-io/js-sdk-core';
import { walletChain, checkedDepositTransaction, checkedPayoutTransaction } from '../public/funding-network.js';
import { linkPhantom, sendPhantomDeposit, sendPhantomPayout, selectFundingNetwork, phantomProvider } from './phantom.mjs';

export { sendPhantomDeposit, sendPhantomPayout, phantomProvider };

// Import lazily after /api/auth/config reports a configured application.
export async function createPrivyAccount(config) {
  const privy = new Privy({ appId: config.appId, clientId: config.clientId, storage: new LocalStorage(),
    supportedChains: [walletChain()],
    sessions: { mode: 'single-user', cookieWriteBehavior: 'never' } });
  await privy.initialize();
  const iframe = document.createElement('iframe');
  const frameUrl = new URL(privy.embeddedWallet.getURL());
  if (frameUrl.origin !== 'https://auth.privy.io') throw new Error('Unexpected wallet origin.');
  iframe.title = 'Privy secure wallet'; iframe.hidden = true;
  let dispose;
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Wallet frame did not load. Please try again.')), 15000);
    iframe.onload = () => { clearTimeout(timeout); resolve(); };
    iframe.onerror = () => { clearTimeout(timeout); reject(new Error('Wallet frame could not load.')); };
    dispose = () => clearTimeout(timeout);
  });
  // Observe the frame promise immediately even when account login happens later.
  ready.catch(() => {});
  iframe.src = frameUrl.href; document.body.append(iframe);
  privy.setMessagePoster(iframe.contentWindow);
  const listener = event => {
    if (event.source !== iframe.contentWindow || event.origin !== frameUrl.origin) return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      Promise.resolve(privy.embeddedWallet.onMessage(data)).catch(() => {});
    } catch { /* Ignore malformed frame messages, never evaluate their content. */ }
  };
  window.addEventListener('message', listener);
  return {
    connectPhantom: onProgress => linkPhantom(privy, undefined, onProgress),
    sendCode: email => privy.auth.email.sendCode(email),
    login: (email, code) => privy.auth.email.loginWithCode(email, code),
    async headers() {
      const token = await privy.getAccessToken();
      if (!token) return {};
      const identity = await privy.getIdentityToken();
      return { Authorization: `Bearer ${token}`, ...(identity ? { 'X-Privy-Identity-Token': identity } : {}) };
    },
    async createWallet() {
      await ready;
      const { user } = await privy.user.get();
      if (!user) throw new Error('Sign in before creating a wallet.');
      if (getUserEmbeddedEthereumWallet(user)) return;
      const storageKey = `vault-wallet-creation:${config.appId}:${user.id}`;
      let idempotencyKey = localStorage.getItem(storageKey);
      if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); localStorage.setItem(storageKey, idempotencyKey); }
      await privy.embeddedWallet.create({ idempotencyKey, solanaAccount: getUserEmbeddedSolanaWallet(user) ?? undefined });
    },
    async sendTestnetDeposit(prepared) {
      const tx = checkedDepositTransaction(prepared);
      const { user } = await privy.user.get(), wallet = getUserEmbeddedEthereumWallet(user);
      if (!wallet || wallet.address.toLowerCase() !== tx.from.toLowerCase()) return sendPhantomDeposit(prepared);
      await ready;
      const { entropyId, entropyIdVerifier } = getEntropyDetailsFromUser(user);
      const provider = await privy.embeddedWallet.getEthereumProvider({ wallet, entropyId, entropyIdVerifier });
      await selectFundingNetwork(provider);
      return provider.request({ method: 'eth_sendTransaction', params: [checkedDepositTransaction(prepared)] });
    },
    async sendTestnetPayout(prepared) {
      const tx = checkedPayoutTransaction(prepared);
      const { user } = await privy.user.get(), wallet = getUserEmbeddedEthereumWallet(user);
      if (!wallet || wallet.address.toLowerCase() !== tx.from.toLowerCase()) return sendPhantomPayout(prepared);
      await ready;
      const { entropyId, entropyIdVerifier } = getEntropyDetailsFromUser(user);
      const provider = await privy.embeddedWallet.getEthereumProvider({ wallet, entropyId, entropyIdVerifier });
      await selectFundingNetwork(provider);
      return provider.request({ method: 'eth_sendTransaction', params: [checkedPayoutTransaction(prepared)] });
    },
    async logout() {
      try { await privy.auth.logout(); }
      finally { dispose(); window.removeEventListener('message', listener); iframe.remove(); }
    }
  };
}
