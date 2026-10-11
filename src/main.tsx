import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-600.css';
import '@fontsource/atkinson-hyperlegible-next/latin-800.css';
import '@fontsource/patrick-hand/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/kid.css';
import './styles/parent.css';
import './styles/onboard.css';
import { render } from 'preact';
import { toBase64url } from './crypto/base64url';
import { parseFragment } from './crypto/links';
import { PREVIEW, route } from './router';
import { getKids, saveKid, setParent } from './store/device';
import { App } from './ui/App';

// Read the secret from the fragment once, keep it in memory, remember it on this
// device when appropriate, then wipe it from the address bar (SPEC §7.4, §10.3).
const fragment = parseFragment(location.hash);
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
if (fragment?.kind === 'kid' && location.pathname !== PREVIEW) {
  const known = getKids().find((k) => k.id === fragment.id);
  saveKid({ id: fragment.id, key: toBase64url(fragment.key), name: known?.name ?? '' });
}

// "Se souvenir sur cet appareil" is on by default; "Oublier cet appareil" is in Réglages.
if (fragment?.kind === 'parent') {
  setParent(toBase64url(fragment.root));
  history.replaceState(null, '', '/parent');
}
if (fragment?.kind === 'invite') history.replaceState(null, '', '/creer');

render(<App route={route(location.pathname, fragment, getKids())} />, document.getElementById('app')!);

// A new link opened in a tab already showing the app only changes the fragment:
// start over so it is read (and wiped) like any other.
addEventListener('hashchange', () => {
  if (parseFragment(location.hash)) location.reload();
});

// Offline after the first visit (SPEC §10.3). Not in `npm run dev`, where files change all the time.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
