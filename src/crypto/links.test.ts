import { describe, expect, it } from 'vitest';
import { kidLink, kidPreviewLink, parentLink, parseFragment } from './links';

const ROOT = Uint8Array.from({ length: 16 }, (_, i) => i);
const KID_KEY = new Uint8Array(32).fill(7);

describe('links (SPEC §7.1, §7.2)', () => {
  it('puts the root only in the fragment of the parent link', () => {
    expect(parentLink('https://banque.example', ROOT)).toBe('https://banque.example/parent#p=AAECAwQFBgcICQoLDA0ODw');
  });

  it('builds a kid link from the kid id and key', () => {
    expect(kidLink('https://banque.example', 'ZUhXPd7qFxdyniFMmiyQBg', KID_KEY)).toBe(
      'https://banque.example/#k=ZUhXPd7qFxdyniFMmiyQBg.BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
    );
  });

  it('builds a preview link on /apercu', () => {
    expect(kidPreviewLink('https://banque.example', 'ZUhXPd7qFxdyniFMmiyQBg', KID_KEY)).toBe(
      'https://banque.example/apercu#k=ZUhXPd7qFxdyniFMmiyQBg.BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
    );
  });

  it('parses a parent fragment', () => {
    expect(parseFragment('#p=AAECAwQFBgcICQoLDA0ODw')).toEqual({ kind: 'parent', root: ROOT });
  });

  it('parses a kid fragment', () => {
    expect(parseFragment('#k=ZUhXPd7qFxdyniFMmiyQBg.BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc')).toEqual({
      kind: 'kid',
      id: 'ZUhXPd7qFxdyniFMmiyQBg',
      key: KID_KEY,
    });
  });

  it('parses an invite fragment', () => {
    expect(parseFragment('#i=ABCDE-23456')).toEqual({ kind: 'invite', code: 'ABCDE-23456' });
  });

  it('round-trips built links', () => {
    const p = new URL(parentLink('https://banque.example', ROOT));
    expect(parseFragment(p.hash)).toEqual({ kind: 'parent', root: ROOT });
    const k = new URL(kidLink('https://banque.example', 'ZUhXPd7qFxdyniFMmiyQBg', KID_KEY));
    expect(parseFragment(k.hash)?.kind).toBe('kid');
  });

  it.each([
    [''],
    ['#'],
    ['#x=1'],
    ['#p='],
    ['#p=AAECAwQFBgcICQoLDA0O'], // 15 bytes
    ['#p=AAECAwQFBgcICQoLDA0ODw=='], // padded
    ['#k=ZUhXPd7qFxdyniFMmiyQBg'], // no key
    ['#k=ZUhXPd7qFxdyniFMmiyQBg.BwcH'], // short key
    ['#k=short.BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'],
    ['#i='],
  ])('rejects %j', (hash) => {
    expect(parseFragment(hash)).toBeNull();
  });
});
