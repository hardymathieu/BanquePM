import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';

describe('fr messages', () => {
  it('pluralizes centimes the French way (0 and 1 are singular)', () => {
    expect(fr.kid.cents(0)).toBe('0 centime');
    expect(fr.kid.cents(1)).toBe('1 centime');
    expect(fr.kid.cents(9)).toBe('9 centimes');
  });

  it('elides "de" before a vowel in interest rows', () => {
    expect(fr.kid.interestRow('septembre 2026', false)).toBe('Intérêts de septembre 2026');
    expect(fr.kid.interestRow('octobre 2026', true)).toBe("Intérêts d'octobre 2026, jusqu'ici");
    expect(fr.kid.interestRow('août 2026', false)).toBe("Intérêts d'août 2026");
    expect(fr.kid.interestRow('avril 2027', false)).toBe("Intérêts d'avril 2027");
  });

  it('agrees the kept-coins sentence with the count', () => {
    expect(fr.kid.gapKept(1, 'dimanche', '2 €')).toContain("Tu as gardé 1 pièce du dimanche pour toi. Si tu l'avais mise");
    expect(fr.kid.gapKept(20, 'mercredi', '40 €')).toContain('Tu as gardé 20 pièces du mercredi pour toi. Si tu les avais toutes mises');
  });

  it('counts days to the birthday', () => {
    expect(fr.kid.bdayWhen(1)).toBe('Dans 1 jour, tu pourrais avoir :');
    expect(fr.kid.bdayWhen(182)).toBe('Dans 182 jours, tu pourrais avoir :');
  });

  it('marks bold parts with ** for <Rich>', () => {
    expect(fr.kid.today('9 centimes')).toBe(
      "Aujourd'hui, la banque t'a donné **9 centimes**, juste parce que ton argent est ici. Demain, elle recommence.",
    );
  });
});

describe('en messages', () => {
  it('has exactly the same keys as fr', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});
