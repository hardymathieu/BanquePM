// Unpadded base64url (RFC 4648 §5), the only encoding used in links, ids and the API.

const VALID = /^[A-Za-z0-9_-]*$/;

export function toBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes unpadded base64url; null for anything else. */
export function fromBase64url(s: string): Uint8Array | null {
  if (!VALID.test(s) || s.length % 4 === 1) return null;
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
