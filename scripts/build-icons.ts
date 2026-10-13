/**
 * Renders every icon and the social card from one drawing of the mark.
 *
 *   npx tsx scripts/build-icons.ts
 *
 * Icons are rasterised with sharp. The social card has text, so it is
 * rendered by Chrome (Playwright) with the same self-hosted fonts as the app.
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const INK = '#0e0d0b';
const PAPER = '#ede6d8';
const SUN = '#e8a33d';

/** The mark on a 32-unit grid, same geometry as src/ui/Logo.tsx. */
function mark(fg: string, scale = 1, dx = 0, dy = 0): string {
  return `<g transform="translate(${dx} ${dy}) scale(${scale})">
    <circle cx="9" cy="16" r="6" fill="${SUN}"/>
    <path d="M24.5 5.5c-4.2 2.4-6.5 6.2-6.5 10.5s2.3 8.1 6.5 10.5" fill="none" stroke="${fg}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M27 9.5c-2.2 1.7-3.3 3.9-3.3 6.5s1.1 4.8 3.3 6.5" fill="none" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>
    <circle cx="27.5" cy="16" r="1.6" fill="${fg}"/>
  </g>`;
}

/** Square icon: the mark centred on ink, with `pad` as a fraction of the size kept clear. */
function icon(size: number, pad: number): string {
  const inner = size * (1 - 2 * pad);
  const s = inner / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${INK}"/>
    ${mark(PAPER, s, size * pad + s * -0.5, size * pad)}
  </svg>`;
}

/** Monochrome badge for Android notifications (alpha only matters). */
function badge(size: number): string {
  const s = (size * 0.8) / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${size * 0.1} ${size * 0.1}) scale(${s})">
      <circle cx="9" cy="16" r="6" fill="#fff"/>
      <path d="M24.5 5.5c-4.2 2.4-6.5 6.2-6.5 10.5s2.3 8.1 6.5 10.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="27.5" cy="16" r="2" fill="#fff"/>
    </g>
  </svg>`;
}

async function png(svg: string, file: string) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
}

/** A .ico is a tiny header in front of PNG data. */
async function ico(pngFile: string, out: string) {
  const data = await readFile(pngFile);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6);
  header.writeUInt8(32, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(data.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile(out, Buffer.concat([header, data]));
}

function font(pkg: string, file: string): string {
  return pathToFileURL(resolve('node_modules/@fontsource', pkg, 'files', file)).href;
}

async function socialCard() {
  // Real definitive Kp from the archived Gannon storm, 10–11 May 2024.
  const gannon = JSON.parse(await readFile('public/archive/gannon-2024.json', 'utf8')) as { kp: { kp: number[] } };
  const kp = gannon.kp.kp.slice(0, 16);
  const color = (k: number) => (k >= 8.67 ? '#e45b70' : k >= 7.67 ? '#e2694c' : k >= 6.67 ? '#df7a35' : k >= 4.67 ? '#c9b458' : '#8fa98a');
  const bars = kp
    .map((k) => `<span style="height:${(k / 9) * 100}%;background:${color(k)}"></span>`)
    .join('');
  const ticks = Array.from({ length: 31 }, (_, i) => `<i style="left:${(i / 30) * 100}%;height:${i % 5 === 0 ? 14 : 7}px"></i>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Plex; src: url(${font('ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2')}); font-weight: 600; }
    @font-face { font-family: Plex; src: url(${font('ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2')}); font-weight: 400; }
    @font-face { font-family: Mono; src: url(${font('ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2')}); }
    @font-face { font-family: Note; src: url(${font('newsreader', 'newsreader-latin-400-italic.woff2')}); font-style: italic; }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; background: ${INK}; color: ${PAPER}; font-family: Plex; position: relative; overflow: hidden;
      background-image: linear-gradient(rgba(237,230,216,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(237,230,216,.05) 1px, transparent 1px);
      background-size: 48px 48px; }
    .frame { position: absolute; inset: 40px; border: 1px solid rgba(237,230,216,.18); }
    .frame::before, .frame::after { content: ''; position: absolute; width: 16px; height: 16px; border-color: rgba(237,230,216,.5); border-style: solid; }
    .frame::before { top: -1px; left: -1px; border-width: 1px 0 0 1px; }
    .frame::after { right: -1px; bottom: -1px; border-width: 0 1px 1px 0; }
    .head { position: absolute; left: 88px; top: 96px; display: flex; align-items: center; gap: 28px; }
    h1 { font-size: 88px; font-weight: 600; letter-spacing: -0.02em; }
    p { position: absolute; left: 92px; top: 236px; font-family: Note; font-style: italic; font-size: 38px; color: #b8ae9c; }
    .meta { position: absolute; left: 92px; bottom: 92px; font-family: Mono; font-size: 20px; color: #8d8473; letter-spacing: .04em; }
    .meta b { color: ${SUN}; font-weight: 400; }
    .chart { position: absolute; right: 92px; bottom: 150px; width: 470px; height: 200px; display: flex; align-items: flex-end; gap: 6px; border-bottom: 1px solid rgba(237,230,216,.4); }
    .chart span { flex: 1; opacity: .9; }
    .ruler { position: absolute; right: 92px; bottom: 128px; width: 470px; height: 16px; }
    .ruler i { position: absolute; top: 0; width: 1px; background: rgba(237,230,216,.4); }
    .cap { position: absolute; right: 92px; bottom: 92px; font-family: Mono; font-size: 16px; color: #8d8473; }
  </style></head><body>
    <div class="frame"></div>
    <div class="head"><svg width="96" height="96" viewBox="0 0 32 32">${mark(PAPER)}</svg><h1>HelioShield</h1></div>
    <p>Space weather, read from the instruments.</p>
    <div class="chart">${bars}</div>
    <div class="ruler">${ticks}</div>
    <div class="cap">Kp · 10–11 May 2024</div>
    <div class="meta"><b>●</b> live NOAA · NASA data &nbsp;·&nbsp; storm replays &nbsp;·&nbsp; EN / TR</div>
  </body></html>`;

  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  // Load from a file so the page may read the local font files.
  const file = resolve(tmpdir(), 'helioshield-og.html');
  await writeFile(file, html);
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/og.png' });
  await browser.close();
  await rm(file);
}

async function main() {
  await mkdir('public/icons', { recursive: true });
  await png(icon(192, 0.14), 'public/icons/icon-192.png');
  await png(icon(512, 0.14), 'public/icons/icon-512.png');
  // Maskable icons get cropped to a circle; keep the mark inside the safe zone.
  await png(icon(512, 0.24), 'public/icons/maskable-512.png');
  await png(icon(180, 0.16), 'public/icons/apple-touch-icon.png');
  await png(badge(96), 'public/icons/badge-96.png');
  await png(icon(32, 0.06), 'public/icons/favicon-32.png');
  await ico('public/icons/favicon-32.png', 'public/favicon.ico');
  await socialCard();
  console.log('icons and social card written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
