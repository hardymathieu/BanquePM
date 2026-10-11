// npm run lighthouse: Lighthouse scores for the kid view and the parent home (SPEC §16: accessibility ≥ 95),
// against a production build in a local Worker with the fictional demo bank.
import { execSync, spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { localToday } from '../src/ui/shared/today';
import { createDemoBank } from './demo';

const PORT = 8797;
const DEBUG_PORT = 9333;
const TOKEN = 'lighthouse-admin-token-0123456789-abcdef';
const base = `http://localhost:${PORT}`;
const persist = '.wrangler/lighthouse';

execSync(`npx vite build && npx wrangler d1 migrations apply DB --local --persist-to ${persist}`, { stdio: 'ignore' });
const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', persist, '--var', `ADMIN_TOKEN:${TOKEN}`], { stdio: 'ignore', detached: true });
const stop = () => {
  try {
    process.kill(-server.pid!, 'SIGTERM');
  } catch {
    // already gone
  }
};

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      if (i > 120) throw new Error('wrangler dev did not start');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const bank = await createDemoBank(base, TOKEN, localToday());
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${DEBUG_PORT}`] });
  const rows: string[] = [];
  for (const [name, url] of [['kid view', bank.kidLink], ['parent home', bank.parentLink]] as const) {
    const result = await lighthouse(url, {
      port: DEBUG_PORT,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility', 'best-practices', 'performance', 'seo'],
    });
    const c = result!.lhr.categories;
    const score = (k: string) => Math.round((c[k]?.score ?? 0) * 100);
    rows.push(`${name.padEnd(12)} accessibility ${score('accessibility')}  best practices ${score('best-practices')}  performance ${score('performance')}  seo ${score('seo')}`);
    const failed = Object.values(result!.lhr.audits).filter((a) => a.score !== null && a.score < 1 && c.accessibility!.auditRefs.some((r) => r.id === a.id));
    for (const a of failed) rows.push(`    accessibility audit not passed: ${a.id} (${a.title})`);
  }
  await browser.close();
  process.stdout.write(`${rows.join('\n')}\n`);
} finally {
  stop();
}
