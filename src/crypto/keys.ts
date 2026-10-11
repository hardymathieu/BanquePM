// The root secret and its HKDF derivations (SPEC §7.1, §7.2). Words are in words.ts.
import { toBase64url } from './base64url';
import { importBoxKey } from './box';
import { ROOT_BYTES } from './sizes';

export { importBoxKey, ROOT_BYTES };

const SALT = new TextEncoder().encode('banque-papa-maman/v1');

export function generateRoot(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ROOT_BYTES));
}

function checkRoot(root: Uint8Array): void {
  if (root.length !== ROOT_BYTES) throw new RangeError('root must be 16 bytes');
}

export async function hkdf(root: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  checkRoot(root);
  const ikm = await crypto.subtle.importKey('raw', root as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode(info) },
    ikm,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** What the server stores to check a write token: base64url(SHA-256(UTF-8(token))). */
export async function writeHashOf(token: string): Promise<string> {
  return toBase64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
}

export type BlobKeys = {
  id: string;
  key: CryptoKey;
  /** Sent as `Authorization: Bearer <writeToken>`. */
  writeToken: string;
  writeHash: string;
};

export type KidKeys = BlobKeys & { rawKey: Uint8Array };

async function deriveBlob(root: Uint8Array, prefix: string): Promise<BlobKeys & { rawKey: Uint8Array }> {
  const [id, rawKey, write] = await Promise.all([
    hkdf(root, `${prefix}/id`, 16),
    hkdf(root, `${prefix}/key`, 32),
    hkdf(root, `${prefix}/write`, 32),
  ]);
  const writeToken = toBase64url(write);
  return { id: toBase64url(id), rawKey, key: await importBoxKey(rawKey), writeToken, writeHash: await writeHashOf(writeToken) };
}

export async function deriveFamily(root: Uint8Array): Promise<BlobKeys> {
  const { rawKey: _, ...keys } = await deriveBlob(root, 'family');
  return keys;
}

export async function deriveKid(root: Uint8Array, slot: number): Promise<KidKeys> {
  if (!Number.isSafeInteger(slot) || slot < 0) throw new RangeError('slot must be a non-negative integer');
  return deriveBlob(root, `kid/${slot}`);
}
