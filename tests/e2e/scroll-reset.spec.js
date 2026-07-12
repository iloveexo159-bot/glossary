/* Page switches start at the top (mobile QA gap #3, 2026-07-12): without the
   route() scroll reset, the next page inherits the previous one's offset. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

const LONG = 'A deliberately long extract so twelve overview cards overflow any viewport. '.repeat(4);

test('switching pages starts at the top, not at the previous scroll offset', async ({ page }) => {
  const seed = Array.from({ length: 12 }, (_, i) => seedCard({ id: 'c' + i, title: 'Term ' + i, extract: LONG }));
  await openApp(page, { seed });
  await hashTo(page, '#/cards');
  await page.locator('.flashcard').first().waitFor();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  await hashTo(page, '#/settings');
  await expect(page.locator('.page-title:visible')).toHaveText('Settings');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
