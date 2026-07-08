/* A11y regression guard — locks in the 2026-07-06 web-interface audit fixes
   (docs/web-interface-audit-2026-07-06.md): modal focus management (H3),
   live-region announcements (H2), keyboard-operable highlights (M1),
   toggle semantics (M4), and the all-pages-in-DOM tab-order seal (H1).

   Keyboard-only behaviors run desktop-only; the inert and live-region tests
   run on both projects because the bottom nav — a mobile-only element — must
   also be unreachable behind an open dialog. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

const EXTRACT = 'An atom is the basic particle of matter.';
const HL_TEXT = 'basic particle';
const annotated = () => seedCard({
  extract: EXTRACT,
  highlights: [{ id: 'h1', text: HL_TEXT, start: EXTRACT.indexOf(HL_TEXT), note: 'a note', tags: [], createdAt: 1 }],
});

const desktopOnly = (testInfo) =>
  test.skip(testInfo.project.name === 'mobile-chromium', 'keyboard-only behavior — desktop coverage is sufficient');

const noteDialog = (page) => page.locator('.dialog[aria-label="Note"]');

test('the note dialog traps Tab in both directions and returns focus to its opener', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openApp(page, { seed: [annotated()] });
  await hashTo(page, '#/card/c1');
  const mark = page.locator('mark.hl');
  await mark.focus();
  await page.keyboard.press('Enter'); // open the highlight's note dialog
  const dlg = noteDialog(page);
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('textarea')).toBeFocused();

  // more presses than the dialog has controls, so the wrap itself is exercised
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('.dialog')),
      `Tab press ${i + 1} escaped the dialog`).toBe(true);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('.dialog')),
      `Shift+Tab press ${i + 1} escaped the dialog`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(mark).toBeFocused();
});

test('the page behind an open dialog is inert, including the bottom nav', async ({ page }) => {
  await openApp(page, { seed: [annotated()] });
  await hashTo(page, '#/card/c1');
  await page.locator('mark.hl').click(); // clicking a highlight opens its note dialog
  await expect(noteDialog(page)).toBeVisible();

  await expect(page.locator('main')).toHaveJSProperty('inert', true);
  await expect(page.locator('.top-bar')).toHaveJSProperty('inert', true);
  await expect(page.locator('.nav-bottom')).toHaveJSProperty('inert', true);

  await noteDialog(page).getByRole('button', { name: 'CANCEL' }).click();
  await expect(noteDialog(page)).toBeHidden();
  await expect(page.locator('main')).toHaveJSProperty('inert', false);
  await expect(page.locator('.nav-bottom')).toHaveJSProperty('inert', false);
});

test('Enter on a focused highlight mark opens its note dialog', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openApp(page, { seed: [annotated()] });
  await hashTo(page, '#/card/c1');
  const mark = page.locator('mark.hl');
  await expect(mark).toHaveText(HL_TEXT);
  await mark.focus();
  await page.keyboard.press('Enter');
  const dlg = page.locator('.dialog[aria-label="Note"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('blockquote')).toContainText(HL_TEXT);
});

test('live region announces the loaded article and the save confirmation', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'Photosynthesis');
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toHaveText('Photosynthesis');

  const status = page.locator('[role="status"]');
  await expect(status).toHaveText('Photosynthesis — article loaded.');

  await page.locator('.bookmark-btn:visible').click();
  await expect(status).toHaveText('✓ Saved to flashcards');
});

test('exactly one page section renders per route, and every section is x-cloaked in source', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openApp(page, { seed: [seedCard()] });

  // steady state: display:none keeps hidden pages out of the tab order,
  // so the guard is that only the active section is ever rendered
  for (const route of ['#/home', '#/cards', '#/settings', '#/pairing']) {
    await hashTo(page, route);
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('main > section')]
        .filter(s => getComputedStyle(s).display !== 'none').length);
    expect(visible, `${route} must render exactly one section`).toBe(1);
  }

  // pre-hydration: every page section must carry x-cloak in the raw HTML,
  // or its controls are focusable-but-dead until Alpine hydrates (audit H1)
  const html = await (await page.request.get('/')).text();
  const sections = html.match(/<section[^>]*>/g) || [];
  expect(sections.length).toBeGreaterThan(0);
  for (const tag of sections) {
    expect(tag, `${tag} is missing x-cloak`).toContain('x-cloak');
  }
});

test('segmented toggles expose their active state via aria-pressed', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openApp(page, { seed: [seedCard()] });
  await hashTo(page, '#/cards');
  const overview = page.getByRole('button', { name: 'Overview' });
  const flashcards = page.getByRole('button', { name: 'Flashcards' });
  await expect(overview).toHaveAttribute('aria-pressed', 'true');
  await expect(flashcards).toHaveAttribute('aria-pressed', 'false');
  await flashcards.click();
  await expect(flashcards).toHaveAttribute('aria-pressed', 'true');
  await expect(overview).toHaveAttribute('aria-pressed', 'false');
});
