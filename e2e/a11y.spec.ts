// Accessibility (SPEC §13, §16 "Lighthouse accessibility ≥ 95"): axe-core, the engine behind
// Lighthouse's accessibility audit, on every main screen, in light and dark.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { E2E_ADMIN_TOKEN } from '../playwright.config';
import { expect, test } from './fixtures';
import { demoBank } from './helpers';

async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);
  expect(report, `axe violations on ${where}`).toEqual([]);
}

test('kid view, with the passbook and the month table open', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.getByRole('button', { name: 'Voir tout le livret' }).click();
  await page.getByText('Voir les chiffres mois par mois').click();
  await audit(page, 'kid view');
});

test('parent home, with every card open and a catch-up draft', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await expect(page.locator('.sum .val')).toBeVisible();
  await page.getByRole('button', { name: 'Tout à la banque' }).click();
  await page.getByText('Réglages').click();
  await page.getByText('Lien de Léa et sauvegarde', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'QR code du lien de Léa' })).toBeVisible();
  await audit(page, 'parent home');
});

test('parent sheets: edit a move, add a kid', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByRole('button', { name: /Glaces à la plage/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'edit sheet');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '+ Ajouter un enfant' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'add kid sheet');
});

test('landing, restore, privacy and admin pages', async ({ page }) => {
  await page.goto('/');
  await audit(page, 'landing');
  await page.goto('/restaurer');
  await audit(page, 'restore');
  await page.goto('/confidentialite');
  await expect(page.getByRole('heading', { name: 'Confidentialité', level: 1 })).toBeVisible();
  await audit(page, 'privacy');
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer une invitation' }).click();
  await expect(page.locator('.minted .code')).toBeVisible();
  await audit(page, 'admin');
});

test('create flow: form, recovery card, word check, ready', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await audit(page, 'create form');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByRole('button', { name: 'Créer la banque de Léa' }).click();
  await expect(page.locator('.recovery .words li')).toHaveCount(12);
  await audit(page, 'recovery card');
  await page.getByRole('button', { name: "J'ai noté mes mots" }).click();
  await audit(page, 'word check');
  await page.getByRole('button', { name: 'Revoir mes mots' }).click();
  await page.getByRole('button', { name: 'Je le ferai plus tard' }).click();
  await expect(page.getByRole('heading', { name: 'La banque de Léa est prête' })).toBeVisible();
  await audit(page, 'ready');
});

test('kid picker', async ({ page, baseURL }) => {
  const [lea, tom] = [await demoBank(baseURL!, 'Léa'), await demoBank(baseURL!, 'Tom')];
  await page.goto(lea.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.goto(tom.kidLink);
  await expect(page.getByText('Bonjour Tom !')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Qui regarde sa banque ?' })).toBeVisible();
  await audit(page, 'kid picker');
});

test('offline backup viewer, parent and kid views', async ({ page, baseURL }, info) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const path = info.outputPath('backup.json');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger la sauvegarde' }).first().click()]);
  await download.saveAs(path);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('label.file-btn input[type=file]').setInputFiles(path);
  await expect(page.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await audit(page, 'backup viewer, parent view');
  await page.getByRole('button', { name: 'Vue enfant' }).click();
  await audit(page, 'backup viewer, kid view');
});

test('kid view while offline (stale banner)', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await page.route('**/api/**', (r) => r.abort('internetdisconnected'));
  await page.reload();
  await expect(page.locator('.stale')).toBeVisible();
  await audit(page, 'stale kid view');
});
