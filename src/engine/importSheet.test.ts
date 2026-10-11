import { describe, expect, it } from 'vitest';
import rows from '../../fixtures/sheet-a.json';
import { sheetA, TODAY } from './__fixtures__/sheetA';
import { importRows, importSummary, parseSheetCsv } from './importSheet';

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

// The fixture as Google Sheets (French locale) exports it: File → Download → CSV.
function fixtureCsv(): string {
  const lines = ['Banque de Léa,,', 'Date,Ajouté / Sorti,Commentaire', '01/01/2025,,'];
  for (const [d, a] of rows as [string, number][]) {
    const [y, m, day] = d.split('-');
    lines.push(`${day}/${m}/${y},"${a.toFixed(2).replace('.', ',')}",`);
  }
  return lines.join('\r\n');
}

describe('parseSheetCsv (SPEC §12)', () => {
  it('reads the fixture as exported by Google Sheets', () => {
    const res = parseSheetCsv(fixtureCsv(), TODAY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(78);
    expect(res.rows[0]).toEqual({ date: '2025-01-01', amount: null, comment: '' });
    expect(res.rows[1]).toEqual({ date: '2025-01-05', amount: 95.87, comment: '' });
  });

  it('gives the summary of SPEC §12 and the §6.8 balance', () => {
    const res = parseSheetCsv(fixtureCsv(), TODAY);
    if (!res.ok) throw new Error(res.error);
    let n = 0;
    const doc = importRows(res.rows, { name: 'Léa', birthday: null, newId: () => `id${++n}` });
    expect(importSummary(res.rows, doc, TODAY)).toEqual({
      lines: 77,
      banked: 71,
      moves: 7,
      pending: 20,
      balance: expect.closeTo(289.052634, 6),
      start: '2025-01-01',
      overdraft: null,
    });
  });

  it('finds the columns by name, past title rows and extra columns', () => {
    const csv = 'Mon tableau\n\nSolde,Date,Commentaire,Ajouté / Sorti\n100,2025-01-05,Mamy,"10,00 €"\n';
    const res = parseSheetCsv(csv, TODAY);
    expect(res.ok && res.rows).toEqual([{ date: '2025-01-05', amount: 10, comment: 'Mamy' }]);
  });

  it.each([
    ['95,87', 95.87],
    ['-1,00', -1],
    ['−7,50', -7.5],
    ['-7.5', -7.5],
    ['12,00 €', 12],
    ['€ 1 234,50', 1234.5],
    ['1 234,50 €', 1234.5],
    ['1.234,50', 1234.5],
    ['1,234.50', 1234.5],
  ])('reads the amount %j', (text, amount) => {
    const res = parseSheetCsv(`Date,Ajouté / Sorti,Commentaire\n05/01/2025,"${text}",`, TODAY);
    expect(res.ok && res.rows[0]!.amount).toBe(amount);
  });

  it.each([['5/1/2025'], ['05/01/2025'], ['05.01.2025'], ['2025-01-05']])('reads the date %j', (text) => {
    const res = parseSheetCsv(`Date,Ajouté / Sorti,Commentaire\n${text},"1,00",`, TODAY);
    expect(res.ok && res.rows[0]!.date).toBe('2025-01-05');
  });

  it('says which row has an unreadable date or amount', () => {
    expect(parseSheetCsv('Date,Ajouté / Sorti,Commentaire\n05/01/2025,"1,00",\n31/02/2025,"2,00",', TODAY)).toEqual({
      ok: false, error: 'bad_date', row: 3, text: '31/02/2025',
    });
    expect(parseSheetCsv('Date,Ajouté / Sorti,Commentaire\n05/01/2025,beaucoup,', TODAY)).toEqual({
      ok: false, error: 'bad_amount', row: 2, text: 'beaucoup',
    });
  });

  it('refuses a date in the future', () => {
    expect(parseSheetCsv('Date,Ajouté / Sorti\n01/01/2030,"1,00"', TODAY)).toEqual({ ok: false, error: 'future_date', row: 2, text: '2030-01-01' });
  });

  it('skips rows without a date, such as totals', () => {
    const res = parseSheetCsv('Date,Ajouté / Sorti\n05/01/2025,"1,00"\nTotal,"1,00"\n,', TODAY);
    expect(res.ok && res.rows).toHaveLength(1);
  });

  it('refuses a file with no dated row', () => {
    expect(parseSheetCsv('Date,Ajouté / Sorti\nTotal,"1,00"', TODAY)).toEqual({ ok: false, error: 'no_rows' });
    expect(parseSheetCsv('', TODAY)).toEqual({ ok: false, error: 'no_rows' });
  });

  it('reports a ledger that goes below zero, with the date', () => {
    const res = parseSheetCsv('Date,Ajouté / Sorti\n05/01/2025,"5,00"\n06/01/2025,"-9,00"', TODAY);
    if (!res.ok) throw new Error(res.error);
    const doc = importRows(res.rows, { name: 'Léa', birthday: null, newId: () => 'x' + Math.random() });
    expect(importSummary(res.rows, doc, TODAY).overdraft?.date).toBe('2025-01-06');
  });
});
