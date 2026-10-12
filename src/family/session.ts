// One open family: its keys (in memory only), the decrypted document and the server
// version. Saves write the family blob first (the source of truth, with If-Match),
// then publish each kid blob whose projection changed (SPEC §9.3).
import * as client from '../api/client';
import { fromBase64url, toBase64url } from '../crypto/base64url';
import { open, seal } from '../crypto/box';
import { type BlobKeys, deriveFamily, deriveKid, type KidKeys } from '../crypto/keys';
import { mergeImport } from '../engine/backup';
import { markChanged, moveKid, removeKid } from '../engine/family';
import { projectForKid } from '../engine/project';
import { parseFamilyDoc } from '../engine/schema';
import type { FamilyDoc, IsoDate, KidDoc } from '../engine/types';

export type Api = Pick<typeof client, 'getBlob' | 'putBlob' | 'postBlob' | 'deleteBlob'>;

/** Thrown by a change that no longer applies (for example an overdraft after reloading). */
export class ChangeRejected extends Error {
  constructor(readonly reason: unknown) {
    super('change_rejected');
  }
}

export type Change = (family: FamilyDoc) => FamilyDoc;
export type LoadError = 'not_found' | 'damaged' | 'network' | 'server';
export type SaveError = 'conflict' | 'network' | 'server' | 'too_large';
export type SaveResult = { ok: true } | { ok: false; error: SaveError } | { ok: false; error: 'rejected'; reason: unknown };

type Loaded = { ok: true; family: FamilyDoc; version: number } | { ok: false; error: LoadError };

async function load(keys: BlobKeys, api: Api): Promise<Loaded> {
  const res = await api.getBlob(keys.id);
  if (!res.ok) return { ok: false, error: res.error === 'not_found' || res.error === 'network' ? res.error : 'server' };
  const bytes = fromBase64url(res.ct);
  try {
    const family = bytes && parseFamilyDoc(await open(keys.key, keys.id, bytes));
    return family ? { ok: true, family, version: res.version } : { ok: false, error: 'damaged' };
  } catch {
    return { ok: false, error: 'damaged' };
  }
}

const writeError = (e: client.ApiError): SaveError => (e === 'network' || e === 'too_large' ? e : 'server');
/** What a kid blob shows, minus the publish date: when it changes, the blob is rewritten. */
const projectionKey = (doc: KidDoc, locale: FamilyDoc['prefs']['locale']) => JSON.stringify([locale, projectForKid(doc, '').kid]);

export class FamilySession {
  private kidKeys = new Map<number, Promise<KidKeys>>();
  private kidVersions = new Map<number, number>();
  /** What this session last published per slot. Unknown at start, so the first save publishes every kid. */
  private published = new Map<number, string>();
  private queue: Promise<unknown> = Promise.resolve();
  /** Slots that appeared in this session (new kid, revocation): their blob is created, not updated. */
  private newSlots = new Set<number>();

  private constructor(
    readonly root: Uint8Array,
    private readonly keys: BlobKeys,
    private readonly api: Api,
    public family: FamilyDoc,
    private version: number,
  ) {}

  static async open(root: Uint8Array, api: Api = client): Promise<{ ok: true; session: FamilySession } | { ok: false; error: LoadError }> {
    const keys = await deriveFamily(root);
    const loaded = await load(keys, api);
    return loaded.ok ? { ok: true, session: new FamilySession(root, keys, api, loaded.family, loaded.version) } : loaded;
  }

  static async create(
    root: Uint8Array,
    family: FamilyDoc,
    invite: string,
    today: IsoDate,
    api: Api = client,
  ): Promise<{ ok: true; session: FamilySession } | { ok: false; error: client.ApiError }> {
    const keys = await deriveFamily(root);
    const ct = toBase64url(await seal(keys.key, keys.id, family));
    const res = await api.postBlob({ id: keys.id, writeHash: keys.writeHash, ct }, { invite });
    if (!res.ok) return { ok: false, error: res.error };
    const session = new FamilySession(root, keys, api, family, res.version);
    for (const k of family.kids) session.newSlots.add(k.slot);
    await session.publishAll(today);
    return { ok: true, session };
  }

  /** Kid keys, derived once per slot. The raw key is what goes into the kid link. */
  kid(slot: number): Promise<KidKeys> {
    let k = this.kidKeys.get(slot);
    if (!k) this.kidKeys.set(slot, (k = deriveKid(this.root, slot)));
    return k;
  }

