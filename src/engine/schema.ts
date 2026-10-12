// Shape checks for documents read from the outside world (decrypted blobs, export files).
// Unknown extra fields are allowed, so a newer v1 writer stays readable by older apps.
import { isIsoDate } from './dates';
import type { AllowanceEntry, FamilyDoc, IsoDate, KidMove, KidPublicDoc, Ledger, RateEntry } from './types';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDateOrNull = (v: unknown): v is IsoDate | null => v === null || isIsoDate(v);

function sortedByFrom(entries: { from: IsoDate }[]): boolean {
  return entries.every((e, i) => i === 0 || entries[i - 1]!.from < e.from);
}

const isRate = (v: unknown): v is RateEntry => isObj(v) && isIsoDate(v.from) && isNum(v.apr) && v.apr >= 0;

const isAllowance = (v: unknown): v is AllowanceEntry =>
  isObj(v) && isIsoDate(v.from) && Number.isInteger(v.weekday) && (v.weekday as number) >= 0 && (v.weekday as number) <= 6 && isNum(v.amount) && v.amount >= 0;

export const isKidMove = (v: unknown): v is KidMove =>
  isObj(v) && typeof v.id === 'string' && v.id !== '' && isIsoDate(v.date) && isNum(v.amount) && v.amount !== 0 && typeof v.kidNote === 'string';

/** The ledger fields shared by the kid projection and the parent's KidDoc. */
export function isLedger(v: unknown, isMove: (m: unknown) => boolean = isKidMove): v is Ledger {
  if (!isObj(v)) return false;
  const { name, birthday, currency, ledgerStart, rates, allowance, sundays, moves } = v;
  return (
    typeof name === 'string' &&
    isDateOrNull(birthday) &&
    currency === 'EUR' &&
    isIsoDate(ledgerStart) &&
    Array.isArray(rates) && rates.every(isRate) && sortedByFrom(rates) &&
    Array.isArray(allowance) && allowance.every(isAllowance) && sortedByFrom(allowance) &&
    isObj(sundays) && Object.entries(sundays).every(([d, n]) => isIsoDate(d) && isNum(n) && n >= 0) &&
    Array.isArray(moves) && moves.every(isMove)
  );
}

export function parseKidPublicDoc(v: unknown): KidPublicDoc | null {
  if (!isObj(v) || v.format !== 'bpm-kid' || v.v !== 1 || !isIsoDate(v.publishedOn) || !isLedger(v.kid)) return null;
  if (v.locale !== undefined && v.locale !== 'fr' && v.locale !== 'en') return null;
  return v as KidPublicDoc;
}

const isMove = (v: unknown): boolean => isKidMove(v) && typeof (v as Obj).privateNote === 'string';
const isSlot = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

export function parseFamilyDoc(v: unknown): FamilyDoc | null {
  if (!isObj(v) || v.format !== 'bpm-family' || v.v !== 1 || !isIsoDate(v.createdOn)) return null;
  const { kids, backup, prefs, nextSlot } = v;
  if (!Array.isArray(kids) || !kids.every((k) => isObj(k) && isSlot(k.slot) && isLedger(k.doc, isMove))) return null;
  const slots = kids.map((k) => (k as { slot: number }).slot);
  if (new Set(slots).size !== slots.length) return null;
  if (nextSlot !== undefined && !(isSlot(nextSlot) && slots.every((s) => s < nextSlot))) return null;
  if (!isObj(backup) || !isDateOrNull(backup.lastExportOn) || !isSlot(backup.changesSinceExport)) return null;
  if (!isObj(prefs) || (prefs.locale !== 'fr' && prefs.locale !== 'en')) return null;
  if (v.recovery !== undefined && !(isObj(v.recovery) && isDateOrNull(v.recovery.confirmedOn))) return null;
  return v as FamilyDoc;
}
