import { describe, expect, it } from 'vitest';
import { sheetA } from './__fixtures__/sheetA';
import { projectForKid } from './project';
import type { KidDoc } from './types';

// Deterministic pseudo-random notes, so a failure is reproducible.
function* notes(seed: number): Generator<string> {
  let s = seed;
  for (;;) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    yield `secret-${s.toString(36)}-${'ÉÈ"\\\n€'.charAt(s % 6)}`;
  }
}

function withPrivateNotes(doc: KidDoc, seed: number): KidDoc {
  const gen = notes(seed);
  return { ...doc, moves: doc.moves.map((m) => ({ ...m, kidNote: 'Merci Mamy', privateNote: gen.next().value as string })) };
}

describe('projectForKid (SPEC §4.2)', () => {
  it.each([1, 2, 3, 42, 2026])('leaks no non-empty privateNote (seed %i)', (seed) => {
    const doc = withPrivateNotes(sheetA(), seed);
    const json = JSON.stringify(projectForKid(doc, '2026-10-10'));
    for (const m of doc.moves) expect(json).not.toContain(JSON.stringify(m.privateNote).slice(1, -1));
    expect(json).not.toContain('privateNote');
  });

  it('keeps everything the kid view needs', () => {
    const doc = withPrivateNotes(sheetA(), 7);
    const p = projectForKid(doc, '2026-10-10');
    expect(p.format).toBe('bpm-kid');
    expect(p.v).toBe(1);
    expect(p.publishedOn).toBe('2026-10-10');
    const { moves, ...rest } = doc;
    expect(p.kid).toEqual({ ...rest, moves: moves.map(({ privateNote: _, ...m }) => m) });
  });

  it('copies only whitelisted fields, so a new KidDoc field never leaks by accident', () => {
    const doc = { ...sheetA(), secretField: 'nope' } as KidDoc;
    doc.moves[0] = { ...doc.moves[0]!, extra: 'nope' } as KidDoc['moves'][number];
    expect(JSON.stringify(projectForKid(doc, '2026-10-10'))).not.toContain('nope');
  });

  it('does not share arrays or objects with the parent doc', () => {
    const doc = sheetA();
    const p = projectForKid(doc, '2026-10-10');
    expect(p.kid.sundays).not.toBe(doc.sundays);
    expect(p.kid.rates).not.toBe(doc.rates);
    expect(p.kid.allowance).not.toBe(doc.allowance);
  });
});
