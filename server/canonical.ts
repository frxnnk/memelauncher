import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// BELLFLY-C14N-1: restricted JSON (ASCII keys, finite numbers, no undefined).
// This is not a claim to implement general RFC 8785/JCS.
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(k => {
      if (!/^[\x20-\x7e]+$/.test(k)) throw new Error('Non-ASCII key');
      return JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]);
    }).join(',') + '}';
  }
  throw new Error('Non-canonical value');
}
export const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
