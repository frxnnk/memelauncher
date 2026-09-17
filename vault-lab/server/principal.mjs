import { apiError } from './errors.mjs';

// These functions accept the result of server authentication, never a request body.
export function verifiedAccountId(principal) {
  if (principal?.authenticated !== true || typeof principal.accountId !== 'string' || !/^player_[a-zA-Z0-9_-]{1,70}$/.test(principal.accountId)) {
    throw apiError(401, 'AUTH_REQUIRED', 'A server-verified account is required.');
  }
  return principal.accountId;
}
export function verifiedWallet(principal, value) {
  verifiedAccountId(principal);
  if (typeof value !== 'string' || !/^0x[0-9a-f]{40}$/i.test(value) || /^0x0{40}$/i.test(value) ||
      principal.walletOwnershipVerified !== true || !principal.wallets?.some(wallet => wallet.chainType === 'ethereum' && wallet.address?.toLowerCase() === value.toLowerCase())) {
    throw apiError(400, 'WALLET_NOT_VERIFIED', 'Choose a wallet verified for your account.');
  }
  return value.toLowerCase();
}
