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
  | { ok: false; error: 'no_rows'; sample?: string }
  | { ok: false; error: 'bad_date' | 'bad_amount'; row: number; text: string };

/** `future`: rows dated after today (a sheet planned ahead), left out of the import. */
export type SheetRead = { ok: true; rows: SheetRow[]; future: number } | SheetError;

export type SheetColumns = {
  /** The header row (0-based), or -1 when there is none. */
  header: number;
  date: number;
  amount: number;
  /** -1 when there is no comment column. */
  comment: number;
};

type Order = 'dmy' | 'mdy';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const MONTHS: Record<string, number> = {};
[
  ['janvier', 'janv', 'jan', 'january'],
  ['fevrier', 'fevr', 'fev', 'feb', 'february'],
  ['mars', 'mar', 'march'],
  ['avril', 'avr', 'apr', 'april'],
  ['mai', 'may'],
  ['juin', 'jun', 'june'],
  ['juillet', 'juil', 'jul', 'july'],
  ['aout', 'aug', 'august'],
  ['septembre', 'sept', 'sep', 'september'],
  ['octobre', 'oct', 'october'],
  ['novembre', 'nov', 'november'],
  ['decembre', 'dec', 'december'],
].forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)));

const WEEKDAYS = new Set(
  'lundi lun mardi mar mercredi mer jeudi jeu vendredi ven samedi sam dimanche dim monday mon tuesday tue wednesday wed thursday thu friday fri saturday sat sunday sun'.split(' '),
);

const NUMERIC = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/;
/** A trailing time: " 00:00", " 0:00:00", "T00:00:00Z". */
const TIME = /(?:t|\s+)\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?$/;

const cleanDate = (text: string) => fold(text).replace(TIME, '').trim();

