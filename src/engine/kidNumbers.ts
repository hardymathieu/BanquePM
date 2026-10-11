// The numbers the kid view shows about today (SPEC §6.3, §6.5).
import { addDays } from './dates';
import { balanceOn, computeSeries, interestOn } from './ledger';
import { allowanceAmount, aprOn } from './schedule';
import type { IsoDate, Ledger } from './types';

/** i18n keys for fractionWord; fr.ts maps them to "un petit bout", "un quart", … */
export type FractionKey = 'bit' | 'quarter' | 'third' | 'half' | 'twoThirds' | 'threeQuarters' | 'almostAll' | 'whole';

export type KidNumbers = {
  balance: number;
  interestToday: number;
  interestWeek: number;
  /** min(interestWeek / allowance, 1); 0 without an allowance. Drives the coin gauge. */
  coinFill: number;
  fraction: FractionKey;
  /** Balance at which a week of interest equals a week's allowance; null without an allowance or a rate. */
  milestone: number | null;
  /** Ghost line today, the gap to the real balance, and the number of kept days behind it. */
  ghost: number;
  gap: number;
  keptCount: number;
};

export function fractionKey(fill: number): FractionKey {
  if (fill < 0.2) return 'bit';
  if (fill < 0.29) return 'quarter';
  if (fill < 0.4) return 'third';
  if (fill < 0.58) return 'half';
  if (fill < 0.7) return 'twoThirds';
  if (fill < 0.9) return 'threeQuarters';
  if (fill < 1) return 'almostAll';
  return 'whole';
}

export function kidNumbers(doc: Ledger, today: IsoDate): KidNumbers {
  const s = computeSeries(doc, today);
  const balance = balanceOn(s, today);
  let interestWeek = 0;
  for (let k = 6; k >= 0; k--) interestWeek += interestOn(s, addDays(today, -k));

  const allowance = allowanceAmount(doc, today);
  const apr = aprOn(doc.rates, today);
  const coinFill = allowance > 0 ? Math.min(interestWeek / allowance, 1) : 0;
  const ghost = balanceOn(computeSeries(doc, today, { ghost: true }), today);

  return {
    balance,
    interestToday: interestOn(s, today),
    interestWeek,
    coinFill,
    fraction: fractionKey(coinFill),
    milestone: allowance > 0 && apr > 0 ? allowance / ((1 + apr / 365) ** 7 - 1) : null,
    ghost,
    gap: ghost - balance,
    keptCount: Object.entries(doc.sundays).filter(([d, v]) => v === 0 && d <= today).length,
  };
}
