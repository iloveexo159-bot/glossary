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
  const star = await card.locator('.star-btn').boundingBox();
  const text = await card.locator('.summary').boundingBox();
  // the first answer line must start below the star's bottom edge
  expect(text.y).toBeGreaterThanOrEqual(star.y + star.height);
});
