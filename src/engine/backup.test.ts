import { describe, expect, it } from 'vitest';
import {
  backupStatus,
  exportFile,
  exportFileName,
  familyFromBackup,
  mergeImport,
  parseExportFile,
  recoveryTipDue,
} from './backup';
import { addKid, moveKid, newFamily, newKidDoc } from './family';
import type { FamilyDoc } from './types';

const TODAY = '2026-10-11';
const kid = (name: string) => newKidDoc({ name, birthday: null, allowance: 2, weekday: 0, apr: 0.12 }, '2026-09-01');

function family(over: Partial<FamilyDoc> = {}): FamilyDoc {
  return { ...newFamily(kid('Léa'), '2026-09-01', 'fr'), ...over };
}

describe('backupStatus (SPEC §11 banner)', () => {
  it('shows "never" when there has never been an export', () => {
    expect(backupStatus(family(), TODAY)).toEqual({ show: true, kind: 'never', days: null, changes: 0 });
  });

  it('shows "stale" after more than 30 days', () => {
    const f = family({ backup: { lastExportOn: '2026-09-07', changesSinceExport: 1 } });
    expect(backupStatus(f, TODAY)).toEqual({ show: true, kind: 'stale', days: 34, changes: 1 });
    expect(backupStatus(family({ backup: { lastExportOn: '2026-09-11', changesSinceExport: 1 } }), TODAY).show).toBe(false);
  });

  it('shows "changes" from 5 changes on', () => {
    const f = family({ backup: { lastExportOn: '2026-10-10', changesSinceExport: 5 } });
    expect(backupStatus(f, TODAY)).toEqual({ show: true, kind: 'changes', days: 1, changes: 5 });
    expect(backupStatus(family({ backup: { lastExportOn: '2026-10-10', changesSinceExport: 4 } }), TODAY).show).toBe(false);
  });
});

describe('export (SPEC §4.3)', () => {
  it('wraps the family, private notes included, with the counters reset', () => {
    const f = family({ backup: { lastExportOn: null, changesSinceExport: 7 } });
    f.kids[0]!.doc.moves.push({ id: 'm1', date: '2026-09-02', amount: 5, kidNote: '', privateNote: 'secret' });
    const file = exportFile(f, TODAY);
    expect(file.format).toBe('bpm-export');
    expect(file.v).toBe(1);
    expect(file.exportedOn).toBe(TODAY);
    expect(file.family.backup).toEqual({ lastExportOn: TODAY, changesSinceExport: 0 });
    expect(JSON.stringify(file)).toContain('secret');
  });

  it('never contains the root secret or any key', () => {
    expect(Object.keys(exportFile(family(), TODAY)).sort()).toEqual(['exportedOn', 'family', 'format', 'v']);
  });

  it('names the file after the kids, without accents', () => {
    const two = addKid(family(), kid('Noé Jr')).family;
    expect(exportFileName(two, TODAY)).toBe('banque-lea-noe-jr-2026-10-11.json');
    expect(exportFileName({ ...family(), kids: [] }, TODAY)).toBe('banque-2026-10-11.json');
  });

  it('round-trips through JSON and the validator', () => {
    const file = exportFile(family(), TODAY);
    expect(parseExportFile(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });

  it('rejects anything that is not a v1 export', () => {
    const file = JSON.parse(JSON.stringify(exportFile(family(), TODAY)));
    expect(parseExportFile({ ...file, format: 'bpm-family' })).toBeNull();
    expect(parseExportFile({ ...file, v: 2 })).toBeNull();
    expect(parseExportFile({ ...file, exportedOn: 'hier' })).toBeNull();
    expect(parseExportFile({ ...file, family: { ...file.family, kids: 'x' } })).toBeNull();
    expect(parseExportFile(null)).toBeNull();
  });
});

describe('mergeImport (replace the current family with a backup)', () => {
  it('keeps the slots that are active now, so current kid links keep working', () => {
    const current = addKid(family(), kid('Tom')).family; // slots 0, 1
    const backup = exportFile(current, '2026-10-01').family;
    const { family: merged, deleteSlots } = mergeImport(current, backup);
    expect(merged.kids.map((k) => k.slot)).toEqual([0, 1]);
    expect(deleteSlots).toEqual([]);
  });

  it('moves a kid whose slot was revoked since the backup, so a revoked link stays dead', () => {
    const before = family(); // Léa on slot 0
    const backup = exportFile(before, '2026-10-01').family;
    const current = moveKid(before, 0).family; // Léa now on slot 1, slot 0 revoked
    const { family: merged, deleteSlots } = mergeImport(current, backup);
    expect(merged.kids.map((k) => k.slot)).toEqual([2]);
    expect(merged.nextSlot).toBe(3);
    expect(deleteSlots).toEqual([1]);
  });

  it('deletes the blobs of current kids that are not in the backup', () => {
    const current = addKid(family(), kid('Tom')).family;
    const backup = exportFile(family(), '2026-10-01').family; // only Léa on slot 0
    expect(mergeImport(current, backup).deleteSlots).toEqual([1]);
  });

  it('keeps the current recovery status and resets nothing else', () => {
    const current = { ...family(), recovery: { confirmedOn: '2026-10-05' } };
    const backup = { ...exportFile(family(), '2026-10-01').family, recovery: { confirmedOn: null } };
    expect(mergeImport(current, backup).family.recovery).toEqual({ confirmedOn: '2026-10-05' });
  });
});

describe('familyFromBackup (a new bank, with a new root)', () => {
  it('keeps the kids and their slots, resets backup counters and recovery', () => {
    const backup = exportFile(addKid(family(), kid('Tom')).family, '2026-10-01').family;
    const f = familyFromBackup(backup, TODAY);
    expect(f.kids.map((k) => k.doc.name)).toEqual(['Léa', 'Tom']);
    expect(f.backup).toEqual({ lastExportOn: null, changesSinceExport: 0 });
    expect(f.recovery).toEqual({ confirmedOn: null });
    expect(f.createdOn).toBe(TODAY);
  });
});

describe('recoveryTipDue (SPEC §11 monthly tip)', () => {
  it('is due when the words were never checked and not dismissed this month', () => {
    expect(recoveryTipDue(family(), null, TODAY)).toBe(true);
    expect(recoveryTipDue(family(), '2026-09', TODAY)).toBe(true);
    expect(recoveryTipDue(family(), '2026-10', TODAY)).toBe(false);
  });

  it('is never due once the words were checked', () => {
    expect(recoveryTipDue({ ...family(), recovery: { confirmedOn: '2026-10-01' } }, null, TODAY)).toBe(false);
  });

  it('is due for older docs without a recovery field', () => {
    const { recovery: _, ...old } = family();
    expect(recoveryTipDue(old as FamilyDoc, null, TODAY)).toBe(true);
  });
});
