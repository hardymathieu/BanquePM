// "Restaurer avec mes 12 mots" (SPEC §10.5): words → candidate roots → the one with a family here.
import * as client from '../api/client';
import { rootsFromWords } from '../crypto/words';
import { type Api, FamilySession } from './session';

export type RestoreResult =
  | { ok: true; root: Uint8Array; session: FamilySession }
  | { ok: false; error: 'count'; count: number }
  | { ok: false; error: 'unknown_words'; positions: number[] }
  | { ok: false; error: 'checksum' | 'not_found' | 'damaged' | 'network' | 'server' };

export async function restoreFromWords(input: string, api: Api = client): Promise<RestoreResult> {
  const words = rootsFromWords(input);
  if (!words.ok) return words;
  let error: 'not_found' | 'damaged' | 'network' | 'server' = 'not_found';
  for (const root of words.roots) {
    const opened = await FamilySession.open(root, api);
    if (opened.ok) return { ok: true, root, session: opened.session };
    if (opened.error !== 'not_found') error = opened.error;
  }
  return { ok: false, error };
}
