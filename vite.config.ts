import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact({ prerender: { enabled: false } })],
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
