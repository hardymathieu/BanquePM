import type { IsoDate } from '../../engine/types';

/** The device's local calendar date (SPEC §4: "today" is local). The only clock read in the UI. */
export function localToday(now = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
