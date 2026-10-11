// Page: /admin (SPEC §10.1, §10.2). The instance owner mints invite codes or creates
// their own bank. The token stays in memory: never stored, never in a URL.
import { useState } from 'preact/hooks';
import { mintInvite } from '../../api/client';
import { useI18n } from '../../i18n';
import { useNav } from '../nav';
import { QrCode } from '../shared/QrCode';

const DAYS = [7, 14, 30];

export default function AdminInvites() {
  const { t, f } = useI18n();
  const go = useNav();
  const [token, setToken] = useState('');
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expiresOn: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const link = invite ? `${location.origin}/#i=${invite.code}` : '';

  async function mint() {
    setBusy(true);
    setError(null);
    const res = await mintInvite(token.trim(), days);
    setBusy(false);
    if (res.ok) setInvite({ code: res.code, expiresOn: res.expiresOn });
    else setError(res.error === 'bad_token' ? t.admin.badToken : res.error === 'admin_disabled' ? t.admin.disabled : t.admin.network);
  }

  const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => setCopied(text), () => undefined);

  return (
    <main class="onboard">
      <h1>{t.admin.title}</h1>
      <p class="sub">{t.admin.sub}</p>
      <div class="card">
        <div class="field">
          <label for="adm-token">{t.admin.tokenLabel}</label>
          <input id="adm-token" type="password" autocomplete="off" spellcheck={false} value={token} onInput={(e) => setToken(e.currentTarget.value)} />
        </div>
      </div>

      <section aria-labelledby="h-invite">
        <h2 id="h-invite">{t.admin.inviteTitle}</h2>
        <div class="card">
          <div class="field">
            <label for="adm-days">{t.admin.daysLabel}</label>
            <select id="adm-days" value={days} onChange={(e) => setDays(Number(e.currentTarget.value))}>
              {DAYS.map((d) => (
                <option key={d} value={d}>{t.admin.days(d)}</option>
              ))}
            </select>
          </div>
          <button type="button" class="btn" disabled={!token.trim() || busy} onClick={() => void mint()}>{t.admin.mint}</button>
          {error && <p class="err" role="alert">{error}</p>}
          {invite && (
            <div class="minted">
              <p class="code">{invite.code}</p>
              <p class="sub">{t.admin.minted(f.dateLong(invite.expiresOn))}</p>
              <div class="share">
                <QrCode text={link} label={t.admin.inviteQrAria} />
                <div class="stack">
                  <button type="button" class="btn small" onClick={() => copy(link)}>{t.admin.copyLink}</button>
                  <button type="button" class="btn small ghosty" onClick={() => copy(invite.code)}>{t.admin.copyCode}</button>
                  {copied && <p class="hint" role="status">{t.admin.copied}</p>}
                </div>
              </div>
              <p class="url">{link}</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div class="card">
          <p class="sub">{t.admin.myBankHelp}</p>
          <button type="button" class="btn ghosty" disabled={!token.trim()} onClick={() => go({ page: 'create', invite: null, adminToken: token.trim() })}>
            {t.admin.myBank}
          </button>
        </div>
      </section>
    </main>
  );
}
