// Server-side limits. Blob limits are shared with the app through src/limits.ts.
import { FAMILY_CT_LIMIT } from '../src/limits';

export { FAMILY_CT_LIMIT, KID_CT_LIMIT, MAX_KIDS } from '../src/limits';

/** The largest family ciphertext as base64url, plus room for the JSON envelope. */
export const BODY_LIMIT = Math.ceil((FAMILY_CT_LIMIT * 4) / 3) + 8 * 1024;

export const INVITE_DEFAULT_DAYS = 14;
export const INVITE_MAX_DAYS = 30;
export const ADMIN_TOKEN_MIN_LENGTH = 32;
