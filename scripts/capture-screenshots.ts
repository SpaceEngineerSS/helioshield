/**
 * Screenshots for the README and docs, taken from a running dev or preview server.
 *
 *   npx tsx scripts/capture-screenshots.ts [baseUrl] [outDir]
 *
 * Uses the installed Chrome (channel "chrome") so no browser download is needed.
 */
import { chromium, type Page } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5288';
const out = process.argv[3] ?? 'docs/assets';

interface Shot {
  name: string;
  path: string;
  width: number;
  height: number;
  theme?: 'night' | 'paper';
  lang?: 'en' | 'tr';
  full?: boolean;
  before?: (p: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  { name: 'dashboard', path: '/', width: 1440, height: 900 },
  { name: 'replay-gannon', path: '/?event=gannon-2024&t=2024-05-11T02:00Z', width: 1440, height: 900, full: true },
  { name: 'paper-tr', path: '/?lang=tr', width: 1440, height: 900, theme: 'paper', lang: 'tr' },
  { name: 'mobile', path: '/', width: 390, height: 844 },
];

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.width < 600 ? 3 : 1,
      colorScheme: 'dark',
      locale: 'en-US',
      isMobile: s.width < 600,
      hasTouch: s.width < 600,
    });
    await ctx.addInitScript(
      ([theme, lang]) => {
        localStorage.setItem(
          'helioshield:prefs',
          JSON.stringify({ state: { theme, lang, quality: 'medium', scene: true, place: { lat: 59.91, lon: 10.75, label: 'Oslo' }, notify: { enabled: false, kp: 6 } }, version: 2 }),
        );
      },
      [s.theme ?? 'night', s.lang ?? 'en'],
    );
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error(`[${s.name}] pageerror`, e.message));
    page.on('console', (m) => m.type() === 'error' && console.error(`[${s.name}] console`, m.text()));
    await page.goto(base + s.path, { waitUntil: 'load' });
    await page.waitForTimeout(7000);
    await s.before?.(page);
    await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: !!s.full });
    console.log('saved', s.name);
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
