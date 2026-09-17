import { FUNDING_NETWORK, resolvePhantomProvider, checkedDepositTransaction, checkedPayoutTransaction, PHANTOM_NOT_DISPATCHED } from './funding-network.js';

export const PROVING_ROUND_BUTTON = 'Send 1 AMZN to treasury';
export const PROVING_CLAIM_BUTTON = 'Send prize from treasury';
export const SEND_WITH_PHANTOM_BUTTON = 'Send with Phantom';
export const SIGN_AMZN_BUTTON = 'Sign 5 AMZN with Phantom';
export const ASKING_PHANTOM = 'Asking Phantom…';
export const DEPOSIT_SIGN_PATH = '/sign-deposit';
export const DEPOSIT_SIGN_BUILD = 'phantom-sign-6';
export const DEPOSIT_SIGN_STORAGE = 'vault-deposit-sign';
export const DEPOSIT_SIGN_RESULT = 'vault-deposit-sign-result';
const PROVING_AMZN = '0x5884ad2f920c162cfbbacc88c9c51aa75ec09e02';
const PROVING_TREASURY = '0xbec4fdb33ed39844956d9078fd232aca92d7396d';
const PROVING_X402 = '0xf670531e46ba92f49c5d9c11d2c03875cffe7d40';
const PROVING_LAPTOP = '0xf2824a8042e3597afe5a9d420bd69445e80e0c8f';
const PROVING_AMOUNT = 10n ** 18n;
const HISTORICAL_AMZN = 10n ** 17n;
const FORBIDDEN_PAY_FROM = new Set([PROVING_TREASURY, PROVING_X402, PROVING_LAPTOP]);

function eoa(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value.trim()) && !/^0x0{40}$/i.test(value)
    ? value.trim() : null;
}

function assertProvingRoundAsset(config) {
  const asset = config?.asset ?? {};
  if (!config?.localOperatorObserve) throw new Error('Proving-round send is only for local paid-beta:testnet.');
  if (config.environment !== 'testnet' || config.realFundsEnabled !== false) throw new Error('Proving-round send is only for Robinhood testnet.');
  if (String(asset.chainId) !== FUNDING_NETWORK.chainId || Number(asset.decimals) !== 18) throw new Error('Proving-round send requires Robinhood Chain Testnet AMZN.');
  if (typeof asset.tokenAddress !== 'string' || asset.tokenAddress.toLowerCase() !== PROVING_AMZN) throw new Error('Proving-round send requires the testnet AMZN token.');
  if (typeof asset.destination !== 'string' || asset.destination.toLowerCase() !== PROVING_TREASURY) throw new Error('Proving-round send requires the disclosed treasury.');
  return asset;
}

function transferData(to, amount) {
  return '0xa9059cbb' + to.slice(2).toLowerCase().padStart(64, '0') + amount.toString(16).padStart(64, '0');
}

export function provingRoundTransfer(config, from) {
  assertProvingRoundAsset(config);
  const sender = eoa(from);
  if (!sender || sender.toLowerCase() === PROVING_TREASURY || sender.toLowerCase() === PROVING_X402) {
    throw new Error('Select the Phantom account that holds test AMZN. Do not sign as treasury or the x402 operating box.');
  }
  return {
    from: sender,
    to: PROVING_AMZN,
    value: '0x0',
    chainId: FUNDING_NETWORK.hexId,
    data: transferData(PROVING_TREASURY, PROVING_AMOUNT)
  };
}

export function provingRoundClaimTransfer(config, round, from) {
  assertProvingRoundAsset(config);
  const sender = eoa(from);
  if (!sender || sender.toLowerCase() !== PROVING_TREASURY) {
    throw new Error('Connect the disclosed treasury in Phantom. Do not sign as the player or the x402 operating box.');
  }
  if (!round || round.state !== 'won') throw new Error('No recorded prize yet. A fresh 1 AMZN win records payable.');
  let amount;
  try { amount = BigInt(round.prizePayable); } catch { amount = 0n; }
  if (amount <= 0n) throw new Error('No recorded prize yet. A fresh 1 AMZN win records payable.');
  if (amount === HISTORICAL_AMZN) throw new Error('Historical 0.1 AMZN cannot be claimed as a prize.');
  const recipient = eoa(round.prizeRecipient);
  if (!recipient || recipient.toLowerCase() === PROVING_TREASURY || recipient.toLowerCase() === PROVING_X402) {
    throw new Error('Prize recipient must be the frozen winner wallet, not treasury or the x402 operating box.');
  }
  return {
    from: PROVING_TREASURY,
    to: PROVING_AMZN,
    value: '0x0',
    chainId: FUNDING_NETWORK.hexId,
    data: transferData(recipient, amount)
  };
}

