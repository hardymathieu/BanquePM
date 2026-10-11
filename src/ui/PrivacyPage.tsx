// Page: /confidentialite (SPEC §14). Plain language; the owner's contact if INSTANCE_CONTACT is set.
import { useEffect, useState } from 'preact/hooks';
import { getInstance } from '../api/client';
import { useI18n } from '../i18n';
import { useNav } from './nav';

const SOURCE = 'https://github.com/hardymathieu/BanquePM';

export default function PrivacyPage() {
  const { t } = useI18n();
  const go = useNav();
  const [contact, setContact] = useState<string | null>(null);
  useEffect(() => {
    document.title = t.privacy.title;
    void getInstance().then((i) => setContact(i.contact));
  }, [t]);
  const p = t.privacy;
  return (
    <main class="onboard privacy">
      <h1>{p.title}</h1>
      <p class="lede">{p.intro}</p>
      <h2>{p.storesTitle}</h2>
      <ul class="bullets">
        {p.stores.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <h2>{p.notStoredTitle}</h2>
      <p>{p.notStored}</p>
      <h2>{p.cloudflareTitle}</h2>
      <p>{p.cloudflare}</p>
      <h2>{p.recoveryTitle}</h2>
      <p>{p.recovery}</p>
      <h2>{p.kidLinkTitle}</h2>
      <p>{p.kidLink}</p>
      <h2>{p.deviceTitle}</h2>
      <p>{p.device}</p>
      {contact && (
        <>
          <h2>{p.contactTitle}</h2>
          <p class="contact">{contact}</p>
        </>
      )}
      <p class="hint">
        {p.code} <a href={SOURCE} rel="noopener noreferrer">{SOURCE.replace('https://', '')}</a>
      </p>
      <button type="button" class="btn ghosty" onClick={() => (history.length > 1 ? history.back() : go({ page: 'landing' }))}>
        {p.back}
      </button>
    </main>
  );
}
