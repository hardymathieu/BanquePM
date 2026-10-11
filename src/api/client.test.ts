import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteBlob, getBlob, postBlob, putBlob } from './client';

afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe('getBlob', () => {
  it('returns version and ciphertext', async () => {
    respond(200, { version: 3, ct: 'AQID' });
    expect(await getBlob('ZUhXPd7qFxdyniFMmiyQBg')).toEqual({ ok: true, version: 3, ct: 'AQID' });
  });

  it('asks only its own origin, without cache or referrer', async () => {
    respond(200, { version: 1, ct: 'AQID' });
    await getBlob('ZUhXPd7qFxdyniFMmiyQBg');
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/v1/blobs/ZUhXPd7qFxdyniFMmiyQBg');
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('tells a missing blob from a server or network problem', async () => {
    respond(404, { error: 'not_found' });
    expect(await getBlob('x')).toEqual({ ok: false, error: 'not_found' });
    respond(500, { error: 'internal' });
    expect(await getBlob('x')).toEqual({ ok: false, error: 'server' });
    respond(200, { version: 'nope' });
    expect(await getBlob('x')).toEqual({ ok: false, error: 'server' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await getBlob('x')).toEqual({ ok: false, error: 'network' });
  });
});

describe('putBlob', () => {
  it('sends the token and the version, and returns the new version', async () => {
    respond(200, { version: 4 });
    expect(await putBlob('ID', 'TOKEN', 3, 'AQID')).toEqual({ ok: true, version: 4 });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/v1/blobs/ID');
    expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify({ ct: 'AQID' }), credentials: 'omit' });
    expect(new Headers(init!.headers).get('Authorization')).toBe('Bearer TOKEN');
    expect(new Headers(init!.headers).get('If-Match')).toBe('3');
  });

  it('reports a version conflict with the current version', async () => {
    respond(409, { error: 'version_conflict', version: 7 });
    expect(await putBlob('ID', 'T', 3, 'AQID')).toEqual({ ok: false, error: 'conflict', version: 7 });
  });

  it('reports not found, bad token and too large', async () => {
    respond(404, { error: 'not_found' });
    expect(await putBlob('ID', 'T', 1, 'A')).toEqual({ ok: false, error: 'not_found' });
    respond(401, { error: 'bad_token' });
    expect(await putBlob('ID', 'T', 1, 'A')).toEqual({ ok: false, error: 'bad_token' });
    respond(413, { error: 'too_large' });
    expect(await putBlob('ID', 'T', 1, 'A')).toEqual({ ok: false, error: 'too_large' });
  });
});

describe('postBlob', () => {
  it('creates a family blob with an invite', async () => {
    respond(201, { version: 1 });
    expect(await postBlob({ id: 'ID', writeHash: 'H', ct: 'C' }, { invite: 'ABCDE-23456' })).toEqual({ ok: true, version: 1 });
    const init = vi.mocked(fetch).mock.calls[0]![1]!;
    expect(new Headers(init.headers).get('X-Invite')).toBe('ABCDE-23456');
  });

  it('creates a kid blob under its family', async () => {
    respond(201, { version: 1 });
    await postBlob({ id: 'ID', writeHash: 'H', ct: 'C' }, { parentId: 'FAM', familyToken: 'FT' });
    const h = new Headers(vi.mocked(fetch).mock.calls[0]![1]!.headers);
    expect(h.get('X-Parent-Id')).toBe('FAM');
    expect(h.get('Authorization')).toBe('Bearer FT');
  });

  it('reports exists, bad invite and too many kids', async () => {
    respond(409, { error: 'exists' });
    expect(await postBlob({ id: 'I', writeHash: 'H', ct: 'C' }, { invite: 'X' })).toEqual({ ok: false, error: 'exists' });
    respond(401, { error: 'bad_invite' });
    expect(await postBlob({ id: 'I', writeHash: 'H', ct: 'C' }, { invite: 'X' })).toEqual({ ok: false, error: 'bad_invite' });
    respond(429, { error: 'too_many_kids' });
    expect(await postBlob({ id: 'I', writeHash: 'H', ct: 'C' }, { invite: 'X' })).toEqual({ ok: false, error: 'too_many_kids' });
  });
});

describe('deleteBlob', () => {
  it('deletes with the write token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    expect(await deleteBlob('ID', 'T')).toEqual({ ok: true });
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: 'DELETE' });
  });
});