export function injectedPhantom(root = globalThis) {
  return resolvePhantomProvider(root);
}

export function demoteFundingDialog(root = globalThis.document) {
  const info = root?.querySelector?.('#info-dialog');
  const seen = [];
  if (info) seen.push(info);
  if (typeof root?.querySelectorAll === 'function') {
    for (const dialog of root.querySelectorAll('dialog')) {
      if (!seen.includes(dialog)) seen.push(dialog);
    }
  }
  let changed = false;
  for (const dialog of seen) {
    if (!dialog?.open) continue;
    const modal = typeof dialog.matches === 'function' ? dialog.matches(':modal') : dialog.showModal;
    if (!modal) continue;
    dialog.close();
    if (dialog === info && typeof dialog.show === 'function') dialog.show();
    changed = true;
  }
  return changed;
}

function walletHashOrNotSent(pending, message) {
  return Promise.resolve(pending).then(hash => {
    if (typeof hash === 'string' && /^0x[0-9a-f]{64}$/i.test(hash)) return hash;
    throw Object.assign(new Error(message), { code: 'VAULT_WALLET_NOT_SENT' });
  });
}

export function requestReviewedDeposit(prepared, provider = injectedPhantom()) {
  /* phantom-sign-6: same-click eth_sendTransaction, no fetch or chain switch here */
  const tx = checkedDepositTransaction(prepared);
  return walletHashOrNotSent(
    provider.request({ method: 'eth_sendTransaction', params: [tx] }),
    'Phantom did not open a signature. In Phantom, open Settings → Developer Settings → Testnet Mode, then choose Robinhood Chain Testnet. Click Review top-up once, then Send with Phantom.'
  );
}

export function requestReviewedPayout(prepared, provider = injectedPhantom()) {
  const tx = checkedPayoutTransaction(prepared);
  return walletHashOrNotSent(
    provider.request({ method: 'eth_sendTransaction', params: [tx] }),
    'Phantom did not open a prize signature. Connect the disclosed treasury in Phantom on Robinhood Chain Testnet, click Review prize transfer, then Confirm prize transfer once.'
  );
}

export function depositSignUrl() {
  return `${DEPOSIT_SIGN_PATH}?v=${DEPOSIT_SIGN_BUILD}`;
}

export function stashReviewedDeposit(prepared, storage = globalThis.localStorage) {
  const tx = checkedDepositTransaction(prepared);
  storage.setItem(DEPOSIT_SIGN_STORAGE, JSON.stringify({ prepared, tx, stashedAt: Date.now() }));
  return tx;
}

export function readStashedDeposit(storage = globalThis.localStorage) {
  const raw = storage?.getItem?.(DEPOSIT_SIGN_STORAGE);
  if (!raw) {
    throw Object.assign(new Error('No reviewed top-up is waiting. Return to Play, click Review top-up, then Send with Phantom.'), {
      code: 'VAULT_WALLET_NOT_SENT', dispatched: false
    });
  }
  const parsed = JSON.parse(raw);
  checkedDepositTransaction(parsed.prepared);
  return parsed;
}

export function signStashedDeposit(provider, storage = globalThis.localStorage) {
  const stashed = readStashedDeposit(storage);
  if (!provider || typeof provider.request !== 'function') {
    throw Object.assign(new Error(PHANTOM_NOT_DISPATCHED), { code: 'VAULT_WALLET_NOT_SENT', dispatched: false });
  }
  return walletHashOrNotSent(
    provider.request({ method: 'eth_sendTransaction', params: [stashed.tx] }),
    'Phantom returned no hash. Enable Phantom for this site (not Brave Wallet). You should see a Phantom popup or the Brave toolbar.'
  );
}

export function recordSignedDepositHash(hash, storage = globalThis.localStorage) {
  storage.setItem(DEPOSIT_SIGN_RESULT, JSON.stringify({ hash, at: Date.now() }));
  return hash;
}

