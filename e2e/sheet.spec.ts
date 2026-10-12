// Google Sheet import (SPEC §12): CSV → summary → bank, against a real local Worker.
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import rows from '../fixtures/sheet-a.json' with { type: 'json' };
import { E2E_ADMIN_TOKEN } from '../playwright.config';
import { importRows, importSummary, parseSheetCsv } from '../src/engine/importSheet';
import { formatter } from '../src/i18n/format';
import { localToday } from '../src/ui/shared/today';
import { demoBank } from './helpers';

const f = formatter('fr');
const today = localToday();

/** fixtures/sheet-a.json as Google Sheets (French) exports it, with one comment. */
function fixtureCsv(): string {
  const lines = ['Date,Ajouté / Sorti,Commentaire', '01/01/2025,,'];
  for (const [d, a] of rows as [string, number][]) {
    const [y, m, day] = d.split('-');
    const comment = d === '2025-03-20' ? 'Trouvés dans le jardin' : '';
    lines.push(`${day}/${m}/${y},"${a.toFixed(2).replace('.', ',')}",${comment}`);
  }
  return lines.join('\r\n');
}

function expected() {
  const parsed = parseSheetCsv(fixtureCsv(), today);
  if (!parsed.ok) throw new Error(parsed.error);
  const doc = importRows(parsed.rows, { name: 'Léa', birthday: null, newId: () => Math.random().toString(36) });
  return importSummary(parsed.rows, doc, today);
}

async function pickCsv(page: Page, path: string) {
  await page.getByRole('button', { name: 'Depuis un tableau' }).click();
  await page.locator('.sheet-import input[type=file]').setInputFiles(path);
}

test('creates a bank from the Google Sheet; summary, balance and catch-up match the engine', async ({ page }, info) => {
  const path = info.outputPath('banque.csv');
  writeFileSync(path, fixtureCsv());
  const s = expected();

  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await page.getByLabel('Prénom').fill('Léa');
  await pickCsv(page, path);
  const summary = page.locator('.sheet-import .preview');
  await expect(summary).toContainText(
    `77 lignes : 71 dimanches à la banque, 7 mouvements, ${s.pending} dimanches à rattraper. Solde aujourd'hui : ${f.money(s.balance)}.`,
  );
  await expect(summary).toContainText('Le livret commence le 1 janvier 2025.');
  await page.screenshot({ path: info.outputPath('sheet-summary.png'), fullPage: true });

  await page.getByRole('button', { name: 'Créer la banque de Léa' }).click();
  await page.getByRole('button', { name: 'Je le ferai plus tard' }).click();
  await page.getByRole('button', { name: 'Ouvrir mon espace parent' }).click();
  await expect(page.locator('.sum .val')).toHaveText(f.money(s.balance));
  await expect(page.locator('#h-catch .count')).toHaveText(String(s.pending));
  await page.getByRole('button', { name: /Voir tout le livret/ }).click();
  await expect(page.getByText('Trouvés dans le jardin')).toBeVisible(); // comment → private note
});

test('adds a kid from a spreadsheet in the parent app', async ({ page, baseURL }, info) => {
  const path = info.outputPath('banque.csv');
  writeFileSync(path, fixtureCsv());
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByRole('button', { name: '+ Ajouter un enfant' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ajouter un enfant' });
  await sheet.getByLabel('Prénom').fill('Tom');
  await pickCsv(page, path);
  await expect(sheet.locator('.preview')).toContainText('77 lignes');
  await sheet.getByRole('button', { name: 'Créer la banque de Tom' }).click();
  await expect(page.getByText('Banque de Tom créée. Envoie-lui son lien.')).toBeVisible();
  await expect(page.locator('.sum .val')).toHaveText(f.money(expected().balance));
});

test('explains a row it cannot read, and a ledger that goes below zero', async ({ page }, info) => {
  const bad = info.outputPath('bad.csv');
  writeFileSync(bad, 'Date,Ajouté / Sorti\n05/01/2025,"1,00"\n31/02/2025,"2,00"\n');
  const negative = info.outputPath('negative.csv');
  writeFileSync(negative, 'Date,Ajouté / Sorti\n05/01/2025,"5,00"\n06/01/2025,"-9,00"\n');

  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await page.getByLabel('Prénom').fill('Léa');
  await pickCsv(page, bad);
  await expect(page.getByText("Ligne 3 : la date « 31/02/2025 » n'est pas lisible.")).toBeVisible();
  await page.locator('.sheet-import input[type=file]').setInputFiles(negative);
  await expect(page.getByText(/Le solde passe sous zéro le 6 janvier 2025/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer la banque de Léa' })).toBeDisabled();
});

test('reads a sheet with other headers and dates in words, and lets the parent fix the columns', async ({ page }, info) => {
  const odd = info.outputPath('odd.csv');
  writeFileSync(
    odd,
    [
      'Semaine,Quand,Pièces,Solde,Remarque',
      '1,"dim. 5 janv. 2025","95,87 €","95,87 €",premier dépôt',
      '2,"dim. 12 janv. 2025","2,00 €","97,87 €",',
      '3,"mer. 15 janv. 2025","-7,50 €","90,37 €",glaces',
      '4,"dim. 5 janv. 2031","2,00 €","92,37 €",prévu',
    ].join('\n'),
  );
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await page.getByLabel('Prénom').fill('Léa');
  await pickCsv(page, odd);
  const columns = page.getByRole('group', { name: 'Colonnes lues' });
  await expect(columns.getByLabel('Dates')).toHaveValue('1');
  await expect(columns.getByLabel('Montants')).toHaveValue('2');
  await expect(columns.getByLabel('Commentaires')).toHaveValue('4');
  await expect(page.locator('.sheet-import .preview')).toContainText('3 lignes : 1 dimanche à la banque, 2 mouvements');
  await expect(page.locator('.sheet-import .preview')).toContainText("1 ligne datée après aujourd'hui est laissée de côté : seul le passé est importé.");

  // A wrong choice explains itself; putting it back fixes it.
  await columns.getByLabel('Dates').selectOption({ label: 'Semaine' });
  await expect(page.getByText('Aucune date reconnue dans la colonne « Semaine » (par exemple « 1 »)')).toBeVisible();
  await columns.getByLabel('Dates').selectOption({ label: 'Quand' });
  await expect(page.locator('.sheet-import .preview')).toContainText('3 lignes');
  await page.screenshot({ path: info.outputPath('odd-sheet.png'), fullPage: true });
});
