/* Unified selection mode (PRD §3 "Revise/study" + "Curate/export"): one Select
   button, Select all over the filtered set, Review (n) restricted to the
   selection. Also covers the status filter and the search box resetting
   between pages. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

test('tag filter → select all → review only that selection, with escape hatch', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', tags: ['physics'] }),
    seedCard({ id: 'b', title: 'Gravity', tags: ['physics'] }),
    seedCard({ id: 'c', title: 'Cell', tags: ['biology'] }),
  ] });
  await hashTo(page, '#/cards');

  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.locator('.flashcard.selected')).toHaveCount(2);

  await page.getByRole('button', { name: 'Review (2)', exact: true }).click();
  await expect(page.locator('.review-card:visible')).toHaveCount(2);
  await expect(page.locator('.review-note')).toContainText('Reviewing 2 selected');

  // REVIEW ALL lifts the selection restriction (tag filter stays until cleared)
  await page.getByRole('button', { name: 'REVIEW ALL', exact: true }).click();
  await expect(page.locator('.review-note')).toBeHidden();
  await expect(page.locator('.review-card:visible')).toHaveCount(2);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.review-card:visible')).toHaveCount(3);
});

test('status filter separates reviewed from unreviewed cards', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'r', title: 'Atom', lastReviewedAt: Date.now() }),
    seedCard({ id: 'n', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');

  await page.getByRole('button', { name: 'Not reviewed', exact: true }).click();
  await expect(page.locator('.flashcard .term')).toHaveText('Cell');
  await page.getByRole('button', { name: 'Reviewed', exact: true }).click();
  await expect(page.locator('.flashcard .term')).toHaveText('Atom');
  // clicking the active chip clears the filter
  await page.getByRole('button', { name: 'Reviewed', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(2);
});

test('flashcard search shows a clear (X) button that resets the filter', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom' }),
    seedCard({ id: 'b', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');

  await page.fill('.cards-search .input-search', 'Atom');
  await expect(page.locator('.flashcard')).toHaveCount(1);
  await page.locator('.cards-search .icon-clear').click();
  await expect(page.locator('.cards-search .input-search')).toHaveValue('');
  await expect(page.locator('.flashcard')).toHaveCount(2);
});

test('a searched term does not linger in search boxes on other pages', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'Photosynthesis');
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toHaveText('Photosynthesis');
  // on Results the bar reflects the current lookup — that stays
  await expect(page.locator('#search-top')).toHaveValue('Photosynthesis');

  await hashTo(page, '#/cards');
  await expect(page.locator('#search-top')).toHaveValue('');
  await hashTo(page, '#/home');
  await expect(page.locator('#search-home')).toHaveValue('');
});
