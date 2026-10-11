import { defineConfig, devices } from '@playwright/test';

export const E2E_PORT = 8799;
export const E2E_ADMIN_TOKEN = 'e2e-admin-token-0123456789-abcdefghijkl';
const persist = '.wrangler/e2e';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: 'fr-BE',
  },
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
  webServer: {
    // The production build behind the real Worker, so CSP and _headers apply.
    command: [
      'vite build',
      `wrangler d1 migrations apply DB --local --persist-to ${persist}`,
      `wrangler dev --port ${E2E_PORT} --persist-to ${persist} --var ADMIN_TOKEN:${E2E_ADMIN_TOKEN}`,
    ].join(' && '),
    url: `http://localhost:${E2E_PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
