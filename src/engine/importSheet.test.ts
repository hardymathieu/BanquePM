import { describe, expect, it } from 'vitest';
import { sheetA } from './__fixtures__/sheetA';
import { importRows } from './importSheet';

let n = 0;
const newId = () => `id${++n}`;
const opts = { name: 'Léa', birthday: null, newId };

describe('importRows (SPEC §12)', () => {
  it('splits the fixture into 71 banked Sundays and 7 moves', () => {
    const doc = sheetA();
    expect(Object.keys(doc.sundays)).toHaveLength(71);
    expect(Object.values(doc.sundays).every((v) => v === 2)).toBe(true);
    expect(doc.moves.map((m) => [m.date, m.amount])).toEqual([
      ['2025-01-05', 95.87],
      ['2025-01-12', -1],
      ['2025-02-01', 2],
      ['2025-02-10', 2],
      ['2025-03-20', 2],
      ['2025-04-13', 10],
      ['2026-08-18', -7.5],
    ]);
  });

  it('starts the allowance on the first scheduled weekday after the first non-zero row', () => {
    expect(sheetA().allowance).toEqual([{ from: '2025-01-12', weekday: 0, amount: 2 }]);
  });

  it('uses default rate 12 % from ledgerStart', () => {
    const doc = sheetA();
    expect(doc.ledgerStart).toBe('2025-01-01');
    expect(doc.rates).toEqual([{ from: '2025-01-01', apr: 0.12 }]);
  });

  it('defaults ledgerStart to the first date in the sheet, even with an empty amount', () => {
    const doc = importRows(
      [
        { date: '2025-01-01', amount: null, comment: '' },
        { date: '2025-01-05', amount: 10, comment: '' },
      ],
      opts,
    );
    expect(doc.ledgerStart).toBe('2025-01-01');
  });

  it('puts comments in privateNote and leaves kidNote empty', () => {
    const doc = importRows(
      [
        { date: '2025-01-03', amount: 50, comment: 'Mamy' },
        { date: '2025-01-12', amount: 5, comment: 'pièce + 3 € trouvés' },
      ],
      opts,
    );
    expect(doc.sundays).toEqual({ '2025-01-12': 2 });
    expect(doc.moves.map(({ date, amount, kidNote, privateNote }) => ({ date, amount, kidNote, privateNote }))).toEqual([
      { date: '2025-01-03', amount: 50, kidNote: '', privateNote: 'Mamy' },
      { date: '2025-01-12', amount: 3, kidNote: '', privateNote: 'pièce + 3 € trouvés' },
    ]);
  });

  it('skips rows with an empty or zero amount, and sorts moves by date', () => {
    const doc = importRows(
      [
        { date: '2025-01-08', amount: 4, comment: '' },
        { date: '2025-01-03', amount: 0, comment: 'rien' },
        { date: '2025-01-02', amount: 1, comment: '' },
        { date: '2025-01-04', amount: null, comment: 'vide' },
      ],
      opts,
    );
    expect(doc.moves.map((m) => m.date)).toEqual(['2025-01-02', '2025-01-08']);
  });

  it('honours a custom weekday, amount and rate', () => {
    const doc = importRows(
      [
        { date: '2025-01-01', amount: 20, comment: '' }, // Wednesday
        { date: '2025-01-08', amount: 3, comment: '' }, // Wednesday
      ],
      { ...opts, weekday: 3, allowance: 3, apr: 0.05 },
    );
    expect(doc.allowance).toEqual([{ from: '2025-01-08', weekday: 3, amount: 3 }]);
    expect(doc.rates).toEqual([{ from: '2025-01-01', apr: 0.05 }]);
    expect(doc.sundays).toEqual({ '2025-01-08': 3 });
  });

  it('gives every move a unique id from newId', () => {
    const ids = sheetA().moves.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
