// Typed fetch wrapper for /api/v1 (SPEC §5.2). Same origin only; ids are capabilities,
// so nothing else (no names, no keys) ever goes into a URL or a header.

export type ApiError = 'not_found' | 'network' | 'server';
export type GetBlobResult = { ok: true; version: number; ct: string } | { ok: false; error: ApiError };

const BASE = '/api/v1';
const INIT: RequestInit = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };

export async function getBlob(id: string): Promise<GetBlobResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/blobs/${id}`, INIT);
  } catch {
    return { ok: false, error: 'network' };
  }
  if (res.status === 404) return { ok: false, error: 'not_found' };
  if (!res.ok) return { ok: false, error: 'server' };
  try {
    const body = (await res.json()) as { version?: unknown; ct?: unknown };
    if (typeof body.version === 'number' && typeof body.ct === 'string') return { ok: true, version: body.version, ct: body.ct };
  } catch {
    // fall through
  }
  return { ok: false, error: 'server' };
}
