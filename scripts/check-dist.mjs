// npm run check:dist: final checks on the production build (SPEC §16 "done means", CLAUDE.md rule 3).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const CSP = "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'";
/** Absolute URLs allowed in the build: XML namespaces (never fetched) and the source-code link. */
const ALLOWED_URLS = [/^http:\/\/www\.w3\.org\//, /^https:\/\/github\.com\/hardymathieu\/BanquePM$/];
const KiB = 1024;
const BUDGET = { kidFirstLoadJs: 45 * KiB, totalJs: 150 * KiB, css: 10 * KiB };

const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const all = files(DIST);
const gz = (f) => gzipSync(readFileSync(f)).length;
const problems = [];
const check = (ok, message) => ok || problems.push(message);

check(!all.some((f) => f.endsWith('.map')), 'source maps in dist');

for (const f of all.filter((f) => /\.(js|css|html|webmanifest|svg)$/.test(f))) {
  for (const url of readFileSync(f, 'utf8').match(/https?:\/\/[^\s"'`)<>\\]+/g) ?? []) {
    check(ALLOWED_URLS.some((re) => re.test(url)), `unexpected absolute URL in ${f}: ${url}`);
  }
}

const headers = readFileSync(join(DIST, '_headers'), 'utf8');
check(headers.includes(`Content-Security-Policy: ${CSP}`), 'the SPEC §7.4 CSP is missing from dist/_headers');
check(/\/sw\.js\s+Cache-Control: no-cache/.test(headers), 'sw.js must be served with Cache-Control: no-cache');

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
check(sw.includes("url.pathname.startsWith('/api/')"), 'the service worker must not handle /api/');
check(!sw.includes('__PRECACHE__') && !sw.includes('__VERSION__'), 'sw.js placeholders were not filled');

// What a kid's phone downloads first: the entry script and its static imports.
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const entry = /<script type="module"[^>]*src="\/([^"]+)"/.exec(html)?.[1];
check(entry !== undefined, 'no entry script in index.html');
const firstLoad = new Set();
const visit = (rel) => {
  if (firstLoad.has(rel)) return;
  firstLoad.add(rel);
  const code = readFileSync(join(DIST, rel), 'utf8');
  for (const m of code.matchAll(/(?:^|[;}\n])\s*import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) visit(join('assets', m[1]));
};
if (entry) visit(entry);
const sum = (list) => list.reduce((n, f) => n + gz(join(DIST, f)), 0);
const kidJs = sum([...firstLoad]);
const js = all.filter((f) => f.endsWith('.js') && !f.endsWith('sw.js'));
const totalJs = js.reduce((n, f) => n + gz(f), 0);
const css = all.filter((f) => f.endsWith('.css')).reduce((n, f) => n + gz(f), 0);
check(kidJs <= BUDGET.kidFirstLoadJs, `kid first-load JS ${kidJs} B > ${BUDGET.kidFirstLoadJs} B`);
check(totalJs <= BUDGET.totalJs, `total JS ${totalJs} B > ${BUDGET.totalJs} B`);
check(css <= BUDGET.css, `CSS ${css} B > ${BUDGET.css} B`);

const kb = (n) => `${(n / KiB).toFixed(1)} KiB`;
process.stdout.write(
  `gzipped: kid first load JS ${kb(kidJs)} (${firstLoad.size} files), all JS ${kb(totalJs)}, CSS ${kb(css)}\n` +
    (problems.length ? `FAILED:\n- ${problems.join('\n- ')}\n` : 'dist check: clean\n'),
);
process.exit(problems.length ? 1 : 0);
