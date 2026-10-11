// Pure document edits. Each returns a new KidDoc and never mutates its input,
// so the UI can memoise on document identity. Callers validate first (validate.ts).
import { allowanceAmount } from './schedule';
import type { AllowanceEntry, IsoDate, KidDoc, Move, RateEntry } from './types';

export type SundayAnswer = 'banked' | 'kept';

export function setSunday(doc: KidDoc, d: IsoDate, status: SundayAnswer | 'pending'): KidDoc {
  const sundays = { ...doc.sundays };
  if (status === 'pending') delete sundays[d];
  else sundays[d] = status === 'banked' ? allowanceAmount(doc, d) : 0;
  return { ...doc, sundays };
}

/** The catch-up screen's draft, committed in one save. */
export function applySundayDraft(doc: KidDoc, draft: Record<IsoDate, SundayAnswer>): KidDoc {
  const sundays = { ...doc.sundays };
  for (const [d, status] of Object.entries(draft)) sundays[d] = status === 'banked' ? allowanceAmount(doc, d) : 0;
  return { ...doc, sundays };
}

const byDate = (a: { date: IsoDate }, b: { date: IsoDate }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function addMove(doc: KidDoc, move: Move): KidDoc {
  if (doc.moves.some((m) => m.id === move.id)) throw new Error('duplicate_move_id');
  return { ...doc, moves: [...doc.moves, move].sort(byDate) };
}

export function updateMove(doc: KidDoc, move: Move): KidDoc {
  if (!doc.moves.some((m) => m.id === move.id)) throw new Error('unknown_move_id');
  return { ...doc, moves: doc.moves.map((m) => (m.id === move.id ? move : m)).sort(byDate) };
}

export function deleteMove(doc: KidDoc, id: string): KidDoc {
  if (!doc.moves.some((m) => m.id === id)) throw new Error('unknown_move_id');
  return { ...doc, moves: doc.moves.filter((m) => m.id !== id) };
}

/** Appends a dated change; scheduled changes on or after its date are replaced. */
function appendDated<T extends { from: IsoDate }>(entries: readonly T[], entry: T): T[] {
  return [...entries.filter((e) => e.from < entry.from), entry];
}

export function changeRate(doc: KidDoc, entry: RateEntry): KidDoc {
  return { ...doc, rates: appendDated(doc.rates, entry) };
}

export function changeAllowance(doc: KidDoc, entry: AllowanceEntry): KidDoc {
  return { ...doc, allowance: appendDated(doc.allowance, entry) };
}
