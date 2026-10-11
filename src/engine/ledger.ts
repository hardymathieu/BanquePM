// The daily recurrence (SPEC §6.1), the ghost line (§6.3) and projections (§6.4).
import { addDays, daysBetween, nextBirthday } from './dates';
import { allowanceAmount, scheduledDays } from './schedule';
import type { IsoDate, Ledger } from './types';

export type SeriesOptions = {
  /** Kept days count as banked at the allowance in force (the "what if" line). */
  ghost?: boolean;
  /** Add the allowance on every unanswered scheduled day strictly after this date. */
  coinsAfter?: IsoDate;
};

/** Daily values from ledgerStart to end, indexed by days since ledgerStart. */
export type Series = {
  start: IsoDate;
  end: IsoDate;
  balance: Float64Array;
  interest: Float64Array;
  totalInterest: Float64Array;
};

export function computeSeries(doc: Ledger, end: IsoDate, opts: SeriesOptions = {}): Series {
  const start = doc.ledgerStart;
  const n = Math.max(0, daysBetween(start, end) + 1);
  const flows = new Float64Array(n);
  const add = (d: IsoDate, amount: number) => {
    const i = daysBetween(start, d);
    if (i >= 0 && i < n) flows[i] = (flows[i] ?? 0) + amount;
  };

  for (const m of doc.moves) add(m.date, m.amount);
  for (const [d, v] of Object.entries(doc.sundays)) {
    if (v > 0) add(d, v);
    else if (opts.ghost) add(d, allowanceAmount(doc, d));
  }
  if (opts.coinsAfter !== undefined && n > 0) {
    for (const d of scheduledDays(doc, addDays(opts.coinsAfter, 1), end)) {
      if (!Object.hasOwn(doc.sundays, d)) add(d, allowanceAmount(doc, d));
    }
  }

  const rateStarts = doc.rates.map((r) => ({ i: daysBetween(start, r.from), apr: r.apr }));
  const balance = new Float64Array(n);
  const interest = new Float64Array(n);
  const totalInterest = new Float64Array(n);
  let b = 0;
  let total = 0;
  let apr = 0;
  let r = 0;
  for (let i = 0; i < n; i++) {
    while (r < rateStarts.length && rateStarts[r]!.i <= i) apr = rateStarts[r++]!.apr;
    const it = i === 0 ? 0 : (b * apr) / 365;
    b += it + flows[i]!;
    total += it;
    balance[i] = b;
    interest[i] = it;
    totalInterest[i] = total;
  }
  return { start, end, balance, interest, totalInterest };
}

function read(s: Series, values: Float64Array, d: IsoDate): number {
  const i = daysBetween(s.start, d);
  if (i < 0) return 0;
  if (i >= values.length) throw new RangeError(`${d} is after the end of the series (${s.end})`);
  return values[i]!;
}

export const balanceOn = (s: Series, d: IsoDate): number => read(s, s.balance, d);
export const interestOn = (s: Series, d: IsoDate): number => read(s, s.interest, d);
export const totalInterestOn = (s: Series, d: IsoDate): number => read(s, s.totalInterest, d);

export type Projections = {
  /** "si tu mets ta pièce chaque dimanche" */
  withCoins: number;
  /** "si tu ne mets plus rien" */
  withNothing: number;
  /** the ghost line continued with future coins */
  ghost: number;
};

export function projections(doc: Ledger, today: IsoDate, target: IsoDate): Projections {
  const end = target > today ? target : today;
  return {
    withCoins: balanceOn(computeSeries(doc, end, { coinsAfter: today }), end),
    withNothing: balanceOn(computeSeries(doc, end), end),
    ghost: balanceOn(computeSeries(doc, end, { ghost: true, coinsAfter: today }), end),
  };
}

export type MonthInterest = { month: string; amount: number; partial: boolean };

/** Interest per calendar month ('YYYY-MM') from ledgerStart to today, oldest first. */
export function monthlyInterest(doc: Ledger, today: IsoDate): MonthInterest[] {
  const s = computeSeries(doc, today);
  const out: MonthInterest[] = [];
  for (let i = 0, d = s.start; i < s.interest.length; i++, d = addDays(d, 1)) {
    const month = d.slice(0, 7);
    const last = out.at(-1);
    if (last?.month === month) last.amount += s.interest[i]!;
    else out.push({ month, amount: s.interest[i]!, partial: false });
  }
  const current = out.at(-1);
  if (current?.month === today.slice(0, 7)) current.partial = true;
  return out;
}

const DEFAULT_HORIZON_DAYS = 180;

/** The projection date: the next birthday, otherwise today + 180 days. */
export function defaultTarget(doc: Pick<Ledger, 'birthday'>, today: IsoDate): { date: IsoDate; age: number | null } {
  if (doc.birthday) return nextBirthday(doc.birthday, today);
  return { date: addDays(today, DEFAULT_HORIZON_DAYS), age: null };
}
