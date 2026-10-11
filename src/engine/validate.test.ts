import { describe, expect, it } from 'vitest';
import { sheetA, TODAY } from './__fixtures__/sheetA';
import { balanceOn, computeSeries } from './ledger';
import { addMove, deleteMove, setSunday, updateMove } from './ops';
import { checkAllowanceChange, checkMove, checkRateChange, findOverdraft } from './validate';
import type { KidDoc, Move } from './types';

const move = (id: string, date: string, amount: number): Move => ({ id, date, amount, kidNote: '', privateNote: '' });

function doc(over: Partial<KidDoc> = {}): KidDoc {
  return {
    name: 'Léa',
    birthday: null,
    currency: 'EUR',
    ledgerStart: '2026-01-01',
    rates: [],
    allowance: [{ from: '2026-01-01', weekday: 0, amount: 2 }],
    sundays: {},
    moves: [move('dep', '2026-01-01', 50)],
    ...over,
  };
}

describe('checkMove (SPEC §6.6)', () => {
  const today = '2026-01-20';

  it('accepts a valid move', () => {
    expect(checkMove(doc(), move('x', '2026-01-10', -5), today)).toBeNull();
  });

  it('refuses a zero or non-finite amount', () => {
    expect(checkMove(doc(), move('x', '2026-01-10', 0), today)).toBe('amount_zero');
    expect(checkMove(doc(), move('x', '2026-01-10', Number.NaN), today)).toBe('amount_invalid');
    expect(checkMove(doc(), move('x', '2026-01-10', Infinity), today)).toBe('amount_invalid');
  });

  it('refuses a date before ledgerStart, after today, or malformed', () => {
    expect(checkMove(doc(), move('x', '2025-12-31', 5), today)).toBe('before_start');
    expect(checkMove(doc(), move('x', '2026-01-21', 5), today)).toBe('in_future');
    expect(checkMove(doc(), move('x', '2026-02-30', 5), today)).toBe('date_invalid');
  });

  it('accepts ledgerStart and today', () => {
    expect(checkMove(doc(), move('x', '2026-01-01', 5), today)).toBeNull();
    expect(checkMove(doc(), move('x', today, 5), today)).toBeNull();
  });
});

describe('findOverdraft (SPEC §6.6)', () => {
  const today = '2026-01-20';

  it('is null when the balance never goes below zero', () => {
    expect(findOverdraft(addMove(doc(), move('w', '2026-01-10', -50)), today)).toBeNull();
  });

  it('reports a withdrawal today with what was on the account', () => {
    expect(findOverdraft(addMove(doc(), move('w', today, -60)), today)).toEqual({ date: today, available: 50 });
  });

  it('catches a backdated withdrawal that makes a later withdrawal overdraw', () => {
    const d = addMove(doc(), move('later', '2026-01-15', -40));
    expect(findOverdraft(d, today)).toBeNull();
    const backdated = addMove(d, move('early', '2026-01-05', -20));
    expect(findOverdraft(backdated, today)).toEqual({ date: '2026-01-15', available: 30 });
  });

  it('catches deleting a deposit', () => {
    const d = addMove(addMove(doc(), move('dep2', '2026-01-03', 20)), move('w', '2026-01-10', -60));
    expect(findOverdraft(d, today)).toBeNull();
    expect(findOverdraft(deleteMove(d, 'dep2'), today)).toEqual({ date: '2026-01-10', available: 50 });
  });

  it('catches editing a deposit down', () => {
    const d = addMove(doc(), move('w', '2026-01-10', -40));
    expect(findOverdraft(updateMove(d, move('dep', '2026-01-01', 30)), today)).toEqual({ date: '2026-01-10', available: 30 });
  });

  it('catches switching a banked Sunday to kept', () => {
    const d = addMove(setSunday(doc(), '2026-01-04', 'banked'), move('w', '2026-01-10', -52));
    expect(findOverdraft(d, today)).toBeNull();
    expect(findOverdraft(setSunday(d, '2026-01-04', 'kept'), today)?.date).toBe('2026-01-10');
  });

  it('tolerates rounding up to half a centime', () => {
    expect(findOverdraft(addMove(doc(), move('w', today, -50.0049)), today)).toBeNull();
    expect(findOverdraft(addMove(doc(), move('w', today, -50.0051)), today)).not.toBeNull();
  });

  it('includes interest in what is available', () => {
    const d = sheetA();
    const balance = balanceOn(computeSeries(d, TODAY), TODAY);
    const o = findOverdraft(addMove(d, move('w', TODAY, -300)), TODAY);
    expect(o?.date).toBe(TODAY);
    expect(o?.available).toBeCloseTo(balance, 9);
  });
});

describe('checkRateChange (SPEC §6.6)', () => {
  const today = '2026-01-20';

  it('accepts a rate in [0, 0.5] from today on', () => {
    expect(checkRateChange(doc(), { from: today, apr: 0 }, today)).toBeNull();
    expect(checkRateChange(doc(), { from: '2026-02-01', apr: 0.5 }, today)).toBeNull();
  });

  it('refuses a rate outside [0, 0.5]', () => {
    expect(checkRateChange(doc(), { from: today, apr: -0.01 }, today)).toBe('rate_out_of_range');
    expect(checkRateChange(doc(), { from: today, apr: 0.51 }, today)).toBe('rate_out_of_range');
    expect(checkRateChange(doc(), { from: today, apr: Number.NaN }, today)).toBe('rate_out_of_range');
  });

  it('refuses a date in the past, so history never changes', () => {
    expect(checkRateChange(doc(), { from: '2026-01-19', apr: 0.1 }, today)).toBe('in_past');
  });

  it('refuses a date before ledgerStart', () => {
    expect(checkRateChange(doc({ ledgerStart: '2026-02-01' }), { from: '2026-01-25', apr: 0.1 }, today)).toBe('before_start');
  });
});

describe('checkAllowanceChange', () => {
  const today = '2026-01-20';

  it('accepts an amount ≥ 0 and a weekday from today on', () => {
    expect(checkAllowanceChange(doc(), { from: today, weekday: 3, amount: 2.5 }, today)).toBeNull();
    expect(checkAllowanceChange(doc(), { from: today, weekday: 0, amount: 0 }, today)).toBeNull();
  });

  it('refuses a negative or non-finite amount', () => {
    expect(checkAllowanceChange(doc(), { from: today, weekday: 0, amount: -1 }, today)).toBe('amount_invalid');
    expect(checkAllowanceChange(doc(), { from: today, weekday: 0, amount: Number.NaN }, today)).toBe('amount_invalid');
  });

  it('refuses a date in the past', () => {
    expect(checkAllowanceChange(doc(), { from: '2026-01-01', weekday: 0, amount: 3 }, today)).toBe('in_past');
  });
});
