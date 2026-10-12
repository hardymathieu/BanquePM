#!/usr/bin/env bash
# Updates a copy made by the "Deploy to Cloudflare" button from this repository (upstream).
# The button makes a copy, not a fork, with its own history and its own D1 database_id in
# wrangler.jsonc. This keeps that database_id: without it, the next deploy could use a new,
# empty database. Run it in your copy, check the result, then `git push`: Cloudflare redeploys.
set -euo pipefail
UPSTREAM="${UPSTREAM:-https://github.com/hardymathieu/BanquePM.git}"

db_line=$(grep -o '"database_id": *"[^"]*"' wrangler.jsonc | head -1 || true)
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM"
git fetch --quiet upstream main
# Upstream wins on every conflict; the first time, histories are unrelated.
git merge upstream/main --allow-unrelated-histories -X theirs --no-edit -m "Update from upstream"

if [ -n "$db_line" ] && ! grep -q '"database_id"' wrangler.jsonc; then
  DB_LINE="$db_line" node -e '
    const fs = require("fs");
    const s = fs.readFileSync("wrangler.jsonc", "utf8");
    const out = s.replace(/("migrations_dir":\s*"migrations")(\s*})/, `$1, ${process.env.DB_LINE}$2`);
    if (out === s) { console.error("Could not put database_id back: add it to wrangler.jsonc by hand."); process.exit(1); }
    fs.writeFileSync("wrangler.jsonc", out);'
  git commit --quiet -am "Keep this deployment's D1 database_id"
fi
grep -q '"database_id"' wrangler.jsonc && echo "database_id kept."
echo "Updated. Check with 'git log --oneline -3', then 'git push' to redeploy."
