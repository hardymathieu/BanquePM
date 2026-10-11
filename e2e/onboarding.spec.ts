// Onboarding against a real local Worker (SPEC §10, §16 E2E 1 and 4).
import { expect, type Page, test } from '@playwright/test';
import { E2E_ADMIN_TOKEN } from '../playwright.config';
import { watch } from './helpers';

async function mintInvite(page: Page): Promise<string> {
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer une invitation' }).click();
  const code = (await page.locator('.minted .code').textContent())!;
  expect(code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  return code;
}

async function fillKid(page: Page, name: string) {
  await page.getByLabel('Prénom').fill(name);
  await page.getByRole('button', { name: `Créer la banque de ${name}` }).click();
}

async function readWords(page: Page): Promise<string[]> {
  const items = page.locator('.recovery .words li');
  await expect(items).toHaveCount(12);
  return items.allTextContents();
}

async function confirmWords(page: Page, words: string[]) {
  await page.getByRole('button', { name: "J'ai noté mes mots" }).click();
  for (const label of await page.locator('.recovery label').allTextContents()) {
    const n = Number(/(\d+)/.exec(label)![1]);
    await page.getByLabel(label).fill(words[n - 1]!.toUpperCase());
  }
  await page.getByRole('button', { name: 'Vérifier' }).click();
}

test('admin mints an invite; a friend redeems it, creates Léa, confirms 3 words and gets the link (E2E 1)', async ({ page, browser, baseURL }, info) => {
  const code = await mintInvite(page);
  await page.screenshot({ path: info.outputPath('admin.png'), fullPage: true });
  const friend = await browser.newPage();
  const seen = watch(friend, baseURL!);
  await friend.goto(`/#i=${code}`);
  await expect(friend.getByRole('heading', { name: 'Crée la banque de ton enfant' })).toBeVisible();
  expect(new URL(friend.url()).pathname).toBe('/creer');
  await expect(friend.getByLabel("Code d'invitation")).toHaveValue(code);
  await friend.screenshot({ path: info.outputPath('create.png'), fullPage: true });
  await fillKid(friend, 'Léa');

  await expect(friend.getByRole('heading', { name: 'Ta carte de récupération' })).toBeVisible();
  const words = await readWords(friend);
  await friend.screenshot({ path: info.outputPath('recovery.png'), fullPage: true });
  await confirmWords(friend, words);

  await expect(friend.getByRole('heading', { name: 'La banque de Léa est prête' })).toBeVisible();
  await expect(friend.getByRole('img', { name: 'QR code du lien de Léa' })).toBeVisible();
  await friend.screenshot({ path: info.outputPath('ready.png'), fullPage: true });
  const kidLink = (await friend.locator('.url').textContent())!;
  await friend.getByRole('button', { name: 'Ouvrir mon espace parent' }).click();
  await expect(friend.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await friend.getByText('Lien de Léa', { exact: true }).click();
  await expect(friend.getByText(/^Mots vérifiés le/)).toBeVisible();

  const kid = await browser.newPage();
  await kid.goto(kidLink);
  await expect(kid.getByText('Bonjour Léa !')).toBeVisible();

  // The same invite works only once.
  const other = await browser.newPage();
  await other.goto(`/#i=${code}`);
  await fillKid(other, 'Tom');
  await expect(other.getByText("Cette invitation n'est plus valable. Demande-en une nouvelle.")).toBeVisible();

  expect(seen.foreign).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('the owner creates their own bank from /admin; the token never reaches a URL', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await expect(page.getByLabel("Code d'invitation")).toHaveCount(0);
  await fillKid(page, 'Noé');
  await expect(page.getByRole('heading', { name: 'Ta carte de récupération' })).toBeVisible();
  await page.getByRole('button', { name: 'Je le ferai plus tard' }).click();
  await expect(page.getByRole('heading', { name: 'La banque de Noé est prête' })).toBeVisible();
  expect(urls.some((u) => u.includes(E2E_ADMIN_TOKEN))).toBe(false);
  expect(page.url()).not.toContain(E2E_ADMIN_TOKEN);
});

test('admin errors say what is wrong', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill('not-the-token');
  await page.getByRole('button', { name: 'Créer une invitation' }).click();
  await expect(page.getByText("Ce n'est pas le bon mot de passe d'administration.")).toBeVisible();
});

test('restores the bank with the 12 words after forgetting the device (E2E 4, words)', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await fillKid(page, 'Léa');
  const words = await readWords(page);
  await page.getByRole('button', { name: 'Je le ferai plus tard' }).click();
  await page.getByRole('button', { name: 'Ouvrir mon espace parent' }).click();
  await page.getByLabel('Montant (€)').first().fill('12,34');
  await page.getByRole('button', { name: /^Déposer/ }).click();
  await expect(page.locator('.sum .val')).toHaveText(/12,34/);

  await page.getByText('Réglages').click();
  await page.getByRole('button', { name: 'Oublier cet appareil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Oublier', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');

  await page.getByRole('button', { name: 'Restaurer avec mes 12 mots' }).click();
  // Paste everything into the first box, shouting and without accents.
  const sloppy = words.map((w) => w.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()).join(' ');
  await page.getByLabel('Mot 1', { exact: true }).fill(sloppy);
  await expect(page.getByLabel('Mot 12')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Ouvrir ma banque' }).click();
  await expect(page.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await expect(page.locator('.sum .val')).toHaveText(/12,34/);
});

test('restore explains wrong words', async ({ page }) => {
  await page.goto('/restaurer');
  const first = page.getByLabel('Mot 1', { exact: true });
  await first.fill(`${'abandon '.repeat(11)}about`);
  await page.getByRole('button', { name: 'Ouvrir ma banque' }).click();
  await expect(page.getByText("Ces mots ne correspondent à aucune banque sur ce serveur. Vérifie l'adresse et l'ordre des mots.")).toBeVisible();

  await page.getByLabel('Mot 12').fill('abandon');
  await page.getByRole('button', { name: 'Ouvrir ma banque' }).click();
  await expect(page.getByText("Ces mots ne vont pas ensemble. Vérifie l'ordre et l'orthographe.")).toBeVisible();

  await page.getByLabel('Mot 3', { exact: true }).fill('xyzzy');
  await page.getByRole('button', { name: 'Ouvrir ma banque' }).click();
  await expect(page.getByText("Le mot n° 3 n'existe pas dans la liste.")).toBeVisible();
});

test('restore suggests words as you type', async ({ page }, info) => {
  await page.goto('/restaurer');
  await page.getByLabel('Mot 1', { exact: true }).fill('agrea');
  await page.screenshot({ path: info.outputPath('restore.png'), fullPage: true });
  await page.getByRole('group', { name: 'Suggestions' }).getByRole('button', { name: 'agréable' }).click();
  await expect(page.getByLabel('Mot 1', { exact: true })).toHaveValue('agréable');
  await expect(page.getByLabel('Mot 2')).toBeFocused();
});

test('the printed card has the words, the host and a QR code, and no kid name', async ({ page }, info) => {
  await page.goto('/admin');
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Créer ma banque' }).click();
  await fillKid(page, 'Léa');
  const words = await readWords(page);
  await page.emulateMedia({ media: 'print' });
  const card = page.locator('.print-card');
  await expect(card).toBeVisible();
  await expect(page.locator('main')).toBeHidden();
  for (const w of words) await expect(card).toContainText(w);
  await expect(card).toContainText(`Serveur : ${new URL(page.url()).host}`);
  await expect(card).toContainText('Range cette carte avec la tirelire.');
  await expect(card.locator('svg.qr')).toBeVisible();
  await expect(card).not.toContainText('Léa');
  await page.screenshot({ path: info.outputPath('recovery-card-print.png'), fullPage: true });
});

test('landing page: what this is, and the ways in', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Banque de papa et maman' })).toBeVisible();
  await expect(page.getByRole('button', { name: "J'ai une invitation" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurer avec mes 12 mots' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvrir mon espace parent' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('landing.png'), fullPage: true });
});