export function consumeSignedDepositHash(storage = globalThis.localStorage) {
  const raw = storage?.getItem?.(DEPOSIT_SIGN_RESULT);
  if (!raw) return null;
  storage.removeItem(DEPOSIT_SIGN_RESULT);
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.hash === 'string' && /^0x[0-9a-f]{64}$/i.test(parsed.hash) ? parsed.hash : null;
  } catch { return null; }
}

export function walletPromptError(error) {
  if (error?.code === 4001) return 'You rejected the request in Phantom. Click Sign 5 AMZN with Phantom again.';
  if (error?.dispatched === false) return error.message || PHANTOM_NOT_DISPATCHED;
  if (error?.code === 'VAULT_WALLET_NOT_SENT') return error.message || 'Phantom did not open a signature.';
  return error?.message || 'Phantom returned nothing. Enable Phantom for this site (not Brave Wallet) and click Sign 5 AMZN with Phantom again.';
}

export function openDepositSignSurface(root = globalThis) {
  const url = depositSignUrl();
  const opener = typeof root.open === 'function' ? root : root.window;
  const popup = typeof opener?.open === 'function' ? opener.open(url, 'vault-sign-deposit', 'popup=yes,width=520,height=760') : null;
  if (popup) return { kind: 'popup', handle: popup };
  const location = root.location ?? root.window?.location;
  if (location && typeof location.assign === 'function') location.assign(url);
  return { kind: 'page' };
}

function isUnknownChainError(error) {
  const code = error?.code;
  const message = String(error?.message ?? '');
  return code === 4902 || /unrecognized chain|chain has not been added|4902/i.test(message);
}

export async function ensureRobinhoodTestnet(provider = injectedPhantom(), { timeoutMs = 8000 } = {}) {
  if (!provider || typeof provider.request !== 'function') {
    throw Object.assign(new Error(PHANTOM_NOT_DISPATCHED), { code: 'VAULT_WALLET_NOT_SENT', dispatched: false });
  }
  const switchTimeout = Object.assign(new Error(
    'In Phantom, open Settings → Developer Settings → Testnet Mode, then choose Robinhood Chain Testnet. Close the failed wallet request and click Review top-up again.'
  ), { code: 'VAULT_WALLET_NOT_SENT' });
  const requestWallet = async payload => {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return provider.request(payload);
    let timer;
    try {
      return await Promise.race([
        provider.request(payload),
        new Promise((_, reject) => { timer = setTimeout(() => reject(switchTimeout), timeoutMs); })
      ]);
    } finally { clearTimeout(timer); }
  };
  try {
    const current = await provider.request({ method: 'eth_chainId' });
    if (BigInt(current) === BigInt(FUNDING_NETWORK.chainId)) return;
    const switchToTestnet = () => requestWallet({
      method: 'wallet_switchEthereumChain', params: [{ chainId: FUNDING_NETWORK.hexId }]
    });
    try {
      await switchToTestnet();
    } catch (error) {
      if (error?.code === 'VAULT_WALLET_NOT_SENT') throw error;
      if (!isUnknownChainError(error)) throw switchTimeout;
      await requestWallet({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: FUNDING_NETWORK.hexId,
          chainName: FUNDING_NETWORK.name,
          nativeCurrency: { ...FUNDING_NETWORK.nativeCurrency },
          rpcUrls: [FUNDING_NETWORK.rpcUrl],
          blockExplorerUrls: [FUNDING_NETWORK.explorerUrl]
        }]
      });
      await switchToTestnet();
    }
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (BigInt(chainId) !== BigInt(FUNDING_NETWORK.chainId)) throw switchTimeout;
  } catch (error) {
    if (error?.code === 'VAULT_WALLET_NOT_SENT') throw error;
    throw Object.assign(new Error(error.message || switchTimeout.message), { code: 'VAULT_WALLET_NOT_SENT' });
  }
}

async function readAmznBalanceOf(tokenAddress, holder, fetchImpl) {
  const data = '0x70a08231' + holder.slice(2).toLowerCase().padStart(64, '0');
  const response = await fetchImpl(FUNDING_NETWORK.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: tokenAddress, data }, 'latest'] })
  });
  const payload = await response.json();
  try { return BigInt(payload.result); } catch { return 0n; }
}

