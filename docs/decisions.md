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