function iso(y: number, m: number, d: number): IsoDate | null {
  const v = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isIsoDate(v) ? v : null;
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/**
 * Dates as sheets export them: 05/01/2025, 5/1/25, 2025-01-05, 05/01/2025 00:00:00,
 * 5 janv. 2025, dim. 5 janvier 2025, Sunday, January 5, 2025, 5-Jan-2025…
 * `order` says how to read an ambiguous numeric date (decided per column).
 */
function parseDate(text: string, order: Order): IsoDate | null {
  const t = cleanDate(text);
  const n = NUMERIC.exec(t);
  if (n) {
    const [, a, b, c] = n as unknown as [string, string, string, string];
    if (a.length === 4) return iso(Number(a), Number(b), Number(c));
    if (c.length !== 2 && c.length !== 4) return null;
    return order === 'mdy' ? iso(fullYear(c), Number(a), Number(b)) : iso(fullYear(c), Number(b), Number(a));
  }
  const tokens = t.split(/[\s.,/-]+/).filter(Boolean);
  const numbers = tokens.filter((x) => /^\d{1,4}$/.test(x));
  const words = tokens.filter((x) => !/^\d+$/.test(x));
  // "mar" is both mars and mardi: prefer a word that can only be a month, else take the ambiguous one.
  const candidates = words.filter((x) => MONTHS[x] !== undefined);
  const month = candidates.find((x) => !WEEKDAYS.has(x)) ?? candidates.at(-1);
  const rest = [...words];
  if (month !== undefined) rest.splice(rest.indexOf(month), 1);
  if (month === undefined || numbers.length !== 2 || !rest.every((x) => WEEKDAYS.has(x))) return null;
  const year = numbers.find((x) => x.length === 4) ?? numbers[1]!;
  const day = numbers.find((x) => x !== year) ?? numbers[0]!;
  return iso(fullYear(year), MONTHS[month]!, Number(day));
}

/** Worth reading as a date (a typo in it is an error); anything else (titles, totals) is skipped. */
function looksLikeDate(text: string): boolean {
  const t = cleanDate(text);
  if (!/\d/.test(t)) return false;
  return NUMERIC.test(t) || t.split(/[\s.,/-]+/).some((x) => MONTHS[x] !== undefined);
}

/** m/d/yyyy only when the column itself proves it (a "day" above 12 in second place, never in first). */
function columnOrder(cells: string[]): Order {
  let dayFirst = false;
  let monthFirst = false;
  for (const cell of cells) {
    const n = NUMERIC.exec(cleanDate(cell));
    if (!n || n[1]!.length === 4) continue;
    if (Number(n[1]) > 12) dayFirst = true;
    if (Number(n[2]) > 12) monthFirst = true;
  }
  return monthFirst && !dayFirst ? 'mdy' : 'dmy';
}

/** "95,87", "12,00 €", "€ 1 234,50", "−7,50", "(1,00)", "1,234.50" → number; null if unreadable. */
function parseAmount(text: string): number | null {
  let t = text.replace(/[€\s  ]/g, '').replace(/−/g, '-');
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

export const readSheetTable = (text: string): string[][] => parseCsv(text);

const HEADER = {
  date: /^(date|dates|jour|day)\b/,
  amount: /ajout|sorti|montant|amount|somme|mouvement/,
  comment: /comment|note|remarque|libelle|description/,
};

const cell = (table: string[][], r: number, c: number) => (table[r]?.[c] ?? '').trim();
const width = (table: string[][]) => Math.max(0, ...table.map((r) => r.length));

/** Columns by header name first, then by content: the most dated column, then the first numeric one after it. */
export function guessColumns(table: string[][]): SheetColumns {
  const cols = width(table);
  const named = table.findIndex((row) => row.some((c) => HEADER.date.test(fold(c))));
  const headerCells = named >= 0 ? table[named]!.map(fold) : [];
  const byName = (re: RegExp) => headerCells.findIndex((c) => re.test(c));

  const datesIn = (c: number) => {
    const cells = table.map((row) => row[c] ?? '');
    const order = columnOrder(cells);
    return cells.filter((x) => looksLikeDate(x) && parseDate(x, order) !== null).length;
  };
  let date = byName(HEADER.date);
  if (date < 0 || datesIn(date) === 0) {
    let best = 0;
    date = 0;
    for (let c = 0; c < cols; c++) if (datesIn(c) > best) [best, date] = [datesIn(c), c];
  }

  const dateRows = table.flatMap((row, r) => (looksLikeDate(row[date] ?? '') ? [r] : []));
  const firstData = dateRows[0] ?? -1;
  const header = named >= 0 ? named : firstData > 0 && table[firstData - 1]!.some((c) => /\p{L}/u.test(c)) ? firstData - 1 : -1;
  const names = header >= 0 ? table[header]!.map(fold) : [];

  let amount = names.findIndex((c, i) => i !== date && HEADER.amount.test(c));
  if (amount < 0) {
    const numeric = (c: number) => dateRows.filter((r) => parseAmount(cell(table, r, c)) !== null).length;
    const order = [...Array(cols).keys()].filter((c) => c !== date).sort((a, b) => Number(a < date) - Number(b < date) || a - b);
    amount = order.find((c) => numeric(c) > 0) ?? (date === 0 ? 1 : 0);
  }
  const comment = names.findIndex((c, i) => i !== date && i !== amount && HEADER.comment.test(c));
  return { header, date, amount, comment };
}

/** Header names for the column picker, or A, B, C… */
export function columnLabels(table: string[][], header: number): string[] {
  return Array.from({ length: width(table) }, (_, c) => (header >= 0 && cell(table, header, c)) || String.fromCharCode(65 + (c % 26)));
}

/** Dated rows from chosen columns (row numbers in errors are 1-based file lines). */
export function sheetRows(table: string[][], cols: SheetColumns, today: IsoDate): SheetRead {
  const body = table.slice(cols.header + 1);
  const order = columnOrder(body.map((row) => row[cols.date] ?? ''));
  const rows: SheetRow[] = [];
  let future = 0;
  for (let r = cols.header + 1; r < table.length; r++) {
    const dateText = cell(table, r, cols.date);
    const amountText = cell(table, r, cols.amount);
    if (!looksLikeDate(dateText)) continue; // titles, totals, blank lines
    const date = parseDate(dateText, order);
    if (!date) return { ok: false, error: 'bad_date', row: r + 1, text: dateText };
    if (date > today) {
      future++; // planned ahead in the sheet: not history yet
      continue;
    }
    const amount = amountText === '' ? null : parseAmount(amountText);
    if (amountText !== '' && amount === null) return { ok: false, error: 'bad_amount', row: r + 1, text: amountText };
    rows.push({ date, amount, comment: cols.comment >= 0 ? cell(table, r, cols.comment) : '' });
  }
  if (rows.length) return { ok: true, rows, future };
  const sample = body.map((row) => (row[cols.date] ?? '').trim()).find(Boolean);
  return sample === undefined || future > 0 ? { ok: false, error: 'no_rows' } : { ok: false, error: 'no_rows', sample };
}

/** The exported sheet → dated rows, with the columns guessed. */
export function parseSheetCsv(text: string, today: IsoDate): SheetRead {
  const table = readSheetTable(text);
  return sheetRows(table, guessColumns(table), today);
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
