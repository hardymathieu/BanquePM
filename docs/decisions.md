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

## Onboarding (milestone 6)

- **Routes:** `/creer` (create a bank), `/restaurer` (12 words) and `/admin`. An invite link `/#i=CODE` opens `/creer` with the code filled in. Navigation inside the app passes secrets in memory: the admin token used as "Créer ma banque" invite and a fresh root never appear in a URL. An e2e test checks the token.
- **Admin token.** Typed on `/admin`, kept in memory only, never stored. Wrong token: "Ce n'est pas le bon mot de passe d'administration." Disabled server: an explanation of the 32-character rule.
- **`FamilyDoc.recovery`** (optional, additive) holds `{ confirmedOn }`. It is set when the 3-word check passes, during onboarding or later from the parent app. Milestone 7's monthly reminder reads it. Confirming counts as one change for the backup banner.
- **The 3-word check** picks 3 positions with the crypto RNG and ignores case and accents. "Je le ferai plus tard" is always visible.
- **Recovery words** are shown in the device language at creation (French unless the phone is in English). Restoring accepts French or English and tries every root whose checksum matches.
- **The printed card** is portalled into `<body>`. `@media print` hides everything else. It shows the host, 12 numbered words, a QR code of the parent link, the date and the "Range cette carte…" line. There is no kid name, which an e2e test checks.
- **Parent app.** The 12 words sit behind a tap ("Vérifier mes mots", or "Voir mes 12 mots" once checked), so they are never on screen by default.
- **Restore** offers suggestions from both wordlists. Pasting the 12 words into any box fills the boxes from there on, and Space moves to the next box.
- **Landing.** "Ouvrir une sauvegarde" arrives with milestone 7. "Ouvrir mon espace parent" shows when the device remembers a parent.
- **Kid blobs for new slots** (new kid, revocation, a new family) are created with `POST` straight away, instead of a `PUT` that 404s first.
- **Bundles.** Each onboarding page and the wordlists are separate lazy chunks. Kids' phones load none of them.

## Backups (milestone 7)

