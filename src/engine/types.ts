// Document types, SPEC §4. Dates are ISO calendar dates 'YYYY-MM-DD'.
// Amounts are euros as plain numbers, never rounded when stored.

export type IsoDate = string;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type RateEntry = { from: IsoDate; apr: number }; // apr 0.12 = 12 %/year

export type AllowanceEntry = { from: IsoDate; weekday: Weekday; amount: number };

export type Move = {
  id: string;
  date: IsoDate;
  amount: number; // + deposit, − withdrawal, never 0
  kidNote: string;
  privateNote: string;
};

export type KidDoc = {
  name: string;
  birthday: IsoDate | null;
  currency: 'EUR';
  ledgerStart: IsoDate;
  rates: RateEntry[]; // sorted by from
  allowance: AllowanceEntry[]; // sorted by from
  sundays: Record<IsoDate, number>; // banked amount; 0 = kept; absent = pending
  moves: Move[];
};

export type KidRecord = { slot: number; doc: KidDoc };

export type FamilyDoc = {
  format: 'bpm-family';
  v: 1;
  createdOn: IsoDate;
  kids: KidRecord[];
  backup: { lastExportOn: IsoDate | null; changesSinceExport: number };
  prefs: { locale: 'fr' | 'en' };
  /** Next unused kid slot. Slots are never reused, so a revoked link can never show another kid. */
  nextSlot?: number;
  /** When the 12 recovery words were checked (SPEC §10.4, §11 monthly tip). Absent in older docs. */
  recovery?: { confirmedOn: IsoDate | null };
};

export type KidMove = Omit<Move, 'privateNote'>;

export type Locale = 'fr' | 'en';

export type KidPublicDoc = {
  format: 'bpm-kid';
  v: 1;
  publishedOn: IsoDate;
  /** The family's language, chosen by the parent (absent in older blobs: French). */
  locale?: Locale;
  kid: Omit<KidDoc, 'moves'> & { moves: KidMove[] };
};

export type ExportFile = {
  format: 'bpm-export';
  v: 1;
  exportedOn: IsoDate;
  family: FamilyDoc;
};

/** What the ledger needs to compute balances: a KidDoc or its kid projection. */
export type Ledger = Omit<KidDoc, 'moves'> & { moves: KidMove[] };
