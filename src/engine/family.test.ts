import { describe, expect, it } from 'vitest';
import { addKid, freeSlot, markChanged, moveKid, newKidDoc, updateKid } from './family';
import type { FamilyDoc } from './types';

const lea = newKidDoc({ name: 'Léa', birthday: null, allowance: 2, weekday: 0, apr: 0.12 }, '2026-10-10');

function family(over: Partial<FamilyDoc> = {}): FamilyDoc {
  return {
    format: 'bpm-family', v: 1, createdOn: '2026-10-10', kids: [],
    backup: { lastExportOn: null, changesSinceExport: 0 }, prefs: { locale: 'fr' }, ...over,
  };
}

describe('newKidDoc (SPEC §9.4)', () => {
  it('starts the ledger, rate and allowance today', () => {
    expect(lea).toEqual({
      name: 'Léa', birthday: null, currency: 'EUR', ledgerStart: '2026-10-10',
      rates: [{ from: '2026-10-10', apr: 0.12 }], allowance: [{ from: '2026-10-10', weekday: 0, amount: 2 }],
      sundays: {}, moves: [],
    });
  });
});

describe('slots (SPEC §7.2)', () => {
  it('starts at 0 and uses nextSlot when present', () => {
    expect(freeSlot(family())).toBe(0);
    expect(freeSlot(family({ kids: [{ slot: 3, doc: lea }] }))).toBe(4);
    expect(freeSlot(family({ kids: [{ slot: 0, doc: lea }], nextSlot: 5 }))).toBe(5);
  });

  it('adds a kid on a fresh slot and advances nextSlot', () => {
    const { family: f, slot } = addKid(family({ nextSlot: 2 }), lea);
    expect(slot).toBe(2);
    expect(f.kids).toEqual([{ slot: 2, doc: lea }]);
    expect(f.nextSlot).toBe(3);
  });

  it('moves a kid to a fresh slot and never reuses the old one', () => {
    const a = addKid(family(), lea).family;
    const { family: b, from, to } = moveKid(a, 0);
    expect([from, to]).toEqual([0, 1]);
    expect(b.kids.map((k) => k.slot)).toEqual([1]);
    expect(freeSlot(b)).toBe(2);
  });
});

describe('updateKid and markChanged', () => {
  it('replaces one kid doc and keeps the order', () => {
    const f = addKid(addKid(family(), lea).family, { ...lea, name: 'Tom' }).family;
    const g = updateKid(f, 1, (d) => ({ ...d, name: 'Tom B.' }));
    expect(g.kids.map((k) => k.doc.name)).toEqual(['Léa', 'Tom B.']);
    expect(f.kids[1]!.doc.name).toBe('Tom');
  });

  it('refuses an unknown slot', () => {
    expect(() => updateKid(family(), 7, (d) => d)).toThrow();
  });

  it('counts changes since the last export', () => {
    expect(markChanged(family()).backup.changesSinceExport).toBe(1);
  });
});