export async function readLinkedAmznBalances(wallets, { tokenAddress = PROVING_AMZN, fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  const token = String(tokenAddress).toLowerCase();
  const ethereum = (wallets ?? []).filter(wallet => wallet?.chainType === 'ethereum' && eoa(wallet.address));
  const entries = await Promise.all(ethereum.map(async wallet => {
    const have = await readAmznBalanceOf(token, wallet.address, fetchImpl);
    return [wallet.address.toLowerCase(), have];
  }));
  return Object.fromEntries(entries);
}

export function payFromWalletLabel(wallet, balance, { decimals = 18 } = {}) {
  const kind = wallet?.kind === 'embedded' ? 'Privy' : 'External wallet';
  const address = wallet?.address ?? '';
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;
  if (balance == null) return `${kind} · ${short}`;
  return `${kind} · ${short} · ${displayTokens(balance.toString(), decimals)} AMZN`;
}

export function defaultPayFromAddress(wallets = [], balances = {}, needed = 0n) {
  const need = BigInt(needed);
  const list = (wallets ?? []).filter(wallet => wallet?.chainType === 'ethereum' && eoa(wallet.address));
  const eligible = list.filter(wallet => !FORBIDDEN_PAY_FROM.has(wallet.address.toLowerCase()));
  const have = address => {
    const raw = balances[address.toLowerCase()] ?? balances[address];
    try { return BigInt(raw ?? 0); } catch { return 0n; }
  };
  const funded = eligible.find(wallet => have(wallet.address) >= need);
  if (funded) return funded.address;
  return (eligible.find(wallet => wallet.kind === 'external') ?? eligible[0] ?? list[0])?.address ?? null;
}

export function payFromShortageCopy({ needed = '5', faucetUrl = FUNDING_NETWORK.faucetUrl } = {}) {
  return `None of the linked wallets have ${needed} AMZN. Open ${faucetUrl}, request Robinhood Chain Testnet AMZN to a Phantom account, then pick that wallet in Pay from.`;
}

export async function assertReviewedAmznBalance(prepared, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  const tx = checkedDepositTransaction(prepared);
  const needed = BigInt(prepared.order.minimumReceived);
  const decimals = Number.isInteger(prepared.order.asset?.decimals) ? prepared.order.asset.decimals : 18;
  const have = await readAmznBalanceOf(tx.to, tx.from, fetchImpl);
  if (have < needed) {
    throw Object.assign(new Error(
      `Pay-from ${tx.from} has ${displayTokens(have.toString(), decimals)} AMZN. This top-up needs ${displayTokens(needed.toString(), decimals)} AMZN. Open ${FUNDING_NETWORK.faucetUrl}, request Robinhood Chain Testnet AMZN to that address, then Review top-up again.`
    ), { code: 'VAULT_INSUFFICIENT_TEST_AMZN' });
  }
}

async function phantomTestnetSender(provider) {
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Open this site in the Phantom mobile browser, or install the Phantom extension. Enable Robinhood Chain Testnet in Phantom settings.');
  }
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const from = eoa(Array.isArray(accounts) ? accounts[0] : null);
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: FUNDING_NETWORK.hexId }] });
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (BigInt(chainId) !== BigInt(FUNDING_NETWORK.chainId)) throw new Error('Select Robinhood Chain Testnet in your wallet.');
  const current = await provider.request({ method: 'eth_accounts' });
  const sender = eoa(Array.isArray(current) ? current[0] : null);
  if (!from || !sender || sender.toLowerCase() !== from.toLowerCase()) throw new Error('Your Phantom account changed.');
  return sender;
}

function phantomSwitchError(error, retry) {
  const message = /testnet|not connected to the requested chain/i.test(error.message ?? '')
    ? `In Phantom, open Settings → Developer Settings → Testnet Mode, then choose Robinhood Chain Testnet. Close the failed wallet request and ${retry}.`
    : error.message;
  return Object.assign(new Error(message), { code: 'VAULT_WALLET_NOT_SENT' });
}

export async function sendProvingRoundTransfer(provider, config) {
  let tx;
  try {
    tx = provingRoundTransfer(config, await phantomTestnetSender(provider));
  } catch (error) {
    throw phantomSwitchError(error, 'send 1 AMZN again');
  }
  return provider.request({ method: 'eth_sendTransaction', params: [tx] });
}

export async function sendProvingRoundClaim(provider, config, round) {
  let tx;
  try {
    tx = provingRoundClaimTransfer(config, round, await phantomTestnetSender(provider));
  } catch (error) {
    throw phantomSwitchError(error, 'send the prize again');
  }
  return provider.request({ method: 'eth_sendTransaction', params: [tx] });
}

