// Page: one kid's read-only bank. No buttons that change data (SPEC §8).
import { useEffect } from 'preact/hooks';
import { useI18n } from '../../i18n';
import { KidScreen } from './KidScreen';
import { useKidBank } from './useKidBank';

export default function KidView({ id, rawKey }: { id: string; rawKey: Uint8Array }) {
  const { t } = useI18n();
  const state = useKidBank(id, rawKey);

  useEffect(() => {
    document.title = state.status === 'ready' ? t.kid.title(state.doc.kid.name) : t.app.name;
  }, [state, t]);

  switch (state.status) {
    case 'loading':
      return <main class="kid"><p class="notice" role="status">{t.app.loading}</p></main>;
    case 'revoked':
      return <main class="kid"><p class="notice" role="alert">{t.kid.revoked}</p></main>;
    case 'error':
      return (
        <main class="kid">
          <p class="notice" role="alert">{t.kid.loadError}</p>
          <button class="more" type="button" onClick={() => location.reload()}>{t.kid.retry}</button>
        </main>
      );
    case 'ready':
      return <KidScreen doc={state.doc} today={state.today} staleSince={state.staleSince} />;
  }
}
