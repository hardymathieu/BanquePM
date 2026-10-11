import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetDevice, forgetParent, getCache, getKids, getParent, getTipDismissed, removeKid, saveKid, setCache, setParent, setTipDismissed } from './device';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const throwing = new Proxy({} as Storage, {
  get() {
    throw new DOMException('denied', 'SecurityError');
  },
});

const KID = { id: 'ZUhXPd7qFxdyniFMmiyQBg', key: 'RmF2QZsnJp7vSNV_6J1H_AsBV7kIT4Ek746ZIx4UrTY', name: 'Léa' };

afterEach(() => vi.unstubAllGlobals());

describe('device storage (SPEC §10.3)', () => {
  it('remembers kids, most recent first, without duplicates', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveKid(KID);
    saveKid({ id: 'gqxF2BhvFh7iQQPhYfWclA', key: 'k2', name: 'Tom' });
    saveKid({ ...KID, name: 'Léa B.' });
    expect(getKids().map((k) => k.name)).toEqual(['Léa B.', 'Tom']);
    removeKid('gqxF2BhvFh7iQQPhYfWclA');
    expect(getKids()).toEqual([{ ...KID, name: 'Léa B.' }]);
  });

  it('removing a kid also forgets its cached blob', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    saveKid(KID);
    setCache(KID.id, { version: 3, ct: 'AQID', fetchedOn: '2026-10-10' });
    removeKid(KID.id);
    expect(getCache(KID.id)).toBeNull();
  });

  it('caches the last ciphertext and version', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    setCache(KID.id, { version: 3, ct: 'AQID', fetchedOn: '2026-10-10' });
    expect(getCache(KID.id)).toEqual({ version: 3, ct: 'AQID', fetchedOn: '2026-10-10' });
  });

  it('ignores corrupted entries', () => {
    const s = memoryStorage();
    vi.stubGlobal('localStorage', s);
    s.setItem('bpm.kids', '{nope');
    s.setItem(`bpm.cache.${KID.id}`, JSON.stringify({ version: 'x' }));
    expect(getKids()).toEqual([]);
    expect(getCache(KID.id)).toBeNull();
    s.setItem('bpm.kids', JSON.stringify([{ id: 1 }, KID]));
    expect(getKids()).toEqual([KID]);
  });

  it('keeps working, without remembering, when storage throws', () => {
    vi.stubGlobal('localStorage', throwing);
    expect(() => saveKid(KID)).not.toThrow();
    expect(getKids()).toEqual([]);
    expect(() => setCache(KID.id, { version: 1, ct: 'AQID', fetchedOn: '2026-10-10' })).not.toThrow();
    expect(getCache(KID.id)).toBeNull();
    expect(() => removeKid(KID.id)).not.toThrow();
  });

  it('keeps working when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getKids()).toEqual([]);
    expect(() => saveKid(KID)).not.toThrow();
  });
});

describe('parent root (SPEC §10.3)', () => {
  it('remembers and forgets the parent root', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(getParent()).toBeNull();
    setParent('AAECAwQFBgcICQoLDA0ODw');
    expect(getParent()).toBe('AAECAwQFBgcICQoLDA0ODw');
    forgetParent();
    expect(getParent()).toBeNull();
  });

  it('"Oublier cet appareil" forgets the parent root, the kids and every cache', () => {
    const s = memoryStorage();
    vi.stubGlobal('localStorage', s);
    setParent('AAECAwQFBgcICQoLDA0ODw');
    saveKid(KID);
    setCache(KID.id, { version: 1, ct: 'AQID', fetchedOn: '2026-10-10' });
    s.setItem('unrelated', 'keep');
    forgetDevice();
    expect(getParent()).toBeNull();
    expect(getKids()).toEqual([]);
    expect(getCache(KID.id)).toBeNull();
    expect(s.getItem('unrelated')).toBe('keep');
  });

  it('survives throwing storage', () => {
    vi.stubGlobal('localStorage', throwing);
    expect(() => setParent('x')).not.toThrow();
    expect(getParent()).toBeNull();
    expect(() => forgetDevice()).not.toThrow();
  });
});

describe('monthly tip (SPEC §11)', () => {
  it('remembers the month it was dismissed, and survives throwing storage', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(getTipDismissed()).toBeNull();
    setTipDismissed('2026-10');
    expect(getTipDismissed()).toBe('2026-10');
    vi.stubGlobal('localStorage', throwing);
    expect(getTipDismissed()).toBeNull();
    expect(() => setTipDismissed('2026-10')).not.toThrow();
  });
});
