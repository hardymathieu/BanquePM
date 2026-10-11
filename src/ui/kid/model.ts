// Everything the kid view shows, computed from the decrypted ledger and today.
// Pure: no DOM, no formatting. Components only format and lay out.
import { addDays, daysBetween } from '../../engine/dates';
import { kidNumbers, type KidNumbers } from '../../engine/kidNumbers';
import { computeSeries, defaultTarget, monthlyInterest, projections, type Projections } from '../../engine/ledger';
import { allowanceOn } from '../../engine/schedule';
import type { IsoDate, Ledger, Weekday } from '../../engine/types';

export type PassbookRow =
  | { kind: 'move'; key: string; date: IsoDate; amount: number; note: string }
  | { kind: 'coin'; key: string; date: IsoDate; amount: number; weekday: Weekday }
  | { kind: 'interest'; key: string; date: IsoDate; month: IsoDate; amount: number; partial: boolean };

export type KidModel = {
  numbers: KidNumbers;
  allowance: { amount: number; weekday: Weekday } | null;
  target: { date: IsoDate; age: number | null; days: number };
  projections: Projections;
  /** Daily balances from `start`; index `today` is today, `end` the target. */
  chart: { start: IsoDate; today: number; end: number; mine: Float64Array; ghost: Float64Array };
  months: { date: IsoDate; mine: number; ghost: number }[];
  passbook: PassbookRow[];
};

/** Interest rounding to 0,00 € is not worth a passbook line. */
const MIN_INTEREST_ROW = 0.005;
const ORDER: Record<PassbookRow['kind'], number> = { interest: 0, move: 1, coin: 2 };

function lastDayOfMonth(month: string): IsoDate {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7);
  return addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
}

export function kidModel(doc: Ledger, today: IsoDate): KidModel {
  const target = defaultTarget(doc, today);
  const end = target.date;
  const mine = computeSeries(doc, end, { coinsAfter: today });
  const ghost = computeSeries(doc, end, { ghost: true, coinsAfter: today });
  const todayIndex = Math.max(0, daysBetween(doc.ledgerStart, today));
  const entry = allowanceOn(doc, today);

  const months: KidModel['months'] = [];
  for (let i = 0, d = doc.ledgerStart; i <= todayIndex; i++, d = addDays(d, 1)) {
    if (d === today || d === lastDayOfMonth(d.slice(0, 7))) months.push({ date: d, mine: mine.balance[i]!, ghost: ghost.balance[i]! });
  }

  const passbook: PassbookRow[] = [
    ...doc.moves.map((m): PassbookRow => ({ kind: 'move', key: `m:${m.id}`, date: m.date, amount: m.amount, note: m.kidNote })),
    ...Object.entries(doc.sundays)
      .filter(([d, v]) => v > 0 && d <= today)
      .map(([d, v]): PassbookRow => ({ kind: 'coin', key: `c:${d}`, date: d, amount: v, weekday: allowanceOn(doc, d)?.weekday ?? 0 })),
    ...monthlyInterest(doc, today)
      .filter((m) => m.amount >= MIN_INTEREST_ROW)
      .map((m): PassbookRow => ({
        kind: 'interest',
        key: `i:${m.month}`,
        date: m.partial ? today : lastDayOfMonth(m.month),
        month: `${m.month}-01`,
        amount: m.amount,
        partial: m.partial,
      })),
  ].sort((a, b) => (a.date === b.date ? ORDER[a.kind] - ORDER[b.kind] : a.date < b.date ? 1 : -1));

  return {
    numbers: kidNumbers(doc, today),
    allowance: entry && entry.amount > 0 ? { amount: entry.amount, weekday: entry.weekday } : null,
    target: { ...target, days: daysBetween(today, end) },
    projections: projections(doc, today, end),
    chart: { start: doc.ledgerStart, today: todayIndex, end: mine.balance.length - 1, mine: mine.balance, ghost: ghost.balance },
    months,
    passbook,
  };
}
