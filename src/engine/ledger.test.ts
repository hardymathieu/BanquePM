import { describe, expect, it } from 'vitest';
import { balanceOn, computeSeries, defaultTarget, interestOn, monthlyInterest, projections, totalInterestOn } from './ledger';
import type { KidDoc, Move } from './types';

// apr 0.365 → exactly 0.1 % a day, so interest is easy to compute by hand.
const DAILY = 0.365;

const move = (date: string, amount: number): Move => ({ id: `m-${date}-${amount}`, date, amount, kidNote: '', privateNote: '' });

function doc(over: Partial<KidDoc> = {}): KidDoc {
  return {
    name: 'Léa',
    birthday: null,
    currency: 'EUR',
    ledgerStart: '2026-01-01',
    rates: [{ from: '2026-01-01', apr: DAILY }],
    allowance: [{ from: '2026-01-01', weekday: 0, amount: 2 }], // Sundays: 4, 11, 18, 25 Jan…
    sundays: {},
    moves: [],
    ...over,
  };
}

describe('computeSeries', () => {
  it('pays no interest on ledgerStart, then credits the previous day balance × apr / 365', () => {
    const s = computeSeries(doc({ moves: [move('2026-01-01', 1000)] }), '2026-01-03');
    expect(interestOn(s, '2026-01-01')).toBe(0);
    expect(interestOn(s, '2026-01-02')).toBeCloseTo(1, 12);
    expect(balanceOn(s, '2026-01-02')).toBeCloseTo(1001, 12);
    expect(interestOn(s, '2026-01-03')).toBeCloseTo(1.001, 12);
    expect(totalInterestOn(s, '2026-01-03')).toBeCloseTo(2.001, 12);
  });

  it('starts earning on a move the day after it', () => {
    const s = computeSeries(doc({ moves: [move('2026-01-01', 1000), move('2026-01-02', 500)] }), '2026-01-03');
    expect(interestOn(s, '2026-01-02')).toBeCloseTo(1, 12);
    expect(interestOn(s, '2026-01-03')).toBeCloseTo(1.501, 12);
  });

  it('applies a rate change from its date on', () => {
    const d = doc({
      rates: [{ from: '2026-01-01', apr: DAILY }, { from: '2026-01-03', apr: 0 }],
      moves: [move('2026-01-01', 1000)],
    });
    const s = computeSeries(d, '2026-01-04');
    expect(interestOn(s, '2026-01-02')).toBeCloseTo(1, 12);
    expect(interestOn(s, '2026-01-03')).toBe(0);
    expect(balanceOn(s, '2026-01-04')).toBeCloseTo(1001, 12);
  });

  it('pays nothing before the first rate entry', () => {
    const d = doc({ rates: [{ from: '2026-01-03', apr: DAILY }], moves: [move('2026-01-01', 1000)] });
    const s = computeSeries(d, '2026-01-03');
    expect(interestOn(s, '2026-01-02')).toBe(0);
    expect(interestOn(s, '2026-01-03')).toBeCloseTo(1, 12);
  });

  it('adds banked Sundays and ignores kept and pending ones', () => {
    const d = doc({ rates: [], sundays: { '2026-01-04': 2, '2026-01-11': 0 } });
    expect(balanceOn(computeSeries(d, '2026-01-31'), '2026-01-31')).toBe(2);
  });

  it('is 0 before ledgerStart and refuses dates after its end', () => {
    const s = computeSeries(doc({ moves: [move('2026-01-01', 10)] }), '2026-01-05');
    expect(balanceOn(s, '2025-12-31')).toBe(0);
    expect(() => balanceOn(s, '2026-01-06')).toThrow(RangeError);
  });
});

