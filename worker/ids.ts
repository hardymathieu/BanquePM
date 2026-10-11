// Wire formats: canonical unpadded base64url of an exact byte length.
import { fromBase64url, toBase64url } from '../src/crypto/base64url';

function isCanonical(s: unknown, bytes: number): s is string {
  if (typeof s !== 'string') return false;
  const b = fromBase64url(s);
  return b !== null && b.length === bytes && toBase64url(b) === s;
}

export const isBlobId = (s: unknown): s is string => isCanonical(s, 16);
export const isWriteHash = (s: unknown): s is string => isCanonical(s, 32);

/** Decodes a non-empty base64url ciphertext, or null. */
export function decodeCt(s: unknown): Uint8Array | null {
  if (typeof s !== 'string' || s === '') return null;
  return fromBase64url(s);
}

export { toBase64url };
