// Write tokens, the admin token and constant-time comparison (SPEC §5.2).
import { toBase64url } from '../src/crypto/base64url';
import { ADMIN_TOKEN_MIN_LENGTH } from './limits';

const encoder = new TextEncoder();

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
}

/** base64url(SHA-256(UTF-8(s))): how write tokens and invite codes are stored. */
export async function hashOf(s: string): Promise<string> {
  return toBase64url(await digest(s));
}

/** Constant-time string equality: compares fixed-length digests, never the raw strings. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([digest(a), digest(b)]);
  return crypto.subtle.timingSafeEqual(da, db);
}

export async function tokenMatches(token: string | null, writeHash: string): Promise<boolean> {
  return token !== null && safeEqual(await hashOf(token), writeHash);
}

export function bearer(req: Request): string | null {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '');
  return m ? m[1]! : null;
}

/** The admin token, or null when admin calls are disabled (missing or too short). */
export function adminToken(env: Env): string | null {
  const t = env.ADMIN_TOKEN;
  return t && t.length >= ADMIN_TOKEN_MIN_LENGTH ? t : null;
}
