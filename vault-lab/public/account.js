import { accessConfiguration } from './access.js';
import { localOperatorHeaders, readLocalOperatorWallet, requestLocalOperatorWallet, sendProvingRoundTransfer, sendProvingRoundClaim, recordProvingRoundClaim, injectedPhantom, requestReviewedDeposit, requestReviewedPayout, PROVING_ROUND_BUTTON, PROVING_CLAIM_BUTTON } from './funding-client.js';
const $ = selector => document.querySelector(selector);
const phantomButton = $('#account-phantom');
const provingSend = $('#proving-round-send');
const provingClaim = $('#proving-round-claim');
const provingAccountSend = $('#proving-round-account-send');
let config, client, verifiedAccount = null, busy = false, inferenceBusy = false, generation = 0, refreshSequence = 0, localOperatorWallet = null;
const status = message => {
  $('#account-status').textContent = message;
  const provingStatus = $('#proving-round-status');
  if (provingStatus) provingStatus.textContent = message;
};
const announce = () => document.dispatchEvent(new CustomEvent('vault:account-changed', { detail: verifiedAccount }));

export async function accountHeaders() {
  if (config?.localOperatorObserve && localOperatorWallet) return localOperatorHeaders(localOperatorWallet);
  try { return client ? await client.headers() : {}; }
  catch { throw Object.assign(new Error('Sign in again to verify your account.'), { code:'AUTH_REQUIRED' }); }
}
export const accountState = () => verifiedAccount;
export async function sendTestnetDeposit(prepared) {
  if (!config?.webFundingEnabled || !accountCanPlay()) throw new Error('Testnet funding access is unavailable.');
  const from = prepared?.transfer?.transaction?.from?.toLowerCase();
  const embedded = verifiedAccount?.wallets?.some(wallet => wallet.kind === 'embedded'
    && wallet.chainType === 'ethereum' && wallet.address?.toLowerCase() === from);
  if (embedded) return (await ensureClient()).sendTestnetDeposit(prepared);
  return requestReviewedDeposit(prepared, injectedPhantom());
}
export async function sendTestnetPayout(prepared) {
  if (!config?.webFundingEnabled || !accountCanPlay()) throw new Error('Testnet prize claims are unavailable.');
  return requestReviewedPayout(prepared, injectedPhantom());
}
export const accountCanPlay = () => Boolean(verifiedAccount && (config?.closedBeta && !config?.publicAdmission
  ? verifiedAccount.beta?.admitted === true && verifiedAccount.beta.paused === false
  : !verifiedAccount.beta?.required || (verifiedAccount.beta.admitted && !verifiedAccount.beta.paused)));
export function lockAccount(value) { inferenceBusy = value; render(); }

