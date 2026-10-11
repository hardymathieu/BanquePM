import { describe, expect, it } from 'vitest';
import { monthTicks, niceTicks } from './chartScale';

describe('niceTicks', () => {
  it.each([
    [425.8, [0, 100, 200, 300, 400, 500]],
    [190, [0, 50, 100, 150, 200]],
    [10, [0, 2, 4, 6, 8, 10]],
    [3.2, [0, 1, 2, 3, 4]],
    [0, [0, 1]],
  ])('%f → %j', (max, ticks) => {
    expect(niceTicks(max)).toEqual(ticks);
  });
});

describe('monthTicks', () => {
  it('labels January and July over about two years', () => {
    expect(monthTicks('2025-01-01', '2027-04-10')).toEqual(['2025-01-01', '2025-07-01', '2026-01-01', '2026-07-01', '2027-01-01']);
  });

  it('labels every month over a few months', () => {
    expect(monthTicks('2026-10-10', '2027-01-15')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });

  it('labels every year over a long ledger', () => {
    expect(monthTicks('2016-01-03', '2026-12-31')).toHaveLength(5);
  });
});
