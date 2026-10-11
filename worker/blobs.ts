// /api/v1/blobs (SPEC §5.2). The server stores ciphertext it cannot read, and never lists it.
import { normalizeInviteCode } from '../src/inviteCode';
import { adminToken, bearer, hashOf, safeEqual, tokenMatches } from './auth';
import { thisMonth, today } from './clock';
import { fail, isObject, json, readJson } from './http';
import { decodeCt, isBlobId, isWriteHash, toBase64url } from './ids';
import { BODY_LIMIT, FAMILY_CT_LIMIT, KID_CT_LIMIT, MAX_KIDS } from './limits';

type Row = { parent_id: string | null; write_hash: string; version: number };

const INSERT = 'INSERT INTO blobs (id, parent_id, write_hash, version, ct, touched_month) SELECT ?, ?, ?, 1, ?, ?';

function findRow(env: Env, id: string): Promise<Row | null> {
  return env.DB.prepare('SELECT parent_id, write_hash, version FROM blobs WHERE id = ?').bind(id).first<Row>();
}

async function exists(env: Env, id: string): Promise<boolean> {
  return (await env.DB.prepare('SELECT 1 FROM blobs WHERE id = ?').bind(id).first()) !== null;
}

/** Runs an insert; a primary-key clash (a race on the same id) becomes 409 exists. */
async function inserting<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) fail(409, 'exists');
    throw e;
  }
}

function checkSize(ct: Uint8Array, isKid: boolean): void {
  if (ct.length > (isKid ? KID_CT_LIMIT : FAMILY_CT_LIMIT)) fail(413, 'too_large');
}

export async function getBlob(env: Env, id: string): Promise<Response> {
  if (!isBlobId(id)) return fail(404, 'not_found');
  const row = await env.DB.prepare('SELECT version, ct FROM blobs WHERE id = ?')
    .bind(id)
    .first<{ version: number; ct: ArrayBuffer | number[] }>();
  if (!row) return fail(404, 'not_found');
  return json(200, { version: row.version, ct: toBase64url(new Uint8Array(row.ct)) });
}

export async function createBlob(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req, BODY_LIMIT);
  if (!isObject(body) || !isBlobId(body.id) || !isWriteHash(body.writeHash)) return fail(400, 'bad_request');
  const ct = decodeCt(body.ct);
  if (!ct) return fail(400, 'bad_request');
  const { id, writeHash } = body;
  const parentId = req.headers.get('X-Parent-Id');
  checkSize(ct, parentId !== null);

  if (parentId !== null) {
    // Kid blob: prove control of the family blob.
    const parent = isBlobId(parentId) ? await findRow(env, parentId) : null;
    if (!parent || parent.parent_id !== null || !(await tokenMatches(bearer(req), parent.write_hash))) {
      return fail(401, 'bad_token');
    }
    if (await exists(env, id)) return fail(409, 'exists');
    const r = await inserting(() =>
      env.DB.prepare(`${INSERT} WHERE (SELECT COUNT(*) FROM blobs WHERE parent_id = ?) < ?`)
        .bind(id, parentId, writeHash, ct, thisMonth(), parentId, MAX_KIDS)
        .run(),
    );
    if (r.meta.changes !== 1) return fail(429, 'too_many_kids');
    return json(201, { version: 1 });
  }

  // Family blob: needs an invite, or the admin token as an unlimited one.
  const invite = req.headers.get('X-Invite');
  if (invite === null) return fail(401, 'bad_invite');
  const admin = adminToken(env);
  if (admin !== null && (await safeEqual(invite, admin))) {
    if (await exists(env, id)) return fail(409, 'exists');
    await inserting(() => env.DB.prepare(INSERT).bind(id, null, writeHash, ct, thisMonth()).run());
    return json(201, { version: 1 });
  }

  const code = normalizeInviteCode(invite);
  if (code === null) return fail(401, 'bad_invite');
  const codeHash = await hashOf(code);
  const valid = 'SELECT 1 FROM invites WHERE code_hash = ? AND expires_on >= ?';
  if ((await env.DB.prepare(valid).bind(codeHash, today()).first()) === null) return fail(401, 'bad_invite');
  if (await exists(env, id)) return fail(409, 'exists');

  // One batch (one transaction): the insert only happens if the invite is still there,
  // and the invite is spent with it. A concurrent second redemption inserts nothing.
  const [inserted] = await inserting(() =>
    env.DB.batch([
      env.DB.prepare(`${INSERT} WHERE EXISTS (${valid})`).bind(id, null, writeHash, ct, thisMonth(), codeHash, today()),
      env.DB.prepare('DELETE FROM invites WHERE code_hash = ?').bind(codeHash),
    ]),
  );
  if (inserted?.meta.changes !== 1) return fail(401, 'bad_invite');
  return json(201, { version: 1 });
}

function parseIfMatch(req: Request): number | null {
  const m = /^(?:W\/)?"?(\d{1,15})"?$/.exec(req.headers.get('If-Match')?.trim() ?? '');
  return m ? Number(m[1]) : null;
}

export async function putBlob(req: Request, env: Env, id: string): Promise<Response> {
  if (!isBlobId(id)) return fail(404, 'not_found');
  const body = await readJson(req, BODY_LIMIT);
  const row = await findRow(env, id);
  if (!row) return fail(404, 'not_found');
  if (!(await tokenMatches(bearer(req), row.write_hash))) return fail(401, 'bad_token');
  const expected = parseIfMatch(req);
  const ct = isObject(body) ? decodeCt(body.ct) : null;
  if (expected === null || !ct) return fail(400, 'bad_request');
  checkSize(ct, row.parent_id !== null);
  if (row.version !== expected) return fail(409, 'version_conflict', { version: row.version });

  const r = await env.DB.prepare('UPDATE blobs SET ct = ?, version = version + 1, touched_month = ? WHERE id = ? AND version = ?')
    .bind(ct, thisMonth(), id, expected)
    .run();
  if (r.meta.changes !== 1) {
    const now = await findRow(env, id);
    return now ? fail(409, 'version_conflict', { version: now.version }) : fail(404, 'not_found');
  }
  return json(200, { version: expected + 1 });
}

export async function deleteBlob(req: Request, env: Env, id: string): Promise<Response> {
  if (!isBlobId(id)) return fail(404, 'not_found');
  const row = await findRow(env, id);
  if (!row) return fail(404, 'not_found');
  if (!(await tokenMatches(bearer(req), row.write_hash))) return fail(401, 'bad_token');
  // Deleting a family blob also deletes its kid blobs.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM blobs WHERE parent_id = ?').bind(id),
    env.DB.prepare('DELETE FROM blobs WHERE id = ?').bind(id),
  ]);
  return json(204);
}
