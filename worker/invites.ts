// POST /api/v1/invites: the instance owner mints single-use invite codes (SPEC §5.2).
import { formatInviteCode, INVITE_ALPHABET, INVITE_LENGTH } from '../src/inviteCode';
import { adminToken, bearer, hashOf, safeEqual } from './auth';
import { addDays, today } from './clock';
import { fail, isObject, json, readJson } from './http';
import { INVITE_DEFAULT_DAYS, INVITE_MAX_DAYS } from './limits';

function randomCode(): string {
  // 32-letter alphabet: `byte & 31` is uniform, no modulo bias.
  return Array.from(crypto.getRandomValues(new Uint8Array(INVITE_LENGTH)), (b) => INVITE_ALPHABET[b & 31]).join('');
}

function parseDays(body: unknown): number {
  if (body === undefined) return INVITE_DEFAULT_DAYS;
  if (!isObject(body)) return fail(400, 'bad_request');
  if (!('days' in body)) return INVITE_DEFAULT_DAYS;
  const days = body.days;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > INVITE_MAX_DAYS) return fail(400, 'bad_request');
  return days;
}

export async function mintInvite(req: Request, env: Env): Promise<Response> {
  const admin = adminToken(env);
  if (admin === null) return fail(503, 'admin_disabled');
  const token = bearer(req);
  if (token === null || !(await safeEqual(token, admin))) return fail(401, 'bad_token');
  const days = parseDays(await readJson(req, 1024));

  await env.DB.prepare('DELETE FROM invites WHERE expires_on < ?').bind(today()).run();
  const expiresOn = addDays(today(), days);
  for (;;) {
    const code = randomCode();
    const r = await env.DB.prepare('INSERT OR IGNORE INTO invites (code_hash, expires_on) VALUES (?, ?)')
      .bind(await hashOf(code), expiresOn)
      .run();
    if (r.meta.changes === 1) return json(201, { code: formatInviteCode(code), expiresOn });
  }
}
