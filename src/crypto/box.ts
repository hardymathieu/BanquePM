// ct = 0x01 ‖ iv(12) ‖ AES-256-GCM(key, iv, aad = UTF-8(blobId), gzip(UTF-8(JSON)))  (SPEC §7.3)

const FORMAT = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type BoxErrorCode = 'bad_format' | 'decrypt_failed' | 'bad_content';

/** Carries only a code: never the plaintext, the key or the blob id. */
export class BoxError extends Error {
  constructor(readonly code: BoxErrorCode) {
    super(code);
    this.name = 'BoxError';
  }
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** AES-256-GCM key for seal/open. Non-extractable: raw bytes only exist where a link needs them. */
export function importBoxKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const aad = (blobId: string) => new TextEncoder().encode(blobId);

export async function seal(key: CryptoKey, blobId: string, value: unknown): Promise<Uint8Array> {
  const plain = await pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(blobId) }, key, plain as BufferSource),
  );
  const ct = new Uint8Array(1 + IV_BYTES + sealed.length);
  ct[0] = FORMAT;
  ct.set(iv, 1);
  ct.set(sealed, 1 + IV_BYTES);
  return ct;
}

/** Returns the parsed JSON, unvalidated: the caller checks its shape. */
export async function open(key: CryptoKey, blobId: string, ct: Uint8Array): Promise<unknown> {
  if (ct.length < 1 + IV_BYTES + TAG_BYTES || ct[0] !== FORMAT) throw new BoxError('bad_format');
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ct.slice(1, 1 + IV_BYTES), additionalData: aad(blobId) },
      key,
      ct.slice(1 + IV_BYTES),
    );
  } catch {
    throw new BoxError('decrypt_failed');
  }
  try {
    return JSON.parse(new TextDecoder().decode(await pipe(new Uint8Array(plain), new DecompressionStream('gzip'))));
  } catch {
    throw new BoxError('bad_content');
  }
}
