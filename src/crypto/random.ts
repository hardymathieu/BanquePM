import { toBase64url } from './base64url';

/** A move id (SPEC §4.1: random, 8+ characters): 9 random bytes, 12 characters. */
export const randomId = (): string => toBase64url(crypto.getRandomValues(new Uint8Array(9)));
