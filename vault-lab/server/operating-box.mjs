import { apiError } from './errors.mjs';

export function createOperatingBox({ readBalance, floor = 0n } = {}) {
  if (typeof readBalance !== 'function' || typeof floor !== 'bigint' || floor < 0n) throw new Error('Operating box requires a balance reader and a nonnegative floor.');
  let held = 0n;
  return {
    async assertCoverage(amount) {
      if (typeof amount !== 'string' || !/^[1-9][0-9]{0,18}$/.test(amount)) throw apiError(502, 'X402_QUOTE_UNSUPPORTED', 'The quoted payment amount is invalid. No payment was signed.');
      const value = BigInt(amount);
      const balance = await readBalance().catch(() => null);
      if (typeof balance !== 'bigint' || balance < value + floor + held) {
        throw apiError(503, 'INSUFFICIENT_OPERATING_FUNDS', 'The operating box cannot cover this inference and its reserve floor. No payment was signed and no credits were consumed.');
      }
      held += value;
      let open = true;
      return { amount: value, release() { if (open) { held -= value; open = false; } } };
    }
  };
}
