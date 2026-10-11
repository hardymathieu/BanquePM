// npm run icons: renders the app icon (SVG) to the PNG sizes the PWA needs, with Playwright's Chromium.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

/** The coin from the kid view's gauge, on the brand blue. `pad` shrinks it into the maskable safe zone. */
const icon = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2E63C7"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <circle cx="256" cy="256" r="196" fill="#C9D1D6"/>
    <circle cx="256" cy="256" r="168" fill="#D9A93A"/>
    <circle cx="256" cy="256" r="150" fill="none" stroke="#9C7410" stroke-width="7" stroke-dasharray="14 16"/>
    <path fill="#18244A" transform="translate(26 0)" d="M300 166c-22-10-46-12-68-6-34 10-58 38-66 72h-26v26h22v18h-22v26h26c8 34 32 62 66 72 22 6 46 4 68-6l-8-30c-16 7-34 9-50 5-22-6-38-22-46-41h70v-26h-76v-18h76v-26h-70c8-19 24-35 46-41 16-4 34-2 50 5z"/>
  </g>
</svg>`;

writeFileSync('public/favicon.svg', icon(0.04));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [
  ['icon-192.png', 192, 0.04],
  ['icon-512.png', 512, 0.04],
  ['maskable-512.png', 512, 0.2],
  ['apple-touch-icon.png', 180, 0.12],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${icon(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
}
await browser.close();
