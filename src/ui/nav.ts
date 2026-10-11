// In-app navigation. Routes carry secrets (a root, the admin token) in memory, never in the URL.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Route } from '../router';

export const NavContext = createContext<(route: Route) => void>(() => undefined);
export const useNav = () => useContext(NavContext);
