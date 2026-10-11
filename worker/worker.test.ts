// SPEC §5.2 API contract. Runs inside workerd with a real (local) D1.
import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { toBase64url as b64 } from '../src/crypto/base64url';
import { FAMILY_CT_LIMIT, KID_CT_LIMIT, MAX_KIDS } from '../src/limits';
import { handle } from './index';

// ---- helpers ----

const randomB64 = (n: number) => b64(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s: string) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
const ctOf = (n: number, fill = 1) => b64(new Uint8Array(n).fill(fill));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

type Blob = { id: string; token: string; writeHash: string };

async function newBlob(): Promise<Blob> {
  const token = randomB64(32);
  return { id: randomB64(16), token, writeHash: await sha(token) };
}

function api(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`https://bpm.test/api/v1${path}`, init));
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return api(path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });
}

async function createFamily(ct = ctOf(100)): Promise<Blob> {
  const b = await newBlob();
  const r = await post('/blobs', { id: b.id, writeHash: b.writeHash, ct }, { 'X-Invite': env.ADMIN_TOKEN! });
  expect(r.status).toBe(201);
  return b;
}

async function createKid(family: Blob, ct = ctOf(100)): Promise<Response & { blob: Blob }> {
  const b = await newBlob();
  const r = await post('/blobs', { id: b.id, writeHash: b.writeHash, ct }, {
    'X-Parent-Id': family.id,
    Authorization: `Bearer ${family.token}`,
  });
  return Object.assign(r, { blob: b });
}

async function mintInvite(body: unknown = {}): Promise<Response> {
  return post('/invites', body, { Authorization: `Bearer ${env.ADMIN_TOKEN}` });
}

async function error(r: Response): Promise<string> {
  return ((await r.json()) as { error: string }).error;
}

// ---- tests ----

