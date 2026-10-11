import { describe, expect, it } from 'vitest';
import { allowanceAmount, aprOn, pendingDays, scheduledDays, sundayStatus } from './schedule';
import type { KidDoc } from './types';

const base: KidDoc = {
  name: 'Léa',
  birthday: null,
  currency: 'EUR',
  ledgerStart: '2026-09-01',
  rates: [{ from: '2026-09-01', apr: 0.12 }],
  allowance: [{ from: '2026-09-01', weekday: 0, amount: 2 }],
  sundays: {},
  moves: [],
};

describe('aprOn', () => {
  const rates = [
    { from: '2026-01-01', apr: 0.12 },
    { from: '2026-11-01', apr: 0.08 },
  ];

  it('is 0 before the first entry', () => {
    expect(aprOn(rates, '2025-12-31')).toBe(0);
  });

  it('uses the entry with the greatest from ≤ d', () => {
    expect(aprOn(rates, '2026-01-01')).toBe(0.12);
    expect(aprOn(rates, '2026-10-31')).toBe(0.12);
    expect(aprOn(rates, '2026-11-01')).toBe(0.08);
  });
});

describe('scheduledDays', () => {
  it('lists every allowance weekday in the range, starting on or after allowance[0].from', () => {
    // 2026-09-01 is a Tuesday; the first Sunday is the 6th.
    expect(scheduledDays(base, '2026-08-01', '2026-09-27')).toEqual([
      '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
    ]);
  });

  it('follows a weekday change from its date on', () => {
    const doc: KidDoc = {
      ...base,
      allowance: [
        { from: '2026-09-01', weekday: 0, amount: 2 },
        { from: '2026-09-14', weekday: 3, amount: 3 }, // Wednesdays from Mon 14 Sept
      ],
    };
    expect(scheduledDays(doc, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-06', '2026-09-13', '2026-09-16', '2026-09-23', '2026-09-30',
    ]);
  });

  it('skips periods where the allowance amount is 0', () => {
    const doc: KidDoc = {
      ...base,
      allowance: [
        { from: '2026-09-01', weekday: 0, amount: 2 },
        { from: '2026-09-14', weekday: 0, amount: 0 },
      ],
    };
    expect(scheduledDays(doc, '2026-09-01', '2026-09-30')).toEqual(['2026-09-06', '2026-09-13']);
  });

  it('never lists a day before ledgerStart', () => {
    const doc: KidDoc = { ...base, ledgerStart: '2026-09-10' };
    expect(scheduledDays(doc, '2026-09-01', '2026-09-20')).toEqual(['2026-09-13', '2026-09-20']);
  });
});

describe('allowanceAmount', () => {
  const doc: KidDoc = {
    ...base,
    allowance: [
      { from: '2026-09-01', weekday: 0, amount: 2 },
      { from: '2026-10-01', weekday: 0, amount: 2.5 },
    ],
  };

  it('is the amount in force on that day', () => {
    expect(allowanceAmount(doc, '2026-09-27')).toBe(2);
    expect(allowanceAmount(doc, '2026-10-04')).toBe(2.5);
  });

  it('is 0 before the allowance starts', () => {
    expect(allowanceAmount(doc, '2026-08-30')).toBe(0);
  });
});

describe('pending and status', () => {
  const doc: KidDoc = {
    ...base,
    sundays: { '2026-09-06': 2, '2026-09-13': 0 },
  };

  it('pending = scheduled days ≤ today with no sundays entry', () => {
    expect(pendingDays(doc, '2026-10-04')).toEqual(['2026-09-20', '2026-09-27', '2026-10-04']);
  });

  it('today counts as pending when it is a scheduled day', () => {
    expect(pendingDays(doc, '2026-09-20')).toEqual(['2026-09-20']);
  });

  it('a move on a scheduled day does not resolve it', () => {
    const withMove: KidDoc = {
      ...doc,
      moves: [{ id: 'm1', date: '2026-09-20', amount: 2, kidNote: '', privateNote: '' }],
    };
    expect(pendingDays(withMove, '2026-09-20')).toEqual(['2026-09-20']);
  });

  it('reports banked, kept and pending', () => {
    expect(sundayStatus(doc, '2026-09-06')).toBe('banked');
    expect(sundayStatus(doc, '2026-09-13')).toBe('kept');
    expect(sundayStatus(doc, '2026-09-20')).toBe('pending');
  });
});
