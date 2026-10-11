// Invite codes (SPEC §5.2), shared by the Worker and the app. The canonical form is
// 10 characters with no dash; that is what gets hashed and stored.

export const INVITE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const INVITE_LENGTH = 10;

const CANONICAL = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_LENGTH}}$`);

export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  return CANONICAL.test(code) ? code : null;
}

export function formatInviteCode(canonical: string): string {
  return `${canonical.slice(0, 5)}-${canonical.slice(5)}`;
}
