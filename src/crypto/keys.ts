// Root secret ↔ recovery words, and HKDF derivations (SPEC §7.1, §7.2).
import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { wordlist as french } from '@scure/bip39/wordlists/french.js';
import { toBase64url } from './base64url';

export const ROOT_BYTES = 16;
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

/** AES-256-GCM key for box.ts. Non-extractable: raw bytes only exist where a link needs them. */
export function importBoxKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
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

// ---- Recovery words ----

const LISTS = { en: english, fr: french } as const;

/** Lowercase, no accents, so "Agreable", "agréable" and its NFD form all match. */
const fold = (w: string) => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const FOLDED = Object.fromEntries(
  Object.entries(LISTS).map(([locale, list]) => [locale, new Map(list.map((w) => [fold(w), w]))]),
) as Record<keyof typeof LISTS, Map<string, string>>;

/** 12 BIP39 words, NFC-normalized for display. */
export function rootToWords(root: Uint8Array, locale: 'fr' | 'en'): string[] {
  checkRoot(root);
  return entropyToMnemonic(root, LISTS[locale]).normalize('NFC').split(' ');
}

export type WordsResult =
  | { ok: true; roots: Uint8Array[] }
  | { ok: false; error: 'count'; count: number }
  | { ok: false; error: 'unknown_words'; positions: number[] }
  | { ok: false; error: 'checksum' };

/**
 * Accepts French or English words in any case, with or without accents.
 * Returns every root whose checksum matches (almost always one). 123 words
 * are in both lists, so the restore flow tries each root until one exists.
 */
export function rootsFromWords(input: string): WordsResult {
  const words = input.trim().split(/\s+/).filter(Boolean).map(fold);
  if (words.length !== 12) return { ok: false, error: 'count', count: words.length };

  const unknown = words.flatMap((w, i) => (FOLDED.en.has(w) || FOLDED.fr.has(w) ? [] : [i]));
  if (unknown.length) return { ok: false, error: 'unknown_words', positions: unknown };

  const roots: Uint8Array[] = [];
  for (const locale of ['fr', 'en'] as const) {
    const canonical = words.map((w) => FOLDED[locale].get(w));
    if (canonical.some((w) => w === undefined)) continue;
    try {
      roots.push(mnemonicToEntropy(canonical.join(' '), LISTS[locale]));
    } catch {
      // checksum mismatch in this language
    }
  }
  return roots.length ? { ok: true, roots } : { ok: false, error: 'checksum' };
}