export async function recordProvingRoundClaim(round, transactionHash, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  if (!round?.id) throw new Error('Missing recorded prize round.');
  if (!/^0x[0-9a-f]{64}$/i.test(transactionHash)) throw new Error('Enter a valid transaction hash.');
  const headers = { ...localOperatorHeaders(PROVING_TREASURY), 'Content-Type': 'application/json', Accept: 'application/json' };
  const submit = await fetchImpl(`/api/funding/claims/${round.id}/submit`, {
    method: 'POST', headers, body: JSON.stringify({ transactionHash }), signal: AbortSignal.timeout(15000)
  });
  const submitted = await submit.json();
  if (!submit.ok) {
    throw Object.assign(new Error(submitted.error?.message || 'Could not record the prize hash.'), submitted, { code: submitted.error?.code });
  }
  const check = await fetchImpl(`/api/funding/claims/${round.id}/check`, {
    method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15000)
  });
  const checked = await check.json();
  if (!check.ok) {
    throw Object.assign(new Error(checked.error?.message || 'Prize hash is saved. Wait for confirmations; do not send again.'), checked, { code: checked.error?.code });
  }
  return checked;
}

export function tokenAmount(value, decimals) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value.trim()) || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Enter a token amount using digits and a decimal point.');
  const [whole, fraction = ''] = value.trim().split('.');
  if (fraction.length > decimals) throw new Error('Too many decimal places for this token.');
  const units = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (units <= 0n || units >= 2n ** 256n) throw new Error('Enter a positive token amount.');
  return String(units);
}
export const LOCAL_OPERATOR_HEADER = 'x-vault-local-operator-wallet';

function localOperatorAddress(value) {
  const address = eoa(value);
  return address ? address.toLowerCase() : null;
}

export function localOperatorHeaders(wallet) {
  const address = localOperatorAddress(wallet);
  return address ? { [LOCAL_OPERATOR_HEADER]: address } : {};
}

export async function readLocalOperatorWallet(provider) {
  if (!provider || typeof provider.request !== 'function') return null;
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return localOperatorAddress(Array.isArray(accounts) ? accounts[0] : null);
  } catch {
    return null;
  }
}

export async function requestLocalOperatorWallet(provider) {
  if (!provider || typeof provider.request !== 'function') return null;
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return localOperatorAddress(Array.isArray(accounts) ? accounts[0] : null);
  } catch {
    return null;
  }
}

