# Decisions and amendments to the spec

The spec (SPEC.md, kept outside the repo) is the source of truth, **except where this file amends it**. Each entry was agreed with the owner.

## Engine (milestone 1)

- **Coin gauge wording.** `fractionKey` returns i18n keys, not French words. A full coin (`coinFill ≥ 1`) is `whole`, not "presque toute".
- **Dated changes never rewrite history.** A rate or allowance change must start today or later (and on or after `ledgerStart`). It replaces any already-scheduled change on or after its start date. An allowance of 0 € pauses pocket money: no scheduled days.
- **Overdraft check covers every change that removes money.** That includes a banked Sunday switched to kept or pending. `findOverdraft` reports the first day the balance drops below −0.005 €, with what was available that day before its withdrawals.
- **Projections** add coins on scheduled days strictly after today, as the Python reference does. A pending scheduled day today gets no projected coin.
- **Birthdays.** The target is the first birthday strictly after today. A 29 February birthday falls on 28 February in common years.
- **Sheet import** skips rows with an empty or zero amount. `ledgerStart` can be overridden (the fixture has lost the sheet's empty first row).
- **`projectForKid` copies whitelisted fields only.** A field added to `KidDoc` stays private until someone adds it there on purpose.

## Crypto (milestone 2)

- **Write hash** = `base64url(SHA-256(UTF-8(token)))`, where the token is the base64url string sent as `Authorization: Bearer`. Invite codes are hashed the same way. The server never decodes anything.
- **Kid slots start at 0.**
- **Restoring from words** returns every root whose checksum matches. 123 words exist in both the French and English lists, so the restore flow tries each root until a family blob exists.
- **French words** are shown NFC-normalized. Input is matched case- and accent-insensitively.
- **`open()` returns unvalidated JSON.** Callers check the shape (schema validation lands with milestone 7).

## Size limits (amends SPEC §4.4 and §5.2)

- The family blob holds every kid's full ledger, so it can't share the kid blob's limit when 10 kids are allowed. Limits live in `src/limits.ts` and are shared by the client and the Worker:
  - family blob ciphertext: **256 KiB** hard limit, 64 KiB design budget;
  - kid blob ciphertext: **64 KiB** hard limit, 32 KiB design budget.
- The request body limit grows to match (base64url overhead included).
- Measured, 3 kids × 10 years, 2 moves a month, both notes at 60 chars: family blob 36.5 KiB (word-like notes) / 53.7 KiB (random characters); one kid blob 9.4 / 12.4 KiB. 10 such kids: 113 / 152 KiB.

## Server (milestone 3)

- **Request body limit**: the base64url size of the largest family ciphertext plus 8 KiB, about 350 KiB (`worker/limits.ts`). It is checked while streaming, before parsing.
- **Invite codes** are canonicalized to 10 characters (no dash, upper case) before hashing. The server and the app share `src/inviteCode.ts`, so `abcde-23456` and `ABCDE23456` are the same code. `expires_on` is the last valid day.
- **Race safety.** Redeeming an invite inserts the family blob only if the invite still exists, and deletes it in the same D1 batch, so two simultaneous redemptions can't both succeed. Creating a kid blob checks the 10-kid cap inside the insert.
- **Error precedence and the codes the spec left open:**
  - Malformed bodies get `400 bad_request`.
  - A missing or non-numeric `If-Match` gets `400 bad_request`. `If-Match` accepts `3`, `"3"` and `W/"3"`.
  - An unknown parent, or a kid blob used as a parent, gets `401 bad_token`.
  - An unknown `/api` path gets `404 not_found`, and a wrong method gets `405 method_not_allowed`.
  - Anything unexpected gets `500 internal`, with no detail.
  - PUT and DELETE answer 404 before 401: the id is the capability.
- **No logs:** `observability.enabled: false` and `logpush: false`, both checked by a test.
- **Tooling:** `@cloudflare/vitest-pool-workers` is deprecated, so the tests use its successor `@cloudflare/vitest-plugin` with Vitest 5. Runtime types come from `wrangler types` and live in `worker-configuration.d.ts` at the root, so `grep -R "console\." worker/` stays empty.

## Kid view (milestone 4)

- **Fonts** come from the `@fontsource` npm packages (OFL, Latin subset, WOFF2 with WOFF fallback), bundled by Vite. No font request leaves the instance.
- **Copy fixes over the prototype:**
  - French elision ("Intérêts d'octobre", not "de octobre").
  - Plurals through `Intl.PluralRules` ("0 centime", "1 pièce gardée … l'avais mise").
  - The allowance weekday is named ("pièce du mercredi"), never a hard-coded "dimanche".
  - A full coin reads "une pièce entière".
  - Past the milestone the sentence becomes "Ta banque te donne déjà chaque semaine une pièce entière, ou plus. Bravo !".
  - An empty bank gets "Dès que tu mets de l'argent ici…" instead of "0 centime".
  - A day's or week's interest of 1 € or more is shown in euros, not centimes.
  - "autant que papa" is kept as written in the spec.
- **No allowance** (amount 0 today): the coin gauge and the "si tu mets ta pièce" path are hidden.
- **Passbook:** a banked coin and an extra move on the same day are two rows (the prototype merged them). Interest months that round to 0,00 € get no row.
- **Chart ticks** step by 1/2/5 × 10ⁿ €, at least 1 €, at most 5 intervals. Month labels are spaced 1, 2, 3, 6, 12… months apart.
- **Loading and offline.** The cached ciphertext is shown at once, then refreshed. If the API can't be reached, the page keeps the cached copy with "Mis à jour le <date of the last successful fetch>". Opening the page with no network at all needs the service worker (milestone 9).
- **A revoked link (404)** removes the kid and its cache from the device.
- **Several remembered kids:** `/` opens the most recently opened one until the kid picker lands (milestone 9).
- **CSP.** SVG colours come from CSS classes, and the tooltip is positioned through the CSSOM. No inline style or script, so `style-src 'self'` and `script-src 'self'` hold. They are served by `public/_headers` and checked in e2e.
- **Bundle.** Pages that only read links don't load the BIP39 wordlists (`src/crypto/sizes.ts`, `importBoxKey` lives in `box.ts`). The kid page is 40 KB of JS (16 KB gzipped).

## Parent app (milestone 5)

- **`FamilyDoc.nextSlot`** (optional, additive) records the next unused kid slot. Slots are never reused, so a revoked kid link can never show another kid, even after the newest kid is moved or removed. Without it, the next slot is the highest slot + 1.
- **Saving** (`src/family/session.ts`):
  - The family blob is written first, with `If-Match`.
  - Then every kid blob whose projection differs from what this session last published is written. The first save of a session therefore republishes every kid, which repairs a kid blob a crash left behind.
  - A kid blob conflict is overwritten with the fresh projection, since the family blob was just saved and is the source of truth. A missing kid blob is recreated. A failed kid write is retried at the next save.
  - Saves within one tab run one at a time.
- **Conflicts.** On `409` the session reloads, re-applies the change and retries once. Every change re-validates on re-apply (overdraft, dates, 10 kids) and is rejected if it no longer fits. A second conflict shows "Modifié sur un autre appareil…" with a "Recharger" button.
- **Revocation order:** save the family with the kid on its new slot, publish the new kid blob, then delete the old one. If the delete fails, the parent is told the old link still works.
- **"Voir comme Léa"** opens `/apercu#k=…`: the kid view, without storing the kid or its cache on the parent's device.
- **Parent root.** It is remembered on the device by default. "Oublier cet appareil" removes every `bpm.*` key and goes back to `/`.
- **A new link in an open tab** (only the fragment changes) reloads the page so the fragment is read and wiped.
- **Gender-neutral French.** "visible dans son livret" replaces "elle la verra", and "si Léa l'a gardée" replaces the spec's "…l'a-t-elle gardée ?". The verb agrees with *la pièce*, not the child.
- **Dated changes default to the next scheduled day.** The rate and allowance forms start there, never in the past.
- **The 10-kid limit** hides "+ Ajouter un enfant" and is also checked inside the save.
- **Contrast.** White on the dark-mode blue (#6E9BEF) or pink (#D07BB0) is under 3:1. The `--on-mine` / `--on-out` tokens use dark ink there (about 6:1). The pressed "Gardée" uses `--ink-2` (6.5:1 light, 9.5:1 dark).
- **Bundles.** The parent app is lazy-loaded, so kid phones never download it. The BIP39 wordlists live in `src/crypto/words.ts` and are only loaded by screens that show or read words.
- **Deferred:**
  - The backup banner, export, import and deleting a kid or the family are in milestone 7 (deletion offers an export first).
  - The recovery card is in milestone 6.
  - The sharing card is titled "Lien de Léa" until backups join it.
