// The only path from a parent's KidDoc to the kid blob (SPEC §4.2, CLAUDE.md rule 5).
// Fields are copied one by one: a field added to KidDoc stays private until it is added here.
import type { IsoDate, KidDoc, KidPublicDoc } from './types';

export function projectForKid(doc: KidDoc, publishedOn: IsoDate): KidPublicDoc {
  return {
    format: 'bpm-kid',
    v: 1,
    publishedOn,
    kid: {
      name: doc.name,
      birthday: doc.birthday,
      currency: doc.currency,
      ledgerStart: doc.ledgerStart,
      rates: doc.rates.map(({ from, apr }) => ({ from, apr })),
      allowance: doc.allowance.map(({ from, weekday, amount }) => ({ from, weekday, amount })),
      sundays: { ...doc.sundays },
      moves: doc.moves.map(({ id, date, amount, kidNote }) => ({ id, date, amount, kidNote })),
    },
  };
}