export function displayTokens(value, decimals) {
  const digits = BigInt(value).toString().padStart(decimals + 1, '0');
  if (!decimals) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

export function pendingTopupUi({ record = null, order = null, transfer = null, now = Date.now() } = {}) {
  const hasHash = Boolean(record?.hash || order?.submittedTransactionHash || order?.transactionHash);
  const credited = Boolean(order?.credited);
  const expired = Number.isSafeInteger(order?.expiresAt) && now >= order.expiresAt;
  const signingUnknown = record?.state === 'signing-unknown' && !hasHash;
  const prepared = record?.state === 'prepared' && !record?.hash;
  const transferOk = !transfer || transfer.signingEnabled === true;
  const orderStillOpen = !order || (Number.isSafeInteger(order.expiresAt) && now < order.expiresAt);
  const canSign = prepared && !credited && !hasHash && !expired && transferOk && orderStillOpen;
  const kind = credited ? 'credited'
    : hasHash ? 'recover-hash'
    : expired ? 'expired-review'
    : canSign ? 'ready-to-sign'
    : signingUnknown ? 'unsigned-interrupted'
    : record && record.state !== 'complete' ? 'pending'
    : 'idle';
  return {
    confirmVisible: canSign,
    acknowledgeVisible: signingUnknown && !credited,
    recoverOpen: hasHash && !credited,
    kind
  };
}

export function pendingTopupStatusCopy(ui, { amount, owner, destination } = {}) {
  switch (ui?.kind) {
    case 'ready-to-sign':
      return amount && owner && destination
        ? `Review ${amount} test tokens from ${owner} to ${destination}. Gas is additional. Click Send with Phantom once — Asking Phantom, a Phantom popup or Brave toolbar prompt should open immediately.`
        : 'This top-up is ready to sign. Click Send with Phantom once. Asking Phantom should open immediately.';
    case 'unsigned-interrupted':
      return 'No transaction hash was recorded. Click Send with Phantom again — a Phantom popup or Brave toolbar prompt should open.';
    case 'expired-review':
      return 'This order expired. If you never signed it, use Review top-up to prepare another.';
    case 'recover-hash':
      return 'A transfer may have been sent. Recover it with the transaction hash before starting another.';
    case 'credited':
      return 'Top-up credited. Refresh balances to see your available credit.';
    case 'pending':
      return 'Top-up remains pending. Check the same order again.';
    default:
      return '';
  }
}

export function topupErrorFollowup(error, record) {
  if (error?.dispatched === false) return ' Phantom never received a request.';
  if (error?.code === 'VAULT_WALLET_NOT_SENT') return ' No transfer was requested.';
  if (error?.code === 4001) return ' The wallet request was cancelled.';
  if (record?.hash) return ' If a transfer may have been sent, recover it below. Do not send it again.';
  if (record?.state === 'signing-unknown' && !record.hash) {
    return ' Click Send with Phantom again to open the wallet prompt.';
  }
  return '';
}

// Persist before wallet submission. An interrupted send is never retried blindly.
export function createTopupController({ api, storage, storageKey, send, uuid = () => crypto.randomUUID(), onProgress = () => {}, locks } = {}) {
  const read = () => JSON.parse(storage.getItem(storageKey) || 'null');
  const save = value => { storage.setItem(storageKey, JSON.stringify(value)); return value; };
  let busy = false;
  const runLocked = async work => {
    try {
      const webLocks = locks ?? (typeof window !== 'undefined' ? globalThis.navigator?.locks : undefined);
      if (webLocks?.request) {
        return await webLocks.request('vault-topup:' + storageKey, { mode: 'exclusive', ifAvailable: true }, lock => {
          if (!lock) throw new Error('A top-up is already waiting. Close Phantom if it is hidden, hard-refresh this page, then click Review top-up once.');
          return work();
        });
      }
      if (typeof window !== 'undefined') throw new Error('This browser cannot safely coordinate wallet requests across tabs. Use a browser with Web Locks support.');
      return await work();
    } finally { busy = false; }
  };
  const exclusive = async work => {
    if (busy) throw new Error('A top-up operation is already running.');
    busy = true;
    return runLocked(work);
  };
  function reviveUnsignedPrepared() {
    const record = read();
    if (record?.state !== 'signing-unknown' || record.hash || !record.prepared) return false;
    const order = record.prepared.order;
    if (!record.prepared.transfer?.signingEnabled || order?.credited || order?.submittedTransactionHash
      || order?.transactionHash || !Number.isSafeInteger(order?.expiresAt) || Date.now() >= order.expiresAt) {
      return false;
    }
    save({ ...record, state: 'prepared' });
    return true;
  }
  function releaseHungSend() {
    busy = false;
    return reviveUnsignedPrepared();
  }
  function cachePrepared(record, prepared) {
    return save({ ...record, orderId: prepared.order.id, prepared, state: 'prepared' });
  }
  function reviewedPrepared(record) {
    if (!record || record.state !== 'prepared' || !record.prepared) {
      throw new Error('Review this top-up again, then click Confirm testnet transfer once.');
    }
    const prepared = record.prepared;
    const order = prepared.order;
    if (!prepared.transfer?.signingEnabled || order.credited || record.hash || order.submittedTransactionHash || order.transactionHash
      || !Number.isSafeInteger(order.expiresAt) || Date.now() >= order.expiresAt) {
      throw new Error('This top-up can no longer be signed. Review its status before continuing.');
    }
    return prepared;
  }
  async function submit(record) {
    onProgress('confirmations');
    await api(`/api/funding/deposits/${record.orderId}/submit`, { transactionHash: record.hash });
    save({ ...record, state: 'submitted' });
    const result = await api(`/api/funding/deposits/${record.orderId}/check`, {});
    if (result.order.credited) save({ ...record, state: 'complete' });
    return result;
  }
  return {
    read,
    readyToSend: () => {
      try { reviewedPrepared(read()); return true; }
      catch { return false; }
    },
    prepare: input => exclusive(async () => {
      onProgress('review');
      reviveUnsignedPrepared();
      let record = read();
      if (record && record.state !== 'complete') {
        if (record.state === 'signing-unknown' && !record.hash) {
          if (record.orderId) {
            const result = await api(`/api/funding/deposits/${record.orderId}`);
            const order = result.order;
            const unsignedExpired = !order.submittedTransactionHash && !order.transactionHash
              && Number.isSafeInteger(order.expiresAt) && Date.now() >= order.expiresAt;
            if (order.credited || order.submittedTransactionHash || order.transactionHash) {
              throw new Error('Recover the existing top-up before starting another.');
            }
            if (unsignedExpired) {
              save({ ...record, state: 'complete' });
              record = save({ key: uuid(), input, state: 'preparing' });
              const prepared = await api('/api/funding/deposits', { ...record.input, key: record.key });
              cachePrepared(record, prepared);
              return prepared;
            }
          }
          throw new Error('The previous wallet request finished without a hash. If you did not sign, use I did not sign a transfer, then Confirm.');
        }
        const sameInput = JSON.stringify(record.input) === JSON.stringify(input);
        const unsignedLeftover = ['preparing', 'prepared'].includes(record.state) && !record.hash;
        const leftoverWallet = String(record.input?.wallet ?? '').toLowerCase();
        const nextWallet = String(input?.wallet ?? '').toLowerCase();
        const walletChanged = Boolean(leftoverWallet && nextWallet && leftoverWallet !== nextWallet);
        if (!['preparing', 'prepared'].includes(record.state) || (!sameInput && !(unsignedLeftover && walletChanged))) {
          throw new Error('Recover the existing top-up before starting another.');
        }
        if (unsignedLeftover && walletChanged && !sameInput) {
          if (record.orderId) {
            const result = await api(`/api/funding/deposits/${record.orderId}`);
            const order = result.order;
            if (order.credited || order.submittedTransactionHash || order.transactionHash) {
              throw new Error('Recover the existing top-up before starting another.');
            }
            save({ ...record, state: 'complete' });
          }
          record = save({ key: uuid(), input, state: 'preparing' });
          const prepared = await api('/api/funding/deposits', { ...record.input, key: record.key });
          cachePrepared(record, prepared);
          return prepared;
        }
        if (record.state === 'prepared') {
          const result = await api(`/api/funding/deposits/${record.orderId}`);
          const order = result.order;
          const unsignedExpired = !record.hash && !order.submittedTransactionHash && !order.transactionHash
            && Number.isSafeInteger(order.expiresAt) && Date.now() >= order.expiresAt;
          if (order.credited || unsignedExpired) save({ ...record, state: 'complete' });
          if (unsignedExpired && !order.credited) {
            record = save({ key: uuid(), input, state: 'preparing' });
            const prepared = await api('/api/funding/deposits', { ...record.input, key: record.key });
            cachePrepared(record, prepared);
            return prepared;
          }
          if (order.credited) return result;
          cachePrepared(record, result);
          return result;
        }
      } else record = save({ key: uuid(), input, state: 'preparing' });
      const prepared = await api('/api/funding/deposits', { ...record.input, key: record.key });
      cachePrepared(record, prepared);
      return prepared;
    }),
    releaseHungSend,
    armSign: () => {
      releaseHungSend();
      const record = read();
      const prepared = reviewedPrepared(record);
      save({ ...record, state: 'signing-unknown' });
      onProgress('wallet');
      return prepared;
    },
    confirm: () => {
      let sendPromise, record;
      try {
        if (busy) throw new Error('A top-up operation is already running.');
        busy = true;
        record = read();
        const prepared = reviewedPrepared(record);
        save({ ...record, state: 'signing-unknown' });
        onProgress('wallet');
        sendPromise = send(prepared);
      } catch (error) {
        if (record && (error.code === 4001 || error.code === 'VAULT_WALLET_NOT_SENT')) save({ ...record, state: 'prepared' });
        busy = false;
        return Promise.reject(error);
      }
      return (async () => {
        let hash;
        try { hash = await sendPromise; }
        catch (error) {
          // Rejection or our local preflight can establish that no send occurred.
          // Errors after eth_sendTransaction remain uncertain.
          if (error.code === 4001 || error.code === 'VAULT_WALLET_NOT_SENT') save({ ...record, state: 'prepared' });
          throw error;
        } finally { busy = false; }
        if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Wallet submission is uncertain. Recover the transaction hash before continuing.');
        const sent = save({ ...record, hash, state: 'submitted' });
        return exclusive(() => submit(sent));
      })();
    },
    acknowledgeNotSigned: ({ confirmedNoSignature } = {}) => exclusive(async () => {
      const record = read();
      if (confirmedNoSignature !== true || record?.state !== 'signing-unknown' || record.hash) throw new Error('Only confirm this if you did not approve a transfer and no wallet request remains pending.');
      const result = await api(`/api/funding/deposits/${record.orderId}`);
      if (result.order.credited || result.order.submittedTransactionHash || result.order.transactionHash) throw new Error('A transfer is already recorded. Recover that transaction instead.');
      if (!Number.isSafeInteger(result.order.expiresAt)) throw new Error('Could not verify the original order.');
      save({ ...record, userConfirmedNotSigned: true, state: Date.now() > result.order.expiresAt ? 'complete' : 'prepared' });
      return result;
    }),
    recover: hash => exclusive(async () => {
      let record = read();
      if (!record?.orderId) throw new Error('Retry preparing with the original amount and wallet.');
      if (hash) {
        if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Enter a valid transaction hash.');
        record = save({ ...record, hash, state: 'submitted' });
      }
      const result = record.hash ? await submit(record) : await api(`/api/funding/deposits/${record.orderId}`);
      if (result.order.credited) save({ ...record, state: 'complete' });
      else if ((record.state === 'prepared' || record.state === 'signing-unknown') && Date.now() > result.order.expiresAt && !result.order.submittedTransactionHash && !result.order.transactionHash) save({ ...record, state: 'complete' });
      return result;
    })
  };
}

export function unsignedTopupDisclosure(config, { signedIn = false } = {}) {
  const gate = config?.localOperatorObserve
    ? 'Send 1 AMZN to treasury on Robinhood testnet; localhost login optional for this proving round. After the send, refresh /play; proving round will pick up player_rh{your address}.'
    : signedIn
      ? 'Sign in with an active beta invitation first.'
      : 'Sign in, then Connect Phantom. Top up sends test AMZN from that linked wallet. You do not need the CLI faucet address.';
  const asset = config?.asset ?? {};
  const amount = value => displayTokens(value, Number.isInteger(asset.decimals) ? asset.decimals : 18);
  const facts = [
    `${config?.network?.name || 'Robinhood Chain Testnet'} · chain ${asset.chainId}`,
    `AMZN ${asset.tokenAddress}`,
    `Recipient ${asset.destination}`
  ];
  for (const round of config?.rounds ?? []) {
    const split = `${round.prizeBps / 100}% bounty / ${round.operationsBps / 100}% operations / ${round.nextRoundBps / 100}% next round.`;
    facts.push(`${amount(round.price)} AMZN per completed attempt · ${split}`);
  }
  return { gate, facts };
}

export function unsignedClaimDisclosure(config, { signedIn = false } = {}) {
  const gate = config?.localOperatorObserve
    ? 'A recorded win is sent from the disclosed treasury in Phantom on Robinhood testnet. Switch to 0xb626 and sign as treasury. Do not sign as the x402 operating box. Sign-in is optional for this proving round.'
    : signedIn
      ? 'After a win, the player cannot send the prize. Connect the disclosed treasury in Phantom, then Review prize transfer and confirm once. Do not sign as the x402 operating box.'
      : 'A recorded win can be sent from the disclosed treasury in Phantom. Sign in to review. The player wallet cannot pay the prize. Do not sign as the x402 operating box.';
  const asset = config?.asset ?? {};
  const amount = value => displayTokens(value, Number.isInteger(asset.decimals) ? asset.decimals : 18);
  const facts = [
    `${config?.network?.name || 'Robinhood Chain Testnet'} · chain ${asset.chainId}`,
    `AMZN ${asset.tokenAddress}`,
    `Prize from treasury ${asset.destination}`
  ];
  for (const round of config?.rounds ?? []) {
    const retain = Number.isInteger(round.winRetainBps) ? round.winRetainBps : 2500;
    facts.push(`A win pays ${(10000 - retain) / 100}% of that round’s bounty; ${retain / 100}% stays as continuity. No cash prize.`);
    if (round.prizePayable && BigInt(round.prizePayable) > 0n) {
      facts.push(round.prizeRecipient
        ? `Recorded payable ${amount(round.prizePayable)} AMZN to ${round.prizeRecipient}. Send prize from treasury in Phantom.`
        : `Recorded payable ${amount(round.prizePayable)} AMZN · unsigned review only until the treasury wallet signs.`);
    }
  }
  return { gate, facts };
}
