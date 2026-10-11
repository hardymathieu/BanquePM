// Pure edits of the family document (SPEC §4.1, §7.2, §9.4). Never mutate the input.
import type { FamilyDoc, IsoDate, KidDoc, Weekday } from './types';

export type NewKid = { name: string; birthday: IsoDate | null; allowance: number; weekday: Weekday; apr: number };

export function newKidDoc(k: NewKid, today: IsoDate): KidDoc {
  return {
    name: k.name,
    birthday: k.birthday,
    currency: 'EUR',
    ledgerStart: today,
    rates: [{ from: today, apr: k.apr }],
    allowance: [{ from: today, weekday: k.weekday, amount: k.allowance }],
    sundays: {},
    moves: [],
  };
}

/** The next slot never used by this family. */
export function freeSlot(family: FamilyDoc): number {
  return family.nextSlot ?? Math.max(-1, ...family.kids.map((k) => k.slot)) + 1;
}

export function addKid(family: FamilyDoc, doc: KidDoc): { family: FamilyDoc; slot: number } {
  const slot = freeSlot(family);
  return { family: { ...family, kids: [...family.kids, { slot, doc }], nextSlot: slot + 1 }, slot };
}

export function updateKid(family: FamilyDoc, slot: number, change: (doc: KidDoc) => KidDoc): FamilyDoc {
  if (!family.kids.some((k) => k.slot === slot)) throw new Error('unknown_slot');
  return { ...family, kids: family.kids.map((k) => (k.slot === slot ? { slot, doc: change(k.doc) } : k)) };
}

/** Revocation: the kid moves to a fresh slot, so it gets a new id, key and link. */
export function moveKid(family: FamilyDoc, slot: number): { family: FamilyDoc; from: number; to: number } {
  if (!family.kids.some((k) => k.slot === slot)) throw new Error('unknown_slot');
  const to = freeSlot(family);
  return {
    family: { ...family, kids: family.kids.map((k) => (k.slot === slot ? { ...k, slot: to } : k)), nextSlot: to + 1 },
    from: slot,
    to,
  };
}

export function markChanged(family: FamilyDoc): FamilyDoc {
  return { ...family, backup: { ...family.backup, changesSinceExport: family.backup.changesSinceExport + 1 } };
}

export function newFamily(kid: KidDoc, today: IsoDate, locale: 'fr' | 'en'): FamilyDoc {
  return {
    format: 'bpm-family',
    v: 1,
    createdOn: today,
    kids: [{ slot: 0, doc: kid }],
    nextSlot: 1,
    backup: { lastExportOn: null, changesSinceExport: 0 },
    prefs: { locale },
    recovery: { confirmedOn: null },
  };
}

export function confirmRecovery(family: FamilyDoc, today: IsoDate): FamilyDoc {
  return { ...family, recovery: { confirmedOn: today } };
}
