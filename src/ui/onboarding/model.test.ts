import { describe, expect, it } from 'vitest';
import { pickPositions } from './model';

describe('pickPositions (SPEC §10.4: ask 3 random word positions)', () => {
  it('picks 3 distinct positions out of 12, in order', () => {
    let s = 0.1;
    const rand = () => (s = (s * 7.3) % 1);
    const p = pickPositions(3, 12, rand);
    expect(p).toHaveLength(3);
    expect(new Set(p).size).toBe(3);
    expect([...p].sort((a, b) => a - b)).toEqual(p);
    expect(p.every((i) => i >= 0 && i < 12)).toBe(true);
  });

  it('covers every position over many draws', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) pickPositions(3, 12, Math.random).forEach((p) => seen.add(p));
    expect(seen.size).toBe(12);
  });
});
