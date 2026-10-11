import { describe, expect, it } from 'vitest';
import { formatInviteCode, INVITE_ALPHABET, normalizeInviteCode } from './inviteCode';

describe('invite codes (SPEC §5.2)', () => {
  it('uses 32 unambiguous characters: no 0, 1, I or O', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(INVITE_ALPHABET).not.toMatch(/[01IO]/);
  });

  it('normalizes case, dashes and spaces to 10 canonical characters', () => {
    expect(normalizeInviteCode('abcde-23456')).toBe('ABCDE23456');
    expect(normalizeInviteCode(' ABCDE 23456 ')).toBe('ABCDE23456');
    expect(normalizeInviteCode('ABCDE23456')).toBe('ABCDE23456');
  });

  it('rejects a wrong length or an ambiguous character', () => {
    expect(normalizeInviteCode('ABCDE-2345')).toBeNull();
    expect(normalizeInviteCode('ABCDE-234567')).toBeNull();
    expect(normalizeInviteCode('ABCDE-O2345')).toBeNull();
    expect(normalizeInviteCode('')).toBeNull();
  });

  it('formats a canonical code as XXXXX-XXXXX', () => {
    expect(formatInviteCode('ABCDE23456')).toBe('ABCDE-23456');
  });
});
