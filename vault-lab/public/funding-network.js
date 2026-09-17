// Network identity shared by the wallet and the server. Testnet only.
export const FUNDING_NETWORK = Object.freeze({
  id: 46630, chainId: '46630', hexId: '0xb626', name: 'Robinhood Chain Testnet',
  rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
  faucetUrl: 'https://faucet.testnet.chain.robinhood.com',
  nativeCurrency: Object.freeze({ name: 'Ether', symbol: 'ETH', decimals: 18 })
});
export const walletChain = () => ({ id: FUNDING_NETWORK.id, name: FUNDING_NETWORK.name, testnet: true,
  nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency }, rpcUrls: { default: { http: [FUNDING_NETWORK.rpcUrl] } },
  blockExplorers: { default: { name: 'Robinhood Testnet Explorer', url: FUNDING_NETWORK.explorerUrl } } });

export const PHANTOM_NOT_DISPATCHED = 'Phantom Ethereum was not found on this page. In Brave, enable the Phantom extension for this site (not Brave Wallet). Phantom never received a request.';

export function phantomBrowseUrl(pageUrl, origin) {
  return `https://phantom.app/ul/browse/${encodeURIComponent(pageUrl)}?ref=${encodeURIComponent(origin)}`;
}

export function chooseCreditPlayModel(catalogModels = [], fundingConfig, creditMode, selectedId) {
  const listed = creditPlayModels(catalogModels, fundingConfig, creditMode);
  if (!listed.length) return null;
  return listed.find(model => model.id === selectedId) ?? listed[0];
}

export function resolvePhantomProvider(scope = globalThis) {
  const root = scope.window ?? scope;
  const usable = provider => provider && typeof provider.request === 'function' && !provider.isBraveWallet;
  const named = root.phantom?.ethereum;
  if (usable(named)) return named;
  const ethereum = root.ethereum;
  const list = Array.isArray(ethereum?.providers) ? ethereum.providers : (ethereum ? [ethereum] : []);
  const phantom = list.find(provider => usable(provider) && provider.isPhantom);
  if (phantom) return phantom;
  throw Object.assign(new Error(PHANTOM_NOT_DISPATCHED), { code: 'VAULT_WALLET_NOT_SENT', dispatched: false });
}

export function checkedDepositTransaction(prepared, now = Date.now()) {
  const order = prepared?.order, tx = prepared?.transfer?.transaction;
  const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
  if (prepared?.environment !== 'testnet' || prepared.realFundsEnabled !== false ||
      !prepared.transfer?.signingEnabled || !tx || tx.chainId !== FUNDING_NETWORK.hexId ||
      order?.asset?.chainId !== FUNDING_NETWORK.chainId || !Number.isSafeInteger(order.expiresAt) || now > order.expiresAt ||
      order.credited || order.submittedTransactionHash || order.transactionHash || tx.value !== '0x0' ||
      !address(tx.from) || !address(tx.to) || !address(order.owner) || !address(order.asset.tokenAddress) || !address(order.asset.destination) ||
      tx.from.toLowerCase() !== order.owner.toLowerCase() || tx.to.toLowerCase() !== order.asset.tokenAddress.toLowerCase() ||
      typeof order.minimumReceived !== 'string' || !/^[1-9][0-9]{0,77}$/.test(order.minimumReceived) || BigInt(order.minimumReceived) >= 2n ** 256n) {
    throw new Error('A current Robinhood testnet deposit order is required.');
  }
  const expected = '0xa9059cbb' + order.asset.destination.slice(2).toLowerCase().padStart(64, '0') + BigInt(order.minimumReceived).toString(16).padStart(64, '0');
  if (tx.data !== expected) throw new Error('The transfer differs from the reviewed amount or destination.');
  return { from: tx.from, to: tx.to, data: tx.data, value: tx.value, chainId: tx.chainId };
}

export function creditPlayModels(catalogModels = [], fundingConfig, creditMode) {
  if (!creditMode) return catalogModels;
  const models = [];
  const seen = new Set();
  for (const round of fundingConfig?.rounds ?? []) {
    if (round.state !== 'open') continue;
    for (const guardian of round.manifest?.manifest?.configuration?.guardians ?? []) {
      const id = guardian?.modelId;
      if (typeof id !== 'string' || !id.includes('/') || seen.has(id)) continue;
      seen.add(id);
      const listed = catalogModels.find(model => model.id === id);
      models.push(listed ?? { id, name: id.split('/')[1] || id, company: id.split('/')[0],
        inputPricePerMillion: null, outputPricePerMillion: null });
    }
  }
  return models;
}

export function checkedPayoutTransaction(prepared) {
  const claim = prepared, tx = prepared?.transfer?.transaction;
  const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
  if (prepared?.environment !== 'testnet' || prepared.realFundsEnabled !== false || prepared.state !== 'won' ||
      !prepared.transfer?.signingEnabled || !tx || tx.chainId !== FUNDING_NETWORK.hexId ||
      claim.asset?.chainId !== FUNDING_NETWORK.chainId || tx.value !== '0x0' ||
      !address(tx.from) || !address(tx.to) || !address(claim.recipient) || !address(claim.treasury) ||
      !address(claim.asset.tokenAddress) || !address(claim.asset.destination) ||
      tx.from.toLowerCase() !== claim.treasury.toLowerCase() || tx.from.toLowerCase() !== claim.asset.destination.toLowerCase() ||
      tx.to.toLowerCase() !== claim.asset.tokenAddress.toLowerCase() ||
      typeof claim.amount !== 'string' || !/^[1-9][0-9]{0,77}$/.test(claim.amount) || BigInt(claim.amount) >= 2n ** 256n) {
    throw new Error('A current Robinhood testnet prize transfer is required.');
  }
  const expected = '0xa9059cbb' + claim.recipient.slice(2).toLowerCase().padStart(64, '0') + BigInt(claim.amount).toString(16).padStart(64, '0');
  if (tx.data !== expected) throw new Error('The prize transfer differs from the recorded payable.');
  return { from: tx.from, to: tx.to, data: tx.data, value: tx.value, chainId: tx.chainId };
}
