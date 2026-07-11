/* Focused review sessions (Create review session → select → #/review) plus
   the collection filters and the search box resetting between pages. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard, openFilters } = require('./helpers');

async function startSessionOf(page, count) {
  await page.getByRole('button', { name: 'Select', exact: true }).click();
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

  await openFilters(page);
  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await startSessionOf(page, 2);
  await expect(page.locator('.session-controls')).toContainText('1 / 2');

  const card = page.locator('.session-card');
  await card.locator('.flip-area').click(); // reveal the answer
  await expect(card).toHaveClass(/flipped/);

  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.locator('.session-controls')).toContainText('2 / 2');
  await expect(card).not.toHaveClass(/flipped/); // advancing resets the flip

  // finishing lands on the results screen (not straight back to the collection)
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.locator('.session-result')).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page).toHaveURL(/#\/cards/);
});

test('Right/Wrong verdicts produce a pass/fail result with Restart and Revise', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', extract: 'An atom.' }),
    seedCard({ id: 'b', title: 'Cell', extract: 'A cell.' }),
  ] });
  await hashTo(page, '#/cards');
  await startSessionOf(page, 2);

  // card 1: reveal, mark Right (buttons are disabled until the card is
  // flipped) — the verdict rides the fling animation to card 2
  await page.locator('.session-card .flip-area').click();
  await page.getByRole('button', { name: 'Mark right' }).click();
  await expect(page.locator('.session-controls')).toContainText('2 / 2');
  // card 2: reveal, mark Wrong — the last card's fling finishes the session
  await page.locator('.session-card .flip-area').click();
  await page.getByRole('button', { name: 'Mark wrong' }).click();

  const result = page.locator('.session-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('You got 1/2 correct, and skipped 0 cards.');
  await expect(result).toContainText('Oh no, you failed'); // 1 correct vs 1 wrong → no majority

  await page.getByRole('button', { name: 'Revise wrong & skipped (1)' }).click();
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

test('flashcards-mode select box is clickable (regression: checkbox was a dead zone)', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom' }),
    seedCard({ id: 'b', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');
  await page.getByRole('button', { name: 'Flashcards', exact: true }).click();

  // enter selection mode — the checkbox appears on each flip card
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const firstCard = page.locator('.review-card').first();

  // clicking the checkbox ITSELF must select the card. It sits outside .flip-area
  // (the only other click target), so a missing handler makes it a dead zone.
  await firstCard.locator('.select-check').click();
  await expect(firstCard).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'Review (1)', exact: true })).toBeVisible();
});

test('the session card can be starred mid-review and it persists', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ id: 'a', title: 'Atom' })] });
  await hashTo(page, '#/cards');
  await startSessionOf(page, 1);

  await page.locator('.session-card .star-btn').click();
  await expect(page.locator('.session-card .star-btn')).toHaveText('★');
  const starred = await page.evaluate(() => JSON.parse(localStorage.getItem('glossary.cards'))[0].starred);
  expect(starred).toBe(true);
});

test('segmented status filter separates reviewed from unreviewed cards', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'r', title: 'Atom', lastReviewedAt: Date.now() }),
    seedCard({ id: 'n', title: 'Cell' }),
  ] });
  await hashTo(page, '#/cards');

  await openFilters(page);
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

  await openFilters(page);
  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await page.getByRole('button', { name: '#biology', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(2);
  await page.locator('.chip-row').getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(3);
});

test('flashcard search shows a clear (X) button that resets the filter', async ({ page }) => {
  // distinct extracts: the default seedCard extract mentions "atom", which would
  // make a title search for "Atom" also match Cell via its body text (search
  // spans title OR extract) — give each card its own body so the query is unambiguous
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', extract: 'The smallest unit of ordinary matter.' }),
    seedCard({ id: 'b', title: 'Cell', extract: 'The basic structural unit of living organisms.' }),
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
