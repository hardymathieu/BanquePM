// Pure helpers behind the parent screens: parsing, previews, list rows.
// Money maths comes from the engine; this file only arranges it for the UI.
import { addDays, daysBetween, weekday } from '../../engine/dates';
import { balanceOn, computeSeries, totalInterestOn } from '../../engine/ledger';
import { addMove, applySundayDraft, setSunday, type SundayAnswer, updateMove } from '../../engine/ops';
import { allowanceOn, pendingDays, scheduledDays } from '../../engine/schedule';
import type { IsoDate, KidDoc, Weekday } from '../../engine/types';
import { checkMove, findOverdraft, type MoveProblem, type Overdraft } from '../../engine/validate';

const MAX_AMOUNT = 100_000;
const AMOUNT_RE = /^\d+(?:[.,]\d{1,2})?$/;

/** "5", "5,5" or "5.50" → 5.5. Null for anything else, 0 or more than 100 000 €. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return n > 0 && n <= MAX_AMOUNT ? n : null;
}

const balanceToday = (doc: KidDoc, today: IsoDate) => balanceOn(computeSeries(doc, today), today);
const interestToday = (doc: KidDoc, today: IsoDate) => totalInterestOn(computeSeries(doc, today), today);

export type Ago = { kind: 'today' } | { kind: 'this_week' } | { kind: 'weeks'; n: number };

export function ago(date: IsoDate, today: IsoDate): Ago {
  const days = daysBetween(date, today);
  if (days <= 0) return { kind: 'today' };
  const n = Math.round(days / 7);
  return n === 0 ? { kind: 'this_week' } : { kind: 'weeks', n };
}

export type PendingRow = { date: IsoDate; weekday: Weekday; ago: Ago };

export function pendingRows(doc: KidDoc, today: IsoDate): PendingRow[] {
  return pendingDays(doc, today)
    .reverse()
    .map((date) => ({ date, weekday: weekday(date), ago: ago(date, today) }));
}

export type CatchUpPreview = { banked: number; kept: number; coins: number; interest: number; newBalance: number };

/** "19 à la banque, 1 gardée. +38,00 € de pièces et +2,40 € d'intérêts rattrapés." */
export function catchUpPreview(doc: KidDoc, draft: Record<IsoDate, SundayAnswer>, today: IsoDate): CatchUpPreview {
  const after = applySundayDraft(doc, draft);
  const answers = Object.values(draft);
  const coins = Object.keys(draft).reduce((sum, d) => sum + (after.sundays[d] ?? 0), 0);
  return {
    banked: answers.filter((a) => a === 'banked').length,
    kept: answers.filter((a) => a === 'kept').length,
    coins,
    interest: interestToday(after, today) - interestToday(doc, today),
    newBalance: balanceToday(after, today),
  };
}

export type MovePreview = {
  problem: MoveProblem | null;
  overdraft: Overdraft | null;
  newBalance: number;
  /** Interest added (or removed) by dating the move in the past; 0 for today or under half a centime. */
  backdatedInterest: number;
};

const PREVIEW_ID = '\u0000preview';

/** Preview of a new move, or of the move `editingId` changed to `draft`. */
export function movePreview(
  doc: KidDoc,
  draft: { amount: number; date: IsoDate },
  editingId: string | null,
  today: IsoDate,
): MovePreview {
  const problem = checkMove(doc, draft, today);
  if (problem) return { problem, overdraft: null, newBalance: balanceToday(doc, today), backdatedInterest: 0 };
  const editing = editingId === null ? undefined : doc.moves.find((m) => m.id === editingId);
  const after = editing
    ? updateMove(doc, { ...editing, ...draft })
    : addMove(doc, { id: PREVIEW_ID, ...draft, kidNote: '', privateNote: '' });
  const interest = interestToday(after, today) - interestToday(doc, today);
  return {
    problem: null,
    overdraft: findOverdraft(after, today),
    newBalance: balanceToday(after, today),
    backdatedInterest: draft.date < today && Math.abs(interest) >= 0.005 ? interest : 0,
  };
}

/** Switching an answered day (banked ⇄ kept, or back to pending) may remove money. */
export function sundayChangePreview(doc: KidDoc, date: IsoDate, status: SundayAnswer | 'pending', today: IsoDate) {
  const after = setSunday(doc, date, status);
  return { overdraft: findOverdraft(after, today), newBalance: balanceToday(after, today) };
}

/** Same for deleting a move. */
export function deletePreview(doc: KidDoc, id: string, today: IsoDate) {
  const after = { ...doc, moves: doc.moves.filter((m) => m.id !== id) };
  return { overdraft: findOverdraft(after, today), newBalance: balanceToday(after, today) };
}

export type HistoryRow =
  | { kind: 'move'; key: string; date: IsoDate; id: string; amount: number; kidNote: string; privateNote: string }
  | { kind: 'coin' | 'kept'; key: string; date: IsoDate; amount: number; weekday: Weekday };

/** The parent's livret: moves and answered days, newest first, a move before the coin of its day. */
export function historyRows(doc: KidDoc): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...doc.moves.map((m): HistoryRow => ({ kind: 'move', key: `m:${m.id}`, date: m.date, id: m.id, amount: m.amount, kidNote: m.kidNote, privateNote: m.privateNote })),
    ...Object.entries(doc.sundays).map(([date, v]): HistoryRow => ({
      kind: v > 0 ? 'coin' : 'kept',
      key: `s:${date}`,
      date,
      amount: v,
      weekday: allowanceOn(doc, date)?.weekday ?? weekday(date),
    })),
  ];
  return rows.sort((a, b) => (a.date === b.date ? (a.kind === 'move' ? -1 : 1) - (b.kind === 'move' ? -1 : 1) : a.date < b.date ? 1 : -1));
}

const LOOKAHEAD_DAYS = 400;

/** The first scheduled day after `today` ("Prochain dimanche : le 11 octobre"), or null while paused. */
export function nextScheduled(doc: KidDoc, today: IsoDate): IsoDate | null {
  return scheduledDays(doc, addDays(today, 1), addDays(today, LOOKAHEAD_DAYS))[0] ?? null;
}

/** The latest scheduled day up to today ("Dimanche dernier" chip). */
export function lastScheduled(doc: KidDoc, today: IsoDate): IsoDate | null {
  return scheduledDays(doc, addDays(today, -LOOKAHEAD_DAYS), today).at(-1) ?? null;
}

const PERCENT_RE = /^\d{1,2}(?:[.,]\d{1,2})?$/;
const MAX_PERCENT = 50;

/** "12" or "8,5" (% per year) → 0.12 or 0.085. Null outside 0–50 %. */
export function parsePercent(text: string): number | null {
  const t = text.trim();
  if (!PERCENT_RE.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return n <= MAX_PERCENT ? Math.round(n * 100) / 10_000 : null;
}
