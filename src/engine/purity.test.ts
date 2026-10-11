// CLAUDE.md rule 7: the engine is pure. No DOM, no I/O, no crypto, no clock.
// The engine's own tsconfig (no DOM lib) catches most of this at typecheck time;
// this test catches what types can't (Date.now, Math.random, globalThis lookups).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = import.meta.dirname;
const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

const forbidden: [string, RegExp][] = [
  ['Date.now', /\bDate\.now\b/],
  ['new Date() (current time)', /new Date\(\s*\)/],
  ['Math.random', /\bMath\.random\b/],
  ['fetch', /\bfetch\s*\(/],
  ['crypto', /\bcrypto\b/],
  ['window / document / localStorage', /\b(window|document|localStorage|sessionStorage|navigator)\b/],
  ['console', /\bconsole\./],
  ['globalThis', /\bglobalThis\b/],
];

// Good enough for our own sources: no '//' or '/*' inside string literals here.
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('engine purity', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  for (const file of sources) {
    it(`${file} uses no clock, randomness, I/O or DOM`, () => {
      const code = stripComments(readFileSync(join(dir, file), 'utf8'));
      for (const [name, re] of forbidden) expect(re.test(code), `${file} uses ${name}`).toBe(false);
    });
  }
});
