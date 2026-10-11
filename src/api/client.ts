// Typed fetch wrapper for /api/v1 (SPEC §5.2). Same origin only; ids are capabilities,
// so nothing else (no names, no keys) ever goes into a URL. Headers carry only
// write tokens and invite codes, never anything readable about the family.

export type ApiError =
  | 'not_found'
  | 'conflict'
  | 'exists'
  | 'bad_token'
  | 'bad_invite'
  | 'too_large'
  | 'too_many_kids'
  | 'admin_disabled'
  | 'network'
  | 'server';

export type GetBlobResult = { ok: true; version: number; ct: string } | { ok: false; error: ApiError };
export type WriteResult = { ok: true; version: number } | { ok: false; error: 'conflict'; version: number } | { ok: false; error: ApiError };

const BASE = '/api/v1';
const INIT: RequestInit = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };

const ERRORS: Record<string, ApiError> = {
  not_found: 'not_found',
  version_conflict: 'conflict',
  exists: 'exists',
  bad_token: 'bad_token',
  bad_invite: 'bad_invite',
  too_large: 'too_large',
  too_many_kids: 'too_many_kids',
  admin_disabled: 'admin_disabled',
};

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> } | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...INIT, ...init });
  } catch {
    return null;
  }
  let body: Record<string, unknown> = {};
  try {
    if (res.status !== 204) body = (await res.json()) as Record<string, unknown>;
  } catch {
    // keep {}
  }
  return { status: res.status, body };
}

function failure(r: { status: number; body: Record<string, unknown> } | null): { ok: false; error: ApiError } {
  if (!r) return { ok: false, error: 'network' };
  return { ok: false, error: ERRORS[String(r.body.error)] ?? (r.status === 404 ? 'not_found' : 'server') };
}

function written(r: { status: number; body: Record<string, unknown> } | null, okStatus: number): WriteResult {
  if (r?.status === okStatus && typeof r.body.version === 'number') return { ok: true, version: r.body.version };
  if (r?.status === 409 && r.body.error === 'version_conflict' && typeof r.body.version === 'number') {
    return { ok: false, error: 'conflict', version: r.body.version };
  }
  return failure(r);
}

export async function getBlob(id: string): Promise<GetBlobResult> {
  const r = await call(`/blobs/${id}`);
  if (r?.status === 200 && typeof r.body.version === 'number' && typeof r.body.ct === 'string') {
    return { ok: true, version: r.body.version, ct: r.body.ct };
  }
  return r?.status === 200 ? { ok: false, error: 'server' } : failure(r);
}

export async function putBlob(id: string, token: string, version: number, ct: string): Promise<WriteResult> {
  return written(
    await call(`/blobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ct }),
      headers: { Authorization: `Bearer ${token}`, 'If-Match': String(version) },
    }),
    200,
  );
}

export type NewBlob = { id: string; writeHash: string; ct: string };
export type CreateAuth = { invite: string } | { parentId: string; familyToken: string };

export async function postBlob(blob: NewBlob, auth: CreateAuth): Promise<WriteResult> {
  const headers: Record<string, string> =
    'invite' in auth ? { 'X-Invite': auth.invite } : { 'X-Parent-Id': auth.parentId, Authorization: `Bearer ${auth.familyToken}` };
  return written(await call('/blobs', { method: 'POST', body: JSON.stringify(blob), headers }), 201);
}

export async function deleteBlob(id: string, token: string): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  const r = await call(`/blobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return r?.status === 204 ? { ok: true } : failure(r);
}

/** Instance owner only (SPEC §5.2). The admin token goes in a header, never in a URL. */
export async function mintInvite(
  adminToken: string,
  days: number,
): Promise<{ ok: true; code: string; expiresOn: string } | { ok: false; error: ApiError }> {
  const r = await call('/invites', { method: 'POST', body: JSON.stringify({ days }), headers: { Authorization: `Bearer ${adminToken}` } });
  if (r?.status === 201 && typeof r.body.code === 'string' && typeof r.body.expiresOn === 'string') {
    return { ok: true, code: r.body.code, expiresOn: r.body.expiresOn };
  }
  return failure(r);
}
