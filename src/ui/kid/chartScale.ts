// Axis helpers for the kid chart: round tick values and evenly spaced month labels.
import { addDays } from '../../engine/dates';
import type { IsoDate } from '../../engine/types';

const MAX_INTERVALS = 5;

/** 0, step, 2·step… up to the first multiple ≥ max, with step in 1/2/5 × 10ⁿ (≥ 1 €) and at most 5 intervals. */
export function niceTicks(max: number): number[] {
  const safeMax = Math.max(max, 0);
  let exp = Math.max(0, Math.floor(Math.log10(Math.max(safeMax, 1) / MAX_INTERVALS)) - 1); // steps of 1 € at least
  for (;;) {
    for (const m of [1, 2, 5]) {
      const step = m * 10 ** exp;
      const n = Math.max(1, Math.ceil(safeMax / step - 1e-9));
      if (n <= MAX_INTERVALS) return Array.from({ length: n + 1 }, (_, i) => Math.round(i * step * 100) / 100);
    }
    exp++;
  }
}

const monthIndex = (d: IsoDate) => +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1);
const fromMonthIndex = (i: number): IsoDate => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`;

/** First days of months in [start, end], every k months (aligned: January, July…), at most `max` of them. */
export function monthTicks(start: IsoDate, end: IsoDate, max = 5): IsoDate[] {
  const first = monthIndex(start) + (start.endsWith('-01') ? 0 : 1);
  const last = monthIndex(addDays(end, 0));
  for (const k of [1, 2, 3, 6, 12, 24, 36, 60, 120]) {
    const ticks: IsoDate[] = [];
    for (let i = Math.ceil(first / k) * k; i <= last; i += k) ticks.push(fromMonthIndex(i));
    if (ticks.length <= max) return ticks;
  }
  return [];
}
