import { describe, expect, it } from 'vitest';
import { BoxError, open, seal } from './box';
import { importBoxKey } from './keys';

const keyA = () => importBoxKey(new Uint8Array(32).fill(1));
const keyB = () => importBoxKey(new Uint8Array(32).fill(2));
const ID = 'h87_z6uLAE4aGqoBi0vXSw';
const DOC = { format: 'bpm-kid', v: 1, kid: { name: 'Léa', note: 'Pour ton vélo 🚲' } };

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'no error';
  } catch (e) {
    return e instanceof BoxError ? e.code : `other: ${String(e)}`;
  }
}

describe('box (SPEC §7.3)', () => {
  it('round-trips JSON', async () => {
    const key = await keyA();
    expect(await open(key, ID, await seal(key, ID, DOC))).toEqual(DOC);
  });

  it('starts with format byte 0x01, then a 12-byte IV', async () => {
    const ct = await seal(await keyA(), ID, DOC);
    expect(ct[0]).toBe(1);
    expect(ct.length).toBeGreaterThan(1 + 12 + 16);
  });

  it('uses a fresh IV on every write', async () => {
    const key = await keyA();
    const a = await seal(key, ID, DOC);
    const b = await seal(key, ID, DOC);
    expect(a.slice(1, 13)).not.toEqual(b.slice(1, 13));
  });

  it('compresses before encrypting', async () => {
    const big = { rows: Array.from({ length: 500 }, () => 'dimanche à la banque') };
    expect((await seal(await keyA(), ID, big)).length).toBeLessThan(JSON.stringify(big).length / 10);
  });

  it('fails with the wrong key', async () => {
    const ct = await seal(await keyA(), ID, DOC);
    expect(await code(open(await keyB(), ID, ct))).toBe('decrypt_failed');
  });

  it('fails with the wrong blob id (AAD), so blobs cannot be swapped', async () => {
    const key = await keyA();
    const ct = await seal(key, ID, DOC);
    expect(await code(open(key, 'ZUhXPd7qFxdyniFMmiyQBg', ct))).toBe('decrypt_failed');
  });

  it('fails on a tampered ciphertext', async () => {
    const key = await keyA();
    const ct = await seal(key, ID, DOC);
    ct[ct.length - 1]! ^= 1;
    expect(await code(open(key, ID, ct))).toBe('decrypt_failed');
  });

  it('refuses an unknown format byte or a truncated blob', async () => {
    const key = await keyA();
    const ct = await seal(key, ID, DOC);
    ct[0] = 2;
    expect(await code(open(key, ID, ct))).toBe('bad_format');
    expect(await code(open(key, ID, new Uint8Array(20)))).toBe('bad_format');
  });

  it('never puts the plaintext or the key in an error message', async () => {
    const key = await keyA();
    const ct = await seal(key, ID, DOC);
    try {
      await open(await keyB(), ID, ct);
    } catch (e) {
      expect(String(e)).not.toContain('Léa');
      expect(String(e)).not.toContain(ID);
    }
  });
});
