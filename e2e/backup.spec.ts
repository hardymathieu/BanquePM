// Backups, import, offline viewer and deletion (SPEC §4.3, §9.5, §11, §16 E2E 4).
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { E2E_ADMIN_TOKEN } from '../playwright.config';
import { balanceOn, computeSeries } from '../src/engine/ledger';
import { formatter } from '../src/i18n/format';
import { localToday } from '../src/ui/shared/today';
import { PRIVATE_NOTE } from '../scripts/demo';
import { demoBank } from './helpers';

const f = formatter('fr');
const today = localToday();
const balance = (page: Page) => page.locator('.sum .val');

async function download(page: Page, button: string, path: string) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).first().click()]);
  await file.saveAs(path);
  return file;
}

test('the banner nags until an export; the export holds everything, private notes included', async ({ page, baseURL }, info) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const banner = page.getByRole('region', { name: 'Sauvegarde' });
  await expect(banner).toContainText("Aucune sauvegarde pour l'instant.");
  await expect(banner).toContainText("l'historique de Léa est perdu");

  const path = info.outputPath('backup.json');
  const file = await download(page, 'Télécharger la sauvegarde', path);
  expect(file.suggestedFilename()).toBe(`banque-lea-${today}.json`);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  expect(json.format).toBe('bpm-export');
  expect(json.family.kids[0].doc.name).toBe('Léa');
  expect(JSON.stringify(json)).toContain(PRIVATE_NOTE);
  expect(Object.keys(json).sort()).toEqual(['exportedOn', 'family', 'format', 'v']);

  await expect(page.getByText('Sauvegarde téléchargée. Range-la hors de ce téléphone')).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.getByText('Lien de Léa et sauvegarde', { exact: true }).click();
  await expect(page.getByText("Dernière sauvegarde : aujourd'hui.")).toBeVisible();
});

test('restores a backup into the family; kid links keep working', async ({ page, browser, baseURL }, info) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const before = await balance(page).textContent();
  const path = info.outputPath('backup.json');
  await download(page, 'Télécharger la sauvegarde', path);

  await page.getByLabel('Montant (€)').first().fill('50');
  await page.getByRole('button', { name: /^Déposer/ }).click();
  await expect(balance(page)).not.toHaveText(before!);

  await page.getByText('Lien de Léa et sauvegarde', { exact: true }).click();
  await page.locator('label.file-btn input[type=file]').setInputFiles(path);
  const sheet = page.getByRole('dialog', { name: 'Restaurer cette sauvegarde ?' });
  await expect(sheet).toContainText(`Sauvegarde du ${f.dateLong(today)} : Léa.`);
  await sheet.getByRole('button', { name: 'Remplacer ma banque' }).click();
  await expect(page.getByText('Sauvegarde restaurée.')).toBeVisible();
  await expect(balance(page)).toHaveText(before!);

  const kid = await browser.newPage();
  await kid.goto(bank.kidLink);
  await expect(kid.locator('.balance')).toHaveAttribute('aria-label', before!);
});

