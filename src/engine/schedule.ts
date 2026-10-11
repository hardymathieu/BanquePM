// Rates, allowance schedule and the status of each scheduled day (SPEC §6.1, §6.2).
import { addDays, weekday } from './dates';
import type { AllowanceEntry, IsoDate, Ledger, RateEntry } from './types';

export type SundayStatus = 'banked' | 'kept' | 'pending';

/** The entry with the greatest `from` ≤ d, assuming entries are sorted by `from`. */
function inForce<T extends { from: IsoDate }>(entries: readonly T[], d: IsoDate): T | undefined {
  let found: T | undefined;
  for (const e of entries) {
    if (e.from > d) break;
    found = e;
  }
  return found;
}

export function aprOn(rates: readonly RateEntry[], d: IsoDate): number {
  return inForce(rates, d)?.apr ?? 0;
}

export function allowanceOn(doc: Pick<Ledger, 'allowance'>, d: IsoDate): AllowanceEntry | undefined {
  return inForce(doc.allowance, d);
}

export function allowanceAmount(doc: Pick<Ledger, 'allowance'>, d: IsoDate): number {
  return allowanceOn(doc, d)?.amount ?? 0;
}

export function isScheduledDay(doc: Pick<Ledger, 'allowance' | 'ledgerStart'>, d: IsoDate): boolean {
  if (d < doc.ledgerStart) return false;
  const e = allowanceOn(doc, d);
  return e !== undefined && e.amount > 0 && weekday(d) === e.weekday;
}

/** Every scheduled day in [from, to], oldest first. */
export function scheduledDays(doc: Pick<Ledger, 'allowance' | 'ledgerStart'>, from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const first = doc.allowance[0];
  if (!first) return out;
  let d = [from, doc.ledgerStart, first.from].reduce((a, b) => (a > b ? a : b));
  for (; d <= to; d = addDays(d, 1)) if (isScheduledDay(doc, d)) out.push(d);
  return out;
}

/** Scheduled days ≤ today with no answer yet, oldest first. */
export function pendingDays(doc: Ledger, today: IsoDate): IsoDate[] {
  return scheduledDays(doc, doc.ledgerStart, today).filter((d) => !Object.hasOwn(doc.sundays, d));
}

export function sundayStatus(doc: Pick<Ledger, 'sundays'>, d: IsoDate): SundayStatus {
  const v = doc.sundays[d];
  return v === undefined ? 'pending' : v > 0 ? 'banked' : 'kept';
}
