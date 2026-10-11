import { describe, expect, it } from 'vitest';
import { sheetA, TODAY } from './__fixtures__/sheetA';
import { balanceOn, computeSeries, totalInterestOn } from './ledger';
import { addMove, applySundayDraft, changeAllowance, changeRate, deleteMove, setSunday, updateMove } from './ops';
import { pendingDays, sundayStatus } from './schedule';
import type { KidDoc, Move } from './types';

function doc(over: Partial<KidDoc> = {}): KidDoc {
  return {
    name: 'Léa',
    birthday: null,
    currency: 'EUR',
    ledgerStart: '2026-01-01',
    rates: [{ from: '2026-01-01', apr: 0.12 }],
    allowance: [
      { from: '2026-01-01', weekday: 0, amount: 2 },
      { from: '2026-01-15', weekday: 0, amount: 3 },
    ],
    sundays: {},
    moves: [],
    ...over,
  };
}

const move = (id: string, date: string, amount: number): Move => ({ id, date, amount, kidNote: '', privateNote: '' });

describe('Sunday transitions (SPEC §6.2)', () => {
  it('banking stores the allowance in force on that day', () => {
    expect(setSunday(doc(), '2026-01-11', 'banked').sundays).toEqual({ '2026-01-11': 2 });
    expect(setSunday(doc(), '2026-01-18', 'banked').sundays).toEqual({ '2026-01-18': 3 });
  });

  it('keeping stores 0', () => {
    expect(setSunday(doc(), '2026-01-11', 'kept').sundays).toEqual({ '2026-01-11': 0 });
  });

  it('"Remettre à rattraper" deletes the key', () => {
    const d = setSunday(doc({ sundays: { '2026-01-11': 2 } }), '2026-01-11', 'pending');
    expect(d.sundays).toEqual({});
    expect(sundayStatus(d, '2026-01-11')).toBe('pending');
  });

  it('goes banked ⇄ kept', () => {
    const banked = setSunday(doc(), '2026-01-11', 'banked');
    const kept = setSunday(banked, '2026-01-11', 'kept');
    expect(sundayStatus(kept, '2026-01-11')).toBe('kept');
    expect(sundayStatus(setSunday(kept, '2026-01-11', 'banked'), '2026-01-11')).toBe('banked');
  });

  it('never mutates its input', () => {
    const d = doc();
    setSunday(d, '2026-01-11', 'banked');
    expect(d.sundays).toEqual({});
  });

  it('applies a whole catch-up draft at once', () => {
    const d = applySundayDraft(sheetA(), Object.fromEntries(pendingDays(sheetA(), TODAY).map((day) => [day, 'banked'])));
    expect(pendingDays(d, TODAY)).toEqual([]);
    expect(balanceOn(computeSeries(d, TODAY), TODAY)).toBeCloseTo(331.457013, 6);
  });

  it('gives the catch-up preview numbers: coins and interest caught up', () => {
    const before = sheetA();
    const after = applySundayDraft(before, { '2026-10-04': 'banked', '2026-09-27': 'kept' });
    const interestCaughtUp =
      totalInterestOn(computeSeries(after, TODAY), TODAY) - totalInterestOn(computeSeries(before, TODAY), TODAY);
    expect(balanceOn(computeSeries(after, TODAY), TODAY) - balanceOn(computeSeries(before, TODAY), TODAY)).toBeCloseTo(
      2 + interestCaughtUp,
      12,
    );
    expect(interestCaughtUp).toBeGreaterThan(0);
  });
});

describe('moves', () => {
  const d = doc({ moves: [move('a', '2026-01-02', 10), move('b', '2026-01-05', -3)] });

  it('adds, keeping moves sorted by date', () => {
    expect(addMove(d, move('c', '2026-01-03', 1)).moves.map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('updates by id', () => {
    const e = updateMove(d, { ...move('a', '2026-01-06', 12), kidNote: 'de Mamy' });
    expect(e.moves.map((m) => [m.id, m.date, m.amount, m.kidNote])).toEqual([
      ['b', '2026-01-05', -3, ''],
      ['a', '2026-01-06', 12, 'de Mamy'],
    ]);
  });

  it('deletes by id', () => {
    expect(deleteMove(d, 'a').moves.map((m) => m.id)).toEqual(['b']);
  });

  it('refuses an unknown id or a duplicate id', () => {
    expect(() => updateMove(d, move('zzz', '2026-01-06', 1))).toThrow();
    expect(() => deleteMove(d, 'zzz')).toThrow();
    expect(() => addMove(d, move('a', '2026-01-06', 1))).toThrow();
  });

  it('never mutates its input', () => {
    addMove(d, move('c', '2026-01-03', 1));
    deleteMove(d, 'a');
    expect(d.moves.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('dated changes to rate and allowance', () => {
  it('appends a rate change, keeping entries sorted', () => {
    const d = changeRate(doc(), { from: '2026-11-01', apr: 0.08 });
    expect(d.rates).toEqual([{ from: '2026-01-01', apr: 0.12 }, { from: '2026-11-01', apr: 0.08 }]);
  });

  it('replaces scheduled changes on or after the new date', () => {
    const d = changeRate(changeRate(doc(), { from: '2026-12-01', apr: 0.08 }), { from: '2026-11-01', apr: 0.1 });
    expect(d.rates).toEqual([{ from: '2026-01-01', apr: 0.12 }, { from: '2026-11-01', apr: 0.1 }]);
  });

  it('works the same for the allowance', () => {
    const d = changeAllowance(doc(), { from: '2026-11-04', weekday: 3, amount: 2.5 });
    expect(d.allowance.at(-1)).toEqual({ from: '2026-11-04', weekday: 3, amount: 2.5 });
    expect(d.allowance).toHaveLength(3);
  });
});
