import type { Page } from '@playwright/test';
import { E2E_ADMIN_TOKEN } from '../playwright.config';
import { createDemoBank } from '../scripts/demo';
import { localToday } from '../src/ui/shared/today';

export const demoBank = (baseURL: string) => createDemoBank(baseURL, E2E_ADMIN_TOKEN, localToday());

/** Records every request and console error, so a test can assert none left the origin. */
export function watch(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const foreign: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol !== 'data:' && url.origin !== origin) foreign.push(r.url());
  });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return { foreign, errors };
}
