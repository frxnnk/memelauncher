import { displayTokens } from './funding-client.js';

export function paidBetaLandingCopy(status = {}, funding = null) {
  const paid = status.paidConfigured === true && (status.bountyEnabled === true || funding?.enabled === true);
  if (paid) {
    const round = (funding?.rounds ?? []).find(row => row.state === 'open') ?? funding?.rounds?.[0];
    const decimals = Number.isInteger(funding?.asset?.decimals) ? funding.asset.decimals : 18;
    const price = round?.price ? `${displayTokens(round.price, decimals)} AMZN` : 'Robinhood testnet AMZN';
    return {
      edition: 'Closed paid beta',
      playNote: `Invitation. ${price} per paid attempt. Practice models stay unpaid.`,
      footer: 'Paid beta · testnet AMZN',
      navPlay: 'Enter the beta '
    };
  }
  if (status.closedBeta) {
    return {
      edition: 'Closed beta',
      playNote: 'By invitation. No deposit. No cash prize.',
      footer: 'Closed beta',
      navPlay: 'Enter the beta '
    };
  }
  return {
    edition: 'An experiment in persuasion',
    playNote: 'Practice edition. No deposit. No cash prize.',
    footer: 'Practice only',
    navPlay: null
  };
}

export function paidBetaAccountCopy(auth = {}) {
  if (!auth.webFundingEnabled) return null;
  return {
    treasuryLabel: 'Testnet AMZN / operator custody',
    treasuryIntro: 'Sign in and enter your invitation. Practice models need no deposit. Paid attempts use Robinhood testnet AMZN via Top up.',
    footer: auth.closedBeta ? 'Closed paid beta / testnet AMZN' : 'Paid beta / testnet AMZN',
    modeNote: 'Testnet only. Tokens have no cash value. Link Phantom to Top up AMZN and play the paid guardian.'
  };
}
