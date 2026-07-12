/* PWA offline shell + manifest (PRD §6 phase 8).
   The only spec that allows service workers — everywhere else they're
   blocked (playwright.config.js) so page.route() mocks stay reliable.
   No mockWiki here: the home page makes no Wikipedia requests on its own. */
const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });

test('the app shell loads offline after a single visit', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForSelector('#search-home', { state: 'visible' });
  // registered in init(); ready resolves once it's activated (clients.claim
  // in sw.js means it controls this very page, not just the next load)
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  // Alpine hydrating the hero proves the whole chain: index.html, app.js and
  // styles.css from the shell cache, the Alpine CDN script from the CDN cache
  await page.waitForSelector('#search-home', { state: 'visible' });
  await expect(page.locator('.wordmark')).toHaveText('Glossary');
  await context.setOffline(false);
});

test('manifest declares the installable basics', async ({ request }) => {
  const res = await request.get('/manifest.json');
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('./'); // relative: works at / and at /glossary/
  expect(m.icons.some((i) => i.sizes === '192x192')).toBeTruthy();
  expect(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBeTruthy();
});

test('settings shows which build the device is running', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#search-home', { state: 'visible' });
  await page.evaluate(() => { location.hash = '#/settings'; });
  // document.lastModified formatted as an ISO minute — the diagnostic that
  // makes a stale installed copy visible (mobile QA found one the hard way)
  await expect(page.locator('.build-stamp')).toHaveText(/^Build \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
});

test('index.html wires the manifest, icons and theme-color', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icons/apple-touch-icon.png');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#[0-9A-Fa-f]{6}/);
});
