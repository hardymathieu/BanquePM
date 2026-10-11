// The kid link (SPEC §9.1.8): QR code, copy, and "Créer un nouveau lien" (revocation, §7.2).
// The recovery card and backups join this card in milestones 6 and 7.
import { useEffect, useState } from 'preact/hooks';
import { kidLink } from '../../crypto/links';
import type { FamilySession } from '../../family/session';
import { useI18n } from '../../i18n';
import { QrCode } from '../shared/QrCode';
import { Sheet } from '../shared/Sheet';
import { useToast } from '../shared/Toast';
import type { KidCtx } from './kidContext';

type Props = {
  ctx: KidCtx;
  session: FamilySession;
  revoke: (slot: number) => Promise<{ ok: true; slot: number } | { ok: false; error: string }>;
  open: boolean;
  onToggle: (open: boolean) => void;
};

export function Sharing({ ctx, session, revoke, open, onToggle }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const name = ctx.doc.name;
  const [link, setLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void session.kid(ctx.slot).then((k) => alive && setLink(kidLink(location.origin, k.id, k.rawKey)));
    return () => {
      alive = false;
    };
  }, [ctx.slot, session]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast(t.parent.toastCopied(name));
    } catch {
      // clipboard refused: the link is on screen to copy by hand
    }
  }

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
        {link && (
          <>
            <div class="share">
              <QrCode text={link} label={t.parent.qrAria(name)} />
              <div>
                <p>{t.parent.shareHelp(name)}</p>
                <button type="button" class="btn small" onClick={() => void copy()}>{t.parent.copyLink(name)}</button>
              </div>
            </div>
            <p class="url">{link}</p>
          </>
        )}
        <button type="button" class="btn ghosty" onClick={() => setConfirm(true)}>{t.parent.newLink(name)}</button>
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
