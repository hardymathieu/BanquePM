import { updateKid } from '../../engine/family';
import type { IsoDate, KidDoc } from '../../engine/types';
import type { Change, SaveResult } from '../../family/session';

/** What every section of the parent home gets for the selected kid. */
export type KidCtx = {
  slot: number;
  doc: KidDoc;
  today: IsoDate;
  save: (change: Change) => Promise<SaveResult>;
  /** Reports a failed save as a toast (with "Recharger" on a conflict). Returns true on success. */
  report: (res: SaveResult) => boolean;
};

/** A change to one kid's ledger, as a family change. */
export const onKid = (slot: number, change: (doc: KidDoc) => KidDoc): Change => (f) => updateKid(f, slot, change);
