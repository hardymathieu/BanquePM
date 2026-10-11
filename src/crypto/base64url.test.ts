import { describe, expect, it } from 'vitest';
import { fromBase64url, toBase64url } from './base64url';

describe('base64url', () => {
  it('encodes without padding, with - and _', () => {
    expect(toBase64url(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]))).toBe('AAECAwQFBgcICQoLDA0ODw');
    expect(toBase64url(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_');
    expect(toBase64url(new Uint8Array([]))).toBe('');
  });

  it('round-trips every length up to 64 bytes', () => {
    for (let n = 0; n <= 64; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
      expect(fromBase64url(toBase64url(bytes))).toEqual(bytes);
    }
  });

  it('rejects padding, standard base64 characters and garbage', () => {
    expect(fromBase64url('AAECAw==')).toBeNull();
    expect(fromBase64url('+/+/')).toBeNull();
    expect(fromBase64url('abc!')).toBeNull();
    expect(fromBase64url('A')).toBeNull(); // impossible length
  });
});
