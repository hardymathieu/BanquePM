// Golden values were computed independently with Python's hmac/hashlib
// (RFC 5869 HKDF) and a from-scratch BIP39, not with this code.
import { describe, expect, it } from 'vitest';
import { toBase64url } from './base64url';
import { open, seal } from './box';
import { deriveFamily, deriveKid, generateRoot, hkdf, importBoxKey, rootsFromWords, rootToWords, writeHashOf } from './keys';

const ROOT = Uint8Array.from({ length: 16 }, (_, i) => i); // 000102…0f
const b64 = async (p: Promise<Uint8Array>) => toBase64url(await p);

describe('HKDF golden values for root 000102…0f (SPEC §7.2)', () => {
  it.each([
    ['family/id', 16, 'h87_z6uLAE4aGqoBi0vXSw'],
    ['family/key', 32, 'S16DYk-Yu53LXg47Iiw1Zn3YyXo0WkYSDN0LoiLdZNc'],
    ['family/write', 32, '5HjPAFOnN2_45-qnQjMu1Xt7sp9X5mA4LhuXvmpGB9w'],
    ['kid/0/id', 16, 'ZUhXPd7qFxdyniFMmiyQBg'],
    ['kid/0/key', 32, 'RmF2QZsnJp7vSNV_6J1H_AsBV7kIT4Ek746ZIx4UrTY'],
    ['kid/0/write', 32, '8NMaC6DG4OYG8HV_lfJpUcWmW7VXdIKDXUnb9JWhX6o'],
    ['kid/1/id', 16, 'gqxF2BhvFh7iQQPhYfWclA'],
  ] as const)('%s', async (info, length, expected) => {
    expect(await b64(hkdf(ROOT, info, length))).toBe(expected);
  });

  it('derives the family id, write token and write hash', async () => {
    const f = await deriveFamily(ROOT);
    expect(f.id).toBe('h87_z6uLAE4aGqoBi0vXSw');
    expect(f.writeToken).toBe('5HjPAFOnN2_45-qnQjMu1Xt7sp9X5mA4LhuXvmpGB9w');
    expect(f.writeHash).toBe('u-JY0NN8URPnDY9mMOYroqapImCODcwcJqIH6zmRL2E');
  });

  it('derives a kid slot', async () => {
    const k = await deriveKid(ROOT, 0);
    expect(k.id).toBe('ZUhXPd7qFxdyniFMmiyQBg');
    expect(toBase64url(k.rawKey)).toBe('RmF2QZsnJp7vSNV_6J1H_AsBV7kIT4Ek746ZIx4UrTY');
    expect(k.writeToken).toBe('8NMaC6DG4OYG8HV_lfJpUcWmW7VXdIKDXUnb9JWhX6o');
    expect(k.writeHash).toBe('b-MqSx_RhBSHwVHhDO_QrIgnlMICXLBBtRUp4wfNOcY');
    expect((await deriveKid(ROOT, 1)).id).toBe('gqxF2BhvFh7iQQPhYfWclA');
  });

  it('gives a family key that matches the golden raw key', async () => {
    const f = await deriveFamily(ROOT);
    const golden = await importBoxKey(await hkdf(ROOT, 'family/key', 32));
    expect(await open(golden, f.id, await seal(f.key, f.id, { ok: 1 }))).toEqual({ ok: 1 });
  });

  it('keeps derived keys non-extractable', async () => {
    expect((await deriveFamily(ROOT)).key.extractable).toBe(false);
  });

  it('refuses a root that is not 16 bytes, and a bad slot', async () => {
    await expect(deriveFamily(new Uint8Array(15))).rejects.toThrow();
    await expect(deriveKid(ROOT, -1)).rejects.toThrow();
    await expect(deriveKid(ROOT, 1.5)).rejects.toThrow();
  });
});

describe('writeHashOf', () => {
  it('is base64url(SHA-256(UTF-8(token)))', async () => {
    // printf %s abc | sha256sum
    expect(await writeHashOf('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });
});

describe('generateRoot', () => {
  it('returns 16 fresh random bytes', () => {
    const a = generateRoot();
    expect(a).toHaveLength(16);
    expect(toBase64url(a)).not.toBe(toBase64url(generateRoot()));
  });
});

describe('recovery words (SPEC §7.1, §10.5)', () => {
  const EN = 'abandon amount liar amount expire adjust cage candy arch gather drum buyer';
  const FR = 'abaisser agréable inductif agréable éligible achat bolide boucle amateur exister dérober bloquer';

  it('matches the BIP39 English test vectors', () => {
    expect(rootToWords(new Uint8Array(16), 'en').join(' ')).toBe(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    );
    expect(rootToWords(new Uint8Array(16).fill(0x7f), 'en').join(' ')).toBe(
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    );
    expect(rootToWords(new Uint8Array(16).fill(0xff), 'en').join(' ')).toBe('zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong');
  });

  it('gives 12 words in English and French, NFC-normalized for display', () => {
    expect(rootToWords(ROOT, 'en').join(' ')).toBe(EN);
    const fr = rootToWords(ROOT, 'fr');
    expect(fr).toHaveLength(12);
    expect(fr.join(' ')).toBe(FR.normalize('NFC'));
    expect(fr.every((w) => w === w.normalize('NFC'))).toBe(true);
  });

  it('restores from French or English', () => {
    expect(rootsFromWords(FR)).toEqual({ ok: true, roots: [ROOT] });
    expect(rootsFromWords(EN)).toEqual({ ok: true, roots: [ROOT] });
  });

  it('tolerates case, missing accents, decomposed accents and extra spaces', () => {
    const sloppy = '  ABAISSER agreable Inductif  agréable\n eligible achat bolide boucle amateur exister DEROBER bloquer ';
    expect(rootsFromWords(sloppy)).toEqual({ ok: true, roots: [ROOT] });
    expect(rootsFromWords(FR.normalize('NFD'))).toEqual({ ok: true, roots: [ROOT] });
  });

  it('round-trips random roots in both languages', () => {
    for (let i = 0; i < 50; i++) {
      const root = generateRoot();
      for (const locale of ['fr', 'en'] as const) {
        expect(rootsFromWords(rootToWords(root, locale).join(' '))).toEqual({ ok: true, roots: [root] });
      }
    }
  });

  it('reports a wrong word count', () => {
    expect(rootsFromWords('abandon abandon')).toEqual({ ok: false, error: 'count', count: 2 });
  });

  it('reports the positions of unknown words', () => {
    expect(rootsFromWords(EN.replace('liar', 'lyre').replace('buyer', 'byer'))).toEqual({
      ok: false,
      error: 'unknown_words',
      positions: [2, 11],
    });
  });

  it('reports a bad checksum, for example two words swapped', () => {
    const swapped = EN.split(' ');
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(rootsFromWords(swapped.join(' '))).toEqual({ ok: false, error: 'checksum' });
  });
});
