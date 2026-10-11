// Every e2e test runs under this guard (SPEC §16 "no network request leaves the instance's
// own origin"; CLAUDE.md rule 3): no request to another origin, no console error (CSP
// violations show up there), no uncaught exception. Failed loads that a test causes on
// purpose (offline, a revoked link's 404) are network events, not app errors.
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ context, baseURL }, use) => {
      const origin = new URL(baseURL!).origin;
      const foreign: string[] = [];
      const errors: string[] = [];
      const watchPage = (page: Page) => {
        page.on('console', (m) => {
          if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
        });
        page.on('pageerror', (e) => errors.push(String(e)));
      };
      context.on('request', (r) => {
        const url = new URL(r.url());
        if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== origin) foreign.push(r.url());
      });
      context.pages().forEach(watchPage);
      context.on('page', watchPage);
      await use();
      expect(foreign, 'requests to another origin').toEqual([]);
      expect(errors, 'console errors or uncaught exceptions').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
