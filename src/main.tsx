import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-600.css';
import '@fontsource/atkinson-hyperlegible-next/latin-800.css';
import '@fontsource/patrick-hand/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/kid.css';
import { render } from 'preact';
import { toBase64url } from './crypto/base64url';
import { parseFragment } from './crypto/links';
import { route } from './router';
import { getKids, saveKid } from './store/device';
import { App } from './ui/App';

// Read the secret from the fragment once, keep it in memory, remember it on this
// device when appropriate, then wipe it from the address bar (SPEC §7.4, §10.3).
const fragment = parseFragment(location.hash);
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
if (fragment?.kind === 'kid') {
  const known = getKids().find((k) => k.id === fragment.id);
  saveKid({ id: fragment.id, key: toBase64url(fragment.key), name: known?.name ?? '' });
}

render(<App route={route(location.pathname, fragment, getKids())} />, document.getElementById('app')!);
