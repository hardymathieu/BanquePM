// Installable app, offline after the first visit, kid picker, privacy page (SPEC §10.3, §14, §16 E2E 3).
import { expect, test } from './fixtures';
import { E2E_CONTACT } from '../playwright.config';
import { demoBank, watch } from './helpers';

test('serves a manifest with icons, start_url / and the French name', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: 'Banque de papa et maman', start_url: '/', display: 'standalone', lang: 'fr' });
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
});

test('the kid view opens with no network after the first visit (E2E 3)', async ({ page, context, baseURL }) => {
  const bank = await demoBank(baseURL!);
  const seen = watch(page, baseURL!);
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await expect(page.locator('.stale')).toContainText('Mis à jour le');
  await context.setOffline(false);
  expect(seen.foreign).toEqual([]);
});

test('the service worker never caches API answers', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(cached.length).toBeGreaterThan(5);
  expect(cached.filter((u) => u.startsWith('/api/'))).toEqual([]);
});

test('several kids on one phone get a picker, and never the parent app (SPEC §10.3)', async ({ page, baseURL }) => {
  const lea = await demoBank(baseURL!, 'Léa');
  const tom = await demoBank(baseURL!, 'Tom');
  await page.goto(lea.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.goto(tom.kidLink);
  await expect(page.getByText('Bonjour Tom !')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Qui regarde sa banque ?' })).toBeVisible();
  await expect(page.locator('a[href^="/parent"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Léa' }).click();
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.getByRole('button', { name: "Changer d'enfant" }).click();
  await page.getByRole('button', { name: 'Tom' }).click();
  await expect(page.getByText('Bonjour Tom !')).toBeVisible();
});

test('the privacy page says what is and is not stored, with the host contact', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Confidentialité', level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/confidentialite');
  await expect(page.getByText('Aucun prénom, aucun montant, aucune note, aucun e-mail, aucun mot de passe, aucune adresse IP, aucun journal.')).toBeVisible();
  await expect(page.getByText("Toute personne qui a le lien d'un enfant peut voir son solde")).toBeVisible();
  await expect(page.getByText(E2E_CONTACT)).toBeVisible();
  await page.screenshot({ path: info.outputPath('privacy.png'), fullPage: true });
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: "J'ai une invitation" })).toBeVisible();
});
