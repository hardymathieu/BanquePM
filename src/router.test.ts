import { describe, expect, it } from 'vitest';
import { route } from './router';

const key = new Uint8Array(32).fill(7);
const KEY_TEXT = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';

describe('route', () => {
  it('opens a kid link on any path', () => {
    expect(route('/', { kind: 'kid', id: 'abc', key }, [])).toEqual({ page: 'kid', id: 'abc', key, remember: true });
  });

  it('opens a preview from the parent app without remembering it', () => {
    expect(route('/apercu', { kind: 'kid', id: 'abc', key }, [])).toEqual({ page: 'kid', id: 'abc', key, remember: false });
  });

  it('opens the parent app from a parent link, or from storage on /parent', () => {
    const root = new Uint8Array(16);
    expect(route('/parent', { kind: 'parent', root }, [])).toEqual({ page: 'parent', root });
    expect(route('/', { kind: 'parent', root }, [])).toEqual({ page: 'parent', root });
    expect(route('/parent', null, [])).toEqual({ page: 'parent', root: null });
  });

  it('opens the only stored kid on /', () => {
    expect(route('/', null, [{ id: 'a', key: KEY_TEXT, name: 'Léa' }])).toMatchObject({ page: 'kid', id: 'a' });
  });

  it('shows the kid picker on / when several kids are stored (SPEC §10.3)', () => {
    expect(route('/', null, [{ id: 'a', key: KEY_TEXT, name: 'Léa' }, { id: 'b', key: KEY_TEXT, name: 'Tom' }])).toEqual({ page: 'picker' });
  });

  it('has the privacy page', () => {
    expect(route('/confidentialite', null, [])).toEqual({ page: 'privacy' });
  });

  it('skips a stored kid with a damaged key', () => {
    expect(route('/', null, [{ id: 'a', key: 'nope', name: 'Léa' }])).toEqual({ page: 'landing' });
  });

  it('never reaches the parent app from stored kids', () => {
    expect(route('/', null, [{ id: 'a', key: KEY_TEXT, name: 'Léa' }]).page).toBe('kid');
    expect(route('/', null, [{ id: 'a', key: KEY_TEXT, name: 'Léa' }, { id: 'b', key: KEY_TEXT, name: 'Tom' }]).page).toBe('picker');
    expect(route('/parent', null, [{ id: 'a', key: KEY_TEXT, name: 'Léa' }]).page).toBe('parent');
  });

  it('shows the landing page when nothing is stored', () => {
    expect(route('/', null, [])).toEqual({ page: 'landing' });
  });

  it('opens the create page from an invite link', () => {
    expect(route('/', { kind: 'invite', code: 'ABCDE-23456' }, [])).toEqual({ page: 'create', invite: 'ABCDE-23456' });
    expect(route('/creer', null, [])).toEqual({ page: 'create', invite: null });
  });

  it('has the backup viewer, empty after a reload (the file lives in memory)', () => {
    expect(route('/sauvegarde', null, [])).toEqual({ page: 'backup', file: null });
  });

  it('has the admin and restore pages', () => {
    expect(route('/admin', null, []).page).toBe('admin');
    expect(route('/restaurer', null, []).page).toBe('restore');
  });

  it('sends unknown paths to not-found', () => {
    expect(route('/nope', null, []).page).toBe('not-found');
  });
});