describe('response headers', () => {
  it('sends JSON, no-store, no-referrer and nosniff on success and on errors', async () => {
    for (const r of [await api('/blobs/AAAAAAAAAAAAAAAAAAAAAA'), await mintInvite()]) {
      expect(r.headers.get('Content-Type')).toBe('application/json');
      expect(r.headers.get('Cache-Control')).toBe('no-store');
      expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });
});

describe('router', () => {
  it('404s an unknown API path', async () => {
    const r = await api('/nope');
    expect(r.status).toBe(404);
    expect(await error(r)).toBe('not_found');
  });

  it('has no listing endpoints', async () => {
    expect((await api('/blobs')).status).toBe(405);
    expect((await api('/invites')).status).toBe(405);
  });

  it('405s a wrong method', async () => {
    const r = await api('/blobs/AAAAAAAAAAAAAAAAAAAAAA', { method: 'PATCH' });
    expect(r.status).toBe(405);
    expect(await error(r)).toBe('method_not_allowed');
  });
});

describe('GET /blobs/:id', () => {
  it('returns version and ciphertext', async () => {
    const ct = ctOf(300, 7);
    const f = await createFamily(ct);
    const r = await api(`/blobs/${f.id}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ version: 1, ct });
  });

  it('404s an unknown or malformed id', async () => {
    const r = await api(`/blobs/${randomB64(16)}`);
    expect(r.status).toBe(404);
    expect(await error(r)).toBe('not_found');
    expect((await api('/blobs/not-an-id')).status).toBe(404);
  });
});

describe('POST /blobs (family)', () => {
  it('accepts ADMIN_TOKEN as an unlimited invite', async () => {
    await createFamily();
    await createFamily();
  });

  it('stores a family blob with a minted invite, once', async () => {
    const { code } = (await (await mintInvite()).json()) as { code: string };
    const a = await newBlob();
    const ok = await post('/blobs', { id: a.id, writeHash: a.writeHash, ct: ctOf(10) }, { 'X-Invite': code });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ version: 1 });

    const b = await newBlob();
    const again = await post('/blobs', { id: b.id, writeHash: b.writeHash, ct: ctOf(10) }, { 'X-Invite': code });
    expect(again.status).toBe(401);
    expect(await error(again)).toBe('bad_invite');
  });

  it('lets only one of two simultaneous redemptions through', async () => {
    const { code } = (await (await mintInvite()).json()) as { code: string };
    const [a, b] = [await newBlob(), await newBlob()];
    const results = await Promise.all(
      [a, b].map((x) => post('/blobs', { id: x.id, writeHash: x.writeHash, ct: ctOf(10) }, { 'X-Invite': code })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 401]);
  });

  it('accepts an invite in lower case or without the dash', async () => {
    for (const shape of [(c: string) => c.toLowerCase(), (c: string) => c.replace('-', ''), (c: string) => ` ${c} `]) {
      const { code } = (await (await mintInvite()).json()) as { code: string };
      const b = await newBlob();
      const r = await post('/blobs', { id: b.id, writeHash: b.writeHash, ct: ctOf(10) }, { 'X-Invite': shape(code) });
      expect(r.status).toBe(201);
    }
  });

  it('refuses an expired invite but accepts one on its last day', async () => {
    await env.DB.prepare('INSERT INTO invites (code_hash, expires_on) VALUES (?, ?), (?, ?)')
      .bind(await sha('EXPRD22222'), addDays(today(), -1), await sha('LASTD33333'), today())
      .run();
    const a = await newBlob();
    const expired = await post('/blobs', { id: a.id, writeHash: a.writeHash, ct: ctOf(10) }, { 'X-Invite': 'EXPRD-22222' });
    expect(expired.status).toBe(401);
    const last = await post('/blobs', { id: a.id, writeHash: a.writeHash, ct: ctOf(10) }, { 'X-Invite': 'LASTD-33333' });
    expect(last.status).toBe(201);
  });

  it('refuses a missing or wrong invite', async () => {
    const b = await newBlob();
    const body = { id: b.id, writeHash: b.writeHash, ct: ctOf(10) };
    const attempts: Record<string, string>[] = [{}, { 'X-Invite': 'ZZZZZ-ZZZZZ' }, { 'X-Invite': `${env.ADMIN_TOKEN}x` }];
    for (const headers of attempts) {
      const r = await post('/blobs', body, headers);
      expect(r.status).toBe(401);
      expect(await error(r)).toBe('bad_invite');
    }
  });

  it('refuses ADMIN_TOKEN as an invite when it is shorter than 32 characters', async () => {
    const b = await newBlob();
    const req = new Request('https://bpm.test/api/v1/blobs', {
      method: 'POST',
      body: JSON.stringify({ id: b.id, writeHash: b.writeHash, ct: ctOf(10) }),
      headers: { 'X-Invite': 'short-token' },
    });
    expect((await handle(req, { ...env, ADMIN_TOKEN: 'short-token' })).status).toBe(401);
  });

  it('409s an existing id without spending the invite', async () => {
    const f = await createFamily();
    const { code } = (await (await mintInvite()).json()) as { code: string };
    const dup = await post('/blobs', { id: f.id, writeHash: f.writeHash, ct: ctOf(10) }, { 'X-Invite': code });
    expect(dup.status).toBe(409);
    expect(await error(dup)).toBe('exists');
    const b = await newBlob();
    expect((await post('/blobs', { id: b.id, writeHash: b.writeHash, ct: ctOf(10) }, { 'X-Invite': code })).status).toBe(201);
  });

  it.each([
    ['not JSON', '{'],
    ['an array', '[]'],
    ['a missing ct', { id: 'AAAAAAAAAAAAAAAAAAAAAA', writeHash: 'x'.repeat(43) }],
    ['a short id', { id: 'AAAA', writeHash: 'A'.repeat(43), ct: 'AAAA' }],
    ['a bad write hash', { id: 'AAAAAAAAAAAAAAAAAAAAAA', writeHash: 'nope', ct: 'AAAA' }],
    ['ct that is not base64url', { id: 'AAAAAAAAAAAAAAAAAAAAAA', writeHash: 'A'.repeat(43), ct: 'AA+A' }],
    ['an empty ct', { id: 'AAAAAAAAAAAAAAAAAAAAAA', writeHash: 'A'.repeat(43), ct: '' }],
  ])('400s %s', async (_, body) => {
    const r = await post('/blobs', body, { 'X-Invite': env.ADMIN_TOKEN! });
    expect(r.status).toBe(400);
    expect(await error(r)).toBe('bad_request');
  });

  it('accepts a family ciphertext up to the family limit, and 413s beyond', async () => {
    const big = await newBlob();
    const ok = await post('/blobs', { id: big.id, writeHash: big.writeHash, ct: ctOf(FAMILY_CT_LIMIT) }, { 'X-Invite': env.ADMIN_TOKEN! });
    expect(ok.status).toBe(201);
    const tooBig = await newBlob();
    const r = await post('/blobs', { id: tooBig.id, writeHash: tooBig.writeHash, ct: ctOf(FAMILY_CT_LIMIT + 1) }, { 'X-Invite': env.ADMIN_TOKEN! });
    expect(r.status).toBe(413);
    expect(await error(r)).toBe('too_large');
  });

  it('413s a body over the request limit before parsing it', async () => {
    const r = await post('/blobs', 'x'.repeat(2 * FAMILY_CT_LIMIT), { 'X-Invite': env.ADMIN_TOKEN! });
    expect(r.status).toBe(413);
  });
});

describe('POST /blobs (kid)', () => {
  it('stores a kid blob under its family', async () => {
    const f = await createFamily();
    const r = await createKid(f);
    expect(r.status).toBe(201);
    const row = await env.DB.prepare('SELECT parent_id FROM blobs WHERE id = ?').bind(r.blob.id).first<{ parent_id: string }>();
    expect(row?.parent_id).toBe(f.id);
  });

  it('401s a wrong family token, an unknown family, or a kid posing as a family', async () => {
    const f = await createFamily();
    const kid = (await createKid(f)).blob;
    const b = await newBlob();
    const body = { id: b.id, writeHash: b.writeHash, ct: ctOf(10) };
    const attempts: Record<string, string>[] = [
      { 'X-Parent-Id': f.id, Authorization: `Bearer ${kid.token}` },
      { 'X-Parent-Id': f.id },
      { 'X-Parent-Id': randomB64(16), Authorization: `Bearer ${f.token}` },
      { 'X-Parent-Id': kid.id, Authorization: `Bearer ${kid.token}` },
    ];
    for (const headers of attempts) {
      const r = await post('/blobs', body, headers);
      expect(r.status).toBe(401);
      expect(await error(r)).toBe('bad_token');
    }
  });

  it(`429s the kid after ${MAX_KIDS}`, async () => {
    const f = await createFamily();
    for (let i = 0; i < MAX_KIDS; i++) expect((await createKid(f)).status).toBe(201);
    const r = await createKid(f);
    expect(r.status).toBe(429);
    expect(await error(r)).toBe('too_many_kids');
  });

  it('413s a kid ciphertext over the kid limit', async () => {
    const f = await createFamily();
    expect((await createKid(f, ctOf(KID_CT_LIMIT))).status).toBe(201);
    expect((await createKid(f, ctOf(KID_CT_LIMIT + 1))).status).toBe(413);
  });
});

describe('PUT /blobs/:id', () => {
  const put = (b: Blob, body: unknown, version: string | null, token = b.token) =>
    api(`/blobs/${b.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${token}`, ...(version === null ? {} : { 'If-Match': version }) },
    });

  it('replaces the ciphertext and bumps the version', async () => {
    const f = await createFamily();
    const r = await put(f, { ct: ctOf(20, 9) }, '1');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ version: 2 });
    expect(await (await api(`/blobs/${f.id}`)).json()).toEqual({ version: 2, ct: ctOf(20, 9) });
    expect((await put(f, { ct: ctOf(20, 8) }, '"2"')).status).toBe(200); // quoted ETag form
  });

  it('409s a stale version with the current one', async () => {
    const f = await createFamily();
    await put(f, { ct: ctOf(20) }, '1');
    const r = await put(f, { ct: ctOf(20) }, '1');
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'version_conflict', version: 2 });
  });

  it('400s a missing or malformed If-Match', async () => {
    const f = await createFamily();
    expect((await put(f, { ct: ctOf(20) }, null)).status).toBe(400);
    expect((await put(f, { ct: ctOf(20) }, 'abc')).status).toBe(400);
  });

  it('401s a wrong token and 404s an unknown id', async () => {
    const f = await createFamily();
    const wrong = await put(f, { ct: ctOf(20) }, '1', randomB64(32));
    expect(wrong.status).toBe(401);
    expect(await error(wrong)).toBe('bad_token');
    expect((await put(await newBlob(), { ct: ctOf(20) }, '1')).status).toBe(404);
  });

  it('applies the kid limit to kid blobs and the family limit to family blobs', async () => {
    const f = await createFamily();
    const kid = (await createKid(f)).blob;
    expect((await put(kid, { ct: ctOf(KID_CT_LIMIT + 1) }, '1')).status).toBe(413);
    expect((await put(f, { ct: ctOf(KID_CT_LIMIT + 1) }, '1')).status).toBe(200);
  });

  it('records the month of the write, and nothing finer', async () => {
    const f = await createFamily();
    const row = await env.DB.prepare('SELECT touched_month FROM blobs WHERE id = ?').bind(f.id).first<{ touched_month: string }>();
    expect(row?.touched_month).toBe(today().slice(0, 7));
  });
});

describe('DELETE /blobs/:id', () => {
  const del = (b: Blob, token = b.token) => api(`/blobs/${b.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

  it('deletes a kid blob and leaves its family', async () => {
    const f = await createFamily();
    const kid = (await createKid(f)).blob;
    expect((await del(kid)).status).toBe(204);
    expect((await api(`/blobs/${kid.id}`)).status).toBe(404);
    expect((await api(`/blobs/${f.id}`)).status).toBe(200);
  });

  it('deletes a family blob and all its kid blobs', async () => {
    const f = await createFamily();
    const kids = [(await createKid(f)).blob, (await createKid(f)).blob];
    expect((await del(f)).status).toBe(204);
    for (const b of [f, ...kids]) expect((await api(`/blobs/${b.id}`)).status).toBe(404);
  });

  it('401s a wrong token and 404s an unknown id', async () => {
    const f = await createFamily();
    expect((await del(f, randomB64(32))).status).toBe(401);
    expect((await del(await newBlob())).status).toBe(404);
  });
});

describe('POST /invites', () => {
  it('mints a code valid for 14 days by default', async () => {
    const r = await mintInvite();
    expect(r.status).toBe(201);
    const { code, expiresOn } = (await r.json()) as { code: string; expiresOn: string };
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
    expect(expiresOn).toBe(addDays(today(), 14));
  });

  it('honours days in 1..30 and refuses anything else', async () => {
    const r = await mintInvite({ days: 30 });
    expect(((await r.json()) as { expiresOn: string }).expiresOn).toBe(addDays(today(), 30));
    for (const days of [0, 31, 1.5, '7', null]) expect((await mintInvite({ days })).status).toBe(400);
  });

  it('accepts an empty body', async () => {
    const r = await api('/invites', { method: 'POST', headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}` } });
    expect(r.status).toBe(201);
  });

  it('stores only a hash of the code', async () => {
    const { code } = (await (await mintInvite()).json()) as { code: string };
    const raw = code.replace('-', '');
    const { results } = await env.DB.prepare('SELECT code_hash FROM invites').all<{ code_hash: string }>();
    expect(results.some((r) => r.code_hash === raw || r.code_hash === code)).toBe(false);
    expect(results.some((r) => r.code_hash === undefined)).toBe(false);
  });

  it('purges expired invites', async () => {
    const hash = await sha('OLDDD44444');
    await env.DB.prepare('INSERT INTO invites (code_hash, expires_on) VALUES (?, ?)').bind(hash, addDays(today(), -1)).run();
    await mintInvite();
    expect(await env.DB.prepare('SELECT 1 FROM invites WHERE code_hash = ?').bind(hash).first()).toBeNull();
  });

  it('401s a wrong admin token', async () => {
    const r = await post('/invites', {}, { Authorization: `Bearer ${env.ADMIN_TOKEN}x` });
    expect(r.status).toBe(401);
    expect(await error(r)).toBe('bad_token');
  });

  it('503s when ADMIN_TOKEN is missing or shorter than 32 characters', async () => {
    for (const ADMIN_TOKEN of [undefined, '', 'x'.repeat(31)]) {
      const req = new Request('https://bpm.test/api/v1/invites', { method: 'POST', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
      const r = await handle(req, { ...env, ADMIN_TOKEN });
      expect(r.status).toBe(503);
      expect(await error(r)).toBe('admin_disabled');
    }
  });
});

describe('what the server stores (SPEC §5.1)', () => {
  it('has exactly the specified columns, so nothing else creeps in', async () => {
    const cols = async (t: string) =>
      (await env.DB.prepare(`SELECT name FROM pragma_table_info('${t}')`).all<{ name: string }>()).results.map((r) => r.name);
    expect(await cols('blobs')).toEqual(['id', 'parent_id', 'write_hash', 'version', 'ct', 'touched_month']);
    expect(await cols('invites')).toEqual(['code_hash', 'expires_on']);
  });
});
