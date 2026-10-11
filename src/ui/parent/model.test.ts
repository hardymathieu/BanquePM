import { describe, expect, it } from 'vitest';
import { sheetA, TODAY } from '../../engine/__fixtures__/sheetA';
import { balanceOn, computeSeries } from '../../engine/ledger';
import type { KidDoc } from '../../engine/types';
import {
  catchUpPreview,
  historyRows,
  lastScheduled,
  movePreview,
  nextScheduled,
  parseAmount,
  parsePercent,
  pendingRows,
  sundayChangePreview,
} from './model';

const balance = (d: KidDoc) => balanceOn(computeSeries(d, TODAY), TODAY);

describe('parseAmount', () => {
  it.each([
    ['5', 5], ['5,5', 5.5], ['5.50', 5.5], [' 12,30 ', 12.3], ['0,01', 0.01], ['1000', 1000],
  ])('%j → %f', (text, n) => expect(parseAmount(text)).toBe(n));

  it.each(['', '0', '0,00', '-3', '1,234', 'abc', '1e3', '5,', ',5x', '100001', '1 000'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});

describe('pendingRows (SPEC §9.2)', () => {
  it('lists pending days newest first, with how long ago', () => {
    const rows = pendingRows(sheetA(), TODAY);
    expect(rows).toHaveLength(20);
    expect(rows[0]).toEqual({ date: '2026-10-04', weekday: 0, ago: { kind: 'weeks', n: 1 } });
    expect(rows.at(-1)!.date).toBe('2025-01-12');
  });

  it('says today and this week', () => {
    expect(pendingRows(sheetA(), '2026-10-11')[0]!.ago).toEqual({ kind: 'today' });
    expect(pendingRows(sheetA(), '2026-10-13')[0]!.ago).toEqual({ kind: 'this_week' });
  });
});

describe('catchUpPreview', () => {
  it('counts coins and the interest caught up, and the new balance', () => {
    const doc = sheetA();
    const draft = Object.fromEntries(pendingRows(doc, TODAY).map((r, i) => [r.date, i === 0 ? 'kept' : 'banked'] as const));
    const p = catchUpPreview(doc, draft, TODAY);
    expect(p.banked).toBe(19);
    expect(p.kept).toBe(1);
    expect(p.coins).toBe(38);
    expect(p.newBalance - balance(doc)).toBeCloseTo(p.coins + p.interest, 9);
    expect(p.interest).toBeGreaterThan(0);
  });
});

describe('movePreview (SPEC §9.3)', () => {
  it('gives the new balance for a deposit today, without backdating note', () => {
    const p = movePreview(sheetA(), { amount: 5, date: TODAY }, null, TODAY);
    expect(p.newBalance).toBeCloseTo(balance(sheetA()) + 5, 9);
    expect(p.backdatedInterest).toBe(0);
    expect(p.overdraft).toBeNull();
  });

  it('gives the interest recalculated for a past date', () => {
    const p = movePreview(sheetA(), { amount: 5, date: '2026-01-01' }, null, TODAY);
    expect(p.backdatedInterest).toBeGreaterThan(0.4);
    expect(p.newBalance).toBeCloseTo(balance(sheetA()) + 5 + p.backdatedInterest, 9);
  });

  it('reports an overdraft today with the balance', () => {
    const p = movePreview(sheetA(), { amount: -500, date: TODAY }, null, TODAY);
    expect(p.overdraft?.date).toBe(TODAY);
    expect(p.overdraft?.available).toBeCloseTo(balance(sheetA()), 9);
  });

  it('checks an edit against the ledger without the edited move', () => {
    const doc = sheetA();
    const wd = doc.moves.find((m) => m.amount === -7.5)!;
    const p = movePreview(doc, { amount: -8, date: wd.date }, wd.id, TODAY);
    expect(p.overdraft).toBeNull();
    expect(p.newBalance).toBeLessThan(balance(doc));
  });

  it('reports a date problem', () => {
    expect(movePreview(sheetA(), { amount: 5, date: '2027-01-01' }, null, TODAY).problem).toBe('in_future');
    expect(movePreview(sheetA(), { amount: 5, date: '2024-12-31' }, null, TODAY).problem).toBe('before_start');
  });
});

describe('sundayChangePreview', () => {
  it('blocks switching a banked coin to kept when that would overdraw', () => {
    const doc: KidDoc = { ...sheetA(), moves: [...sheetA().moves, { id: 'big', date: TODAY, amount: -289.05, kidNote: '', privateNote: '' }] };
    expect(sundayChangePreview(doc, '2026-06-14', 'kept', TODAY).overdraft).not.toBeNull();
    expect(sundayChangePreview(sheetA(), '2026-06-14', 'kept', TODAY).overdraft).toBeNull();
  });
});

describe('historyRows', () => {
  it('lists moves and answered days newest first, moves before the coin of the same day', () => {
    const rows = historyRows({ ...sheetA(), sundays: { ...sheetA().sundays, '2026-10-04': 0 } });
    expect(rows.slice(0, 3).map((r) => [r.kind, r.date])).toEqual([
      ['kept', '2026-10-04'],
      ['move', '2026-08-18'],
      ['coin', '2026-06-14'],
    ]);
    const april = rows.filter((r) => r.date === '2025-04-13').map((r) => r.kind);
    expect(april).toEqual(['move', 'coin']);
    expect(rows).toHaveLength(7 + 71 + 1);
  });
});

describe('scheduled days around today', () => {
  it('finds the next and the last scheduled day', () => {
    expect(nextScheduled(sheetA(), TODAY)).toBe('2026-10-11');
    expect(nextScheduled(sheetA(), '2026-10-11')).toBe('2026-10-18');
    expect(lastScheduled(sheetA(), TODAY)).toBe('2026-10-04');
    expect(lastScheduled(sheetA(), '2026-10-11')).toBe('2026-10-11');
  });

  it('has none while pocket money is paused', () => {
    const paused: KidDoc = { ...sheetA(), allowance: [...sheetA().allowance, { from: '2026-10-01', weekday: 0, amount: 0 }] };
    expect(nextScheduled(paused, TODAY)).toBeNull();
  });
});

describe('parsePercent', () => {
  it.each([['12', 0.12], ['8,5', 0.085], ['0', 0], ['50', 0.5], ['2.25', 0.0225]])('%j → %f', (text, apr) => {
    expect(parsePercent(text)).toBeCloseTo(apr, 12);
  });

  it.each(['', '-1', '51', 'abc', '12 %', '1,234'])('rejects %j', (text) => expect(parsePercent(text)).toBeNull());
});
