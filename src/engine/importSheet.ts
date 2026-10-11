// Google-Sheet import (SPEC §12). Rows → KidDoc. CSV parsing comes in milestone 8.
import { addDays, weekday } from './dates';
import type { IsoDate, KidDoc, Move, Weekday } from './types';

export type SheetRow = { date: IsoDate; amount: number | null; comment: string };

export type ImportOptions = {
  name: string;
  birthday: IsoDate | null;
  newId: () => string;
  ledgerStart?: IsoDate; // default: the first date in the sheet
  weekday?: Weekday; // default: Sunday
  allowance?: number; // default: 2 €
  apr?: number; // default: 12 %
};

export function importRows(rows: readonly SheetRow[], opts: ImportOptions): KidDoc {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const firstDate = sorted[0]?.date;
  const ledgerStart = opts.ledgerStart ?? firstDate;
  if (!ledgerStart) throw new Error('empty_sheet');
  const day = opts.weekday ?? 0;
  const amount = opts.allowance ?? 2;
  const withAmount = sorted.filter((r): r is SheetRow & { amount: number } => r.amount !== null && r.amount !== 0);

  // The allowance starts on the first scheduled weekday strictly after the first non-zero row.
  let allowanceFrom = addDays(withAmount[0]?.date ?? ledgerStart, 1);
  while (weekday(allowanceFrom) !== day) allowanceFrom = addDays(allowanceFrom, 1);

  const sundays: Record<IsoDate, number> = {};
  const moves: Move[] = [];
  const addMove = (date: IsoDate, value: number, comment: string) =>
    moves.push({ id: opts.newId(), date, amount: value, kidNote: '', privateNote: comment });

  for (const r of withAmount) {
    const scheduled = r.date >= allowanceFrom && weekday(r.date) === day;
    if (scheduled && r.amount >= amount && !Object.hasOwn(sundays, r.date)) {
      sundays[r.date] = amount;
      if (r.amount > amount) addMove(r.date, r.amount - amount, r.comment);
    } else {
      addMove(r.date, r.amount, r.comment);
    }
  }

  return {
    name: opts.name,
    birthday: opts.birthday,
    currency: 'EUR',
    ledgerStart,
    rates: [{ from: ledgerStart, apr: opts.apr ?? 0.12 }],
    allowance: [{ from: allowanceFrom, weekday: day, amount }],
    sundays,
    moves,
  };
}
