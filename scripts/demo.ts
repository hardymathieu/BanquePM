// A fictional demo bank ("Léa"), created through the real API with the real crypto.
// Used by `npm run seed` and by the e2e tests. Never put real data here.
import rows from '../fixtures/sheet-a.json' with { type: 'json' };
import { toBase64url } from '../src/crypto/base64url';
import { seal } from '../src/crypto/box';
import { deriveFamily, deriveKid, generateRoot } from '../src/crypto/keys';
import { kidLink, parentLink } from '../src/crypto/links';
import { importRows } from '../src/engine/importSheet';
import { projectForKid } from '../src/engine/project';
import { pendingDays } from '../src/engine/schedule';
import type { FamilyDoc, IsoDate, KidDoc } from '../src/engine/types';

export const PRIVATE_NOTE = 'Note privée de test : ne doit jamais apparaître côté enfant';

const KID_NOTES: Record<string, string> = {
  '2025-01-05': 'Pour ouvrir ta banque',
  '2025-03-20': 'Trouvés sous le canapé',
  '2025-04-13': 'De Mamie, pour ton carnet',
  '2026-08-18': 'Glaces à la plage',
};

/** The fixture ledger as Léa's, every unanswered day before `today` marked kept. */
export function demoLea(today: IsoDate, name = 'Léa'): KidDoc {
  let n = 0;
  const doc = importRows(
    (rows as [string, number][]).map(([date, amount]) => ({ date, amount, comment: '' })),
    { name, birthday: '2016-12-03', ledgerStart: '2025-01-01', newId: () => `demo${String(++n).padStart(4, '0')}` },
  );
  const sundays = { ...doc.sundays };
  for (const d of pendingDays(doc, today)) if (d < '2026-09-20') sundays[d] = 0;
  const moves = doc.moves.map((m) => ({ ...m, kidNote: KID_NOTES[m.date] ?? '', privateNote: PRIVATE_NOTE }));
  return { ...doc, sundays, moves };
}

export type DemoBank = { root: Uint8Array; doc: KidDoc; kidId: string; kidToken: string; kidLink: string; parentLink: string };

async function post(base: string, body: unknown, headers: Record<string, string>): Promise<void> {
  const res = await fetch(`${base}/api/v1/blobs`, { method: 'POST', body: JSON.stringify(body), headers });
  if (res.status !== 201) throw new Error(`POST /blobs → ${res.status} ${await res.text()}`);
}

export async function createDemoBank(base: string, adminToken: string, today: IsoDate, name = 'Léa'): Promise<DemoBank> {
  const root = generateRoot();
  const family = await deriveFamily(root);
  const kid = await deriveKid(root, 0);
  const doc = demoLea(today, name);
  const familyDoc: FamilyDoc = {
    format: 'bpm-family',
    v: 1,
    createdOn: today,
    kids: [{ slot: 0, doc }],
    backup: { lastExportOn: null, changesSinceExport: 0 },
    prefs: { locale: 'fr' },
  };
  await post(base, { id: family.id, writeHash: family.writeHash, ct: toBase64url(await seal(family.key, family.id, familyDoc)) }, { 'X-Invite': adminToken });
  await post(
    base,
    { id: kid.id, writeHash: kid.writeHash, ct: toBase64url(await seal(kid.key, kid.id, projectForKid(doc, today))) },
    { 'X-Parent-Id': family.id, Authorization: `Bearer ${family.writeToken}` },
  );
  return { root, doc, kidId: kid.id, kidToken: kid.writeToken, kidLink: kidLink(base, kid.id, kid.rawKey), parentLink: parentLink(base, root) };
}
