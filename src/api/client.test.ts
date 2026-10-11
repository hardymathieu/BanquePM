import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBlob } from './client';

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
