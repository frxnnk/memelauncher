export const TREASURY_BOX = '0xbec4fdb33ed39844956d9078fd232aca92d7396d';
export const PAYER_BOX = '0x686c6cd47d0a09b5b77fff3f76e2786425dc2f79';
export const LAPTOP_REHEARSAL_BOX = '0xf2824a8042e3597afe5a9d420bd69445e80e0c8f';
export const PRODUCT_X402_BOX = '0xf670531e46ba92f49c5d9c11d2c03875cffe7d40';

export const FORBIDDEN_OPERATING_BOXES = Object.freeze([
  TREASURY_BOX,
  PAYER_BOX,
  LAPTOP_REHEARSAL_BOX
]);

const DEDICATED_BOX_ERROR = 'The x402 operating box must be a dedicated Vercel env key, not the treasury, deposit payer, or laptop rehearsal key.';

export function classifyOperatingBox(address) {
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('A dedicated operating-box address is required.');
  }
  const lower = address.toLowerCase();
  if (lower === TREASURY_BOX || lower === PAYER_BOX) return 'forbidden-funds';
  if (lower === LAPTOP_REHEARSAL_BOX) return 'laptop-rehearsal';
  return 'dedicated';
}

export function requiredOperatingBox(hosting = 'local', env = {}) {
  const explicit = env.VAULT_X402_EXPECTED_ADDRESS?.trim();
  if (explicit) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(explicit)) {
      throw new Error('VAULT_X402_EXPECTED_ADDRESS must be a 20-byte hex address.');
    }
    return explicit.toLowerCase();
  }
  return hosting === 'vercel' ? PRODUCT_X402_BOX : null;
}

export function operatingBoxDecision(address, hosting = 'local', env = {}) {
  const kind = classifyOperatingBox(address);
  if (kind === 'dedicated') {
    const required = requiredOperatingBox(hosting, env);
    if (required && address.toLowerCase() !== required) {
      throw new Error('The x402 operating box on Vercel must be the dedicated product key 0xf670531e46ba92f49c5d9c11d2c03875cffe7d40.');
    }
    return 'arm';
  }
  if (kind === 'laptop-rehearsal' && hosting === 'local') return 'ignore';
  throw new Error(DEDICATED_BOX_ERROR);
}

export function assertDedicatedOperatingBox(address) {
  if (classifyOperatingBox(address) !== 'dedicated') throw new Error(DEDICATED_BOX_ERROR);
}
