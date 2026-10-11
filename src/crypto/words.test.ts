import { describe, expect, it } from 'vitest';
import { sameWord, suggestWords } from './words';

describe('suggestWords (SPEC §10.5 autocomplete)', () => {
  it('suggests from both lists, accent- and case-insensitive, NFC for display', () => {
    expect(suggestWords('agre', 5)).toContain('agréable');
    expect(suggestWords('AGRÉ', 5)).toContain('agréable');
    expect(suggestWords('aband', 5)).toEqual(['abandon']);
    expect(suggestWords('agré', 5).every((w) => w === w.normalize('NFC'))).toBe(true);
  });

  it('puts an exact match first and caps the list', () => {
    expect(suggestWords('zoo', 3)[0]).toBe('zoo');
    expect(suggestWords('a', 4)).toHaveLength(4);
  });

  it('suggests nothing for an empty prefix or no match', () => {
    expect(suggestWords('', 5)).toEqual([]);
    expect(suggestWords('qqqq', 5)).toEqual([]);
  });
});

describe('sameWord', () => {
  it('ignores case, accents and spaces', () => {
    expect(sameWord('agréable', ' AGREABLE ')).toBe(true);
    expect(sameWord('éligible', 'eligible')).toBe(true);
    expect(sameWord('éligible', 'eligibles')).toBe(false);
  });
});
