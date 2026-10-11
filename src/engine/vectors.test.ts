// SPEC §6.8 test vectors. They must match within 1e-6. If a change breaks
// them, the change is wrong. Reference: python3 fixtures/engine_reference.py
import { describe, expect, it } from 'vitest';
import { sheetA, TARGET, TODAY } from './__fixtures__/sheetA';
import { kidNumbers } from './kidNumbers';
import { balanceOn, computeSeries, projections, totalInterestOn } from './ledger';
import { pendingDays } from './schedule';
import type { KidDoc } from './types';

const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(1e-6);

function withPending(doc: KidDoc, value: number): KidDoc {
  const sundays = { ...doc.sundays };
  for (const d of pendingDays(doc, TODAY)) sundays[d] = value;
  return { ...doc, sundays };
}

describe('SPEC §6.8 vectors', () => {
  it('V0: 100 € at 12 % on 2025-01-01 is 112.747462 on 2026-01-01', () => {
    const doc: KidDoc = {
      name: 'Léa',
      birthday: null,
      currency: 'EUR',
      ledgerStart: '2025-01-01',
      rates: [{ from: '2025-01-01', apr: 0.12 }],
      allowance: [],
      sundays: {},
      moves: [{ id: 'm1', date: '2025-01-01', amount: 100, kidNote: '', privateNote: '' }],
    };
    near(balanceOn(computeSeries(doc, '2026-01-01'), '2026-01-01'), 112.747462);
  });

  it('V1: 20 pending scheduled days', () => {
    const pending = pendingDays(sheetA(), TODAY);
    expect(pending).toHaveLength(20);
    expect(pending.slice(0, 5)).toEqual(['2025-01-12', '2025-02-02', '2025-02-09', '2025-03-02', '2026-06-21']);
    expect(pending.at(-1)).toBe('2026-10-04');
  });

  it('V2, V3: balance and total interest today', () => {
    const s = computeSeries(sheetA(), TODAY);
    near(balanceOn(s, TODAY), 289.052634);
    near(totalInterestOn(s, TODAY), 43.682634);
  });

  it('V4: balance on 2025-12-31', () => {
    near(balanceOn(computeSeries(sheetA(), TODAY), '2025-12-31'), 223.638951);
  });

  it('V5, V6: interest today, last 7 days, and milestone', () => {
    const k = kidNumbers(sheetA(), TODAY);
    expect(Math.abs(k.interestToday - 0.09499977)).toBeLessThan(1e-9);
    near(k.interestWeek, 0.664343);
    expect(k.milestone).not.toBeNull();
    expect(Math.abs((k.milestone ?? 0) - 868.1909)).toBeLessThan(1e-4);
  });

  it('V7: all 20 pending banked → balance today', () => {
    near(balanceOn(computeSeries(withPending(sheetA(), 2), TODAY), TODAY), 331.457013);
  });

  it('V8: all 20 pending kept → ghost today and at target', () => {
    const doc = withPending(sheetA(), 0);
    near(kidNumbers(doc, TODAY).ghost, 331.457013);
    near(projections(doc, TODAY, TARGET).ghost, 405.522862);
  });

  it('V9: projection at target, with coins / with nothing', () => {
    const p = projections(sheetA(), TODAY, TARGET);
    near(p.withCoins, 360.504185);
    near(p.withNothing, 306.873183);
  });

  it('V10: a future rate change applies to projections', () => {
    const doc = sheetA();
    doc.rates = [...doc.rates, { from: '2026-11-01', apr: 0.08 }];
    near(projections(doc, TODAY, TARGET).withNothing, 301.507706);
  });
});
