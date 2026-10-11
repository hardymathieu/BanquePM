// The single family hook (CLAUDE.md): load, decrypt, save (family blob, then kid blobs), 409.
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { FamilyDoc } from '../../engine/types';
import { type Change, FamilySession, type LoadError, type SaveResult } from '../../family/session';
import { localToday } from '../shared/today';

export type FamilyState =
  | { status: 'loading' }
  | { status: 'error'; error: LoadError }
  | { status: 'ready'; session: FamilySession; family: FamilyDoc };

export function useFamily(root: Uint8Array) {
  const [state, setState] = useState<FamilyState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const opened = await FamilySession.open(root);
    setState(opened.ok ? { status: 'ready', session: opened.session, family: opened.session.family } : { status: 'error', error: opened.error });
  }, [root]);

  useEffect(() => {
    void load();
  }, [load]);

  const session = state.status === 'ready' ? state.session : null;
  const refresh = useCallback(() => session && setState({ status: 'ready', session, family: session.family }), [session]);

  const save = useCallback(
    async (change: Change): Promise<SaveResult> => {
      if (!session) return { ok: false, error: 'server' };
      const res = await session.save(change, localToday());
      refresh();
      return res;
    },
    [session, refresh],
  );

  const revoke = useCallback(
    async (slot: number) => {
      if (!session) return { ok: false as const, error: 'server' as const };
      const res = await session.revoke(slot, localToday());
      refresh();
      return res;
    },
    [session, refresh],
  );

  const reload = useCallback(async () => {
    if (!session) return load();
    const res = await session.reload();
    if (res.ok) refresh();
    else setState({ status: 'error', error: res.error });
  }, [session, refresh, load]);

  return { state, save, revoke, reload, retry: load };
}
