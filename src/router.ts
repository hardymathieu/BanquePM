// Which screen to show, from the path, the fragment and what this device remembers.
// Pure, so it is easy to test. The fragment is read once and then removed (SPEC §7.4).
import { fromBase64url } from './crypto/base64url';
import type { Fragment } from './crypto/links';
import type { StoredKid } from './store/device';

export type Route =
  | { page: 'kid'; id: string; key: Uint8Array }
  | { page: 'parent' }
  | { page: 'landing' }
  | { page: 'not-found' };

export function route(path: string, fragment: Fragment | null, storedKids: StoredKid[]): Route {
  if (fragment?.kind === 'kid') return { page: 'kid', id: fragment.id, key: fragment.key };
  if (path === '/parent' || fragment?.kind === 'parent') return { page: 'parent' };
  if (path !== '/') return { page: 'not-found' };
  for (const kid of storedKids) {
    const key = fromBase64url(kid.key);
    if (key?.length === 32) return { page: 'kid', id: kid.id, key };
  }
  return { page: 'landing' };
}
