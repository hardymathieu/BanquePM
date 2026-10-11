// Calendar-day arithmetic on ISO dates. Every date is a UTC day number,
// so local time zones and DST can never shift a day.
import type { IsoDate, Weekday } from './types';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayNumber(d: IsoDate): number {
  return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY_MS;
}

export function fromDayNumber(n: number): IsoDate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromDayNumber(dayNumber(d) + n);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(to) - dayNumber(from);
}

export function weekday(d: IsoDate): Weekday {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(d) + 4) % 7) + 7) % 7 as Weekday;
}

export function isIsoDate(v: unknown): v is IsoDate {
  return typeof v === 'string' && ISO_RE.test(v) && fromDayNumber(dayNumber(v)) === v;
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** The first birthday strictly after `today`, and the age reached on it. 29 Feb → 28 Feb in common years. */
export function nextBirthday(birthday: IsoDate, today: IsoDate): { date: IsoDate; age: number } {
  const birthYear = +birthday.slice(0, 4);
  const monthDay = birthday.slice(5);
  for (let year = +today.slice(0, 4); ; year++) {
    const md = monthDay === '02-29' && !isLeapYear(year) ? '02-28' : monthDay;
    const date = `${year}-${md}`;
    if (date > today) return { date, age: year - birthYear };
  }
}
