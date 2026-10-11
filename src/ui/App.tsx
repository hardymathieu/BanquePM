import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { I18nContext, deviceLocale, i18nFor } from '../i18n';
import { PATHS, type Route, route as routeFor } from '../router';
import { getKids } from '../store/device';
import KidView from './kid/KidView';
import { NavContext } from './nav';

// Kids' phones never download the parent app or onboarding (forms, QR code, wordlists).
const ParentApp = lazy(() => import('./parent/ParentApp'));
const Landing = lazy(() => import('./onboarding/Landing'));
const CreateFamily = lazy(() => import('./onboarding/CreateFamily'));
const Restore = lazy(() => import('./onboarding/Restore'));
const Admin = lazy(() => import('./admin/AdminInvites'));

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'kid':
      return <KidView id={route.id} rawKey={route.key} remember={route.remember} />;
    case 'parent':
      return <ParentApp root={route.root} />;
    case 'create':
      return <CreateFamily invite={route.invite} adminToken={route.adminToken ?? null} />;
    case 'restore':
      return <Restore />;
    case 'admin':
      return <Admin />;
    default:
      return <Landing />;
  }
}

export function App({ route: initial }: { route: Route }) {
  const i18n = i18nFor(deviceLocale());
  const [route, setRoute] = useState(initial);

  useEffect(() => {
    const onPop = () => setRoute(routeFor(location.pathname, null, getKids()));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const go = (next: Route) => {
    history.pushState(null, '', PATHS[next.page]);
    scrollTo(0, 0);
    setRoute(next);
  };

  return (
    <I18nContext.Provider value={i18n}>
      <NavContext.Provider value={go}>
        <Suspense fallback={null}>
          <Page route={route} />
        </Suspense>
      </NavContext.Provider>
    </I18nContext.Provider>
  );
}
