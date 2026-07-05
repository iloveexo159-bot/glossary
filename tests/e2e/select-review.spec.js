/* Focused review sessions (Create review session → select → #/review) plus
   the collection filters and the search box resetting between pages. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

async function startSessionOf(page, count) {
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: `Review (${count})`, exact: true }).click();
  await expect(page).toHaveURL(/#\/review/);
}

test('tag filter → create review session → flip, advance, and finish back at the collection', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', tags: ['physics'], extract: 'An atom.' }),
    seedCard({ id: 'b', title: 'Gravity', tags: ['physics'], extract: 'A force.' }),
    seedCard({ id: 'c', title: 'Cell', tags: ['biology'] }),
  ] });
  await hashTo(page, '#/cards');

  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await startSessionOf(page, 2);
  await expect(page.locator('.session-controls')).toContainText('1 / 2');

  const card = page.locator('.session-card');
  await card.locator('.flip-area').click(); // reveal the answer
  await expect(card).toHaveClass(/flipped/);

  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.locator('.session-controls')).toContainText('2 / 2');
  await expect(card).not.toHaveClass(/flipped/); // advancing resets the flip

  // finishing with nothing starred returns straight to the collection
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page).toHaveURL(/#\/cards/);
});

test('starring during a session offers a starred-only second pass', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom' }),
    seedCard({ id: 'b', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');
  await startSessionOf(page, 2);

  await page.locator('.session-card .star-btn').click(); // star card 1
  await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();

  await expect(page.locator('.state-box:visible')).toContainText('Session complete');
  await page.getByRole('button', { name: /Review starred again \(1\)/ }).click();
  await expect(page.locator('.session-controls')).toContainText('1 / 1');
});

test('View full article detours to detail; back resumes the session in place', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', extract: 'An atom.' }),
    seedCard({ id: 'b', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');
  await startSessionOf(page, 2);

  // the article link lives on the back face — reveal the answer first
  await page.locator('.session-card .flip-area').click();
  await page.locator('.session-card .card-article-link').click();
  await expect(page.locator('.page-title:visible')).toHaveText('Atom');

  await page.locator('.top-bar .icon-btn[aria-label="Back"]').click();
  await expect(page).toHaveURL(/#\/review/);
  await expect(page.locator('.session-controls')).toContainText('1 / 2');
});

test('segmented status filter separates reviewed from unreviewed cards', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'r', title: 'Atom', lastReviewedAt: Date.now() }),
    seedCard({ id: 'n', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');

  const reviewedGroup = page.getByRole('group', { name: 'Reviewed filter' });
  await reviewedGroup.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.locator('.flashcard .term')).toHaveText('Cell');
  await reviewedGroup.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(page.locator('.flashcard .term')).toHaveText('Atom');
  await reviewedGroup.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(2);
});

test('multiple tag chips select together (OR)', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', tags: ['physics'] }),
    seedCard({ id: 'b', title: 'Cell', tags: ['biology'] }),
    seedCard({ id: 'c', title: 'Rome', tags: ['history'] }),
  ] });
  await hashTo(page, '#/cards');

  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await page.getByRole('button', { name: '#biology', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(2);
  await page.locator('.chip-row').getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(3);
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
