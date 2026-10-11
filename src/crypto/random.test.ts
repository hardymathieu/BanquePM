import { describe, expect, it } from 'vitest';
import { randomId } from './random';

describe('randomId', () => {
  it('is 12 base64url characters and unique', () => {
    const ids = Array.from({ length: 1000 }, randomId);
    expect(ids.every((id) => /^[A-Za-z0-9_-]{12}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(1000);
  });
});
