// The kid link and the recovery card (SPEC §9.1.8): QR code, copy, "Créer un nouveau lien"
// (revocation, §7.2), and the 12 words behind a deliberate tap. Backups join in milestone 7.
import { useEffect, useState } from 'preact/hooks';
import { parseExportFile } from '../../engine/backup';
import { daysBetween } from '../../engine/dates';
import { confirmRecovery } from '../../engine/family';
import type { ExportFile } from '../../engine/types';
import type { FamilyDoc } from '../../engine/types';
import type { Change, FamilySession, SaveResult } from '../../family/session';
import { useI18n } from '../../i18n';
import { canShareFiles, readJsonFile } from '../shared/files';
import { KidLinkCard } from '../shared/KidLinkCard';
import { Sheet } from '../shared/Sheet';
import { useToast } from '../shared/Toast';
import type { KidCtx } from './kidContext';
import { RecoveryFlow } from './RecoveryCard';

type Props = {
  ctx: KidCtx;
  family: FamilyDoc;
  session: FamilySession;
  save: (change: Change, opts?: { count?: boolean }) => Promise<SaveResult>;
  revoke: (slot: number) => Promise<{ ok: true; slot: number } | { ok: false; error: string }>;
  replaceWith: (file: ExportFile) => Promise<boolean>;
  backup: { download: () => Promise<void>; share: () => Promise<void> };
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Set by the monthly tip's "Vérifier mes mots". */
  revealWords: boolean;
};

export function Sharing({ ctx, family, session, save, revoke, replaceWith, backup, open, onToggle, revealWords }: Props) {
  const { t, f } = useI18n();
  const toast = useToast();
  const name = ctx.doc.name;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const confirmedOn = family.recovery?.confirmedOn ?? null;
  const [pending, setPending] = useState<ExportFile | null>(null);
  const [fileError, setFileError] = useState(false);
  useEffect(() => {
    if (revealWords) setShowWords(true);
  }, [revealWords]);
  const { lastExportOn, changesSinceExport } = family.backup;

  async function newLink() {
    setBusy(true);
    const res = await revoke(ctx.slot);
    setBusy(false);
    setConfirm(false);
    if (res.ok) toast(t.parent.toastNewLink);
    else toast(res.error === 'old_link_kept' ? t.parent.oldLinkKept : t.parent.saveServer);
  }

  return (
    <section>
      <details class="card fold" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
        <summary>{t.parent.sharingTitle(name)}</summary>
        <KidLinkCard session={session} slot={ctx.slot} name={name} />
        <button type="button" class="btn ghosty" onClick={() => setConfirm(true)}>{t.parent.newLink(name)}</button>

        <h3 class="subhead">{t.recovery.title}</h3>
        <p class="sub">{confirmedOn ? t.recovery.confirmedOn(f.dateLong(confirmedOn)) : t.recovery.notConfirmed}</p>
        {showWords ? (
          <RecoveryFlow
            root={session.root}
            locale={family.prefs.locale}
            today={ctx.today}
            onConfirmed={async () => {
              const res = await save((fam) => confirmRecovery(fam, ctx.today), { count: false });
              if (ctx.report(res)) {
                toast(t.recovery.checkOk);
                setShowWords(false);
              }
            }}
          />
        ) : (
          <button type="button" class="btn ghosty" onClick={() => setShowWords(true)}>
            {confirmedOn ? t.recovery.show : t.recovery.verify}
          </button>
        )}

        <h3 class="subhead">{t.backup.sectionTitle}</h3>
        <p class="sub">{lastExportOn ? t.backup.last(daysBetween(lastExportOn, ctx.today), changesSinceExport) : t.backup.lastNever}</p>
        <div class="row2">
          <button type="button" class="btn" onClick={() => void backup.download()}>{t.backup.downloadShort}</button>
          <label class="btn ghosty file-btn">
            {t.backup.restore}
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                input.value = '';
                if (!file) return;
                const parsed = parseExportFile(await readJsonFile(file));
                setFileError(!parsed);
                setPending(parsed);
              }}
            />
          </label>
        </div>
        {canShareFiles() && <button type="button" class="btn ghosty" onClick={() => void backup.share()}>{t.backup.share}</button>}
        {fileError && <p class="err" role="alert">{t.backup.notABackup}</p>}
        <p class="hint">{t.backup.fileHint}</p>
      </details>
      {pending && (
        <Sheet title={t.backup.restoreTitle} onClose={() => setPending(null)}>
          <p class="sub">{t.backup.restoreSummary(f.dateLong(pending.exportedOn), f.names(pending.family.kids.map((k) => k.doc.name)))}</p>
          <p class="sub">{t.backup.restoreWarn}</p>
          <div class="dlg-actions">
            <button type="button" class="btn ghosty" onClick={() => setPending(null)}>{t.parent.cancel}</button>
            <button
              type="button"
              class="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await replaceWith(pending);
                setBusy(false);
                setPending(null);
                if (ok) toast(t.backup.toastRestored);
              }}
            >
              {t.backup.restoreConfirm}
            </button>
          </div>
        </Sheet>
      )}
      {confirm && (
        <Sheet title={t.parent.newLink(name)} onClose={() => setConfirm(false)}>
          <p class="sub">{t.parent.newLinkHelp}</p>
          <div class="dlg-actions">
            <button type="button" class="btn ghosty" onClick={() => setConfirm(false)}>{t.parent.cancel}</button>
            <button type="button" class="btn" disabled={busy} onClick={() => void newLink()}>{t.parent.newLinkConfirm}</button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
