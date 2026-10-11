# SPEC §16 coverage

Where each testing requirement and "definition of done" item of SPEC §16 is checked. `npm run verify` runs everything below except Lighthouse and the Deploy button.

## Unit (Vitest)

| SPEC §16 | Where |
|---|---|
| Engine: every §6.8 vector within 1e-6 | `src/engine/vectors.test.ts` |
| Engine: the overdraft rule | `src/engine/validate.test.ts` (backdated withdrawal, deleted deposit, edited deposit, banked → kept, half-centime tolerance) |
| Engine: pending / kept / banked transitions | `src/engine/schedule.test.ts`, `src/engine/ops.test.ts` |
| Engine: rate and allowance changes over time | `src/engine/ledger.test.ts`, `src/engine/kidNumbers.test.ts`, `src/engine/schedule.test.ts` |
| Engine: ghost line, projections, monthly interest | `src/engine/ledger.test.ts` (the ghost-line rule is also checked by mutation) |
| Crypto: words ⇄ root, French and English | `src/crypto/keys.test.ts`, `src/crypto/words.test.ts` (official BIP39 vectors) |
| Crypto: HKDF golden values for root `000102…0f` | `src/crypto/keys.test.ts` (computed independently in Python) |
| Crypto: seal/open; wrong key or wrong AAD fails | `src/crypto/box.test.ts` |
| Crypto: the §4.4 size budget | `src/crypto/size.test.ts` (amended limits, see `docs/decisions.md`) |
| Projection: no private note survives `projectForKid` | `src/engine/project.test.ts` (random notes, whitelist) |
| Worker: every endpoint's success and error codes | `worker/worker.test.ts` (in workerd, real local D1) |
| Worker: single-use, expiring invites | `worker/worker.test.ts`, including two simultaneous redemptions |
| Worker: admin token length check | `worker/worker.test.ts` (503 under 32 characters) |
| Worker: body limits, version conflict | `worker/worker.test.ts` |
| Worker: deleting a family deletes its kids | `worker/worker.test.ts` |
| Worker: no `console.` in `worker/` | `worker/static.node.test.ts` (also observability and logpush off) |
| Engine purity (CLAUDE.md rule 7) | `src/engine/purity.test.ts` and the engine's no-DOM tsconfig |

## End to end (Playwright, 390×844, light and dark)

Every e2e test runs under `e2e/fixtures.ts`, which fails it on any request to another origin, any console error (CSP violations included) and any uncaught exception.

| SPEC §16 | Where |
|---|---|
| 1. Fresh instance → admin mints an invite → a friend redeems it → creates Léa → confirms 3 recovery words → sees the kid link | `e2e/onboarding.spec.ts` "admin mints an invite…" |
| 2. Parent adds a deposit, backdates one, catches up Sundays with "Tout à la banque"; the balance matches the engine | `e2e/parent.spec.ts` "adds a deposit and a backdated one…", "catches up every pending day…" |
| 3. The kid link in a new context shows the same balance, no private notes, and works offline after the first load | `e2e/parent.spec.ts` (same balance, kid note shown, private note never), `e2e/kid.spec.ts`, `e2e/pwa.spec.ts` "…no network after the first visit (E2E 3)" (fails when the service worker is removed) |
| 4. Export → "Oublier cet appareil" → restore with words → same data; export → offline viewer with the network blocked → same balance | `e2e/onboarding.spec.ts` "restores the bank with the 12 words…", `e2e/backup.spec.ts` "opens a backup with no API call…" |
| 5. Revoke the kid link → the old link shows "Ce lien n'est plus valable…" | `e2e/parent.spec.ts` "a new link revokes the old one", `e2e/kid.spec.ts` |

Every other flow (overdraft, edits, settings, add/delete a kid, two-device conflict, backups, sheet import, picker, privacy page) has its own e2e test in the same folder.

## Definition of done

| Item | Status |
|---|---|
| All tests pass | `npm run verify` |
| `wrangler deploy` works from a clean clone via the Deploy button | `wrangler deploy --dry-run` passes; the button itself needs one try in a real Cloudflare account |
| Lighthouse accessibility ≥ 95 on the kid view and the parent home | `npm run lighthouse`: 100 and 100; `e2e/a11y.spec.ts` runs axe (WCAG 2.1 AA and best practices) on every main screen, light and dark |
| No network request leaves the instance's own origin | `e2e/fixtures.ts` (all e2e tests), `npm run check:dist` (no absolute URL in the build besides XML namespaces and the source link; the §7.4 CSP in `_headers`) |
