import { splitWinPrize } from './paid-beta-policy.mjs';
import { units } from './schema.mjs';
import { preparePayoutTransfer } from './payout-transfer.mjs';
import { TREASURY_BOX } from '../x402-operating-box-policy.mjs';

export const USDG_FIXTURE_UNITS = '1000000';
export const USDG_MAINNET = Object.freeze({
  chainId: '4663',
  tokenAddress: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  destination: TREASURY_BOX,
  symbol: 'USDG',
  decimals: 6,
  minimumConfirmations: 3,
  standardTransferVerified: true
});

export function createRoundEscrow({ asset, roundId, manifestHash, seedAmount, mode = 'software-escrow' } = {}) {
  if (!asset?.chainId || !asset.tokenAddress || typeof roundId !== 'string' || !/^[a-f0-9]{64}$/.test(manifestHash)) {
    throw new Error('Escrow requires a frozen asset, round and manifesto hash.');
  }
  const seed = units(seedAmount);
  if (!seed) throw new Error('Escrow seed must be a positive amount.');
  if (mode === 'fixture-drill' && seed !== 1_000_000n) {
    throw new Error('The USDG drill is 1 unit, not a $500 seed.');
  }
  const attempts = new Map();
  let resolved = null, claimed = null;
  return {
    freezeAttempt({ attemptId, recipient, maxPrice, inputHash }) {
      if (typeof attemptId !== 'string' || !/^0x[0-9a-f]{40}$/i.test(recipient) || !/^[a-f0-9]{64}$/.test(inputHash)) {
        throw new Error('Attempt admission requires a recipient and input hash.');
      }
      units(maxPrice);
      const existing = attempts.get(attemptId);
      if (existing && existing.recipient !== recipient.toLowerCase()) throw new Error('Attempt recipient is frozen.');
      if (existing) return existing;
      const row = { attemptId, recipient: recipient.toLowerCase(), maxPrice, inputHash, state: 'admitted' };
      attempts.set(attemptId, row);
      return row;
    },
    resolve({ attemptId, resultHash, decision }) {
      const row = attempts.get(attemptId);
      if (!row) throw new Error('Unknown attempt.');
      if (row.state !== 'admitted') throw new Error('Attempt already resolved.');
      if (!['released', 'locked'].includes(decision) || !/^[a-f0-9]{64}$/.test(resultHash)) throw new Error('Invalid resolution.');
      row.state = decision;
      row.resultHash = resultHash;
      if (decision === 'released') resolved = { attemptId, resultHash, recipient: row.recipient };
      return row;
    },
    claim({ attemptId, recipient } = {}) {
      if (claimed) throw new Error('Prize already paid.');
      const row = attempts.get(attemptId);
      if (!row || row.state !== 'released' || !resolved || resolved.attemptId !== attemptId) throw new Error('No winning claim.');
      if (recipient && recipient.toLowerCase() !== row.recipient) throw new Error('Claim recipient does not match the frozen wallet.');
      const split = splitWinPrize(String(seed));
      claimed = { recipient: row.recipient, amount: split.payable, continuity: split.continuity, resultHash: resolved.resultHash };
      return claimed;
    },
    yank() { throw new Error('The operator cannot yank escrowed prize funds.'); },
    executeFixtureClaim({ attemptId, transactionHash }) {
      if (mode !== 'fixture-drill') throw new Error('Fixture claims are only for the 1-unit drill.');
      const paid = this.claim({ attemptId });
      if (typeof transactionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) throw new Error('A fixture transaction hash is required.');
      const transfer = preparePayoutTransfer({
        amount: paid.amount, recipient: paid.recipient, treasury: asset.destination, state: 'won', asset
      }, {
        authenticated: true, accountId: 'player_operator', walletOwnershipVerified: true,
        wallets: [{ address: asset.destination, chainType: 'ethereum' }]
      });
      return { ...paid, asset: asset.tokenAddress, chainId: String(asset.chainId),
        transactionHash: transactionHash.toLowerCase(), broadcast: false, realFundsEnabled: false, transfer };
    },
    broadcastMainnet() { throw new Error('Mainnet USDG broadcast is disabled until an approved 1-unit drill wallet is provided.'); }
  };
}
