import { describe, expect, it } from 'vitest';
import { fromBase64url } from '../crypto/base64url';
import { open } from '../crypto/box';
import { deriveKid, generateRoot } from '../crypto/keys';
import { addKid, newKidDoc, updateKid } from '../engine/family';
import { addMove } from '../engine/ops';
import { parseKidPublicDoc } from '../engine/schema';
import type { FamilyDoc, Move } from '../engine/types';
import { fakeApi } from './fakeApi';
import { ChangeRejected, createFamily, FamilySession } from './session';

const TODAY = '2026-10-10';
const move = (id: string, amount: number, privateNote = 'secret'): Move => ({ id, date: TODAY, amount, kidNote: 'pour toi', privateNote });

function emptyFamily(): FamilyDoc {
  return { format: 'bpm-family', v: 1, createdOn: TODAY, kids: [], backup: { lastExportOn: null, changesSinceExport: 0 }, prefs: { locale: 'fr' } };
}

async function setup() {
  const server = fakeApi();
  const root = generateRoot();
  const family = addKid(emptyFamily(), newKidDoc({ name: 'Léa', birthday: null, allowance: 2, weekday: 0, apr: 0.12 }, TODAY)).family;
  const created = await createFamily(root, family, 'INVITE', TODAY, server.api);
  if (!created.ok) throw new Error(created.error);
  return { server, root, session: created.session };
}

async function kidBlob(server: ReturnType<typeof fakeApi>, root: Uint8Array, slot: number) {
  const k = await deriveKid(root, slot);
  const row = server.rows.get(k.id);
  return row ? parseKidPublicDoc(await open(k.key, k.id, fromBase64url(row.ct)!)) : null;
}

const deposit = (id: string, amount = 5) => (f: FamilyDoc) => updateKid(f, 0, (d) => addMove(d, move(id, amount)));

describe('createFamily', () => {
  it('stores the family blob, then publishes each kid blob', async () => {
    const { server, root } = await setup();
    expect(server.log.map((l) => l.split(' ')[0])).toEqual(['POST', 'POST']); // a new kid is created, not first PUT
    expect((await kidBlob(server, root, 0))?.kid.name).toBe('Léa');
  });
});

describe('FamilySession.open', () => {
  it('opens an existing family from its root', async () => {
    const { server, root } = await setup();
    const opened = await FamilySession.open(root, server.api);
    expect(opened.ok && opened.session.family.kids[0]!.doc.name).toBe('Léa');
  });

  it('reports a root with no family on this server', async () => {
    expect(await FamilySession.open(generateRoot(), fakeApi().api)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('save (SPEC §9.3)', () => {
  it('writes the family blob, then the changed kid blob, without private notes', async () => {
    const { server, root, session } = await setup();
    server.log.length = 0;
    expect(await session.save(deposit('m1'), TODAY)).toEqual({ ok: true });
    expect(server.log.map((l) => l.split(' ')[0])).toEqual(['PUT', 'PUT']);
    const kid = await kidBlob(server, root, 0);
    expect(kid?.kid.moves).toEqual([{ id: 'm1', date: TODAY, amount: 5, kidNote: 'pour toi' }]);
    expect(JSON.stringify(kid)).not.toContain('secret');
  });

  it('counts the change for the backup banner', async () => {
    const { session } = await setup();
    await session.save(deposit('m1'), TODAY);
    expect(session.family.backup.changesSinceExport).toBe(1);
  });

  it('skips kid blobs whose projection did not change', async () => {
    const { server, session } = await setup();
    await session.save(deposit('m1'), TODAY);
    server.log.length = 0;
    await session.save((f) => updateKid(f, 0, (d) => ({ ...d, moves: d.moves.map((m) => ({ ...m, privateNote: 'autre' })) })), TODAY);
    expect(server.log.map((l) => l.split(' ')[0])).toEqual(['PUT']);
  });

  it('on a version conflict, reloads, re-applies the change and retries once', async () => {
    const { server, root, session: a } = await setup();
    const opened = await FamilySession.open(root, server.api);
    if (!opened.ok) throw new Error();
    const b = opened.session;
    await a.save(deposit('from-a'), TODAY);
    expect(await b.save(deposit('from-b'), TODAY)).toEqual({ ok: true });
    expect(b.family.kids[0]!.doc.moves.map((m) => m.id).sort()).toEqual(['from-a', 'from-b']);
    expect((await kidBlob(server, root, 0))?.kid.moves).toHaveLength(2);
  });

  it('gives up after a second conflict', async () => {
    const { server, session } = await setup();
    server.failNextPut('conflict');
    const first = session.save(deposit('m1'), TODAY);
    // the retry after reloading conflicts again
    const origGet = server.api.getBlob;
    server.api.getBlob = async (id) => {
      server.failNextPut('conflict');
      return origGet(id);
    };
    expect(await first).toEqual({ ok: false, error: 'conflict' });
  });

  it('rejects a change that no longer applies after reloading', async () => {
    const { server, root, session: a } = await setup();
    const opened = await FamilySession.open(root, server.api);
    if (!opened.ok) throw new Error();
    await a.save(deposit('dep', 10), TODAY);
    const withdraw = (f: FamilyDoc) => {
      const kid = f.kids[0]!.doc;
      if (!kid.moves.length) throw new ChangeRejected('overdraft');
      return updateKid(f, 0, (d) => addMove(d, move('wd', -10)));
    };
    await a.save((f) => updateKid(f, 0, (d) => ({ ...d, moves: [] })), TODAY);
    expect(await opened.session.save(withdraw, TODAY)).toEqual({ ok: false, error: 'rejected', reason: 'overdraft' });
  });

  it('keeps the old document when the network fails', async () => {
    const { server, session } = await setup();
    server.failNextPut('network');
    expect(await session.save(deposit('m1'), TODAY)).toEqual({ ok: false, error: 'network' });
    expect(session.family.kids[0]!.doc.moves).toEqual([]);
    expect(session.family.backup.changesSinceExport).toBe(0);
  });

  it('recreates a missing kid blob', async () => {
    const { server, root, session } = await setup();
    server.rows.delete((await deriveKid(root, 0)).id);
    await session.save(deposit('m1'), TODAY);
    expect((await kidBlob(server, root, 0))?.kid.moves).toHaveLength(1);
  });

  it('runs saves one after the other', async () => {
    const { session } = await setup();
    const results = await Promise.all([session.save(deposit('a'), TODAY), session.save(deposit('b'), TODAY)]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(session.family.kids[0]!.doc.moves.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('new kids', () => {
  it('creates the kid blob of a kid added in this save directly', async () => {
    const { server, session } = await setup();
    server.log.length = 0;
    await session.save((f) => addKid(f, newKidDoc({ name: 'Tom', birthday: null, allowance: 2, weekday: 0, apr: 0.12 }, TODAY)).family, TODAY);
    expect(server.log.map((l) => l.split(' ')[0])).toEqual(['PUT', 'POST']);
  });
});

describe('revoke (SPEC §7.2)', () => {
  it('moves the kid to a fresh slot, publishes it there and deletes the old blob', async () => {
    const { server, root, session } = await setup();
    await session.save(deposit('m1'), TODAY);
    expect(await session.revoke(0, TODAY)).toEqual({ ok: true, slot: 1 });
    expect(session.family.kids.map((k) => k.slot)).toEqual([1]);
    expect(await kidBlob(server, root, 0)).toBeNull();
    expect((await kidBlob(server, root, 1))?.kid.moves).toHaveLength(1);
  });
});
