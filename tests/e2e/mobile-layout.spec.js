/* Mobile-layout regressions (runs meaningfully in the mobile-chromium project;
   narrow-only checks self-skip on desktop).

   The killer bug these guard: ANY filter/transform on <body> (or another
   ancestor) silently becomes the containing block for position:fixed
   descendants — the bottom nav then anchors to the END OF THE DOCUMENT
   instead of the viewport, and on a real phone it only appears after
   scrolling all the way down. It looked correct in emulators on pages
   exactly one viewport tall, which is why a computed-style check on <body>
   is asserted directly alongside the geometry. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard, openFilters } = require('./helpers');

const isNarrow = (page) => page.viewportSize().width <= 640;

/* A dozen long cards forces the collection page well past one viewport. */
const longSeed = () => Array.from({ length: 12 }, (_, i) =>
  seedCard({ id: 'c' + i, title: 'Term ' + i, extract: ('Sentence about term ' + i + '. ').repeat(20) }));

test('bottom nav stays pinned to the viewport while a long page scrolls', async ({ page }) => {
  test.skip(!isNarrow(page), 'bottom nav renders only on narrow viewports');
  await openApp(page, { seed: longSeed() });
  await hashTo(page, '#/cards');

  const nav = page.locator('.nav-bottom');
  await expect(nav).toBeVisible();
  const vh = page.viewportSize().height;
  const hugsBottom = async (label) => {
    const box = await nav.boundingBox(); // viewport-relative for fixed elements
    expect(box.y + box.height, `${label}: nav bottom edge`).toBeLessThanOrEqual(vh + 1);
    expect(box.y, `${label}: nav top edge`).toBeGreaterThan(vh - box.height - 2);
  };
  await hugsBottom('before scroll');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await hugsBottom('after scroll');
});

test('body carries no filter/transform (would break every fixed element)', async ({ page }) => {
  await openApp(page);
  const styles = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const h = getComputedStyle(document.documentElement);
    return [b.filter, b.transform, h.filter, h.transform];
  });
  expect(styles).toEqual(['none', 'none', 'none', 'none']);
});

test('no horizontal overflow on core pages', async ({ page }) => {
  await openApp(page, { seed: [seedCard()] });
  for (const route of ['#/home', '#/cards', '#/settings', '#/login']) {
    await hashTo(page, route);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test('filters live in a pop-out panel; the icon badge reports the active count', async ({ page }) => {
  await openApp(page, { seed: [
    seedCard({ id: 'a', title: 'Atom', tags: ['physics'] }),
    seedCard({ id: 'b', title: 'Cell', tags: ['biology'] }),
  ] });
  await hashTo(page, '#/cards');

  // closed by default on every viewport — the labeled rows are hidden
  await expect(page.getByRole('group', { name: 'Reviewed filter' })).toBeHidden();
  await openFilters(page);
  await expect(page.getByRole('group', { name: 'Reviewed filter' })).toBeVisible();
  // Starred is a labeled dimension row, not a stray chip
  await expect(page.getByRole('group', { name: 'Starred filter' })).toBeVisible();

  // activating a filter surfaces a count badge on the funnel icon, so a
  // filter hidden behind the closed panel can never silently hide cards
  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click(); // close the panel
  await expect(page.getByRole('group', { name: 'Reviewed filter' })).toBeHidden();
  await expect(page.locator('.filter-badge')).toHaveText('1');
  await expect(page.locator('.flashcard')).toHaveCount(1);
});

test('active filters never push Select out of the toolbar row', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ id: 'a', title: 'Atom', tags: ['physics'] })] });
  await hashTo(page, '#/cards');
  await openFilters(page);
  await page.getByRole('button', { name: '#physics', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  // the funnel icon is fixed-size (count lives on a badge), so the toolbar
  // can't reflow: icon and Select stay vertically centered on one row
  const icon = await page.locator('.filters-toggle').boundingBox();
  const select = await page.getByRole('button', { name: 'Select', exact: true }).boundingBox();
  expect(Math.abs((icon.y + icon.height / 2) - (select.y + select.height / 2))).toBeLessThan(8);
});

test('entering Select mode folds the filter panel away (one surface at a time)', async ({ page }) => {
  await openApp(page, { seed: [seedCard()] });
  await hashTo(page, '#/cards');
  await openFilters(page);
  await expect(page.getByRole('group', { name: 'Reviewed filter' })).toBeVisible();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Reviewed filter' })).toBeHidden();
  await expect(page.locator('.select-bar')).toBeVisible();
});

test('narrow viewports: selection bar sticks below the top bar during scroll', async ({ page }) => {
  test.skip(!isNarrow(page), 'the selection bar is sticky only on narrow viewports');
  await openApp(page, { seed: longSeed() });
  await hashTo(page, '#/cards');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const bar = page.locator('.select-bar');
  await expect(bar).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  const box = await bar.boundingBox();
  // 3.5rem top bar = 56px at default font size; sticky bar should sit right below
  expect(box.y).toBeGreaterThanOrEqual(50);
  expect(box.y).toBeLessThanOrEqual(70);
});