test('opens a backup with no API call, then creates a new bank from it (E2E 4, file)', async ({ page, browser, baseURL, request }, info) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const path = info.outputPath('backup.json');
  await download(page, 'Télécharger la sauvegarde', path);
  const expected = f.money(balanceOn(computeSeries(bank.doc, today), today));

  const fresh = await browser.newContext();
  const viewer = await fresh.newPage();
  const api: string[] = [];
  await viewer.goto('/');
  await viewer.route('**/api/**', (r) => {
    api.push(r.request().url());
    return r.abort('internetdisconnected');
  });
  await viewer.locator('label.file-btn input[type=file]').setInputFiles(path);
  await expect(viewer.getByRole('heading', { name: 'Sauvegarde' })).toBeVisible();
  await expect(viewer.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await expect(viewer.locator('.sum .val')).toHaveText(expected);
  await expect(viewer.getByText(PRIVATE_NOTE).first()).toBeVisible();
  await viewer.getByRole('button', { name: 'Vue enfant' }).click();
  await expect(viewer.getByText('Bonjour Léa !')).toBeVisible();
  await expect(viewer.locator('.balance')).toHaveAttribute('aria-label', expected);
  expect(api).toEqual([]);

  await viewer.unroute('**/api/**');
  const invite = await request.post('/api/v1/invites', { headers: { Authorization: `Bearer ${E2E_ADMIN_TOKEN}` }, data: {} });
  const { code } = (await invite.json()) as { code: string };
  await viewer.getByRole('button', { name: 'Créer une banque à partir de cette sauvegarde' }).click();
  await expect(viewer.getByText("Léa : tout l'historique sera repris.")).toBeVisible();
  await viewer.getByLabel("Code d'invitation").fill(code);
  await viewer.getByRole('button', { name: 'Créer la banque' }).click();
  await viewer.getByRole('button', { name: 'Je le ferai plus tard' }).click();
  await expect(viewer.getByRole('heading', { name: 'La banque de Léa est prête' })).toBeVisible();
  const newKidLink = (await viewer.locator('.url').textContent())!;
  expect(newKidLink).not.toBe(bank.kidLink);
  await viewer.getByRole('button', { name: 'Ouvrir mon espace parent' }).click();
  await expect(viewer.locator('.sum .val')).toHaveText(expected);
  await fresh.close();
});

test('refuses a file that is not a backup', async ({ page }, info) => {
  const path = info.outputPath('not-a-backup.json');
  writeFileSync(path, JSON.stringify({ hello: 'world' }));
  await page.goto('/');
  await page.locator('label.file-btn input[type=file]').setInputFiles(path);
  await expect(page.getByText("Ce fichier n'est pas une sauvegarde de la banque.")).toBeVisible();
});

test("deletes one kid's bank, offering an export first; its link stops working", async ({ page, browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByText('Réglages').click();
  await page.getByRole('button', { name: 'Supprimer la banque de Léa' }).click();
  const sheet = page.getByRole('dialog', { name: 'Supprimer la banque de Léa' });
  await expect(sheet.getByRole('button', { name: 'Télécharger la sauvegarde' })).toBeVisible();
  const confirm = sheet.getByRole('button', { name: 'Supprimer', exact: true });
  await expect(confirm).toBeDisabled();
  await sheet.getByLabel('Tape « Léa » pour confirmer').fill('léa');
  await confirm.click();
  await expect(page.getByText('Banque de Léa supprimée.')).toBeVisible();
  await expect(page.getByText('Ajoute un premier enfant pour commencer.')).toBeVisible();

  const kid = await browser.newPage();
  await kid.goto(bank.kidLink);
  await expect(kid.getByText("Ce lien n'est plus valable. Demande un nouveau lien à tes parents.")).toBeVisible();
});

test('deletes the whole bank with SUPPRIMER; the parent link then finds nothing', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByText('Réglages').click();
  await page.getByRole('button', { name: 'Supprimer toute ma banque' }).click();
  const sheet = page.getByRole('dialog', { name: 'Supprimer toute ma banque' });
  await sheet.getByLabel('Tape « SUPPRIMER » pour confirmer').fill('SUPPRIMER');
  await sheet.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.getByRole('button', { name: "J'ai une invitation" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bpm.parent'))).toBeNull();

  await page.goto(bank.parentLink);
  await expect(page.getByText("Ce lien ne correspond à aucune banque sur ce serveur. Vérifie l'adresse.")).toBeVisible();
});

test('the monthly tip offers to check the words, or waits until next month', async ({ page, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  const tip = page.getByRole('region', { name: 'Ta carte de récupération' });
  await expect(tip).toContainText("tes 12 mots n'ont pas encore été vérifiés");
  await tip.getByRole('button', { name: 'Vérifier mes mots' }).click();
  await expect(page.locator('.recovery .words li')).toHaveCount(12);

  await tip.getByRole('button', { name: 'Plus tard' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ta carte de récupération' })).toHaveCount(0);
});
