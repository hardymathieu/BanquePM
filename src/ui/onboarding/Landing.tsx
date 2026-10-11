// Placeholder until milestone 6 (landing, invite, restore, open a backup).
import { useI18n } from '../../i18n';

export default function Landing() {
  const { t } = useI18n();
  return (
    <main class="kid">
      <h1 class="landing-title">{t.app.name}</h1>
    </main>
  );
}
