# CLAUDE.md — Banque de papa et maman

You are building a zero-knowledge, open-source kids' savings app.

**The spec is local-only.** `claude_work_banque-papa-maman-spec/banque-spec/SPEC.md` is the source of truth, and `…/design/*.html` are the visual and behavioural prototypes. That folder is gitignored because it contains a real child's name, notes and birthday. Read it, but never copy names, notes or birthdays from it into committed files. Use "Léa" and fictional notes in code, tests and docs. Re-read the relevant SPEC section before each milestone (SPEC §17 gives the order).

## Hard rules (never break these, even if asked in passing; ask the owner first)

1. **Nothing readable leaves the browser.** Secrets live only in URL fragments, in memory and in `localStorage`. Never send a root, key, word, name, amount, date or note to the server in plaintext, in a header, a query string or an error report.
2. **Log nothing.**
   - No `console.*` in `worker/`; a test greps for it.
   - Keep `"observability": { "enabled": false }` in `wrangler.jsonc`.
   - No analytics or telemetry of any kind, and no error-reporting SDKs.
3. **No third-party requests.** Fonts, QR code and BIP39 libraries are bundled. No CDNs, no Google Fonts URL. The CSP in SPEC §7.4 must hold.
4. **No listing endpoints.** The server never lists blobs or invites.
5. **Private notes never reach the kid blob.** `projectForKid` (`src/engine/project.ts`) is the only path to it. It copies whitelisted fields one by one and has a test.
6. **The API is frozen at `/api/v1`.** Self-hosted copies don't auto-update. Add, never break. A newer frontend must still read v1 blobs.
7. **The engine is pure.** `src/engine/*` has no DOM, no fetch, no crypto, no `Date.now()`, no `Math.random()`; "today" and id generators are always parameters. All money maths lives there. It is enforced by `src/engine/tsconfig.json` (no DOM lib) and `purity.test.ts`.
8. **The test vectors in SPEC §6.8 must pass within 1e-6** (`src/engine/vectors.test.ts`). If a change breaks them, the change is wrong, not the vectors. `fixtures/engine_reference.py` is the reference implementation.

## How to work

- Follow the milestones in SPEC §17 in order. Finish each with tests green before moving on.
- TypeScript `strict` with `noUncheckedIndexedAccess`. Small files, named exports, no default exports except Preact page components.
- Every user-visible string goes through `src/i18n/fr.ts`. Copy is French, *tu* form, sentence case. Take wording from the prototypes whenever it exists there. The engine returns keys (`FractionKey`, `MoveProblem`, …), never sentences.
- Match the prototypes for layout, tokens, copy and behaviour. They are references, not code to copy wholesale. Re-implement them as Preact components. Where a prototype and SPEC disagree (ghost line, overdraft rule), SPEC wins.
- Wrap every `localStorage` access in try/catch. The app must work when storage throws (it then simply doesn't remember).
- Dates are ISO strings. Calendar maths goes through `src/engine/dates.ts` (UTC day numbers). Never use local-time `Date` arithmetic for calendar days.
- Never round stored amounts. Round only for display via `Intl.NumberFormat('fr-BE', …)`.
- Engine edits (`src/engine/ops.ts`) return new documents and never mutate, so the UI can memoise on document identity.
- Prefer boring code. No state-management library. A single `useFamily()` hook that loads, decrypts, saves (family blob, then kid blobs) and handles `409` is enough.

## Commands

```
npm test             # vitest: engine, crypto, worker
npm run typecheck    # tsc for the app, plus the engine's no-DOM config
npm run dev          # vite + wrangler dev                      (milestone 3+)
npm run e2e          # playwright, phone viewport, light + dark (milestone 10)
npm run build        # vite build into dist/                     (milestone 4+)
npm run deploy       # d1 migrations apply (by binding) + wrangler deploy
python3 fixtures/engine_reference.py   # prints the reference test vectors
```

## Before you say a milestone is done

- `npm test` and `npm run typecheck` pass, and for UI milestones `npm run e2e` passes too.
- You opened the screen at 390×844 in light and dark (screenshot) and compared it with the prototype.
- `grep -R "console\." worker/` is empty.
- In the network tab (or a Playwright request log), no request goes to another origin.

## Data caution

This repo is public. `fixtures/sheet-a.json` holds real dates and amounts without names or notes; the owner chose to keep it. Nothing else personal may be committed.
