// Capability links. Secrets live only in the fragment, which browsers never send (SPEC §7).
import { fromBase64url, toBase64url } from './base64url';
import { ID_BYTES, KEY_BYTES, ROOT_BYTES } from './sizes';

export type Fragment =
  | { kind: 'parent'; root: Uint8Array }
  | { kind: 'kid'; id: string; key: Uint8Array }
  | { kind: 'invite'; code: string };

export function parentLink(origin: string, root: Uint8Array): string {
  return `${origin}/parent#p=${toBase64url(root)}`;
}

export function kidLink(origin: string, kidId: string, kidKey: Uint8Array): string {
  return `${origin}/#k=${kidId}.${toBase64url(kidKey)}`;
}

/** "Voir comme Léa": the kid view without remembering the kid on the parent's device. */
export function kidPreviewLink(origin: string, kidId: string, kidKey: Uint8Array): string {
  return `${origin}/apercu#k=${kidId}.${toBase64url(kidKey)}`;
}

function bytesOf(s: string, length: number): Uint8Array | null {
  const b = fromBase64url(s);
  return b && b.length === length ? b : null;
}

/** Parses `location.hash`. Anything malformed is null, never an error that could echo the secret. */
export function parseFragment(hash: string): Fragment | null {
  const m = /^#([pki])=(.+)$/.exec(hash);
  if (!m) return null;
  const [, kind, value] = m as unknown as [string, 'p' | 'k' | 'i', string];
  if (kind === 'p') {
    const root = bytesOf(value, ROOT_BYTES);
    return root && { kind: 'parent', root };
  }
  if (kind === 'k') {
    const [id = '', keyText = '', ...rest] = value.split('.');
    const key = bytesOf(keyText, KEY_BYTES);
    return key && !rest.length && bytesOf(id, ID_BYTES) ? { kind: 'kid', id, key } : null;
  }
  return { kind: 'invite', code: value };
}
