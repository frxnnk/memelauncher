import { paidBetaAccountCopy } from './paid-beta-copy.js';
import { accountState, accountCanPlay, lockAccount } from './account.js';
import { accessConfiguration } from './access.js';
import { showInfo } from './details.js';
import { createTopupController, displayTokens, tokenAmount, unsignedTopupDisclosure, unsignedClaimDisclosure, sendProvingRoundTransfer, sendProvingRoundClaim, recordProvingRoundClaim, injectedPhantom, requestReviewedDeposit, requestReviewedPayout, demoteFundingDialog, ensureRobinhoodTestnet, assertReviewedAmznBalance, readLinkedAmznBalances, payFromWalletLabel, defaultPayFromAddress, payFromShortageCopy, pendingTopupUi, pendingTopupStatusCopy, topupErrorFollowup, walletPromptError, PROVING_ROUND_BUTTON, PROVING_CLAIM_BUTTON, SEND_WITH_PHANTOM_BUTTON, ASKING_PHANTOM } from './funding-client.js';
import { phantomBrowseUrl } from './funding-network.js';
import { fundingRequest, refreshWebFunding, selectWebCredits, usesWebCredits, recoverWebAttempt, pendingWebAttempt, fundingWallet, chooseFundingWallet } from './web-credits.js';

const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text ?? ''; return element; };
const button = (root, label, action) => {
  const element = node('button', label); element.type = 'button'; element.className = 'treasury-action';
  element.addEventListener('click', action); root.append(element); return element;
};
const payableRounds = config => (config.rounds ?? []).filter(round => round.state === 'won'
  && BigInt(round.prizePayable || '0') > 0n && round.prizeRecipient);
