import { describe, expect, it } from 'vitest';
import { formatter } from './format';

const nbsp = (s: string) => s.replace(/[  ]/g, ' ');
const f = formatter('fr');

describe('format (fr-BE, SPEC §13)', () => {
  it('formats money with two decimals', () => {
    expect(nbsp(f.money(289.052634))).toBe('289,05 €');
    expect(nbsp(f.money(1234.5))).toBe('1 234,50 €');
  });

  it('formats whole euros', () => {
    expect(nbsp(f.moneyWhole(868.19))).toBe('868 €');
  });

  it('formats signed money with a real minus sign', () => {
    expect(nbsp(f.signedMoney(2))).toBe('+2,00 €');
    expect(nbsp(f.signedMoney(-7.5))).toBe('−7,50 €');
  });

  it('splits a balance into euros and cents for the big display', () => {
    expect(f.balanceParts(289.052634)).toEqual({ euros: '289', cents: '05', decimal: ',', symbolFirst: false });
    expect(nbsp(f.balanceParts(1234.999).euros)).toBe('1 235');
    expect(f.balanceParts(1234.999).cents).toBe('00');
    expect(f.balanceParts(0.004)).toMatchObject({ euros: '0', cents: '00' });
  });

  it('formats ISO dates without shifting a day, whatever the time zone', () => {
    expect(f.dateLong('2027-04-10')).toBe('10 avril 2027');
    expect(f.dayMonth('2027-04-10')).toBe('10 avril');
    expect(f.dateShort('2026-08-18')).toBe('18 août 2026');
    expect(f.monthYear('2026-09-01')).toBe('septembre 2026');
    expect(f.dateLong('2026-01-01')).toBe('1 janvier 2026');
  });

  it('formats a date with its weekday for the parent livret', () => {
    expect(f.dateWithDay('2026-10-04')).toBe('dim. 4 oct. 2026');
  });

  it('lists names', () => {
    expect(f.names(['Léa'])).toBe('Léa');
    expect(f.names(['Léa', 'Tom', 'Noé'])).toBe('Léa, Tom et Noé');
  });

  it('names weekdays', () => {
    expect(f.weekdayName(0)).toBe('dimanche');
    expect(f.weekdayName(3)).toBe('mercredi');
  });

  it('formats a percentage rate', () => {
    expect(nbsp(f.percent(0.12))).toBe('12 %');
    expect(nbsp(f.percent(0.025))).toBe('2,5 %');
  });
});

describe('format (en)', () => {
  it('splits the big balance the English way: €289.05', () => {
    expect(formatter('en').balanceParts(289.052634)).toEqual({ euros: '289', cents: '05', decimal: '.', symbolFirst: true });
    expect(formatter('en').balanceParts(1234.5).euros).toBe('1,234');
  });

  it('uses English dates and names', () => {
    const e = formatter('en');
    expect(e.dateLong('2027-04-10')).toBe('10 April 2027');
    expect(e.weekdayName(0)).toBe('Sunday');
  });
});
