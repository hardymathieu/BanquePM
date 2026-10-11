// Parent app against a real local Worker (SPEC §9, §16 E2E 2 and 5).
import { expect, type Page, test } from '@playwright/test';
import { addDays } from '../src/engine/dates';
import { balanceOn, computeSeries } from '../src/engine/ledger';
import { pendingDays } from '../src/engine/schedule';
import type { KidDoc } from '../src/engine/types';
import { formatter } from '../src/i18n/format';
import { localToday } from '../src/ui/shared/today';
import { PRIVATE_NOTE } from '../scripts/demo';
import { demoBank, watch } from './helpers';

const f = formatter('fr');
const today = localToday();
const balanceOf = (doc: KidDoc) => balanceOn(computeSeries(doc, today), today);
const balance = (page: Page) => page.locator('.sum .val');

test('opens the parent link, remembers it and wipes it from the address bar', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  const seen = watch(page, baseURL!);
  await page.goto(bank.parentLink);
  await expect(page.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await expect(balance(page)).toHaveText(f.money(balanceOf(bank.doc)));
  expect(new URL(page.url()).pathname).toBe('/parent');
  expect(page.url()).not.toContain('#');
  expect(await page.evaluate(() => localStorage.getItem('bpm.parent'))).toBeTruthy();

  await page.goto('/parent');
  await expect(balance(page)).toHaveText(f.money(balanceOf(bank.doc)));
  expect(seen.foreign).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('adds a deposit and a backdated one; the kid sees the kid note, never the private one', async ({ page, browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const start = balanceOf(bank.doc);

  await page.getByLabel('Montant (€)').first().fill('5');
  await page.getByLabel('Note pour Léa (visible dans son livret)').fill('Pour la tirelire');
  await page.getByLabel('Note privée (seulement pour toi)').fill(PRIVATE_NOTE);
  await expect(page.locator('form .preview')).toContainText(`Nouveau solde : ${f.money(start + 5)}`);
  await page.getByRole('button', { name: `Déposer ${f.money(5)}` }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dépôt ajouté au livret.' })).toBeVisible();
  await expect(balance(page)).toHaveText(f.money(start + 5));

  await page.getByLabel('Montant (€)').first().fill('10');
  await page.getByLabel('Date').first().fill('2026-01-15');
  await expect(page.locator('form .preview')).toContainText("Daté du passé : +");
  await page.getByRole('button', { name: `Déposer ${f.money(10)}` }).click();
  await expect(balance(page)).not.toHaveText(f.money(start + 5));
  const after = Number((await balance(page).textContent())!.replace(/[^\d,]/g, '').replace(',', '.'));
  expect(after).toBeGreaterThan(start + 15);

  const kid = await browser.newPage();
  await kid.goto(bank.kidLink);
  await expect(kid.locator('.balance')).toHaveAttribute('aria-label', f.money(after));
  await expect(kid.getByText('Pour la tirelire')).toBeVisible();
  await expect(kid.locator('body')).not.toContainText(PRIVATE_NOTE);
  await kid.close();
});

test('catches up every pending day with "Tout à la banque"; the balance matches the engine', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const pending = pendingDays(bank.doc, today);
  expect(pending.length).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: 'Tout à la banque' }).click();
  await expect(page.locator('#h-catch + .sub + .card .preview')).toContainText(`${pending.length} à la banque, 0 gardée`);
  await page.getByRole('button', { name: `Enregistrer ${pending.length} dimanches` }).click();
  await expect(page.getByText('Enregistré. Léa verra le nouveau solde à sa prochaine visite.')).toBeVisible();

  const banked: KidDoc = { ...bank.doc, sundays: { ...bank.doc.sundays, ...Object.fromEntries(pending.map((d) => [d, 2])) } };
  await expect(balance(page)).toHaveText(f.money(balanceOf(banked)));
  await expect(page.getByText(/Tout est à jour\. Prochain dimanche : le/)).toBeVisible();
});

test('refuses an overdraft, edits and deletes a move', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByRole('button', { name: 'Retrait' }).first().click();
  await page.getByLabel('Montant (€)').first().fill('10000');
  await expect(page.getByText(`Il n'y a que ${f.money(balanceOf(bank.doc))} sur le compte.`)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Retirer/ })).toBeDisabled();

  await page.getByRole('button', { name: /Glaces à la plage/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Modifier le mouvement' });
  await sheet.getByLabel('Montant (€)').fill('8');
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Modifié. Les soldes sont recalculés.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Glaces à la plage/ })).toContainText(f.signedMoney(-8));

  await page.getByRole('button', { name: /Glaces à la plage/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('Supprimé du livret.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Glaces à la plage/ })).toHaveCount(0);
});

test('switches a kept day to banked from the livret', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByRole('button', { name: /Pièce gardée/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Actuellement : pièce gardée par Léa.');
  await page.getByRole('dialog').getByRole('button', { name: 'Mettre à la banque' }).click();
  await expect(page.getByText('Modifié. Les soldes sont recalculés.')).toBeVisible();
  await expect(balance(page)).not.toHaveText(f.money(balanceOf(bank.doc)));
});

test('changes the rate from a future date', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByText('Réglages').click();
  await page.getByRole('button', { name: 'Changer le taux' }).click();
  await page.getByLabel('Nouveau taux (% par an)').fill('8');
  const from = addDays(today, 10);
  await page.getByLabel('À partir du').fill(from);
  await page.getByRole('button', { name: 'Changer le taux' }).last().click();
  await expect(page.getByText(`Taux de 8 % à partir du ${f.dateLong(from)}.`.replace(/ /g, ' '))).toBeVisible();
  await expect(page.locator('.kv')).toContainText(`à partir du ${f.dateLong(from)}`);
});

test('adds a kid, shows its link and QR code, and the link works', async ({ page, browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByRole('button', { name: '+ Ajouter un enfant' }).click();
  await page.getByRole('dialog').getByLabel('Prénom').fill('Tom');
  await page.getByRole('button', { name: 'Créer la banque de Tom' }).click();
  await expect(page.getByText('Banque de Tom créée. Envoie-lui son lien.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tom', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'QR code du lien de Tom' })).toBeVisible();
  const link = await page.locator('.url').textContent();

  const kid = await browser.newPage();
  await kid.goto(link!);
  await expect(kid.getByText('Bonjour Tom !')).toBeVisible();
  await kid.close();
});

test('a new link revokes the old one (SPEC §16 E2E 5)', async ({ page, browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByText('Lien de Léa', { exact: true }).click();
  await page.getByRole('button', { name: 'Créer un nouveau lien pour Léa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Créer le nouveau lien' }).click();
  await expect(page.getByText("Nouveau lien créé. L'ancien ne marche plus.")).toBeVisible();
  const fresh = await page.locator('.url').textContent();
  expect(fresh).not.toBe(bank.kidLink);

  const kid = await browser.newPage();
  await kid.goto(bank.kidLink);
  await expect(kid.getByText("Ce lien n'est plus valable. Demande un nouveau lien à tes parents.")).toBeVisible();
  await kid.goto(fresh!);
  await expect(kid.getByText('Bonjour Léa !')).toBeVisible();
  await kid.close();
});

test('two devices: a stale save reloads, re-applies and keeps both changes', async ({ browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  const [a, b] = [await browser.newPage(), await browser.newPage()];
  await a.goto(bank.parentLink);
  await b.goto(bank.parentLink);
  for (const [page, note] of [[a, 'Depuis A'], [b, 'Depuis B']] as const) {
    await page.getByLabel('Montant (€)').first().fill('1');
    await page.getByLabel('Note pour Léa (visible dans son livret)').fill(note);
    await page.getByRole('button', { name: `Déposer ${f.money(1)}` }).click();
    await expect(page.getByText('Dépôt ajouté au livret.')).toBeVisible();
  }
  await expect(b.getByRole('button', { name: /Depuis A/ })).toBeVisible();
  await expect(b.getByRole('button', { name: /Depuis B/ })).toBeVisible();
  await expect(balance(b)).toHaveText(f.money(balanceOf(bank.doc) + 2));
});

test('"Voir comme Léa" opens the kid view without remembering the kid', async ({ page, context, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const [preview] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Voir comme Léa' }).click()]);
  await expect(preview.getByText('Bonjour Léa !')).toBeVisible();
  expect(new URL(preview.url()).pathname).toBe('/apercu');
  expect(await preview.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'bpm.parent'))).toEqual([]);
});

test('"Oublier cet appareil" forgets everything and leaves', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByText('Réglages').click();
  await page.getByRole('button', { name: 'Oublier cet appareil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Oublier', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bpm.')))).toEqual([]);
});

test('parent home screenshot', async ({ page, baseURL }, info) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await expect(balance(page)).toBeVisible();
  await page.screenshot({ path: info.outputPath('parent-home.png'), fullPage: true });
});
