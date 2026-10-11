// What this device remembers (SPEC §10.3). Every access is wrapped: when storage
// throws (private mode, blocked site data), the app works and simply forgets.
// Keys never contain secrets; values may (kid keys, the parent root), by design.

export type StoredKid = { id: string; key: string; name: string };
export type CachedBlob = { version: number; ct: string; fetchedOn: string };

const KIDS = 'bpm.kids';
const cacheKey = (id: string) => `bpm.cache.${id}`;

function read(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: not remembering is fine
  }
}

function remove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // same
  }
}

const isStoredKid = (v: unknown): v is StoredKid =>
  typeof v === 'object' && v !== null && ['id', 'key', 'name'].every((k) => typeof (v as Record<string, unknown>)[k] === 'string');

export function getKids(): StoredKid[] {
  const v = read(KIDS);
  return Array.isArray(v) ? v.filter(isStoredKid) : [];
}

/** Adds or updates a kid, moving it to the front (most recently opened). */
export function saveKid(kid: StoredKid): void {
  write(KIDS, [kid, ...getKids().filter((k) => k.id !== kid.id)]);
}

export function removeKid(id: string): void {
  write(KIDS, getKids().filter((k) => k.id !== id));
  remove(cacheKey(id));
}

export function getCache(id: string): CachedBlob | null {
  const v = read(cacheKey(id)) as Partial<CachedBlob> | null;
  return v && typeof v.version === 'number' && typeof v.ct === 'string' && typeof v.fetchedOn === 'string'
    ? { version: v.version, ct: v.ct, fetchedOn: v.fetchedOn }
    : null;
}

export function setCache(id: string, entry: CachedBlob): void {
  write(cacheKey(id), entry);
}

const PARENT = 'bpm.parent';

/** The parent root (base64url), when "Se souvenir sur cet appareil" is on. */
export function getParent(): string | null {
  const v = read(PARENT);
  return typeof v === 'string' ? v : null;
}

export function setParent(root: string): void {
  write(PARENT, root);
}

export function forgetParent(): void {
  remove(PARENT);
}

/** "Oublier cet appareil": every key this app wrote, and nothing else. */
export function forgetDevice(): void {
  try {
    const s = globalThis.localStorage;
    if (!s) return;
    const ours: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith('bpm.')) ours.push(k);
    }
    for (const k of ours) s.removeItem(k);
  } catch {
    // nothing to forget
  }
}

const TIP = 'bpm.tipDismissed';

/** The month ('YYYY-MM') the recovery-card tip was last dismissed on this device. */
export function getTipDismissed(): string | null {
  const v = read(TIP);
  return typeof v === 'string' ? v : null;
}

export function setTipDismissed(month: string): void {
  write(TIP, month);
}
