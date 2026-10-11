import { describe, expect, it } from 'vitest';
import { generateRoot } from '../crypto/keys';
import { rootToWords } from '../crypto/words';
import { newFamily, newKidDoc } from '../engine/family';
import { fakeApi } from './fakeApi';
import { restoreFromWords } from './restore';
import { createFamily } from './session';

const TODAY = '2026-10-10';

async function bank() {
  const server = fakeApi();
  const root = generateRoot();
  const family = newFamily(newKidDoc({ name: 'Léa', birthday: null, allowance: 2, weekday: 0, apr: 0.12 }, TODAY), TODAY, 'fr');
  await createFamily(root, family, 'INVITE', TODAY, server.api);
  return { server, root };
}

describe('restoreFromWords (SPEC §10.5)', () => {
  it('opens the family from its French words', async () => {
    const { server, root } = await bank();
    const res = await restoreFromWords(rootToWords(root, 'fr').join(' '), server.api);
    expect(res.ok && res.root).toEqual(root);
    expect(res.ok && res.session.family.kids[0]!.doc.name).toBe('Léa');
  });

  it('opens it from the same root in English words, typed without care', async () => {
    const { server, root } = await bank();
    const res = await restoreFromWords(rootToWords(root, 'en').join('   ').toUpperCase(), server.api);
    expect(res.ok && res.root).toEqual(root);
  });

  it('says when the words match no bank on this server', async () => {
    const { server } = await bank();
    expect(await restoreFromWords(rootToWords(generateRoot(), 'fr').join(' '), server.api)).toEqual({ ok: false, error: 'not_found' });
  });

  it('passes on word problems', async () => {
    const { server } = await bank();
    expect(await restoreFromWords('abandon abandon', server.api)).toEqual({ ok: false, error: 'count', count: 2 });
    expect(await restoreFromWords(`${'abandon '.repeat(11)}xyzzy`, server.api)).toEqual({ ok: false, error: 'unknown_words', positions: [11] });
  });
});
