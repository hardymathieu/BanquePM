import { describe, expect, it } from 'vitest';
import { sheetA, TODAY } from '../../engine/__fixtures__/sheetA';
import { pendingDays } from '../../engine/schedule';
import type { KidDoc } from '../../engine/types';
import { kidModel } from './model';

function lea(over: Partial<KidDoc> = {}): KidDoc {
  const doc = sheetA();
  const sundays = { ...doc.sundays };
  for (const d of pendingDays(doc, TODAY)) sundays[d] = 0; // every unanswered Sunday kept
  const moves = doc.moves.map((m) => (m.date === '2025-03-20' ? { ...m, kidNote: 'Trouvés dans le parc' } : m));
  return { ...doc, sundays, moves, ...over };
}

describe('kidModel', () => {
  it('gives the balance and the kid numbers for today', () => {
    const m = kidModel(lea(), TODAY);
    expect(m.numbers.balance).toBeCloseTo(289.052634, 6);
    expect(m.numbers.keptCount).toBe(20);
    expect(m.allowance).toEqual({ amount: 2, weekday: 0 });
  });

  it('targets today + 180 days without a birthday', () => {
    expect(kidModel(lea(), TODAY).target).toEqual({ date: '2027-04-08', age: null, days: 180 });
  });

  it('targets the next birthday when there is one', () => {
    expect(kidModel(lea({ birthday: '2016-12-03' }), TODAY).target).toEqual({ date: '2026-12-03', age: 10, days: 54 });
  });

  it('builds chart series from ledgerStart to the target, coins continuing after today', () => {
    const m = kidModel(lea(), TODAY);
    expect(m.chart.start).toBe('2025-01-01');
    expect(m.chart.today).toBe(647);
    expect(m.chart.end).toBe(647 + 180);
    expect(m.chart.mine).toHaveLength(m.chart.end + 1);
    expect(m.chart.mine[m.chart.today]).toBeCloseTo(289.052634, 6);
    expect(m.chart.ghost[m.chart.today]).toBeCloseTo(331.457013, 6);
    expect(m.chart.mine[m.chart.end]).toBeCloseTo(m.projections.withCoins, 9);
    expect(m.chart.ghost[m.chart.end]).toBeCloseTo(m.projections.ghost, 9);
  });

  it('lists month ends up to today for the table', () => {
    const { months } = kidModel(lea(), TODAY);
    expect(months).toHaveLength(22);
    expect(months[0]!.date).toBe('2025-01-31');
    expect(months.at(-1)!.date).toBe(TODAY);
    expect(months.at(-1)!.mine).toBeCloseTo(289.052634, 6);
    expect(months.at(-1)!.ghost).toBeCloseTo(331.457013, 6);
  });

  describe('passbook', () => {
    const { passbook } = kidModel(lea(), TODAY);

    it('has moves, banked coins and monthly interest, but no kept days', () => {
      expect(passbook.filter((r) => r.kind === 'move')).toHaveLength(7);
      expect(passbook.filter((r) => r.kind === 'coin')).toHaveLength(71);
      expect(passbook.filter((r) => r.kind === 'interest')).toHaveLength(22);
    });

    it('is newest first, with the month interest above that month', () => {
      expect(passbook.slice(0, 4).map((r) => [r.kind, r.date])).toEqual([
        ['interest', TODAY],
        ['interest', '2026-09-30'],
        ['interest', '2026-08-31'],
        ['move', '2026-08-18'],
      ]);
      expect(passbook[0]).toMatchObject({ partial: true, month: '2026-10-01' });
      expect(passbook[1]).toMatchObject({ partial: false, month: '2026-09-01' });
    });

    it('names coin rows after the weekday in force on their date', () => {
      expect(passbook.find((r) => r.kind === 'coin')).toMatchObject({ weekday: 0 });
    });

    it('keeps the kid note on moves', () => {
      expect(passbook.find((r) => r.kind === 'move' && r.date === '2025-03-20')).toMatchObject({ note: 'Trouvés dans le parc', amount: 2 });
    });

    it('gives every row a unique key', () => {
      expect(new Set(passbook.map((r) => r.key)).size).toBe(passbook.length);
    });
  });

  it('works for a brand-new kid with nothing yet', () => {
    const fresh: KidDoc = {
      name: 'Léa', birthday: null, currency: 'EUR', ledgerStart: TODAY,
      rates: [{ from: TODAY, apr: 0.12 }], allowance: [{ from: TODAY, weekday: 0, amount: 2 }], sundays: {}, moves: [],
    };
    const m = kidModel(fresh, TODAY);
    expect(m.numbers.balance).toBe(0);
    expect(m.passbook).toEqual([]);
    expect(m.months).toHaveLength(1);
    expect(m.chart.today).toBe(0);
  });
});
