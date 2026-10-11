// Root secret ↔ 12 recovery words (SPEC §7.1, §10.5). Kept apart: the wordlists are big.
import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { wordlist as french } from '@scure/bip39/wordlists/french.js';
import { ROOT_BYTES } from './sizes';

function checkRoot(root: Uint8Array): void {
  if (root.length !== ROOT_BYTES) throw new RangeError('root must be 16 bytes');
}

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
