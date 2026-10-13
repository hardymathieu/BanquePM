// Records docs/explainer (HTML + WebGL2, driven by explainer.seek(t)) frame by frame into:
//   docs/explainer/banque-explainer.mp4   full video, 1280×720, 30 fps
//   docs/explainer/banque-explainer.webp  animated preview for the README (GitHub plays it inline)
// Needs ffmpeg with libx264 and libwebp: on PATH, or FFMPEG=/path/to/ffmpeg.
// Usage: node scripts/record-explainer.mjs [--from 0] [--to 88] [--stills 5,15,40]
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..', 'docs');
const out = join(root, 'explainer');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const FPS = 30;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e));
page.on('response', (r) => r.status() >= 400 && errors.push(new Error(`${r.status()} ${r.url()}`)));
await page.goto(`${base}/explainer/?record`);
await page.waitForFunction(() => window.explainer || document.readyState === 'complete');
if (errors.length) throw errors[0];
await page.evaluate(() => window.explainer.ready);
const stage = page.locator('#stage');
const duration = await page.evaluate(() => window.explainer.duration);

const run = (args, input) =>
  new Promise((ok, fail) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok(p) : fail(new Error(`ffmpeg exited ${code}`))));
    if (input) input(p.stdin);
  });

const stills = arg('stills');
if (stills) {
  const dir = arg('dir', out);
  mkdirSync(dir, { recursive: true });
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((t) => window.explainer.seek(t), t);
    await stage.screenshot({ path: join(dir, `still-${t}.png`) });
  }
} else {
  const from = Number(arg('from', 0));
  const to = Math.min(Number(arg('to', duration)), duration);
  const mp4 = join(out, 'banque-explainer.mp4');
  await run(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], async (stdin) => {
    const frames = Math.round((to - from) * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.explainer.seek(t), from + i / FPS);
      const jpg = await stage.screenshot({ type: 'jpeg', quality: 92 });
      if (!stdin.write(jpg)) await new Promise((r) => stdin.once('drain', r));
      if (i % (FPS * 10) === 0) process.stdout.write(`${Math.round(i / FPS)}s `);
    }
    stdin.end();
  });
  // The README preview: smaller and slower, so GitHub can play it inline.
  await run(['-i', mp4, '-vf', 'fps=12,scale=800:-2:flags=lanczos', '-c:v', 'libwebp_anim', '-quality', '62', '-compression_level', '4', '-loop', '0', join(out, 'banque-explainer.webp')]);
  for (const f of ['banque-explainer.mp4', 'banque-explainer.webp']) console.log(`\n${f}: ${(statSync(join(out, f)).size / 1e6).toFixed(1)} MB`);
}
await browser.close();
server.close();
