import { lazy, Suspense } from 'preact/compat';
import { I18nContext, deviceLocale, i18nFor } from '../i18n';
import type { Route } from '../router';
import KidView from './kid/KidView';
import Landing from './onboarding/Landing';

// Kids' phones never download the parent app (crypto derivations, forms, QR code).
const ParentApp = lazy(() => import('./parent/ParentApp'));

export function App({ route }: { route: Route }) {
  const i18n = i18nFor(deviceLocale());
  return (
    <I18nContext.Provider value={i18n}>
      {route.page === 'kid' ? (
        <KidView id={route.id} rawKey={route.key} remember={route.remember} />
      ) : route.page === 'parent' ? (
        <Suspense fallback={null}>
          <ParentApp root={route.root} />
        </Suspense>
      ) : (
        <Landing />
      )}
    </I18nContext.Provider>
  );
}
