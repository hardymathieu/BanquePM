// The backup nag (SPEC §11) and the monthly recovery-card tip.
import { backupStatus, recoveryTipDue } from '../../engine/backup';
import type { FamilyDoc } from '../../engine/types';
import { useI18n } from '../../i18n';
import { getTipDismissed, setTipDismissed } from '../../store/device';
import { useState } from 'preact/hooks';
import { Rich } from '../shared/Rich';
import { canShareFiles } from '../shared/files';

type Props = { family: FamilyDoc; today: string; onDownload: () => void; onShare: () => void; onCheckWords: () => void };

export function BackupBanner({ family, today, onDownload, onShare, onCheckWords }: Props) {
  const { t, f } = useI18n();
  const [tipHidden, setTipHidden] = useState(false);
  const status = backupStatus(family, today);
  const names = f.names(family.kids.map((k) => k.doc.name));
  const tip = !tipHidden && recoveryTipDue(family, getTipDismissed(), today);

  return (
    <>
      {status.show && (
        <div class="banner" role="region" aria-label={t.backup.sectionTitle}>
          <p>
            <Rich
              text={
                status.kind === 'never'
                  ? t.backup.bannerNever(names)
                  : status.kind === 'stale'
                    ? t.backup.bannerStale(status.days ?? 0, names)
                    : t.backup.bannerChanges(status.changes)
              }
            />
          </p>
          <div class="banner-actions">
            <button type="button" class="btn small" onClick={onDownload}>{t.backup.download}</button>
            {canShareFiles() && <button type="button" class="btn small ghosty" onClick={onShare}>{t.backup.share}</button>}
          </div>
        </div>
      )}
      {tip && (
        <div class="banner recovery-tip" role="region" aria-label={t.recovery.title}>
          <p><Rich text={t.backup.tip} /></p>
          <div class="banner-actions">
            <button type="button" class="btn small" onClick={onCheckWords}>{t.backup.tipAction}</button>
            <button
              type="button"
              class="btn small ghosty"
              onClick={() => {
                setTipDismissed(today.slice(0, 7));
                setTipHidden(true);
              }}
            >
              {t.backup.tipLater}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
