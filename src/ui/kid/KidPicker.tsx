// Page: "/" with several kids on one phone (SPEC §10.3). Big name buttons; never the parent app.
import { fromBase64url } from '../../crypto/base64url';
import { useI18n } from '../../i18n';
import { getKids } from '../../store/device';
import { useNav } from '../nav';
import { PrivacyLink } from '../shared/PrivacyLink';

export default function KidPicker() {
  const { t } = useI18n();
  const go = useNav();
  const kids = getKids().flatMap((k) => {
    const key = fromBase64url(k.key);
    return key?.length === 32 ? [{ ...k, raw: key }] : [];
  });
  return (
    <main class="kid picker">
      <h1>{t.picker.title}</h1>
      <ul>
        {kids.map((k) => (
          <li key={k.id}>
            <button type="button" class="pick" onClick={() => go({ page: 'kid', id: k.id, key: k.raw, remember: true })}>
              {k.name || t.picker.unnamed}
            </button>
          </li>
        ))}
      </ul>
      <footer><PrivacyLink /></footer>
    </main>
  );
}
