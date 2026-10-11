import { describe, expect, it } from 'vitest';
import { sheetA } from './__fixtures__/sheetA';
import { projectForKid } from './project';
import { parseKidPublicDoc } from './schema';

const good = () => JSON.parse(JSON.stringify(projectForKid(sheetA(), '2026-10-10'))) as Record<string, any>;

describe('parseKidPublicDoc', () => {
  it('accepts a projected kid doc', () => {
    expect(parseKidPublicDoc(good())).toEqual(good());
  });

  it('ignores unknown extra fields, so a newer v1 writer stays readable', () => {
    const doc = good();
    doc.extra = 1;
    doc.kid.newField = 'x';
    expect(parseKidPublicDoc(doc)).not.toBeNull();
  });

  it.each<[string, (d: Record<string, any>) => void]>([
    ['another format', (d) => (d.format = 'bpm-family')],
    ['another version', (d) => (d.v = 2)],
    ['a bad publishedOn', (d) => (d.publishedOn = '2026-13-01')],
    ['a missing kid', (d) => delete d.kid],
    ['a non-string name', (d) => (d.kid.name = 3)],
    ['a bad birthday', (d) => (d.kid.birthday = '10/04/2017')],
    ['another currency', (d) => (d.kid.currency = 'USD')],
    ['a rate out of order', (d) => d.kid.rates.push({ from: '2024-01-01', apr: 0.1 })],
    ['a rate that is not a number', (d) => (d.kid.rates[0].apr = '0.12')],
    ['a weekday out of range', (d) => (d.kid.allowance[0].weekday = 7)],
    ['a negative allowance', (d) => (d.kid.allowance[0].amount = -2)],
    ['a sundays key that is not a date', (d) => (d.kid.sundays.hello = 2)],
    ['a negative sundays value', (d) => (d.kid.sundays['2025-01-19'] = -2)],
    ['a zero move', (d) => (d.kid.moves[0].amount = 0)],
    ['a move without id', (d) => (d.kid.moves[0].id = '')],
    ['a move with a non-string note', (d) => (d.kid.moves[0].kidNote = null)],
    ['moves that are not an array', (d) => (d.kid.moves = {})],
    ['NaN smuggled as a string', (d) => (d.kid.moves[0].amount = 'NaN')],
  ])('rejects %s', (_, mutate) => {
    const doc = good();
    mutate(doc);
    expect(parseKidPublicDoc(doc)).toBeNull();
  });

  it('rejects non-objects', () => {
    for (const v of [null, 1, 'x', [], undefined]) expect(parseKidPublicDoc(v)).toBeNull();
  });
});