  /**
   * Applies `change`, saves the family, then publishes changed kid blobs. Saves run one at a time.
   * `count: false` for changes that are not data (export reset, word check): no backup nag for them.
   */
  save(change: Change, today: IsoDate, opts: { count?: boolean } = {}): Promise<SaveResult> {
    const run = this.queue.then(() => this.saveNow(change, today, opts.count ?? true));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async saveNow(change: Change, today: IsoDate, count: boolean): Promise<SaveResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        const fresh = await load(this.keys, this.api);
        if (!fresh.ok) return { ok: false, error: fresh.error === 'network' ? 'network' : 'server' };
        this.family = fresh.family;
        this.version = fresh.version;
      }
      let next: FamilyDoc;
      try {
        next = change(this.family);
        if (count) next = markChanged(next);
      } catch (e) {
        if (e instanceof ChangeRejected) return { ok: false, error: 'rejected', reason: e.reason };
        throw e;
      }
      const ct = toBase64url(await seal(this.keys.key, this.keys.id, next));
      const res = await this.api.putBlob(this.keys.id, this.keys.writeToken, this.version, ct);
      if (!res.ok && res.error === 'conflict') continue;
      if (!res.ok) return { ok: false, error: writeError(res.error) };
      const before = new Set(this.family.kids.map((k) => k.slot));
      for (const k of next.kids) if (!before.has(k.slot)) this.newSlots.add(k.slot);
      this.family = next;
      this.version = res.version;
      await this.publishAll(today);
      return { ok: true };
    }
    return { ok: false, error: 'conflict' };
  }

  /** Brings every kid blob in line with the family. A failed kid write is retried at the next save. */
  async publishAll(today: IsoDate): Promise<void> {
    for (const { slot, doc } of this.family.kids) {
      const key = projectionKey(doc, this.family.prefs.locale);
      if (this.published.get(slot) === key) continue;
      if (await this.publishKid(slot, doc, today)) this.published.set(slot, key);
    }
  }

  private async publishKid(slot: number, doc: KidDoc, today: IsoDate): Promise<boolean> {
    const k = await this.kid(slot);
    const ct = toBase64url(await seal(k.key, k.id, projectForKid(doc, today, this.family.prefs.locale)));
    const create = () => this.api.postBlob({ id: k.id, writeHash: k.writeHash, ct }, { parentId: this.keys.id, familyToken: this.keys.writeToken });
    if (this.newSlots.has(slot)) {
      const created = await create();
      if (created.ok || created.error !== 'exists') {
        if (created.ok) {
          this.newSlots.delete(slot);
          this.kidVersions.set(slot, created.version);
        }
        return created.ok;
      }
      this.newSlots.delete(slot); // it exists after all: update it below
    }
    let res = await this.api.putBlob(k.id, k.writeToken, this.kidVersions.get(slot) ?? 1, ct);
    // The family blob was just saved, so this projection is the latest: overwrite whatever version is there.
    if (!res.ok && res.error === 'conflict' && 'version' in res) res = await this.api.putBlob(k.id, k.writeToken, res.version, ct);
    if (!res.ok && res.error === 'not_found') res = await create();
    if (res.ok) this.kidVersions.set(slot, res.version);
    return res.ok;
  }

  /** "Créer un nouveau lien": the kid moves to a fresh slot, then the old blob is deleted. */
  async revoke(slot: number, today: IsoDate): Promise<{ ok: true; slot: number } | { ok: false; error: SaveError | 'rejected' | 'old_link_kept' }> {
    const old = await this.kid(slot);
    let to = -1;
    const saved = await this.save((f) => {
      if (!f.kids.some((k) => k.slot === slot)) throw new ChangeRejected('unknown_slot');
      const moved = moveKid(f, slot);
      to = moved.to;
      return moved.family;
    }, today);
    if (!saved.ok) return { ok: false, error: saved.error };
    this.published.delete(slot);
    const del = await this.api.deleteBlob(old.id, old.writeToken);
    return del.ok || del.error === 'not_found' ? { ok: true, slot: to } : { ok: false, error: 'old_link_kept' };
  }

  /** Deletes kid blobs after their kids left the family. Missing blobs are fine. */
  private async deleteKidBlobs(slots: number[]): Promise<boolean> {
    let ok = true;
    for (const slot of slots) {
      const k = await this.kid(slot);
      const del = await this.api.deleteBlob(k.id, k.writeToken);
      if (!del.ok && del.error !== 'not_found') ok = false;
      this.published.delete(slot);
    }
    return ok;
  }

  /** "Restaurer" a backup into this family: same keys, data from the file (SPEC §4.3). */
  async replaceWith(imported: FamilyDoc, today: IsoDate): Promise<{ ok: true } | { ok: false; error: SaveError | 'rejected' | 'old_links_kept' }> {
    let deleteSlots: number[] = [];
    const saved = await this.save((current) => {
      const merged = mergeImport(current, imported);
      deleteSlots = merged.deleteSlots;
      return merged.family;
    }, today);
    if (!saved.ok) return { ok: false, error: saved.error };
    return (await this.deleteKidBlobs(deleteSlots)) ? { ok: true } : { ok: false, error: 'old_links_kept' };
  }

  /** "Supprimer la banque de Léa" (SPEC §9.5): out of the family first, then the blob. */
  async removeKid(slot: number, today: IsoDate): Promise<{ ok: true } | { ok: false; error: SaveError | 'rejected' | 'old_links_kept' }> {
    const saved = await this.save((f) => {
      if (!f.kids.some((k) => k.slot === slot)) throw new ChangeRejected('unknown_slot');
      return removeKid(f, slot);
    }, today);
    if (!saved.ok) return { ok: false, error: saved.error };
    return (await this.deleteKidBlobs([slot])) ? { ok: true } : { ok: false, error: 'old_links_kept' };
  }

  /** "Supprimer toute ma banque": the server deletes the family blob and its kid blobs. */
  async deleteFamily(): Promise<{ ok: true } | { ok: false; error: SaveError }> {
    const del = await this.api.deleteBlob(this.keys.id, this.keys.writeToken);
    return del.ok || del.error === 'not_found' ? { ok: true } : { ok: false, error: writeError(del.error) };
  }

  /** Reloads from the server, for example after a conflict the user chose to see. */
  async reload(): Promise<{ ok: true } | { ok: false; error: LoadError }> {
    const fresh = await load(this.keys, this.api);
    if (!fresh.ok) return fresh;
    this.family = fresh.family;
    this.version = fresh.version;
    return { ok: true };
  }
}

/** First save of a new family (onboarding, SPEC §10.2): the family blob with an invite, then its kid blobs. */
export const createFamily = (root: Uint8Array, family: FamilyDoc, invite: string, today: IsoDate, api: Api = client) =>
  FamilySession.create(root, family, invite, today, api);
