import { I18nContext, deviceLocale, i18nFor } from '../i18n';
import type { Route } from '../router';
import KidView from './kid/KidView';
import Landing from './onboarding/Landing';

export function App({ route }: { route: Route }) {
  const i18n = i18nFor(deviceLocale());
  return (
    <I18nContext.Provider value={i18n}>
      {route.page === 'kid' ? <KidView id={route.id} rawKey={route.key} /> : <Landing />}
    </I18nContext.Provider>
  );
}
