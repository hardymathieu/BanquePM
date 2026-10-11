import type { Format, Messages } from '../../i18n';

/** "9 centimes" under a euro, "1,23 €" from there on. */
export function centsText(amount: number, t: Messages, f: Format): string {
  const cents = Math.round(amount * 100);
  return cents < 100 ? t.kid.cents(cents) : f.money(amount);
}

/** "2 €" for a whole coin, "2,50 €" otherwise. */
export function coinLabel(amount: number, f: Format): string {
  return Number.isInteger(amount) ? f.moneyWhole(amount) : f.money(amount);
}
