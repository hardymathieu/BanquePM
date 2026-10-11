import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';

/** Public files the app shell needs offline (fonts and scripts come from the bundle). */
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return publicFiles(path);
    return name.startsWith('_') ? [] : [`/${relative('public', path)}`];
  });
}

/** Emits sw.js with the list of built files to precache, and a version that changes with them. */
function serviceWorker(): Plugin {
  return {
    name: 'bpm-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle)
        .filter((f) => f !== 'index.html' && !f.endsWith('.map') && !/\.woff$/.test(f)) // browsers here all take woff2
        .map((f) => `/${f}`);
      const precache = ['/', ...publicFiles(), ...built].sort();
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('src/sw/sw.template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [preact({ prerender: { enabled: false } }), serviceWorker()],
  build: {
    // No inline scripts: the CSP is script-src 'self' (SPEC §7.4).
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
  },
  server: {
    // `npm run dev`: the Worker (API) runs in wrangler dev on 8787.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
