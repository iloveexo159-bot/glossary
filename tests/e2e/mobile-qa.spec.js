/* Mobile QA regression guards (real-device findings, 2026-07-12):
   - iOS zooms the page when a focused input computes under 16px (and stays
     zoomed after navigating) — text inputs are floored at 16px on touch.
   - The flip-card star overlapped the answer text — the back face reserves a
     top strip that clears the corner controls. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

// the star test measures geometry right after a flip — reduced motion makes
// the app's 250ms 3D rotation an instant swap, so boxes are never mid-animation
test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('text inputs never compute under 16px on touch devices (iOS zoom guard)', async ({ page, isMobile }) => {
  await openApp(page);
  const px = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('search-home')).fontSize));
  if (isMobile) expect(px).toBeGreaterThanOrEqual(16);
  else expect(px).toBeLessThan(16); // desktop keeps the designed 15px UI size
});

test('the flipped card answer clears the star corner', async ({ page }) => {
  const LONG = 'A long answer whose first line would previously run under the star. '.repeat(4);
  await openApp(page, { seed: [seedCard({ id: 'a', title: 'Atom', extract: LONG })] });
  await hashTo(page, '#/cards');
  await page.getByRole('button', { name: 'Flashcards', exact: true }).click();

  const card = page.locator('.review-card').first();
  await card.locator('.flip-area').click(); // reveal the answer face
  await expect(card).toHaveClass(/flipped/);
  const starBtn = card.locator('.star-btn');
  const star = await starBtn.boundingBox();
  const glyphPx = await starBtn.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const text = await card.locator('.summary').boundingBox();
  // the text must clear the VISIBLE glyph (centered in its 44px hit box) —
  // per reader preference the invisible tap-zone corner may overlap, so the
  // full box is deliberately not the bar here (mobile QA round 2)
  expect(text.y).toBeGreaterThanOrEqual(star.y + star.height / 2 + glyphPx / 2);
});

test('the disambiguation dictionary banner works when the typed term is capitalized (iOS keyboard)', async ({ page }) => {
  await openApp(page);
  // iOS autocapitalizes ("Mercury") while the dictionary APIs answer lowercase
  // ("mercury") — the supersede guard once discarded the successful response
  // over that case twin, stranding the page on "Looking up…" forever.
  await page.route(/api\.dictionaryapi\.dev/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      word: 'mercury', phonetic: '', phonetics: [],
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A silvery liquid metal.' }], synonyms: [] }],
    }]),
  }));
  await page.route(/api\.datamuse\.com/, (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));

  await hashTo(page, '#/results/Mercury'); // the capitalized term Wikipedia disambiguates
  await page.locator('.dict-option').click(); // "See the definition of “mercury”"
  await expect(page.locator('.extract')).toContainText('A silvery liquid metal.');
});

test('re-revealing a scrolled answer starts back at the top', async ({ page }) => {
  // enough text that the back face genuinely scrolls (grid backs cap at 220 chars)
  const LONG = 'This answer is long enough that the back face must scroll to read it all. '.repeat(4);
  await openApp(page, { seed: [seedCard({ id: 'a', title: 'Atom', extract: LONG })] });
  await hashTo(page, '#/cards');
  await page.getByRole('button', { name: 'Flashcards', exact: true }).click();

  const card = page.locator('.review-card').first();
  await card.locator('.flip-area').click(); // reveal
  const body = card.locator('.face.back .back-body');
  await body.evaluate((el) => { el.scrollTop = 999; });
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0); // it really scrolled

  await card.locator('.flip-area').click(); // hide the answer
  await card.locator('.flip-area').click(); // reveal again
  expect(await body.evaluate((el) => el.scrollTop)).toBe(0);
});
