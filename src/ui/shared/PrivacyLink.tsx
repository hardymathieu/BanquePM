// Footer link to /confidentialite (SPEC §14): a real link, handled in the app.
import { useI18n } from '../../i18n';
import { useNav } from '../nav';

export function PrivacyLink() {
  const { t } = useI18n();
  const go = useNav();
  return (
    <a
      class="privacy-link"
      href="/confidentialite"
      onClick={(e) => {
        e.preventDefault();
        go({ page: 'privacy' });
      }}
    >
      {t.privacy.link}
    </a>
  );
}