- **Banner wording.** Never exported: "**Aucune sauvegarde pour l'instant.** …" (the spec's "depuis N jours" assumes an earlier export). After 30+ days: "**Aucune sauvegarde depuis N jours.** …". From 5 changes: "**N changements** depuis ta dernière sauvegarde…". Staleness wins when both apply. "l'historique de Léa" lists every kid ("de Léa et Tom").
- **Changes that aren't data don't count.** `session.save(change, today, { count: false })`. Resetting the counters after an export or share, and confirming the recovery words, no longer add to `changesSinceExport` (this amends the milestone 6 note).
- **Export.** `banque-<prénoms>-<date>.json`, names without accents. The file holds the family document only: never the root, never a key (a test checks the top-level keys). On phones whose share sheet takes files, "Partager la sauvegarde" is offered too, and a completed share counts as an export.
- **Restore into the current family** (`mergeImport`). Same keys and same parent link. A kid keeps its slot only if that slot is active now; otherwise it moves to a fresh slot, so restoring an old backup can never revive a revoked kid link. Kid blobs of slots the backup doesn't have are deleted. The current recovery status is kept, since the words didn't change.
- **A new bank from a backup** (from the offline viewer, with an invite). New root, new words, new kid links. Slots are kept (new ids anyway). Backup counters and recovery status start fresh.
- **Offline viewer (`/sauvegarde`).** The file is read in the browser and kept in memory only; a reload goes back to the landing page. It is read-only, with a parent view (balance, livret with private notes) and a kid view (the real kid screen), and makes no API call (an e2e test blocks `/api` and checks nothing was attempted). Opening the page itself without a network needs the service worker (milestone 9).
- **Deletion** lives at the bottom of Réglages. Typing the kid's name (case-insensitive) or SUPPRIMER is required, and "Télécharger la sauvegarde" is offered in the same sheet. Removing a kid takes it out of the family first, then deletes its blob, and `nextSlot` keeps the slot retired. Deleting the bank deletes the family blob (the server removes its kid blobs), forgets the device and returns to `/`.
- **Monthly tip.** It is due while the words were never checked. "Plus tard" stores the month on this device (`bpm.tipDismissed`), not in the family document, since it is a per-device convenience. "Vérifier mes mots" opens the card with the words.
- **Fixed:** the chart tooltip's global `.tip` class hid the new tip banner. Chart tooltip styles are now scoped to `.chart`.

## Sheet importer (milestone 8)

- **Where:** a "Nouveau livret / Depuis un tableau" choice, both when creating the bank (onboarding) and in "+ Ajouter un enfant". The CSV is read in the browser only.
- **CSV:** RFC 4180 quoting, CRLF, and BOM handling. The separator is a comma, or a semicolon when the first line has more of them (Excel in French). Columns are found by header name ("Date", "Ajouté / Sorti" or "Montant", "Commentaire" or "Note"), so title rows above and extra columns (Solde, Intérêts…) are fine. Without such a header, columns 1–3 are assumed.
- **Values:**
  - Dates: `dd/mm/yyyy`, `d/m/yyyy`, `.` or `-` separators, or ISO.
  - Amounts: `,` or `.` decimals, `€`, spaces (including narrow no-break spaces) as thousands separators, `−` or `-`, and `(1,00)` as negative. With both `.` and `,`, the last one is the decimal separator.
  - Rows whose first cell isn't date-like (titles, totals, blank lines) are skipped.
- **Refused, with the file line number:** an unreadable date such as `31/02/2025`, an unreadable amount, or a future date. A ledger that would go below zero is refused too, with the date and what was there: every later edit would otherwise hit the overdraft rule.
- **Summary** worded as in SPEC §12, plus "Le livret commence le …", a note that comments become private notes, and a hint that pending days can all be marked kept at once. Pocket money, weekday and rate can be adjusted and the summary updates live (they decide which rows are coins).
- **Name and birthday** come from the form; `ledgerStart` is the sheet's first date. Imported move ids are random, like any move.

## PWA, privacy page, README (milestone 9)

- **`GET /api/v1/instance`** returns `{ contact }` from the optional `INSTANCE_CONTACT`. It is additive (v1 stays compatible) and says nothing about any family.
- **Kid picker.** `/` with two or more remembered kids shows big name buttons, most recently opened first. The kid view then offers "Changer d'enfant". Nothing on these screens leads to `/parent` (checked by e2e).
- **Manifest.** Name "Banque de papa et maman", `short_name` "Ma banque" (the full name is cut off under a home-screen icon), `start_url` `/`, standalone, brand blue. Icons are drawn as SVG in `scripts/icons.mjs` and rendered to PNG with Playwright's Chromium (`npm run icons`): 192, 512, maskable 512 with the coin inside the safe zone, the Apple touch icon, and an SVG favicon.
- **Service worker.** `sw.js` is generated at build time by a small Vite plugin, with the exact list of built files (minus `.woff`, since these browsers all take `woff2`) and a version hash of that list.
  - Install precaches everything and takes over at once; activation deletes older caches.
  - Navigations are network-first, falling back to the cached app shell `/`. Static files are cache-first.
  - **`/api/*` is never touched**, so no data or ciphertext ever sits in the service worker's cache (checked by e2e). The kid view keeps its own encrypted copy, as before.
  - Not registered in `npm run dev`. `sw.js` is served with `Cache-Control: no-cache`, so updates reach every phone.
  - The offline e2e test (SPEC §16 E2E 3) fails when registration is removed, so it measures the real thing.
- **Privacy page** (`/confidentialite`): every point of SPEC §14, plus "Sur ce téléphone" (what `localStorage` holds and how to erase it) and a link to the source code. It is linked from the landing page, kid view, picker and parent home.
- **README** (French, then English): what it is, the privacy promise, the Deploy to Cloudflare button, `ADMIN_TOKEN`, first steps via `/admin`, `INSTANCE_CONTACT`, updating by syncing the fork, and development. `package.json` → `cloudflare.bindings` describes `ADMIN_TOKEN` and `DB` in the Deploy form. `wrangler deploy --dry-run` passes (12.7 KiB Worker). The button itself still has to be tried once in a real Cloudflare account.

## Final checks (milestone 10)

- **Two light-theme tokens darkened** for WCAG AA small text, as found by axe:
  - `--ink-3` `#6B7590` → `#636D87` (4.6:1 on the page background, 5.2:1 on cards; the old value was 4.1:1 on the background);
  - `--coin-deep` `#9C7410` → `#8A6400` (5.4:1 on cards; this is the parent prototype's value).
  Dark-theme tokens are unchanged.
- **Headings.** The kid greeting ("Bonjour Léa !") and the parent app title are `h1` (same look). The word check's title is `h2`, so heading levels never skip.
- **The big balance** has `role="img"` with its `aria-label` (an `aria-label` on a plain `<p>` is not allowed), so screen readers read "289,15 €" once.
- **A `<meta name="description">`** was added (SEO 82 → 91). Nothing personal is ever in the HTML.
- **The e2e guard** (`e2e/fixtures.ts`) wraps every test: no foreign request, no console error, no uncaught exception. It was checked with a planted external image.
- **`npm run check:dist`** checks the build: absolute URLs allowlisted, CSP present, `sw.js` sane, gzipped size budgets (kid first-load JS ≤ 45 KiB, currently 30.9; all JS ≤ 150 KiB, currently 76.1; CSS ≤ 10 KiB, currently 4.8). It was checked with a planted Google Fonts link.
- **Lighthouse** (`npm run lighthouse`): kid view and parent home both score accessibility 100, best practices 100, performance 100, SEO 91.

## After the first real deploy (2026-10-12)

- **Sheet import reads more formats.**
  - Dates: French or English month names, with or without a weekday ("dim. 5 janv. 2025", "Sunday, January 5, 2025"), 2-digit years, a trailing time ("05/01/2025 00:00:00"), and `yyyy/mm/dd`.
  - US order (`m/d/yyyy`) is used only when a date in that column proves it; otherwise it is day/month.
- **Sheet columns are guessed, shown and changeable.** Headers come first, then content: the column with the most dates, then the first numeric column after it. The import shows "Colonnes lues" (dates, amounts, comments) with dropdowns, so any header names work. "No dates" now names the column and quotes a sample cell, on screen only.
- **`wrangler.jsonc`:** `send_metrics: false` (no Wrangler usage telemetry from builds), `workers_dev: true` and `preview_urls: false` set explicitly (no extra public preview URL per version). The static test checks them.
- **Updating a deployed copy.** The Deploy button makes a copy, not a fork, and pins the D1 `database_id` in its `wrangler.jsonc`. `scripts/update-from-upstream.sh` merges upstream (unrelated histories the first time, upstream wins conflicts) and puts the `database_id` back. The README explains it.
- **Rows dated after today are left out of a sheet import, not refused.** A sheet planned ahead is normal. The summary says how many were set aside ("N lignes datées après aujourd'hui sont laissées de côté : seul le passé est importé."). A sheet with only future rows gets the generic "no dated row" message.
- **"01/Mar/2025":** "mar" is both *mars* and *mardi*. The month is picked first (a word that can only be a month wins), then leftover weekday words are ignored.
- **Language is the family's choice, not the phone's (amends SPEC §15).**
  - "Langue / Language" in Réglages sets `FamilyDoc.prefs.locale` for the parent app and every kid page.
  - The kid blob carries it as an optional `locale` (additive v1; older blobs mean French). Changing it republishes the kid blobs (it is part of the session's republish key) and does not count as a backup change.
  - Everything else (landing, onboarding, admin, picker, privacy page, new families) is French by default: French first, English partial.
  - The recovery words follow the family language when displayed. The same 12 words exist in both lists, and restoring accepts either, so a card printed in one language stays valid after switching.

## User guide (2026-10-12)

- **`docs/guide/`** is a small static site in French (*tu* form, the app's own button wording): home, invitation, self-hosting, creating the bank and everything to do afterwards, and the kid's page. It is plain HTML and one CSS file with the app's tokens: no JavaScript, system fonts, no external request, light and dark mode. It opens straight from a clone, and publishing `docs/` with GitHub Pages works as is. Checked: links and images resolve, axe (WCAG 2.1 AA + best practices) is clean in both themes.
- **Screenshots** come from the real app with the fictional demo bank (`npm run doc:screenshots`, phone size, JPEG). Re-run it after UI changes. The app never displays the parent link as text, so the guide says to use the recovery card's QR code or the 12 words on another device.
- **GitHub Pages** publishes `docs/` from `main` (owner's OK, 2026-10-12): https://hardymathieu.github.io/BanquePM/guide/. `docs/.nojekyll` serves the files as they are, and `docs/index.html` sends the site root to the guide. Note: `decisions.md` and `spec-coverage.md` in `docs/` are reachable there too, as they already were in the public repo.
