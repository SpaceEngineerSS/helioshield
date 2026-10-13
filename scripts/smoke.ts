/**
 * End-to-end smoke test against the production build.
 *
 *   npm run smoke          (builds first)
 *
 * Starts `vite preview`, drives it with the installed Chrome, and checks the
 * flows that matter: live data arrives, the language switch works, a replay
 * loads and plays, and a phone-sized viewport has no horizontal scroll.
 * Exits non-zero on the first failure or on any uncaught page error.
 */
import { preview } from 'vite';
import { chromium, type Page } from 'playwright';

const errors: string[] = [];
let failed = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}

function watch(page: Page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
}

async function main() {
  const server = await preview({ preview: { port: 4317, strictPort: true }, logLevel: 'silent' });
  const base = 'http://localhost:4317';
  const browser = await chromium.launch({ channel: 'chrome' });

  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-US' });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base, { waitUntil: 'load' });

    await check('live solar wind arrives', async () => {
      await page.waitForFunction(
        () => [...document.querySelectorAll('.readout__value')].some((el) => /\d{3}/.test(el.textContent ?? '')),
        null,
        { timeout: 45_000 },
      );
    });

    await check('charts render to canvas', async () => {
      await page.waitForSelector('.uchart canvas', { timeout: 20_000 });
    });

    await check('language switches to Turkish', async () => {
      await page.getByRole('button', { name: 'TR', exact: true }).click();
      await page.getByText('Koşullar', { exact: true }).waitFor({ timeout: 5_000 });
      if ((await page.getAttribute('html', 'lang')) !== 'tr') throw new Error('html lang not updated');
      await page.getByRole('button', { name: 'EN', exact: true }).click();
    });

    await check('a replay loads from the archive and plays', async () => {
      await page.getByRole('button', { name: /replay/i }).click();
      await page.getByRole('button', { name: /Gannon/ }).click();
      await page.getByText('Active region 13664', { exact: false }).waitFor({ timeout: 15_000 });
      if (!page.url().includes('event=gannon-2024')) throw new Error('URL does not carry the event');
      const before = await page.locator('.transport__range').inputValue();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForTimeout(1500);
      const after = await page.locator('.transport__range').inputValue();
      if (Number(after) <= Number(before)) throw new Error('cursor did not advance');
    });

    await ctx.close();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const mpage = await phone.newPage();
    watch(mpage);
    await mpage.goto(base, { waitUntil: 'load' });
    await check('no horizontal scroll at 390 px', async () => {
      await mpage.waitForSelector('.cond', { timeout: 20_000 });
      for (const tab of ['Charts', 'Events', 'Aurora', 'Now']) {
        await mpage.getByRole('button', { name: tab, exact: true }).click();
        await mpage.waitForTimeout(600);
        const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) throw new Error(`${tab}: page is ${overflow}px wider than the screen`);
      }
    });
    await phone.close();

    await check('no uncaught errors in the page', async () => {
      if (errors.length) throw new Error(errors.slice(0, 5).join('\n       '));
    });
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.httpServer.close(() => r()));
  }

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
