// SPEC §4.4: (by default) 3 kids × 10 years of weekly Sundays and 2 moves a month, every note at 60 chars.
import { addDays } from '../../engine/dates';
import type { FamilyDoc, KidDoc, Move } from '../../engine/types';

const WORDS = (
  'pour ton vélo de mamy argent anniversaire tirelire pièce trouvée rendu en liquide cadeau ' +
  'noël parrain marraine livre bonbons cinéma vide-grenier dent de lait carnet bulletin piscine ' +
  'tonton tata voisine lavage voiture jardin gâteau vente limonade brocante médaille'
).split(' ');

/** Deterministic pseudo-random generator (LCG), so sizes are reproducible. */
function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

export type NoteStyle = 'words' | 'random';

function note(next: () => number, style: NoteStyle): string {
  let s = '';
  if (style === 'random') {
    const chars = 'abcdefghijklmnopqrstuvwxyzéèàç ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    while (s.length < 60) s += chars[Math.floor(next() * chars.length)];
  } else {
    while (s.length < 60) s += (s ? ' ' : '') + WORDS[Math.floor(next() * WORDS.length)];
  }
  return s.slice(0, 60);
}

function kid(n: number, style: NoteStyle): KidDoc {
  const next = rng(n + 1);
  const start = '2016-01-03'; // a Sunday
  const sundays: Record<string, number> = {};
  for (let w = 0; w < 520; w++) sundays[addDays(start, 7 * w)] = next() < 0.8 ? 2 : 0;
  const moves: Move[] = [];
  for (let m = 0; m < 240; m++) {
    const day = addDays(start, Math.floor(m * 15.2) + 1);
    moves.push({
      id: Math.floor(next() * 2 ** 48).toString(36).padStart(10, '0'),
      date: day,
      amount: Math.round((next() < 0.7 ? 1 : -1) * next() * 5000) / 100 || 1,
      kidNote: note(next, style),
      privateNote: note(next, style),
    });
  }
  return {
    name: `Enfant ${n}`,
    birthday: '2012-06-15',
    currency: 'EUR',
    ledgerStart: start,
    rates: [{ from: start, apr: 0.12 }, { from: '2020-01-01', apr: 0.1 }],
    allowance: [{ from: start, weekday: 0, amount: 2 }],
    sundays,
    moves,
  };
}

export function bigFamily(style: NoteStyle = 'words', kids = 3): FamilyDoc {
  return {
    format: 'bpm-family',
    v: 1,
    createdOn: '2016-01-03',
    kids: Array.from({ length: kids }, (_, n) => ({ slot: n, doc: kid(n, style) })),
    backup: { lastExportOn: null, changesSinceExport: 0 },
    prefs: { locale: 'fr' },
  };
}
