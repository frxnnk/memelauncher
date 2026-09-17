const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) ? value : null;
const chain = value => typeof value === 'string' && /^0x[0-9a-f]{1,16}$/i.test(value) ? BigInt(value).toString() : null;

export function createWalletConnection({ target = window, onChange = () => {} } = {}) {
  const wallets = [];
  let active = null, revision = 0, handlers = null;
  let state = { status: 'disconnected', address: null, chainId: null, walletName: null, error: null };
  const emit = () => onChange({ ...state, wallets: wallets.map(({ id, name }) => ({ id, name })) });
  const detach = () => {
    if (active && handlers) for (const [event, handler] of Object.entries(handlers)) active.provider.removeListener?.(event, handler);
    handlers = null;
  };
  function clear() {
    revision++; detach(); active = null;
    state = { status: 'disconnected', address: null, chainId: null, walletName: null, error: null }; emit();
  }
  function announce(event) {
    const detail = event.detail;
    if (!detail?.provider || typeof detail.provider.request !== 'function' || !detail.info ||
      typeof detail.info.name !== 'string' || !detail.info.name.trim() || wallets.length >= 12 ||
      wallets.some(item => item.provider === detail.provider)) return;
    // Provider-supplied icons/HTML are intentionally not rendered or fetched.
    wallets.push({ id: `wallet-${wallets.length}`, name: detail.info.name.slice(0, 60), provider: detail.provider }); emit();
  }
  target.addEventListener('eip6963:announceProvider', announce);
  target.dispatchEvent(new Event('eip6963:requestProvider'));
  if (target.ethereum && typeof target.ethereum.request === 'function' && !wallets.some(item => item.provider === target.ethereum)) {
    wallets.push({ id: `wallet-${wallets.length}`, name: 'Browser wallet', provider: target.ethereum });
  }
  emit();

  async function connect(walletId) {
    const selected = wallets.find(item => item.id === walletId);
    if (!selected) return;
    clear(); active = selected;
    const current = revision;
    state = { ...state, status: 'connecting', walletName: selected.name }; emit();
    handlers = {
      accountsChanged(accounts) {
        if (current !== revision) return;
        const next = Array.isArray(accounts) ? address(accounts[0]) : null;
        if (!next) { clear(); return; }
        state = { ...state, address: next }; emit();
      },
      chainChanged(value) {
        if (current !== revision) return;
        const next = chain(value);
        if (!next) { clear(); return; }
        state = { ...state, chainId: next }; emit();
      },
      disconnect() { if (current === revision) clear(); }
    };
    for (const [event, handler] of Object.entries(handlers)) selected.provider.on?.(event, handler);
    try {
      // Only an explicit user's Connect action invokes account access. No signing, switching or transfers.
      const accounts = await selected.provider.request({ method: 'eth_requestAccounts' });
      if (current !== revision) return;
      const chainId = await selected.provider.request({ method: 'eth_chainId' });
      if (current !== revision) return;
      const selectedAddress = state.address ?? address(accounts?.[0]), selectedChain = state.chainId ?? chain(chainId);
      if (!selectedAddress || !selectedChain) throw new Error('Invalid wallet response.');
      state = { status: 'connected', address: selectedAddress, chainId: selectedChain, walletName: selected.name, error: null }; emit();
    } catch (error) {
      if (current !== revision) return;
      detach(); active = null;
      state = { status: 'disconnected', address: null, chainId: null, walletName: null,
        error: error?.code === 4001 ? 'Connection declined. No signature or payment was requested.' : 'Could not connect this wallet. You can try again.' }; emit();
    }
  }
  return { connect, disconnect: clear, state: () => ({ ...state }),
    destroy() { clear(); target.removeEventListener('eip6963:announceProvider', announce); } };
}

export function networkLabel(chainId) {
  if (chainId === '4663') return 'Robinhood Chain · mainnet';
  if (chainId === '46630') return 'Robinhood Chain · testnet';
  if (chainId === '1') return 'Ethereum · mainnet';
  return chainId ? `EVM network ${chainId}` : 'Network not connected';
}
