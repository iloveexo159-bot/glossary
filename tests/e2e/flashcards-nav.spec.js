/* Journey: browse / revise (PRD §3 "Revise/study") + reverse navigation. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

test('empty flashcards page shows the new-user empty state', async ({ page }) => {
  await openApp(page);
  await hashTo(page, '#/cards');
  await expect(page.locator('.state-box:visible')).toContainText('No flashcards yet');
});

test('overview → detail → back returns to the flashcards list', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom' })] });
  await hashTo(page, '#/cards');
  await expect(page.locator('.flashcard .term')).toHaveText('Atom');

  await page.locator('.flashcard').click();
  await expect(page.locator('.page-title:visible')).toHaveText('Atom');

  await page.locator('.top-bar .icon-btn[aria-label="Back"]').click();
  await expect(page).toHaveURL(/#\/cards/);
  await expect(page.locator('.flashcard .term')).toHaveText('Atom');
});

test('review mode flips a card then opens its detail on a second tap', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom', extract: 'An atom is the basic particle of matter.' })] });
  await hashTo(page, '#/cards');
  await page.getByRole('button', { name: 'Review', exact: true }).click();

  const rc = page.locator('.review-card:visible').first();
  await expect(rc).toContainText('Atom');
  await rc.click(); // flip
  await expect(rc).toContainText('An atom is');
  await rc.click(); // → detail
  await expect(page.locator('.page-title:visible')).toHaveText('Atom');
});

test('tag filter narrows the visible cards', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', tags: ['physics'] }),
    seedCard({ id: 'b', title: 'Cell', tags: ['biology'] }),
  ] });
  await hashTo(page, '#/cards');
  await expect(page.locator('.flashcard')).toHaveCount(2);
  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(1);
  await expect(page.locator('.flashcard .term')).toHaveText('Atom');
});
