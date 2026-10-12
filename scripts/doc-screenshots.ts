// npm run doc:screenshots: the pictures in docs/guide/img, taken from the real app with the
// fictional demo bank ("Léa"), at phone size. Never real data. Re-run when the UI changes.
import { execSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium, type Locator, type Page } from '@playwright/test';
import rows from '../fixtures/sheet-a.json' with { type: 'json' };
import { localToday } from '../src/ui/shared/today';
import { createDemoBank } from './demo';

const PORT = 8796;
const TOKEN = 'doc-screenshots-admin-token-0123456789';
const base = `http://localhost:${PORT}`;
const persist = '.wrangler/doc-screenshots';
const OUT = 'docs/guide/img';

execSync(`npx vite build && npx wrangler d1 migrations apply DB --local --persist-to ${persist}`, { stdio: 'ignore' });
const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', persist, '--var', `ADMIN_TOKEN:${TOKEN}`], { stdio: 'ignore', detached: true });

async function shot(target: Page | Locator, name: string) {
  await target.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82, animations: 'disabled' });
}

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      if (i > 120) throw new Error('wrangler dev did not start');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-BE', colorScheme: 'light' });
  const page = await context.newPage();

  // Landing and admin
  await page.goto(`${base}/`);
  await shot(page, 'landing');
  await page.goto(`${base}/admin`);
  await page.getByLabel("Mot de passe d'administration (ADMIN_TOKEN)").fill(TOKEN);
  await page.getByRole('button', { name: 'Créer une invitation' }).click();
  await page.locator('.minted .code').waitFor();
  await shot(page.locator('section').filter({ hasText: 'Inviter une famille' }), 'admin-invite');

  // Creating a bank (with the invite just minted)
  const code = (await page.locator('.minted .code').textContent())!;
  await page.goto(`${base}/#i=${code}`);
  await page.getByLabel('Prénom').fill('Léa');
  await shot(page.locator('form.card'), 'create-form');
  await page.getByRole('button', { name: 'Depuis un tableau' }).click();
  const csv = ['Date,Ajouté / Sorti,Commentaire', '01/01/2025,,'];
  for (const [d, a] of rows as [string, number][]) csv.push(`${d.split('-').reverse().join('/')},"${a.toFixed(2).replace('.', ',')}",`);
  writeFileSync('/tmp/doc-sheet.csv', csv.join('\n'));
  await page.locator('.sheet-import input[type=file]').setInputFiles('/tmp/doc-sheet.csv');
  await page.locator('.sheet-import .preview').waitFor();
  await shot(page.locator('form.card'), 'sheet-import');
  await page.getByRole('button', { name: 'Nouveau livret' }).click();
  await page.getByRole('button', { name: 'Créer la banque de Léa' }).click();
  await page.locator('.recovery .words li').nth(11).waitFor();
  await shot(page, 'recovery');
  await page.getByRole('button', { name: "J'ai noté mes mots" }).click();
  await shot(page.locator('main'), 'word-check');
  await page.getByRole('button', { name: 'Revoir mes mots' }).click();
  await page.getByRole('button', { name: 'Je le ferai plus tard' }).click();
  await page.getByRole('img', { name: 'QR code du lien de Léa' }).waitFor();
  await shot(page, 'ready');

  // Parent space, with the demo bank (history, pending Sundays)
  const bank = await createDemoBank(base, TOKEN, localToday());
  await page.goto(bank.parentLink);
  await page.locator('.sum .val').waitFor();
  await shot(page, 'parent-home');
  await page.getByRole('button', { name: 'Tout à la banque' }).click();
  await shot(page.locator('section').filter({ has: page.locator('#h-catch') }), 'catch-up');
  await page.getByLabel('Montant (€)').first().fill('10');
  await page.getByLabel('Note pour Léa (visible dans son livret)').fill('De Mamie pour ton anniversaire');
  await page.getByLabel('Note privée (seulement pour toi)').fill('Enveloppe du 3 octobre');
  await shot(page.locator('section').filter({ has: page.locator('#h-add') }), 'add-move');
  await page.getByText('Réglages').click();
  await shot(page.locator('details.fold').filter({ hasText: 'Réglages' }), 'settings');
  await page.getByText('Lien de Léa et sauvegarde', { exact: true }).click();
  await page.getByRole('img', { name: 'QR code du lien de Léa' }).waitFor();
  await shot(page.locator('details.fold').filter({ hasText: 'Lien de Léa et sauvegarde' }), 'sharing');

  // What the kid sees
  const kid = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-BE', colorScheme: 'light' });
  await kid.goto(bank.kidLink);
  await kid.locator('.balance').waitFor();
  await kid.locator('.chart svg').waitFor();
  await shot(kid, 'kid-top');
  await shot(kid.locator('section').filter({ has: kid.locator('#h-coin') }), 'kid-coin');
  await shot(kid.locator('section').filter({ has: kid.locator('#h-chart') }), 'kid-chart');
  await shot(kid.locator('section').filter({ has: kid.locator('#h-bday') }), 'kid-birthday');
  await shot(kid.locator('section').filter({ has: kid.locator('#h-book') }), 'kid-passbook');
  const dark = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-BE', colorScheme: 'dark' });
  await dark.goto(bank.kidLink);
  await dark.locator('.chart svg').waitFor();
  await shot(dark, 'kid-dark');

  await browser.close();
  process.stdout.write(`screenshots written to ${OUT}\n`);
} finally {
  try {
    process.kill(-server.pid!, 'SIGTERM');
  } catch {
    // already gone
  }
}
