// Number and date formatting (SPEC §13). Rounding happens here and only here.
// ISO dates are parsed as UTC midnight and formatted in UTC, so a day never shifts.
import type { IsoDate, Weekday } from '../engine/types';

export type Locale = 'fr' | 'en';

const TAGS: Record<Locale, string> = { fr: 'fr-BE', en: 'en-GB' };

const utc = (d: IsoDate) => new Date(`${d}T00:00:00Z`);

export function formatter(locale: Locale) {
  const tag = TAGS[locale];
  const money = new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR' });
  const moneyWhole = new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const integer = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 });
  const date = (opts: Intl.DateTimeFormatOptions) => {
    const fmt = new Intl.DateTimeFormat(tag, { ...opts, timeZone: 'UTC' });
    return (d: IsoDate) => fmt.format(utc(d));
  };
  // 2023-01-01 was a Sunday.
  const weekday = date({ weekday: 'long' });

  return {
    locale,
    money: (n: number) => money.format(n),
    moneyWhole: (n: number) => moneyWhole.format(n),
    signedMoney: (n: number) => `${n < 0 ? '−' : '+'}${money.format(Math.abs(n))}`,
    /** "289" and "05" for the big balance: euros with group separators, cents always two digits. */
    balanceParts(n: number): { euros: string; cents: string } {
      const totalCents = Math.round(Math.abs(n) * 100);
      const euros = integer.format(Math.floor(totalCents / 100));
      return { euros: n < -0.004 ? `−${euros}` : euros, cents: String(totalCents % 100).padStart(2, '0') };
    },
    percent: (rate: number) => percent.format(rate),
    dateLong: date({ day: 'numeric', month: 'long', year: 'numeric' }),
    dateShort: date({ day: 'numeric', month: 'short', year: 'numeric' }),
    dayMonth: date({ day: 'numeric', month: 'long' }),
    monthYear: date({ month: 'long', year: 'numeric' }),
    monthShort: date({ month: 'short', year: '2-digit' }),
    weekdayName: (w: Weekday) => weekday(`2023-01-0${1 + w}`),
  };
}

export type Format = ReturnType<typeof formatter>;
