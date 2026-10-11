// Page: the parent app at /parent (SPEC §9). The root lives in memory, and on this
// device when remembered (§10.3); it never leaves the browser.
import { useMemo } from 'preact/hooks';
import { fromBase64url } from '../../crypto/base64url';
import { I18nContext, i18nFor, useI18n } from '../../i18n';
import { getParent } from '../../store/device';
import { ToastProvider } from '../shared/Toast';
import { ParentHome } from './ParentHome';
import { useFamily } from './useFamily';

function Loaded({ root }: { root: Uint8Array }) {
  const { t } = useI18n();
  const fam = useFamily(root);
  const { state } = fam;

  if (state.status === 'loading') return <main class="parent"><p class="notice" role="status">{t.parent.loading}</p></main>;
  if (state.status === 'error') {
    const message = { not_found: t.parent.notFound, damaged: t.parent.damaged, network: t.parent.loadNetwork, server: t.parent.saveServer }[state.error];
    return (
      <main class="parent">
        <p class="notice" role="alert">{message}</p>
        {(state.error === 'network' || state.error === 'server') && (
          <button type="button" class="btn" onClick={() => void fam.retry()}>{t.parent.retry}</button>
        )}
      </main>
    );
  }
  return (
    <I18nContext.Provider value={i18nFor(state.family.prefs.locale)}>
      <ParentHome family={state.family} session={state.session} save={fam.save} revoke={fam.revoke} reload={fam.reload} />
    </I18nContext.Provider>
  );
}

export default function ParentApp({ root }: { root: Uint8Array | null }) {
  const { t } = useI18n();
  const known = useMemo(() => root ?? fromBase64url(getParent() ?? ''), [root]);
  if (!known || known.length !== 16) {
    return (
      <main class="parent">
        <p class="notice">{t.parent.noRoot}</p>
        <a class="btn ghosty" href="/">{t.app.name}</a>
      </main>
    );
  }
  return (
    <ToastProvider>
      <Loaded root={known} />
    </ToastProvider>
  );
}