function render() {
  phantomButton.hidden = config?.localOperatorObserve ? false : !verifiedAccount || !config?.configured;
  phantomButton.textContent = config?.webFundingEnabled
    ? (config.localOperatorObserve && !client ? 'Connect Phantom (proving round)' : 'Connect Phantom (pay from this wallet)')
    : 'Connect Phantom';
  phantomButton.disabled = busy || inferenceBusy;
  const proving = Boolean(config?.localOperatorObserve);
  $('#proving-round').hidden = !proving;
  provingSend.hidden = !proving;
  provingSend.disabled = busy || inferenceBusy;
  provingSend.textContent = PROVING_ROUND_BUTTON;
  provingClaim.hidden = !proving;
  provingClaim.disabled = busy || inferenceBusy;
  provingClaim.textContent = PROVING_CLAIM_BUTTON;
  provingAccountSend.hidden = !proving;
  provingAccountSend.disabled = busy || inferenceBusy;
  provingAccountSend.textContent = PROVING_ROUND_BUTTON;
  $('#account-login-form').hidden = Boolean(verifiedAccount) || !config?.configured;
  for (const selector of ['#account-send-code', '#account-login', '#account-wallet', '#account-email', '#account-code']) $(selector).disabled = busy || inferenceBusy;
  $('#account-logout').disabled = busy || inferenceBusy;
  $('#account-logout').hidden = !client && !localOperatorWallet;
  $('#account-wallet').hidden = (config?.closedBeta && !config?.webFundingEnabled) || !verifiedAccount || verifiedAccount.wallets.some(w => w.kind === 'embedded') || (config?.localOperatorObserve && !client);
  if (config?.closedBeta) $('#account-credits').hidden = !config?.webFundingEnabled;
  $('#beta-invite-form').hidden = !config?.closedBeta || config?.publicAdmission || !verifiedAccount || verifiedAccount.beta?.admitted;
  $('#beta-invite-code').disabled = $('#beta-redeem').disabled = busy || inferenceBusy;
  $('#account-restore').hidden = !config?.configured || Boolean(verifiedAccount);
  $('#account-restore').disabled = busy || inferenceBusy;
  $('#beta-membership').textContent = !config?.closedBeta ? '' : config?.publicAdmission ? (verifiedAccount ? (verifiedAccount.beta?.paused ? 'Public beta paused · Your receipts remain available.' : 'Public beta · Sign in to play.') : 'Public beta · Sign in to play.') : !verifiedAccount ? 'Closed beta · Sign in, then enter your invitation.'
    : verifiedAccount.beta?.admitted ? (verifiedAccount.beta.paused ? 'Beta paused · Your receipts remain available.' : `Beta access active until ${new Date(verifiedAccount.beta.expiresAt).toLocaleDateString('en-US')}.`)
    : 'An active invitation is required to play.';
  $('#account-summary').textContent = verifiedAccount
    ? `Signed in · ${verifiedAccount.accountId.slice(0, 18)}…${verifiedAccount.wallets.length ? '\n' + verifiedAccount.wallets.map(w => w.address).join('\n') : config?.closedBeta ? '' : '\nNo wallet verified by the server yet.'}`
    : config?.accessMode === 'public-practice' ? 'Sign in to send a practice message.' : 'Not signed in. TEST balances are a separate shared local sandbox.';
}
async function ensureClient() {
  if (!config?.configured) throw new Error('Privy is not configured yet.');
  if (!client) {
    const epoch = generation;
    const module = await import('/vendor/privy.js');
    const created = await module.createPrivyAccount(config);
    if (epoch !== generation) { await created.logout(); throw new Error('Account action cancelled.'); }
    client = created;
  }
  return client;
}
async function refreshIdentity() {
  const headers = await accountHeaders();
  if (!headers.Authorization && !headers['x-vault-local-operator-wallet']) return null;
  const response = await fetch('/api/account', { headers, signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Account verification failed.');
  return data;
}
async function adoptLocalOperator(wallet) {
  localOperatorWallet = wallet;
  try {
    const account = await refreshIdentity();
    if (!account) throw new Error('Could not verify the proving-round wallet.');
    return account;
  } catch (error) {
    localOperatorWallet = null;
    throw error;
  }
}
export async function refreshAccountStatus() {
  if (!client || !verifiedAccount || config?.accessMode !== 'public-practice') return;
  const epoch = generation, sequence = ++refreshSequence, owner = verifiedAccount.accountId;
  try {
    const account = await refreshIdentity();
    if (epoch !== generation || sequence !== refreshSequence || owner !== verifiedAccount?.accountId) return;
    verifiedAccount = account; render(); announce();
    if (!accountCanPlay()) { $('#account-usage').textContent = ''; return; }
    const response = await fetch('/api/usage', { headers:await accountHeaders(), signal:AbortSignal.timeout(12000) });
    const usage = await response.json();
    if (epoch !== generation || sequence !== refreshSequence || owner !== verifiedAccount?.accountId) return;
    $('#account-usage').textContent = response.ok
      ? `${Math.max(0, usage.perUserPerDay - usage.requestsToday)} / ${usage.perUserPerDay} attempts left today · resets at 00:00 UTC.${usage.unresolved ? ' Requests paused for cost reconciliation.' : ''}`
      : 'Usage is unavailable. Server limits still apply.';
  } catch {
    if (epoch === generation && sequence === refreshSequence) $('#account-usage').textContent = 'Could not refresh access or usage. Sign in again if your session expired.';
  }
}
$('#account-button').addEventListener('click', () => refreshAccountStatus());
async function action(run, success, verify = true) {
  if (busy || inferenceBusy) return;
  const epoch = generation; busy = true; render();
  try {
    await run();
    const result = verify ? await refreshIdentity() : null;
    if (epoch !== generation) return;
    verifiedAccount = result; announce(); status(success);
    if (result) refreshAccountStatus();
  } catch {
    if (epoch !== generation) return;
    verifiedAccount = null; announce();
    status('Could not complete account verification. Check the code or try again. No payment was made.');
  } finally { if (epoch === generation) { busy = false; render(); } }
}
$('#account-send-code').addEventListener('click', () => {
  if (!$('#account-email').reportValidity()) return;
  action(async () => (await ensureClient()).sendCode($('#account-email').value.trim()), 'Code sent. Enter it below.', false);
});
$('#account-login-form').addEventListener('submit', event => {
  event.preventDefault();
  action(async () => (await ensureClient()).login($('#account-email').value.trim(), $('#account-code').value.trim()), 'Signed in. Your access status is shown below.');
});
$('#account-restore').addEventListener('click', () => action(async () => { await ensureClient(); }, 'Session checked. Sign in with email if no active session was found.'));
$('#beta-invite-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || inferenceBusy || !verifiedAccount) return;
  const epoch = generation; busy = true; render();
  try {
    const response = await fetch('/api/beta/redeem', { method:'POST', headers:{ 'Content-Type':'application/json', ...await accountHeaders() },
      body:JSON.stringify({ code:$('#beta-invite-code').value.trim() }), signal:AbortSignal.timeout(12000) });
    const data = await response.json();
    if (epoch !== generation) return;
    if (!response.ok) { status(data.error?.message || 'Could not redeem your invitation.'); return; }
    verifiedAccount = { ...verifiedAccount, beta:data.beta }; $('#beta-invite-code').value = '';
    announce(); status('Invitation accepted. You can play.'); refreshAccountStatus();
  } catch { if (epoch === generation) status('Could not confirm the invitation. Retry the same code; it can only admit one account.'); }
  finally { if (epoch === generation) { busy = false; render(); } }
});
$('#account-wallet').addEventListener('click', () => action(async () => (await ensureClient()).createWallet(),
  config?.webFundingEnabled
    ? 'Embedded wallet created if it was missing. For testnet AMZN you already hold, Connect Phantom and Pay from that account in Top up.'
    : 'Wallet request completed. Server-verified wallets appear above. Deposits remain disabled.'));
async function sendProvingRoundAmzn() {
  if (busy || inferenceBusy || !config?.localOperatorObserve) return;
  const epoch = generation; busy = true; render();
  status('Open Phantom to switch to Robinhood testnet and send exactly 1 AMZN to treasury.');
  try {
    const funding = await (await fetch('/api/funding/config', { signal: AbortSignal.timeout(12000) })).json();
    const provider = injectedPhantom();
    const hash = await sendProvingRoundTransfer(provider, funding);
    const wallet = await readLocalOperatorWallet(provider);
    if (wallet) {
      const account = await adoptLocalOperator(wallet);
      if (epoch !== generation) return;
      verifiedAccount = account; announce();
    }
    if (epoch !== generation) return;
    status(`Sent 1 AMZN (${hash}). After the send, refresh /play; proving round will pick up player_rh{your address}.`);
  } catch (error) {
    if (epoch === generation) status(error.message || 'Phantom did not send 1 AMZN.');
  } finally { if (epoch === generation) { busy = false; render(); } }
}
provingSend.addEventListener('click', sendProvingRoundAmzn);
provingAccountSend.addEventListener('click', sendProvingRoundAmzn);
async function sendProvingRoundPrize() {
  if (busy || inferenceBusy || !config?.localOperatorObserve) return;
  const epoch = generation; busy = true; render();
  status('Open Phantom as treasury on Robinhood testnet to send the recorded prize. Do not sign as the x402 operating box.');
  try {
    const funding = await (await fetch('/api/funding/config', { signal: AbortSignal.timeout(12000) })).json();
    const round = (funding.rounds ?? []).find(row => row.state === 'won' && BigInt(row.prizePayable || '0') > 0n && row.prizeRecipient);
    if (!round) throw new Error('No recorded prize yet. A fresh 1 AMZN win records payable; historical 0.1 AMZN is not a prize.');
    const hash = await sendProvingRoundClaim(injectedPhantom(), funding, round);
    status(`Prize sent (${hash}). Recording the hash. Do not send twice.`);
    const checked = await recordProvingRoundClaim(round, hash);
    if (epoch !== generation) return;
    status(checked.order?.state === 'paid'
      ? `Prize transfer recorded: ${checked.order.transactionHash}. Test tokens only.`
      : 'Prize transfer submitted. Wait for confirmations, then refresh. Do not send it twice.');
  } catch (error) {
    if (epoch === generation) status(error.message || 'Phantom did not send the prize.');
  } finally { if (epoch === generation) { busy = false; render(); } }
}
provingClaim.addEventListener('click', sendProvingRoundPrize);
phantomButton.addEventListener('click', async () => {
  if (busy || inferenceBusy) return;
  if (config?.localOperatorObserve && (!verifiedAccount || !client)) {
    const epoch = generation; busy = true; render();
    status('Connect Phantom to pick up player_rh{your address}. No Privy sign-in and no transfer.');
    try {
      const wallet = await requestLocalOperatorWallet(window.phantom?.ethereum ?? window.ethereum);
      if (!wallet) throw new Error('Could not read the Phantom account.');
      const account = await adoptLocalOperator(wallet);
      if (epoch !== generation) return;
      verifiedAccount = account; announce();
      status(`Proving player ${account.accountId}. After a 1 AMZN send, refresh /play.`);
    } catch (error) { if (epoch === generation) status(error.message || 'Wallet linking was not completed.'); }
    finally { if (epoch === generation) { busy = false; render(); } }
    return;
  }
  if (!verifiedAccount) return;
  const epoch = generation; busy = true; render();
  status('Review the sign-in message in Phantom. Connecting uses your current network and does not transfer tokens.');
  try {
    await (await ensureClient()).connectPhantom(({ address, chainId }) => {
      if (epoch === generation) status(`Review the sign-in for ${address} in Phantom (chain ${chainId}). This only links your wallet; no tokens move.`);
    });
    const account = await refreshIdentity();
    if (epoch !== generation) return;
    verifiedAccount = account; announce(); status('Wallet linked. The server-verified address is shown above. No tokens were transferred.');
  } catch (error) { if (epoch === generation) status(error.message || 'Wallet linking was not completed.'); }
  finally { if (epoch === generation) { busy = false; render(); } }
});
$('#account-logout').addEventListener('click', async () => {
  if (busy || inferenceBusy) return;
  generation++; busy = false; verifiedAccount = null; localOperatorWallet = null;
  $('#account-email').value = ''; $('#account-code').value = ''; $('#beta-invite-code').value = ''; $('#account-usage').textContent = '';
  const previous = client; client = null; announce(); render(); status('Signed out locally.');
  try { await previous?.logout(); } catch { status('Signed out locally. Remote session revocation could not be confirmed.'); }
});
async function initialize() {
  try {
    config = await accessConfiguration;
    if (config.accessMode === 'unavailable') throw new Error('Unavailable');
    if (config.localOperatorObserve) {
      const wallet = await readLocalOperatorWallet(window.phantom?.ethereum ?? window.ethereum);
      if (wallet) {
        verifiedAccount = await adoptLocalOperator(wallet);
        announce();
        status(`Local proving player ${verifiedAccount.accountId}. After a 1 AMZN send, refresh /play.`);
      } else {
        status('Send 1 AMZN to treasury, then refresh /play; proving round will pick up player_rh{your address}. Connect Phantom if this page does not see the sender.');
      }
    } else {
      status(config.configured ? config.webFundingEnabled ? 'Sign in to test wallet funding.' : 'Email sign-in is available. Deposits are disabled.' : 'Privy integration prepared. App configuration is still required.');
    }
  } catch { status('Account configuration is unavailable. Reload to retry.'); }
  render();
}
initialize();
