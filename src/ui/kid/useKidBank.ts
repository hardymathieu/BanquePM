// Loads one kid blob (SPEC §8 behaviour): show the cached copy at once, then fetch.
// Refetch when the page becomes visible again. 404 means the link was revoked.
import { useEffect, useState } from 'preact/hooks';
import { getBlob } from '../../api/client';
import { fromBase64url, toBase64url } from '../../crypto/base64url';
import { importBoxKey, open } from '../../crypto/box';
import { parseKidPublicDoc } from '../../engine/schema';
import type { IsoDate, KidPublicDoc } from '../../engine/types';
import { getCache, removeKid, saveKid, setCache } from '../../store/device';
import { localToday } from '../shared/today';

export type KidState =
  | { status: 'loading' }
  | { status: 'ready'; doc: KidPublicDoc; today: IsoDate; staleSince: IsoDate | null }
  | { status: 'revoked' }
  | { status: 'error' };

async function decode(key: CryptoKey, id: string, ct: string): Promise<KidPublicDoc | null> {
  const bytes = fromBase64url(ct);
  if (!bytes) return null;
  try {
    return parseKidPublicDoc(await open(key, id, bytes));
  } catch {
    return null;
  }
}

export function useKidBank(id: string, rawKey: Uint8Array): KidState {
  const [state, setState] = useState<KidState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    let shown: KidPublicDoc | null = null;
    const keyPromise = importBoxKey(rawKey);
    const set = (s: KidState) => alive && setState(s);
    const remember = (name: string) => saveKid({ id, key: toBase64url(rawKey), name });

    async function load() {
      const key = await keyPromise;
      const today = localToday();
      const cached = getCache(id);
      if (!shown && cached) {
        shown = await decode(key, id, cached.ct);
        if (shown) set({ status: 'ready', doc: shown, today, staleSince: null });
      }

      const res = await getBlob(id);
      if (res.ok) {
        const doc = shown && cached?.version === res.version ? shown : await decode(key, id, res.ct);
        if (!doc) return set({ status: 'error' });
        shown = doc;
        setCache(id, { version: res.version, ct: res.ct, fetchedOn: today });
        remember(doc.kid.name);
        return set({ status: 'ready', doc, today, staleSince: null });
      }
      if (res.error === 'not_found') {
        removeKid(id);
        shown = null;
        return set({ status: 'revoked' });
      }
      set(shown && cached ? { status: 'ready', doc: shown, today, staleSince: cached.fetchedOn } : { status: 'error' });
    }

    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, rawKey]);

  return state;
}
