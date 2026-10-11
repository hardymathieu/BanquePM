// Validation rules (SPEC §6.6). Results are i18n keys, never sentences.
// Document schema validation (for imports) arrives with milestone 7.
import { addDays, isIsoDate } from './dates';
import { balanceOn, computeSeries } from './ledger';
import type { AllowanceEntry, IsoDate, Ledger, Move, RateEntry } from './types';

export type MoveProblem = 'amount_zero' | 'amount_invalid' | 'date_invalid' | 'before_start' | 'in_future';
export type DatedChangeProblem = 'rate_out_of_range' | 'amount_invalid' | 'date_invalid' | 'before_start' | 'in_past';

/** A balance can dip this far below zero from rounding before it counts as an overdraft. */
const OVERDRAFT_TOLERANCE = -0.005;
const MAX_APR = 0.5;

export function checkMove(doc: Pick<Ledger, 'ledgerStart'>, move: Pick<Move, 'date' | 'amount'>, today: IsoDate): MoveProblem | null {
  if (!Number.isFinite(move.amount)) return 'amount_invalid';
  if (move.amount === 0) return 'amount_zero';
  if (!isIsoDate(move.date)) return 'date_invalid';
  if (move.date < doc.ledgerStart) return 'before_start';
  if (move.date > today) return 'in_future';
  return null;
}

export type Overdraft = {
  date: IsoDate;
  /** What was on the account that day before its withdrawals: "il n'y avait que … sur le compte". */
  available: number;
};

/**
 * The first day in [ledgerStart, today] where the balance goes below zero, or null.
 * Run it on the document *after* any change that removes money: a new or edited
 * move, a deleted deposit, or a banked Sunday switched to kept or pending.
 */
export function findOverdraft(doc: Ledger, today: IsoDate): Overdraft | null {
  const s = computeSeries(doc, today);
  for (let i = 0, d = s.start; i < s.balance.length; i++, d = addDays(d, 1)) {
    if (s.balance[i]! >= OVERDRAFT_TOLERANCE) continue;
    const withdrawn = doc.moves.reduce((sum, m) => (m.date === d && m.amount < 0 ? sum + m.amount : sum), 0);
    return { date: d, available: balanceOn(s, d) - withdrawn };
  }
  return null;
}

function checkFrom(doc: Pick<Ledger, 'ledgerStart'>, from: IsoDate, today: IsoDate): DatedChangeProblem | null {
  if (!isIsoDate(from)) return 'date_invalid';
  if (from < doc.ledgerStart) return 'before_start';
  if (from < today) return 'in_past';
  return null;
}

/** Rates change from today on, never in the past, so history never changes silently. */
export function checkRateChange(doc: Pick<Ledger, 'ledgerStart'>, entry: RateEntry, today: IsoDate): DatedChangeProblem | null {
  if (!(entry.apr >= 0 && entry.apr <= MAX_APR)) return 'rate_out_of_range';
  return checkFrom(doc, entry.from, today);
}

/** Same rule for the allowance. An amount of 0 pauses pocket money. */
export function checkAllowanceChange(doc: Pick<Ledger, 'ledgerStart'>, entry: AllowanceEntry, today: IsoDate): DatedChangeProblem | null {
  if (!(Number.isFinite(entry.amount) && entry.amount >= 0)) return 'amount_invalid';
  return checkFrom(doc, entry.from, today);
}
