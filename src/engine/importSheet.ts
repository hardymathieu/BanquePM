// Google-Sheet import (SPEC §12): CSV text → rows → KidDoc, and the summary shown before saving.
import { parseCsv } from './csv';
import { addDays, isIsoDate, weekday } from './dates';
import { balanceOn, computeSeries } from './ledger';
import { pendingDays } from './schedule';
import { findOverdraft, type Overdraft } from './validate';
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

export type SheetError =
  | { ok: false; error: 'no_rows' }
  | { ok: false; error: 'bad_date' | 'bad_amount' | 'future_date'; row: number; text: string };

const DATE_LIKE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$|^\d{4}-\d{1,2}-\d{1,2}$/;
const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/** dd/mm/yyyy (also d/m, with . or -) or ISO; null if it isn't a real date. */
function parseDate(text: string): IsoDate | null {
  const t = text.trim();
  const m = DMY.exec(t);
  const iso = m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : t;
  return isIsoDate(iso) ? iso : null;
}

/** "95,87", "12,00 €", "€ 1 234,50", "−7,50", "(1,00)", "1,234.50" → number; null if unreadable. */
function parseAmount(text: string): number | null {
  let t = text.replace(/[€\s\u00a0\u202f]/g, '').replace(/\u2212/g, '-');
  let sign = 1;
  if (/^\(.*\)$/.test(t)) {
    sign = -1;
    t = t.slice(1, -1);
  }
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else t = t.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? sign * Number(t) : null;
}

type Columns = { header: number; date: number; amount: number; comment: number };

function findColumns(table: string[][]): Columns {
  for (let r = 0; r < table.length; r++) {
    const cells = table[r]!.map((c) => c.trim().toLowerCase());
    const date = cells.findIndex((c) => /^date\b/.test(c));
    const amount = cells.findIndex((c) => /ajout|sorti|montant|amount/.test(c));
    if (date >= 0 && amount >= 0) return { header: r, date, amount, comment: cells.findIndex((c) => /comment|note|remarque/.test(c)) };
  }
  return { header: -1, date: 0, amount: 1, comment: 2 };
}

/** The exported sheet → dated rows (row numbers in errors are 1-based file lines). */
export function parseSheetCsv(text: string, today: IsoDate): { ok: true; rows: SheetRow[] } | SheetError {
  const table = parseCsv(text);
  const cols = findColumns(table);
  const rows: SheetRow[] = [];
  for (let r = cols.header + 1; r < table.length; r++) {
    const cells = table[r]!;
    const dateText = (cells[cols.date] ?? '').trim();
    const amountText = (cells[cols.amount] ?? '').trim();
    if (!DATE_LIKE.test(dateText)) continue; // titles, totals, blank lines
    const date = parseDate(dateText);
    if (!date) return { ok: false, error: 'bad_date', row: r + 1, text: dateText };
    if (date > today) return { ok: false, error: 'future_date', row: r + 1, text: date };
    const amount = amountText === '' ? null : parseAmount(amountText);
    if (amountText !== '' && amount === null) return { ok: false, error: 'bad_amount', row: r + 1, text: amountText };
    rows.push({ date, amount, comment: cols.comment >= 0 ? (cells[cols.comment] ?? '').trim() : '' });
  }
  return rows.length ? { ok: true, rows } : { ok: false, error: 'no_rows' };
}

export type ImportSummary = {
  /** Rows with a non-zero amount: "77 lignes". */
  lines: number;
  banked: number;
  moves: number;
  pending: number;
  balance: number;
  start: IsoDate;
  /** An imported ledger must never go below zero: every later edit would be refused. */
  overdraft: Overdraft | null;
};

/** "77 lignes : 71 dimanches à la banque, 7 mouvements, 20 dimanches à rattraper. Solde aujourd'hui : 289,05 €." */
export function importSummary(rows: readonly SheetRow[], doc: KidDoc, today: IsoDate): ImportSummary {
  return {
    lines: rows.filter((r) => r.amount !== null && r.amount !== 0).length,
    banked: Object.values(doc.sundays).filter((v) => v > 0).length,
    moves: doc.moves.length,
    pending: pendingDays(doc, today).length,
    balance: balanceOn(computeSeries(doc, today), today),
    start: doc.ledgerStart,
    overdraft: findOverdraft(doc, today),
  };
}
