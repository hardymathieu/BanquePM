// In-memory stand-in for /api/v1 with the Worker's rules (versions, tokens, parents),
// for testing the session logic in Node. Test-only.
import type { Api } from './session';
import type { CreateAuth, NewBlob } from '../api/client';
import { writeHashOf } from '../crypto/keys';

type Row = { parent: string | null; writeHash: string; version: number; ct: string };

export function fakeApi() {
  const rows = new Map<string, Row>();
  const log: string[] = [];
  let failNext: null | 'network' | 'conflict' = null;

  const api: Api = {
    async getBlob(id) {
      log.push(`GET ${id}`);
      const r = rows.get(id);
      return r ? { ok: true, version: r.version, ct: r.ct } : { ok: false, error: 'not_found' };
    },
    async putBlob(id, token, version, ct) {
      log.push(`PUT ${id}`);
      if (failNext === 'network') return (failNext = null), { ok: false, error: 'network' };
      const r = rows.get(id);
      if (!r) return { ok: false, error: 'not_found' };
      if ((await writeHashOf(token)) !== r.writeHash) return { ok: false, error: 'bad_token' };
      if (failNext === 'conflict') {
        r.version++;
        return { ok: false, error: 'conflict', version: r.version };
      }
      if (r.version !== version) return { ok: false, error: 'conflict', version: r.version };
      r.version++;
      r.ct = ct;
      return { ok: true, version: r.version };
    },
    async postBlob(blob: NewBlob, auth: CreateAuth) {
      log.push(`POST ${blob.id}`);
      if (rows.has(blob.id)) return { ok: false, error: 'exists' };
      let parent: string | null = null;
      if ('parentId' in auth) {
        const p = rows.get(auth.parentId);
        if (!p || p.parent !== null || (await writeHashOf(auth.familyToken)) !== p.writeHash) return { ok: false, error: 'bad_token' };
        parent = auth.parentId;
      }
      rows.set(blob.id, { parent, writeHash: blob.writeHash, version: 1, ct: blob.ct });
      return { ok: true, version: 1 };
    },
    async deleteBlob(id, token) {
      log.push(`DELETE ${id}`);
      const r = rows.get(id);
      if (!r) return { ok: false, error: 'not_found' };
      if ((await writeHashOf(token)) !== r.writeHash) return { ok: false, error: 'bad_token' };
      for (const [k, v] of rows) if (v.parent === id) rows.delete(k);
      rows.delete(id);
      return { ok: true };
    },
  };

  return {
    api,
    rows,
    log,
    /** The next PUT fails this way (a conflict also bumps the stored version, as another device would). */
    failNextPut(kind: 'network' | 'conflict') {
      failNext = kind;
    },
  };
}
