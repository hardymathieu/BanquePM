import { describe, expect, it } from 'vitest';
import { addDays, dayNumber, daysBetween, fromDayNumber, isIsoDate, nextBirthday, weekday } from './dates';

describe('dates', () => {
  it('maps ISO dates to UTC day numbers and back', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2025-01-01')).toBe(20089);
    expect(fromDayNumber(20089)).toBe('2025-01-01');
  });

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28'); // EU DST switch day
    expect(addDays('2025-01-01', 365)).toBe('2026-01-01');
  });

  it('counts days between two dates', () => {
    expect(daysBetween('2026-10-10', '2027-04-10')).toBe(182);
    expect(daysBetween('2026-10-10', '2026-10-03')).toBe(-7);
  });

  it('gives the weekday with 0 = Sunday', () => {
    expect(weekday('2025-01-12')).toBe(0);
    expect(weekday('2026-10-10')).toBe(6);
    expect(weekday('2026-10-14')).toBe(3);
  });

  it('accepts only real calendar dates in YYYY-MM-DD form', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
    expect(isIsoDate('10/10/2026')).toBe(false);
    expect(isIsoDate(20261010)).toBe(false);
  });

  describe('nextBirthday', () => {
    it('is later this year when the birthday has not passed', () => {
      expect(nextBirthday('2018-05-21', '2027-01-01')).toEqual({ date: '2027-05-21', age: 9 });
    });

    it('is next year when the birthday has passed', () => {
      expect(nextBirthday('2018-05-21', '2026-10-10')).toEqual({ date: '2027-05-21', age: 9 });
    });

    it('is next year when today is the birthday', () => {
      expect(nextBirthday('2018-05-21', '2027-05-21')).toEqual({ date: '2028-05-21', age: 10 });
    });

    it('falls on 28 February in non-leap years for a 29 February birthday', () => {
      expect(nextBirthday('2020-02-29', '2026-10-10')).toEqual({ date: '2027-02-28', age: 7 });
      expect(nextBirthday('2020-02-29', '2027-10-10')).toEqual({ date: '2028-02-29', age: 8 });
    });
  });
});
