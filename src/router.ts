// Which screen to show, from the path, the fragment and what this device remembers.
// Pure, so it is easy to test. The fragment is read once and then removed (SPEC §7.4).
import { fromBase64url } from './crypto/base64url';
import type { Fragment } from './crypto/links';
import type { ExportFile } from './engine/types';
import type { StoredKid } from './store/device';

export type Route =
  | { page: 'kid'; id: string; key: Uint8Array; remember: boolean }
  | { page: 'parent'; root: Uint8Array | null }
  | { page: 'landing' }
  /** `adminToken` comes from /admin, in memory only: the owner's own bank (SPEC §10.1). */
  | { page: 'create'; invite: string | null; adminToken?: string; fromBackup?: ExportFile }
  /** The offline viewer (SPEC §11): the file is read in the browser and kept in memory only. */
  | { page: 'backup'; file: ExportFile | null }
  /** Several kids on one phone (SPEC §10.3). Never leads to the parent app. */
  | { page: 'picker' }
  | { page: 'privacy' }
  | { page: 'restore' }
  | { page: 'admin' }
  | { page: 'not-found' };

/** "Voir comme Léa" from the parent app: the kid view, leaving no trace on the device. */
export const PREVIEW = '/apercu';

export function route(path: string, fragment: Fragment | null, storedKids: StoredKid[]): Route {
  if (fragment?.kind === 'kid') return { page: 'kid', id: fragment.id, key: fragment.key, remember: path !== PREVIEW };
  if (fragment?.kind === 'parent') return { page: 'parent', root: fragment.root };
  if (fragment?.kind === 'invite') return { page: 'create', invite: fragment.code };
  if (path === '/parent') return { page: 'parent', root: null };
  if (path === '/creer') return { page: 'create', invite: null };
  if (path === '/restaurer') return { page: 'restore' };
  if (path === '/admin') return { page: 'admin' };
  if (path === '/sauvegarde') return { page: 'backup', file: null };
  if (path === '/confidentialite') return { page: 'privacy' };
  if (path !== '/') return { page: 'not-found' };
  const usable = storedKids.flatMap((kid) => {
    const key = fromBase64url(kid.key);
    return key?.length === 32 ? [{ id: kid.id, key }] : [];
  });
  if (usable.length > 1) return { page: 'picker' };
  if (usable[0]) return { page: 'kid', id: usable[0].id, key: usable[0].key, remember: true };
  return { page: 'landing' };
}

export const PATHS: Record<Route['page'], string> = {
  kid: '/',
  parent: '/parent',
  landing: '/',
  create: '/creer',
  restore: '/restaurer',
  admin: '/admin',
  backup: '/sauvegarde',
  picker: '/',
  privacy: '/confidentialite',
  'not-found': '/',
};
