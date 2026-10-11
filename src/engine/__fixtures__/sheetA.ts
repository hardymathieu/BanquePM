// The SPEC §6.8 fixture: fixtures/sheet-a.json imported with the §12 rules.
import rows from '../../../fixtures/sheet-a.json';
import { importRows } from '../importSheet';
import type { KidDoc } from '../types';

export const TODAY = '2026-10-10';
export const TARGET = '2027-04-10';

export function sheetA(): KidDoc {
  let n = 0;
  return importRows(
    (rows as [string, number][]).map(([date, amount]) => ({ date, amount, comment: '' })),
    { name: 'Léa', birthday: null, ledgerStart: '2025-01-01', newId: () => `m${String(++n).padStart(7, '0')}` },
  );
}
