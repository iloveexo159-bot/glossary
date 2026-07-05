/* Journey: quick lookup (PRD §3 "Quick definition check").
   Covers live suggestions, single-match result, no-result, disambiguation. */
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test('typing shows live suggestions; picking one renders the summary', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'mit');
  const rows = page.locator('.home-hero .dropdown .row');
  await expect(rows.first()).toContainText('Mitochondrion');
  await rows.first().click();
  await expect(page.locator('.page-title:visible')).toHaveText('Mitochondrion');
  await expect(page.locator('.extract:visible')).toContainText('organelle');
  await expect(page.locator('.credit:visible')).toContainText('via Wikipedia');
});

test('submitting a term with no article shows the no-result state', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'Zzzznotarealterm');
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.state-box:visible')).toContainText('No article found');
});

test('an ambiguous term shows a disambiguation candidate list', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'Mercury');
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toContainText('could mean');
  await expect(page.locator('.candidates .row').first()).toBeVisible();
});

test('a successful lookup is added to the recent-searches list', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'Photosynthesis');
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toHaveText('Photosynthesis');
  await page.evaluate(() => { location.hash = '#/home'; });
  await expect(page.locator('.recent-list')).toContainText('Photosynthesis');
});
