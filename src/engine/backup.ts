// Backups (SPEC §4.3, §11): the banner rule, the export file, imports.
// The export holds the family document only: never the root secret, never a key.
import { daysBetween, isIsoDate } from './dates';
import { freeSlot } from './family';
import { parseFamilyDoc } from './schema';
import type { ExportFile, FamilyDoc, IsoDate } from './types';

const STALE_DAYS = 30;
const MANY_CHANGES = 5;

export type BackupStatus = {
  show: boolean;
  kind: 'never' | 'stale' | 'changes' | 'ok';
  /** Days since the last export, null if never. */
  days: number | null;
  changes: number;
};

export function backupStatus(family: FamilyDoc, today: IsoDate): BackupStatus {
  const { lastExportOn, changesSinceExport: changes } = family.backup;
  if (lastExportOn === null) return { show: true, kind: 'never', days: null, changes };
  const days = daysBetween(lastExportOn, today);
  if (days > STALE_DAYS) return { show: true, kind: 'stale', days, changes };
  if (changes >= MANY_CHANGES) return { show: true, kind: 'changes', days, changes };
  return { show: false, kind: 'ok', days, changes };
}

export function resetBackup(family: FamilyDoc, today: IsoDate): FamilyDoc {
  return { ...family, backup: { lastExportOn: today, changesSinceExport: 0 } };
}

export function exportFile(family: FamilyDoc, today: IsoDate): ExportFile {
  return { format: 'bpm-export', v: 1, exportedOn: today, family: resetBackup(family, today) };
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** banque-<prénoms>-<YYYY-MM-DD>.json */
export function exportFileName(family: FamilyDoc, today: IsoDate): string {
  const names = family.kids.map((k) => slug(k.doc.name)).filter(Boolean);
  return ['banque', ...names, today].join('-') + '.json';
}

export function parseExportFile(v: unknown): ExportFile | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.format !== 'bpm-export' || o.v !== 1 || !isIsoDate(o.exportedOn)) return null;
  const family = parseFamilyDoc(o.family);
  return family ? { format: 'bpm-export', v: 1, exportedOn: o.exportedOn, family } : null;
}

/**
 * Replaces the current family with a backup, keeping the keys. A kid keeps its slot only
 * if that slot is active now: a slot revoked since the backup must never come back
 * (its old link would work again). Returns the current slots whose blobs must go.
 */
export function mergeImport(current: FamilyDoc, imported: FamilyDoc): { family: FamilyDoc; deleteSlots: number[] } {
  const active = new Set(current.kids.map((k) => k.slot));
  let next = Math.max(freeSlot(current), freeSlot(imported));
  const kids = imported.kids.map((k) => (active.has(k.slot) ? k : { ...k, slot: next++ }));
  const kept = new Set(kids.map((k) => k.slot));
  return {
    family: { ...imported, kids, nextSlot: next, recovery: current.recovery ?? imported.recovery },
    deleteSlots: current.kids.map((k) => k.slot).filter((s) => !kept.has(s)),
  };
}

/** A new bank from a backup ("Créer une banque à partir de cette sauvegarde"): new root, new words. */
export function familyFromBackup(imported: FamilyDoc, today: IsoDate): FamilyDoc {
  return { ...imported, createdOn: today, backup: { lastExportOn: null, changesSinceExport: 0 }, recovery: { confirmedOn: null } };
}

/** The monthly "carte de récupération" tip: words never checked, not dismissed this month. */
export function recoveryTipDue(family: FamilyDoc, dismissedMonth: string | null, today: IsoDate): boolean {
  return !family.recovery?.confirmedOn && dismissedMonth !== today.slice(0, 7);
}
