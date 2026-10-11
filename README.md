# Banque de papa et maman

A free, open-source "virtual savings account" that parents run for their kids. Pocket money goes into the bank, the bank pays generous, educational interest, and the kid watches it grow on a read-only page.

Built around one promise: **whoever hosts it can know nothing.** No accounts, no emails, no passwords, no logs, no analytics. Everything is end-to-end encrypted in the browser, and the server stores only blobs it cannot read.

> **Status: early development.** The engine, crypto, server, kid view, parent app, onboarding and backups (export, restore, offline viewer) are done. The sheet importer is next. A Deploy to Cloudflare button and the full French and English README come with v1.

## Development

```
npm install
npm test
npm run typecheck
cp .dev.vars.example .dev.vars   # then set ADMIN_TOKEN to 32+ random characters
npm run dev
python3 fixtures/engine_reference.py   # reference implementation of the interest maths
```
