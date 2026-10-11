// Kid view against a real local Worker (SPEC §8, §16 E2E 3 and 5).
import { expect, test } from '@playwright/test';
import { kidNumbers } from '../src/engine/kidNumbers';
import { projectForKid } from '../src/engine/project';
import { formatter } from '../src/i18n/format';
import { localToday } from '../src/ui/shared/today';
import { PRIVATE_NOTE } from '../scripts/demo';
import { demoBank, watch } from './helpers';

const f = formatter('fr');

test('opens a kid link, shows the engine balance and forgets the fragment', async ({ page, baseURL }, info) => {
  const bank = await demoBank(baseURL!);
  const seen = watch(page, baseURL!);
  const response = await page.goto(bank.kidLink);
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");

  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  const balance = kidNumbers(projectForKid(bank.doc, localToday()).kid, localToday()).balance;
  await expect(page.locator('.balance')).toHaveAttribute('aria-label', f.money(balance));
  await expect(page).toHaveTitle('Banque de Léa');

  expect(page.url()).not.toContain('#');
  const stored = await page.evaluate(() => localStorage.getItem('bpm.kids'));
  expect(stored).toContain(bank.kidId);
  await expect(page.locator('body')).not.toContainText(PRIVATE_NOTE);
  await expect(page.getByText('Glaces à la plage')).toBeVisible();
  await expect(page.getByText('Trouvés sous le canapé')).toBeHidden(); // passbook shows 7 rows first
  await page.getByRole('button', { name: 'Voir tout le livret' }).click();
  await expect(page.getByText('Trouvés sous le canapé')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(PRIVATE_NOTE);

  await page.getByRole('button', { name: 'Voir moins' }).click();
  await page.screenshot({ path: info.outputPath('kid-view.png'), fullPage: true });
  expect(seen.foreign).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('opens the remembered kid on /, and shows the cached copy when offline', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await expect(page.locator('.stale')).toBeHidden();

  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await expect(page.locator('.stale')).toContainText(`Mis à jour le ${f.dateLong(localToday())}`);
});

test('a revoked kid link says so and is forgotten', async ({ page, baseURL, request }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();

  const del = await request.delete(`/api/v1/blobs/${bank.kidId}`, { headers: { Authorization: `Bearer ${bank.kidToken}` } });
  expect(del.status()).toBe(204);
  await page.reload();
  await expect(page.getByText("Ce lien n'est plus valable. Demande un nouveau lien à tes parents.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bpm.kids'))).not.toContain(bank.kidId);
  expect(await page.evaluate((id) => localStorage.getItem(`bpm.cache.${id}`), bank.kidId)).toBeNull();
});

test('the chart shows a tooltip on touch', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.kidLink);
  const chart = page.locator('.chart svg');
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await expect(page.locator('.tip.on')).toContainText('ton compte');
});
