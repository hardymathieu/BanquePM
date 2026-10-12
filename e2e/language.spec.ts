// The family's language is the parent's choice, not the phone's (amends SPEC §15).
import { expect, test } from './fixtures';
import { demoBank } from './helpers';

test('an English phone still gets French by default', async ({ browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  const english = await browser.newContext({ locale: 'en-US' });
  const page = await english.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: "J'ai une invitation" })).toBeVisible();
  await page.goto(bank.kidLink);
  await expect(page.getByText('Bonjour Léa !')).toBeVisible();
  await english.close();
});

test('the parent switches the family to English and back; the kid page follows', async ({ page, browser, baseURL }) => {
  const bank = await demoBank(baseURL!);
  await page.goto(bank.parentLink);
  await page.getByText('Réglages').click();
  await page.getByRole('group', { name: 'Langue' }).getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Language changed.')).toBeVisible();
  await expect(page.getByText("Léa’s balance today")).toBeVisible();

  const kid = await browser.newPage(); // a French browser: the family setting wins
  await kid.goto(bank.kidLink);
  await expect(kid.getByText('Hello Léa!')).toBeVisible();
  await expect(kid).toHaveTitle('Léa’s bank');

  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Français' }).click();
  await expect(page.getByText('Langue changée.')).toBeVisible();
  await expect(page.getByText("Solde de Léa aujourd'hui")).toBeVisible();
  await kid.reload();
  await expect(kid.getByText('Bonjour Léa !')).toBeVisible();
  await kid.close();
});
