// Export (SPEC §11): download or share the ExportFile, then reset the backup counters.
import { exportFile, exportFileName, resetBackup } from '../../engine/backup';
import type { FamilyDoc } from '../../engine/types';
import type { Change, SaveResult } from '../../family/session';
import { useI18n } from '../../i18n';
import { downloadJson, shareJson } from '../shared/files';
import { localToday } from '../shared/today';
import { useToast } from '../shared/Toast';

export function useBackup(family: FamilyDoc, save: (change: Change, opts?: { count?: boolean }) => Promise<SaveResult>) {
  const { t } = useI18n();
  const toast = useToast();

  async function done(message: string) {
    const today = localToday();
    // Not a data change: it must not count towards the next "N changements" banner.
    await save((f) => resetBackup(f, today), { count: false });
    toast(message);
  }

  return {
    async download() {
      const today = localToday();
      downloadJson(exportFileName(family, today), exportFile(family, today));
      await done(t.backup.toastExported);
    },
    async share() {
      const today = localToday();
      if (await shareJson(exportFileName(family, today), exportFile(family, today), t.backup.shareTitle)) await done(t.backup.toastShared);
    },
  };
}