let generation = 0, busy = false, activeOwner = null;
async function openFunding() {
  const epoch = ++generation, owner = accountState()?.accountId;
  activeOwner = owner;
  document.querySelector('#treasury-dialog')?.close();
  const host = showInfo('Top up & bounty', 'TESTNET AMZN', { modal: false });
  const root = node('section'); root.className = 'funding-panel'; host.append(root);
  const current = () => generation === epoch && accountState()?.accountId === owner && root.isConnected;
  root.append(node('p', 'Loading…'));
  try {
    const config = await refreshWebFunding();
    if (!current()) return;
    root.replaceChildren();
    if (!config.enabled || !accountCanPlay()) {
      if (!config.enabled) {
        root.append(node('p', accountState()
          ? 'Sign in with an active beta invitation first.'
          : 'Sign in, then Connect Phantom. Top up sends test AMZN from that linked wallet. You do not need the CLI faucet address.'));
        return;
      }
      const panel = unsignedTopupDisclosure(config, { signedIn: Boolean(accountState()) });
      const claim = unsignedClaimDisclosure(config, { signedIn: Boolean(accountState()) });
      root.append(node('p', panel.gate));
      for (const fact of panel.facts) root.append(node('p', fact));
      root.append(node('p', claim.gate));
      for (const fact of claim.facts) root.append(node('p', fact));
      if (config.localOperatorObserve) {
        const provingStatus = node('p'); provingStatus.setAttribute('role', 'status');
        button(root, PROVING_ROUND_BUTTON, async () => {
          provingStatus.textContent = 'Open Phantom to switch to Robinhood testnet and send exactly 1 AMZN to treasury.';
          try {
            const hash = await sendProvingRoundTransfer(injectedPhantom(), config);
            provingStatus.textContent = `Sent 1 AMZN (${hash}). After the send, refresh /play; proving round will pick up player_rh{your address}.`;
          } catch (error) {
            provingStatus.textContent = error.message || 'Phantom did not send 1 AMZN.';
          }
        });
        for (const round of payableRounds(config)) {
          button(root, `${PROVING_CLAIM_BUTTON} (${round.id})`, async () => {
            provingStatus.textContent = 'Open Phantom as treasury on Robinhood testnet to send the recorded prize. Do not sign as the x402 operating box.';
            try {
              const hash = await sendProvingRoundClaim(injectedPhantom(), config, round);
              provingStatus.textContent = `Prize sent (${hash}). Recording the hash. Do not send twice.`;
              const checked = await recordProvingRoundClaim(round, hash);
              provingStatus.textContent = checked.order?.state === 'paid'
                ? `Prize transfer recorded: ${checked.order.transactionHash}. Test tokens only.`
                : 'Prize transfer submitted. Wait for confirmations, then refresh. Do not send it twice.';
            } catch (error) {
              provingStatus.textContent = error.message || 'Phantom did not send the prize.';
            }
          });
        }
        root.append(provingStatus);
      }
      return;
    }
    const amount = value => displayTokens(value, config.asset.decimals);
    root.append(node('p', 'Test tokens only. No monetary value or cash payout.'));
    const disclosure = node('details'); disclosure.append(node('summary', 'Network, rules & custody'));
    const details = node('p', `Chain ${config.asset.chainId}\nToken ${config.asset.tokenAddress}\nRecipient ${config.asset.destination}`);
    details.style.whiteSpace = 'pre-line'; disclosure.append(details);
    const account = await fundingRequest('/api/funding/account'); if (!current()) return;
    const balances = node('p', `${amount(account.available)} available`); balances.className = 'funding-balance'; root.append(balances);
    root.append(node('p', `${amount(account.reserved)} reserved · Test tokens`));
    for (const round of config.rounds) {
      const model = round.manifest.manifest.configuration.guardians.map(g => g.modelId).join(', ');
      root.append(node('p', `${model.split('/').at(-1)} · Bounty ${amount(round.bounty)}`));
      const split = `${round.prizeBps / 100}% bounty / ${round.operationsBps / 100}% operations / ${round.nextRoundBps / 100}% next round.`;
      const winRule = round.winRetainBps
        ? ` A win pays ${(10000 - round.winRetainBps) / 100}% of this round’s bounty; ${round.winRetainBps / 100}% stays as continuity and the beaten guardian is retired.`
        : '';
      const expiry = round.expiresAt
        ? ` If nobody wins by ${round.expiresAt}, player-funded bounty returns to attempters. Unused credits stay non-refundable. Expiry records the ledger only; it does not send tokens.`
        : '';
      disclosure.append(node('p', `${model} · ${round.state}\nPayable ${amount(round.prizePayable)}\n${amount(round.price)} per completed attempt · ${split}${winRule}${expiry}`));
    }
    if (config.testnetClaimsEnabled) {
      const payable = config.rounds.filter(round => round.state === 'won' && BigInt(round.prizePayable || '0') > 0n);
      disclosure.append(node('p', 'A win records a testnet payable (75% of that round’s bounty; 25% stays as continuity). There is still no cash prize. The player cannot send it. The operator connects treasury in Phantom, then Top up & bounty → Review prize transfer → Confirm prize transfer. Phantom or the Brave toolbar should open on Confirm. Do not sign as the x402 operating box.'));
      if (payable.length) {
        root.append(node('p', `Prize payable: ${payable.map(round => `${round.id} ${amount(round.prizePayable)}`).join(' · ')}`));
        let preparedClaim = null;
        let confirmClaim;
        for (const round of payable) {
          button(root, `Review prize transfer (${round.id})`, () => run(async () => {
            confirmClaim.hidden = true;
            preparedClaim = null;
            await ensureRobinhoodTestnet(injectedPhantom());
            try {
              const prepared = await fundingRequest(`/api/funding/claims/${round.id}/prepare`, {});
              const canSign = prepared.transfer?.signingEnabled && prepared.transfer.transaction;
              confirmClaim.hidden = !canSign;
              confirmClaim.dataset.roundId = round.id;
              if (canSign) preparedClaim = prepared;
              return canSign
                ? `Review ${amount(prepared.amount)} test tokens from ${prepared.treasury} to ${prepared.recipient}. Gas is additional. Click Confirm prize transfer once — a Phantom popup or Brave toolbar prompt should open immediately.`
                : `Prize ${amount(prepared.amount)} is recorded for ${prepared.recipient}. Connect the treasury wallet ${config.asset.destination} in Phantom to send it. Do not use the x402 operating box.`;
            } catch (error) {
              if (error.code === 'TREASURY_WALLET_REQUIRED') {
                return `Prize ${amount(round.prizePayable)} is recorded. Connect the treasury wallet ${config.asset.destination} in Account, then review again.`;
              }
              throw error;
            }
          }));
        }
        confirmClaim = button(root, 'Confirm prize transfer', () => {
          demoteFundingDialog();
          busy = false;
          const cached = preparedClaim;
          if (!cached) {
            status.textContent = 'Click Review prize transfer first. Confirm only asks Phantom after a live prize transfer is ready.';
            return;
          }
          const pending = requestReviewedPayout(cached);
          status.textContent = ASKING_PHANTOM;
          pending.then(async hash => {
            const roundId = confirmClaim.dataset.roundId;
            await fundingRequest(`/api/funding/claims/${roundId}/submit`, { transactionHash: hash });
            const checked = await fundingRequest(`/api/funding/claims/${roundId}/check`, {});
            confirmClaim.hidden = true;
            preparedClaim = null;
            if (!current()) return;
            status.textContent = checked.order?.state === 'paid'
              ? `Prize transfer recorded: ${checked.order.transactionHash}. Test tokens only.`
              : 'Prize transfer submitted. Wait for confirmations, then review again. Do not send it twice.';
          }).catch(error => {
            if (current()) {
              status.hidden = false;
              status.textContent = error.message || 'Phantom never received a prize request.';
            }
          });
        });
        confirmClaim.hidden = true;
      }
    }
    disclosure.append(node('p', 'Your top-up stays in your credit balance until used. There is no ordinary cash-out of unused credits. Confirmed errors return the reserved credit. Uncertain replies stay reserved for recovery. The operator controls custody and records model results.'));
    const status = node('p'); status.setAttribute('role', 'status');
    const controls = node('div'); controls.className = 'treasury-buttons'; root.append(controls, status);
    let topupRecord = () => null;
    let refreshTopupUi = () => {};
    let walletRequested = false;
    async function run(work, { keepStatus = false } = {}) {
      if (!current()) return;
      if (busy) {
        status.textContent = 'A top-up action is already running. If Phantom did not open, hard-refresh and click Send with Phantom once.';
        return;
      }
      busy = true; lockAccount(true);
      if (!keepStatus) status.textContent = 'Working…';
      for (const control of root.querySelectorAll('button,input,select')) control.disabled = true;
      try { const message = await work(); if (current()) status.textContent = message; }
      catch (error) {
        const text = (error.message || 'Phantom never received a request.') + topupErrorFollowup(error, topupRecord());
        const liveStatus = root.querySelector('[role="status"]') || status;
        if (current()) refreshTopupUi();
        if (liveStatus) {
          liveStatus.hidden = false;
          liveStatus.textContent = text;
        } else {
          const live = document.querySelector('#info-content [role="status"]') || document.querySelector('#notice');
          if (live) { live.hidden = false; live.textContent = text; }
        }
      }
      finally {
        busy = false; lockAccount(false);
        if (current()) for (const control of root.querySelectorAll('button,input,select')) control.disabled = false;
      }
    }
    button(controls, usesWebCredits() ? 'Use free practice' : 'Use testnet credits in chat', () => {
      if (document.querySelector('#chat-thread').children.length) { status.textContent = 'Start a new conversation before changing between practice and credit play. Your existing receipts stay available.'; return; }
      selectWebCredits(!usesWebCredits()); document.querySelector('#info-dialog').close(); document.querySelector('#treasury-dialog').close();
      document.querySelector('#practice-footer').textContent = usesWebCredits() ? 'Testnet credits · no monetary value' : 'Practice / No cash prize';
    });
    if (config.localOperatorObserve) {
      button(controls, PROVING_ROUND_BUTTON, () => run(async () => {
        const hash = await sendProvingRoundTransfer(injectedPhantom(), config);
        return `Sent 1 AMZN (${hash}). After the send, refresh /play; proving round will pick up player_rh{your address}.`;
      }));
      for (const round of payableRounds(config)) {
        button(controls, `${PROVING_CLAIM_BUTTON} (${round.id})`, () => run(async () => {
          const hash = await sendProvingRoundClaim(injectedPhantom(), config, round);
          const checked = await recordProvingRoundClaim(round, hash);
          return checked.order?.state === 'paid'
            ? `Prize transfer recorded: ${checked.order.transactionHash}. Test tokens only.`
            : 'Prize transfer submitted. Wait for confirmations. Do not send it twice.';
        }));
      }
      button(root, 'Refresh balances', () => { if (!busy) openFunding(); });
      root.append(disclosure);
      return;
    }
    if (pendingWebAttempt()) button(controls, 'Recover pending reply', () => run(async () => {
      const result = await recoverWebAttempt();
      if (result?.receipt) document.dispatchEvent(new CustomEvent('vault:recovered-receipt', { detail: result.receipt }));
      return 'Reply recovered. No new model request was sent.';
    }));
    let wallet = fundingWallet();
    if (!wallet) { root.append(node('p', 'Connect Phantom in Account, then return here.')); root.append(disclosure); return; }
    const guide = node('details'); guide.className = 'funding-wallet-guide';
    guide.append(node('summary', 'Before you top up with Phantom'));
    guide.append(node('p', 'Open Phantom → Settings → Developer Settings → Testnet Mode. Choose Robinhood Chain Testnet and the same account as “Pay from” below.'));
    guide.append(node('p', 'The reviewed transfer is FROM that Pay-from wallet TO the treasury. Any linked Phantom or Privy wallet that holds testnet AMZN can top up. The CLI faucet address is only for npm run paid-beta:testnet-deposit.'));
    guide.append(node('p', 'On mobile, open this site inside Phantom’s browser. You need test tokens and test ETH for gas. Linking a wallet does not switch its network.'));
    const phantomLink = node('a', 'Open this page in Phantom’s browser');
    phantomLink.href = phantomBrowseUrl(`${location.origin}${location.pathname}`, location.origin);
    phantomLink.rel = 'noopener';
    guide.append(phantomLink);
    root.append(guide);
    const ethereumWallets = accountState().wallets.filter(w => w.chainType === 'ethereum');
    const openRound = config.rounds.find(round => round.state === 'open');
    const needed = openRound?.price ? BigInt(openRound.price) : 5n * 10n ** 18n;
    const walletLabel = node('label', 'Pay from'), walletSelect = node('select');
    for (const candidate of ethereumWallets) {
      const option = node('option', payFromWalletLabel(candidate));
      option.value = candidate.address; option.selected = candidate.address === wallet.address; walletSelect.append(option);
    }
    walletSelect.addEventListener('change', () => { chooseFundingWallet(walletSelect.value); wallet = fundingWallet(); });
    walletLabel.append(walletSelect); root.append(walletLabel);
    const faucetNote = node('p', `Your wallet needs test tokens and test ETH for gas: ${wallet.address}`);
    root.append(faucetNote);
    try {
      const balances = await readLinkedAmznBalances(ethereumWallets, { tokenAddress: config.asset.tokenAddress });
      if (!current()) return;
      const chosen = defaultPayFromAddress(ethereumWallets, balances, needed);
      if (chosen) {
        chooseFundingWallet(chosen);
        wallet = fundingWallet();
        walletSelect.value = wallet.address;
      }
      for (const option of walletSelect.options) {
        const candidate = ethereumWallets.find(w => w.address === option.value);
        option.textContent = payFromWalletLabel(candidate, balances[option.value.toLowerCase()], { decimals: config.asset.decimals });
      }
      const selectedBalance = balances[wallet.address.toLowerCase()] ?? 0n;
      faucetNote.textContent = selectedBalance >= needed
        ? `Your wallet needs test tokens and test ETH for gas: ${wallet.address}`
        : payFromShortageCopy({ needed: displayTokens(needed.toString(), config.asset.decimals) });
    } catch { /* keep the address line; Review still checks AMZN and faucet copy */ }
    const controller = createTopupController({ api: fundingRequest, storage: localStorage,
      storageKey: `vault-topup:${config.assetHash}:${owner}`, send: prepared => requestReviewedDeposit(prepared),
      onProgress: stage => {
        if (stage === 'wallet') walletRequested = true;
        if (current()) status.textContent = {
          review: 'Checking the amount and recipient…',
          wallet: ASKING_PHANTOM,
          confirmations: 'Transfer submitted. Waiting for network confirmations. No second transfer is needed.'
        }[stage];
      } });
    const inputLabel = node('label', `Top-up amount (maximum ${amount(config.maximumTopup)})`);
    const input = node('input'); input.inputMode = 'decimal'; input.autocomplete = 'off';
    const suggested = openRound ? amount(openRound.price) : '';
    input.placeholder = suggested || '5';
    if (suggested) input.value = suggested;
    inputLabel.append(input); root.append(inputLabel);
    const previousTopup = controller.read();
    if (previousTopup?.input?.amountBaseUnits && previousTopup.state !== 'complete') input.value = amount(previousTopup.input.amountBaseUnits);
    const orderLabel = node('p'); root.append(orderLabel);
    const signControls = node('div'); signControls.className = 'treasury-buttons';
    const recovery = node('details'); recovery.append(node('summary', 'Recover a top-up'));
    let confirm, acknowledge;
    const applyTopupUi = result => {
      const order = result?.order;
      if (order) {
        orderLabel.textContent = `Order ${order.id} · ${amount(order.minimumReceived)} test tokens · ${order.credited ? 'Credited' : order.state}`;
      }
      const ui = pendingTopupUi({ record: controller.read(), order, transfer: result?.transfer });
      confirm.hidden = !ui.confirmVisible;
      acknowledge.hidden = !ui.acknowledgeVisible;
      recovery.open = ui.recoverOpen;
      return pendingTopupStatusCopy(ui, order ? {
        amount: amount(order.minimumReceived),
        owner: order.owner,
        destination: config.asset.destination
      } : {});
    };
    button(signControls, SEND_WITH_PHANTOM_BUTTON, () => {
      demoteFundingDialog();
      busy = false;
      document.querySelector('#info-dialog')?.close();
      document.querySelector('#treasury-dialog')?.close();
      controller.releaseHungSend();
      if (!controller.readyToSend()) {
        status.textContent = 'Click Review first. Send with Phantom only asks Phantom after Review has a live transfer.';
        return;
      }
      const pending = requestReviewedDeposit(controller.armSign());
      walletRequested = true;
      status.textContent = ASKING_PHANTOM;
      pending.then(async txHash => {
        if (!current()) return;
        status.textContent = applyTopupUi(await controller.recover(txHash));
      }).catch(error => {
        if (current()) {
          status.hidden = false;
          status.textContent = (error.message || 'Phantom never received a request.') + topupErrorFollowup(error, controller.read());
        }
      });
    });
    button(signControls, 'Review top-up', () => run(async () => {
      await ensureRobinhoodTestnet(injectedPhantom());
      const result = await controller.prepare({
        wallet: wallet.address, amountBaseUnits: tokenAmount(input.value, config.asset.decimals)
      });
      await assertReviewedAmznBalance(result);
      return applyTopupUi(result);
    }));
    confirm = button(signControls, 'Confirm testnet transfer', () => {
      demoteFundingDialog();
      busy = false;
      document.querySelector('#treasury-dialog')?.close();
      controller.releaseHungSend();
      if (!controller.readyToSend()) {
        status.textContent = 'Click Review first. Confirm only asks Phantom after a live transfer is ready.';
        return;
      }
      const pending = requestReviewedDeposit(controller.armSign());
      walletRequested = true;
      status.textContent = ASKING_PHANTOM;
      pending.then(async txHash => {
        if (!current()) return;
        status.textContent = applyTopupUi(await controller.recover(txHash));
      }).catch(error => {
        if (current()) {
          status.hidden = false;
          status.textContent = walletPromptError(error) + topupErrorFollowup(error, controller.read());
        }
      });
    });
    acknowledge = button(signControls, 'I did not sign a transfer', () => run(async () => applyTopupUi(await controller.acknowledgeNotSigned({ confirmedNoSignature: true }))));
    root.append(signControls);
    const hashLabel = node('label', 'Transaction hash (only needed if the wallet sent but the page lost its response)');
    const hashInput = node('input'); hashInput.placeholder = '0x…'; hashInput.autocomplete = 'off'; hashLabel.append(hashInput); recovery.append(hashLabel);
    button(recovery, 'Recover / check top-up', () => run(async () => applyTopupUi(await controller.recover(hashInput.value.trim() || undefined))));
    button(root, 'Refresh balances', () => { if (!busy) openFunding(); });
    topupRecord = () => controller.read();
    refreshTopupUi = () => { applyTopupUi(); };
    status.textContent = applyTopupUi();
    root.append(recovery, disclosure);
    if (previousTopup?.state === 'prepared' && previousTopup.input
        && previousTopup.input.wallet?.toLowerCase() === wallet.address.toLowerCase()) {
      try {
        const prepared = await controller.prepare(previousTopup.input);
        if (!walletRequested && current()) status.textContent = applyTopupUi(prepared);
      }
      catch { /* keep the local Review state */ }
      if (!current()) return;
    }
    const history = await fundingRequest('/api/funding/deposits'); if (!current()) return;
    const saved = controller.read();
    const matching = saved?.orderId ? history.deposits.find(({ order }) => order.id === saved.orderId) : null;
    if (!walletRequested && current()) status.textContent = applyTopupUi(matching || {});
    const historyView = node('details'); historyView.append(node('summary', 'Recent top-ups'));
    if (history.deposits.length) root.append(historyView);
    for (const { order } of history.deposits) {
      const row = node('p', `${amount(order.minimumReceived)} · ${order.credited ? 'Credited' : order.state} · ${order.id}`);
      historyView.append(row);
      button(historyView, 'Check this order', () => run(async () => applyTopupUi(await fundingRequest(`/api/funding/deposits/${order.id}/check`, {}))));
    }
  } catch (error) {
    const liveStatus = root.querySelector('[role="status"]');
    if (liveStatus) { liveStatus.hidden = false; liveStatus.textContent = error.message; }
    else if (current()) root.replaceChildren(node('p', error.message));
  }
}
document.addEventListener('vault:account-changed', () => {
  if (activeOwner === accountState()?.accountId) return;
  generation++;
  if (document.querySelector('#info-title')?.textContent === 'Top up & bounty') document.querySelector('#info-dialog').close();
});
accessConfiguration.then(config => {
  if (!config.webFundingEnabled) return;
  button(document.querySelector('#account-credits').parentElement, 'Top up & bounty', openFunding);
  const paid = paidBetaAccountCopy(config);
  if (paid) {
    document.querySelector('#account-mode-note').textContent = paid.modeNote;
    document.querySelector('.treasury-intro').textContent = paid.treasuryIntro;
  }
});
