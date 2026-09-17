import { FUNDING_NETWORK, checkedDepositTransaction, checkedPayoutTransaction, resolvePhantomProvider } from '../public/funding-network.js';
import { getAddress } from 'viem';

export function phantomProvider(scope = globalThis) {
  return resolvePhantomProvider(scope);
}
function isUnknownChainError(error) {
  const code = error?.code;
  const message = String(error?.message ?? '');
  return code === 4902 || /unrecognized chain|chain has not been added|4902/i.test(message);
}

function afterTopLayerClears() {
  return new Promise(resolve => {
    const schedule = typeof globalThis.requestAnimationFrame === 'function'
      ? callback => globalThis.requestAnimationFrame(callback)
      : callback => setTimeout(callback, 0);
    schedule(() => schedule(resolve));
  });
}

function switchTimeoutError() {
  return Object.assign(new Error(
    'In Phantom, open Settings → Developer Settings → Testnet Mode, then choose Robinhood Chain Testnet. Close the failed wallet request and review this top-up again.'
  ), { code: 'VAULT_WALLET_NOT_SENT' });
}

async function requestWallet(provider, payload, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return provider.request(payload);
  let timer;
  try {
    return await Promise.race([
      provider.request(payload),
      new Promise((_, reject) => { timer = setTimeout(() => reject(switchTimeoutError()), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

export async function yieldOpenPageModals(run, root = globalThis.document) {
  const dialogs = root?.querySelectorAll?.('dialog[open]');
  const open = dialogs ? [...dialogs] : [];
  for (const dialog of open) dialog.close();
  await afterTopLayerClears();
  try {
    return await run();
  } finally {
    for (const dialog of open) {
      if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    }
  }
}

export async function selectFundingNetwork(provider, { timeoutMs = 8000 } = {}) {
  const current = await provider.request({ method: 'eth_chainId' });
  if (BigInt(current) === BigInt(FUNDING_NETWORK.chainId)) return;
  const switchToTestnet = () => requestWallet(provider, {
    method: 'wallet_switchEthereumChain', params: [{ chainId: FUNDING_NETWORK.hexId }]
  }, timeoutMs);
  try {
    await switchToTestnet();
  } catch (error) {
    if (error?.code === 'VAULT_WALLET_NOT_SENT') throw error;
    if (!isUnknownChainError(error)) throw error;
    await requestWallet(provider, {
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: FUNDING_NETWORK.hexId,
        chainName: FUNDING_NETWORK.name,
        nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency },
        rpcUrls: [FUNDING_NETWORK.rpcUrl],
        blockExplorerUrls: [FUNDING_NETWORK.explorerUrl]
      }]
    }, timeoutMs);
    await switchToTestnet();
  }
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (BigInt(chainId) !== BigInt(FUNDING_NETWORK.chainId)) throw new Error('Select Robinhood Chain Testnet in your wallet.');
}
export async function linkPhantom(privy, provider = phantomProvider(), onProgress = () => {}) {
  const { user } = await privy.user.get();
  if (!user) throw new Error('Sign in before linking Phantom.');
  const addresses = await provider.request({ method: 'eth_requestAccounts' });
  const rawAddress = addresses?.[0];
  if (typeof rawAddress !== 'string' || !/^0x[0-9a-f]{40}$/i.test(rawAddress)) throw new Error('Phantom did not return an Ethereum address.');
  // Privy core embeds the address verbatim. EIP-4361 requires the EIP-55
  // checksum, even when eth_requestAccounts returns all lowercase.
  const address = getAddress(rawAddress);
  // SIWE identifies this EVM address; it does not authorize a deposit. Use the
  // wallet's current chain so linking never requires enabling testnet mode.
  const currentChain = await provider.request({ method: 'eth_chainId' });
  if (typeof currentChain !== 'string' || !/^0x[0-9a-f]{1,16}$/i.test(currentChain) || BigInt(currentChain) <= 0n) throw new Error('Phantom did not return a valid EVM network.');
  const wallet = { address, chainId: 'eip155:' + BigInt(currentChain).toString(), walletClientType: 'phantom', connectorType: 'injected' };
  const { message } = await privy.auth.siwe.init(wallet, window.location.host, window.location.origin);
  const beforeSign = await provider.request({ method: 'eth_accounts' });
  const chainBeforeSign = await provider.request({ method: 'eth_chainId' });
  if (beforeSign?.[0]?.toLowerCase() !== address.toLowerCase() || BigInt(chainBeforeSign) !== BigInt(currentChain)) throw new Error('Your Phantom account or network changed. Connect again with the same account selected.');
  onProgress({ address, chainId: BigInt(currentChain).toString() });
  const encoded = '0x' + Array.from(new TextEncoder().encode(message), byte => byte.toString(16).padStart(2, '0')).join('');
  let signature;
  try { signature = await provider.request({ method: 'personal_sign', params: [encoded, address] }); }
  catch (error) {
    if (/address.*(not match|mismatch)/i.test(error.message || '')) throw new Error(`Phantom could not match ${address} to the selected account (chain ${BigInt(currentChain)}). Select that same EVM account in Phantom, then reconnect. No wallet was linked.`);
    throw error;
  }
  const accounts = await provider.request({ method: 'eth_accounts' });
  const latest = await privy.user.get();
  if (latest.user?.id !== user.id || accounts?.[0]?.toLowerCase() !== address.toLowerCase()) throw new Error('Your account or wallet changed during linking. Start again.');
  return privy.auth.siwe.linkWithSiwe(signature, wallet, message);
}
export async function sendPhantomDeposit(prepared, provider, options = {}) {
  let tx, dispatched = false;
  try {
    provider ??= phantomProvider();
    tx = checkedDepositTransaction(prepared);
    dispatched = true;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts?.[0]?.toLowerCase() !== tx.from.toLowerCase()) throw new Error(`Select the Phantom account ending in ${tx.from.slice(-6)}, then review the same top-up again.`);
    await selectFundingNetwork(provider, options);
    const current = await provider.request({ method: 'eth_accounts' });
    if (current?.[0]?.toLowerCase() !== tx.from.toLowerCase()) throw new Error('Your Phantom account changed. Review the top-up again.');
    tx = checkedDepositTransaction(prepared);
  } catch (error) {
    const missing = error?.dispatched === false || !dispatched;
    const message = !missing && /not connected to the requested chain|Testnet Mode/i.test(error.message ?? '')
      ? 'In Phantom, open Settings → Developer Settings → Testnet Mode, then choose Robinhood Chain Testnet. Close the failed wallet request and review this top-up again.'
      : error.message;
    throw Object.assign(new Error(message), { code: 'VAULT_WALLET_NOT_SENT', dispatched: !missing });
  }
  return provider.request({ method: 'eth_sendTransaction', params: [tx] });
}
export async function sendPhantomPayout(prepared, provider, options = {}) {
  let tx, dispatched = false;
  try {
    provider ??= phantomProvider();
    tx = checkedPayoutTransaction(prepared);
    dispatched = true;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts?.[0]?.toLowerCase() !== tx.from.toLowerCase()) throw new Error(`Select the Phantom treasury account ending in ${tx.from.slice(-6)}, then review the prize transfer again.`);
    await selectFundingNetwork(provider, options);
    const current = await provider.request({ method: 'eth_accounts' });
    if (current?.[0]?.toLowerCase() !== tx.from.toLowerCase()) throw new Error('Your Phantom account changed. Review the prize transfer again.');
    tx = checkedPayoutTransaction(prepared);
  } catch (error) {
    const missing = error?.dispatched === false || !dispatched;
    const message = !missing && /not connected to the requested chain|Testnet Mode/i.test(error.message ?? '')
      ? 'In Phantom, open Settings → Developer Settings → Testnet Mode, then choose Robinhood Chain Testnet. Close the failed wallet request and review this prize transfer again.'
      : error.message;
    throw Object.assign(new Error(message), { code: 'VAULT_WALLET_NOT_SENT', dispatched: !missing });
  }
  return provider.request({ method: 'eth_sendTransaction', params: [tx] });
}
