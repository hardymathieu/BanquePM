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