describe('ghost line (SPEC §6.3)', () => {
  const d = doc({ rates: [], sundays: { '2026-01-04': 2, '2026-01-11': 0 } }); // 18 and 25 Jan pending

  it('counts kept days as banked', () => {
    expect(balanceOn(computeSeries(d, '2026-01-31', { ghost: true }), '2026-01-31')).toBe(4);
  });

  it('does not count pending days against the kid', () => {
    expect(balanceOn(computeSeries(d, '2026-01-31', { ghost: true }), '2026-01-31')).toBe(4);
    const allKept = { ...d, sundays: { ...d.sundays, '2026-01-18': 0, '2026-01-25': 0 } };
    expect(balanceOn(computeSeries(allKept, '2026-01-31', { ghost: true }), '2026-01-31')).toBe(8);
  });

  it('values a kept day at the allowance in force that day', () => {
    const raised = {
      ...d,
      allowance: [...d.allowance, { from: '2026-01-10', weekday: 0 as const, amount: 3 }],
    };
    expect(balanceOn(computeSeries(raised, '2026-01-31', { ghost: true }), '2026-01-31')).toBe(5);
  });
});

describe('projections (SPEC §6.4)', () => {
  // Saturday 10 Jan; Sundays 11, 18, 25 Jan before the target.
  const today = '2026-01-10';
  const target = '2026-01-31';
  const d = doc({ rates: [], moves: [move('2026-01-01', 10)], sundays: { '2026-01-04': 0 } });

  it('adds the allowance on future scheduled days for "with coins"', () => {
    const p = projections(d, today, target);
    expect(p.withCoins).toBe(16);
    expect(p.withNothing).toBe(10);
  });

  it('continues the ghost line with future coins', () => {
    expect(projections(d, today, target).ghost).toBe(18);
  });

  it('does not add a coin for today, even when today is a pending scheduled day', () => {
    expect(projections(d, '2026-01-11', target).withCoins).toBe(14);
  });

  it('applies a future allowance change', () => {
    const raised = { ...d, allowance: [...d.allowance, { from: '2026-01-20', weekday: 0 as const, amount: 5 }] };
    expect(projections(raised, today, target).withCoins).toBe(19); // 10 + 2 + 2 + 5
  });

  it('earns interest on future coins', () => {
    const p = projections(doc({ moves: [move('2026-01-01', 1000)] }), '2026-01-01', '2026-01-05');
    // 1000 → 1001 → 1002.001 → 1003.003001 → 1004.006004001, plus the 4 Jan coin earning on the 5th
    expect(p.withCoins).toBeCloseTo(1004.006004001 + 2 + 2 * 0.001, 9);
  });

  it('clamps a target in the past to today', () => {
    expect(projections(d, today, '2026-01-05').withNothing).toBe(10);
  });
});

describe('monthlyInterest', () => {
  it('sums interest per calendar month up to today, the current month marked partial', () => {
    const d = doc({ moves: [move('2026-01-30', 1000)] });
    const months = monthlyInterest(d, '2026-02-02');
    expect(months.map((m) => [m.month, m.partial])).toEqual([
      ['2026-01', false],
      ['2026-02', true],
    ]);
    expect(months[0]!.amount).toBeCloseTo(1, 12);
    expect(months[1]!.amount).toBeCloseTo(1.001 + 1.002001, 12);
  });

  it('matches the total interest across months for the fixture shape', () => {
    const d = doc({ moves: [move('2026-01-01', 100)], rates: [{ from: '2026-01-01', apr: 0.12 }] });
    const months = monthlyInterest(d, '2026-10-10');
    expect(months).toHaveLength(10);
    const sum = months.reduce((a, m) => a + m.amount, 0);
    expect(sum).toBeCloseTo(totalInterestOn(computeSeries(d, '2026-10-10'), '2026-10-10'), 12);
  });
});

describe('defaultTarget', () => {
  it('is the next birthday, with the age reached', () => {
    expect(defaultTarget(doc({ birthday: '2018-05-21' }), '2026-10-10')).toEqual({ date: '2027-05-21', age: 9 });
  });

  it('is today + 180 days without a birthday', () => {
    expect(defaultTarget(doc(), '2026-10-10')).toEqual({ date: '2027-04-08', age: null });
  });
});
