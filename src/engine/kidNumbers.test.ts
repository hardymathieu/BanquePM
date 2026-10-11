import { describe, expect, it } from 'vitest';
import { fractionKey, kidNumbers } from './kidNumbers';
import type { KidDoc } from './types';

function doc(over: Partial<KidDoc> = {}): KidDoc {
  return {
    name: 'Léa',
    birthday: null,
    currency: 'EUR',
    ledgerStart: '2026-01-01',
    rates: [{ from: '2026-01-01', apr: 0.365 }],
    allowance: [{ from: '2026-01-01', weekday: 0, amount: 2 }],
    sundays: {},
    moves: [{ id: 'm1', date: '2026-01-01', amount: 100, kidNote: '', privateNote: '' }],
    ...over,
  };
}

describe('fractionKey (SPEC §6.5 thresholds)', () => {
  it.each([
    [0, 'bit'], [0.199, 'bit'],
    [0.2, 'quarter'], [0.289, 'quarter'],
    [0.29, 'third'], [0.399, 'third'],
    [0.4, 'half'], [0.579, 'half'],
    [0.58, 'twoThirds'], [0.699, 'twoThirds'],
    [0.7, 'threeQuarters'], [0.899, 'threeQuarters'],
    [0.9, 'almostAll'], [0.999, 'almostAll'],
    [1, 'whole'],
  ] as const)('%f → %s', (fill, key) => {
    expect(fractionKey(fill)).toBe(key);
  });
});

describe('kidNumbers', () => {
  it('sums interest over the 7 days ending today, ignoring days before ledgerStart', () => {
    // 100 € at 0.1 %/day from 1 Jan: interest on 2, 3 Jan only.
    const k = kidNumbers(doc(), '2026-01-03');
    expect(k.interestToday).toBeCloseTo(0.1001, 12);
    expect(k.interestWeek).toBeCloseTo(0.1 + 0.1001, 12);
  });

  it('caps coinFill at 1 and calls it a whole coin', () => {
    const rich = doc({ moves: [{ id: 'm1', date: '2026-01-01', amount: 10_000, kidNote: '', privateNote: '' }] });
    const k = kidNumbers(rich, '2026-01-20');
    expect(k.coinFill).toBe(1);
    expect(k.fraction).toBe('whole');
  });

  it('has no coin and no milestone without an allowance', () => {
    const k = kidNumbers(doc({ allowance: [] }), '2026-01-20');
    expect(k.coinFill).toBe(0);
    expect(k.milestone).toBeNull();
  });

  it('has no milestone at a 0 % rate', () => {
    expect(kidNumbers(doc({ rates: [{ from: '2026-01-01', apr: 0 }] }), '2026-01-20').milestone).toBeNull();
  });

  it('uses the allowance and rate in force today for the milestone', () => {
    const d = doc({
      allowance: [{ from: '2026-01-01', weekday: 0, amount: 2 }, { from: '2026-01-15', weekday: 0, amount: 3 }],
      rates: [{ from: '2026-01-01', apr: 0.12 }, { from: '2026-01-15', apr: 0.365 }],
    });
    expect(kidNumbers(d, '2026-01-20').milestone).toBeCloseTo(3 / (1.001 ** 7 - 1), 9);
  });

  it('counts kept days and the gap they leave, ignoring pending days', () => {
    const d = doc({ rates: [], sundays: { '2026-01-04': 2, '2026-01-11': 0, '2026-01-18': 0 } }); // 25 Jan pending
    const k = kidNumbers(d, '2026-01-31');
    expect(k.keptCount).toBe(2);
    expect(k.balance).toBe(102);
    expect(k.ghost).toBe(106);
    expect(k.gap).toBe(4);
  });
});
