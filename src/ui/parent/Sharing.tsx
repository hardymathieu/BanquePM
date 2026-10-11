// The kid link and the recovery card (SPEC §9.1.8): QR code, copy, "Créer un nouveau lien"
// (revocation, §7.2), and the 12 words behind a deliberate tap. Backups join in milestone 7.
import { useState } from 'preact/hooks';
import { confirmRecovery } from '../../engine/family';
import type { FamilyDoc } from '../../engine/types';
import type { Change, FamilySession, SaveResult } from '../../family/session';
import { useI18n } from '../../i18n';
import { KidLinkCard } from '../shared/KidLinkCard';
import { Sheet } from '../shared/Sheet';
import { useToast } from '../shared/Toast';
import type { KidCtx } from './kidContext';
import { RecoveryFlow } from './RecoveryCard';

type Props = {
  ctx: KidCtx;
  family: FamilyDoc;
  session: FamilySession;
  save: (change: Change) => Promise<SaveResult>;
  revoke: (slot: number) => Promise<{ ok: true; slot: number } | { ok: false; error: string }>;
  open: boolean;
  onToggle: (open: boolean) => void;
};

export function Sharing({ ctx, family, session, save, revoke, open, onToggle }: Props) {
  const { t, f } = useI18n();
  const toast = useToast();
  const name = ctx.doc.name;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const confirmedOn = family.recovery?.confirmedOn ?? null;

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
              const res = await save((fam) => confirmRecovery(fam, ctx.today));
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
      </details>
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
