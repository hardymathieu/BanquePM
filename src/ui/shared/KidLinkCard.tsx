// A kid's link with its QR code and a copy button (SPEC §9.1.8, §9.4).
import { useEffect, useState } from 'preact/hooks';
import { kidLink } from '../../crypto/links';
import type { FamilySession } from '../../family/session';
import { useI18n } from '../../i18n';
import { QrCode } from './QrCode';
import { useToast } from './Toast';

export function KidLinkCard({ session, slot, name }: { session: FamilySession; slot: number; name: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void session.kid(slot).then((k) => alive && setLink(kidLink(location.origin, k.id, k.rawKey)));
    return () => {
      alive = false;
    };
  }, [slot, session]);

  if (!link) return null;
  return (
    <>
      <div class="share">
        <QrCode text={link} label={t.parent.qrAria(name)} />
        <div>
          <p>{t.parent.shareHelp(name)}</p>
          <button
            type="button"
            class="btn small"
            onClick={() =>
              void navigator.clipboard.writeText(link).then(
                () => toast(t.parent.toastCopied(name)),
                () => undefined, // refused: the link is on screen to copy by hand
              )
            }
          >
            {t.parent.copyLink(name)}
          </button>
        </div>
      </div>
      <p class="url">{link}</p>
    </>
  );
}
