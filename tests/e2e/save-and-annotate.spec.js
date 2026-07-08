/* Journey: lookup + keep + annotate (PRD §3 "Lookup + keep", "Annotate/enrich").
   Covers bookmark save, the note/tags dialog, duplicate-prevention, and the
   confirm-to-highlight selection path on the Results page. */
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

async function lookup(page, term) {
  await page.fill('#search-home', term);
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toHaveText(term);
}

test('bookmark save creates a card, toasts, and the inline editor stores the note + tag', async ({ page }) => {
  await openApp(page);
  await lookup(page, 'Photosynthesis');

  await page.locator('.bookmark-btn:visible').click();
  await expect(page.locator('.toast')).toContainText('Saved to flashcards');

  // Saving is silent now — notes & tags are edited inline below the article.
  const editor = page.locator('.note-editor:visible');
  await expect(editor).toBeVisible();
  await editor.locator('textarea').fill('key concept');
  await editor.locator('#rc-tags').fill('biology');
  await editor.locator('#rc-tags').press(' ');
  await editor.getByRole('button', { name: 'Save notes & tags' }).click();
  await expect(page.locator('.toast')).toContainText('Note & tags saved');

  await page.evaluate(() => { location.hash = '#/cards'; });
  await expect(page.locator('.flashcard .term')).toHaveText('Photosynthesis');
  await expect(page.locator('.flashcard')).toContainText('#biology');
});

test('the bookmark toggles off on a second click and never leaves a duplicate', async ({ page }) => {
  await openApp(page);
  await lookup(page, 'Photosynthesis');

  const bookmark = page.locator('.bookmark-btn:visible');
  await bookmark.click();
  await expect(page.locator('.toast')).toContainText('Saved to flashcards');

  // A second click on the same result unsaves — no dialog, and never a duplicate.
  await bookmark.click();
  await expect(page.locator('.toast')).toContainText('Removed from flashcards');

  await page.evaluate(() => { location.hash = '#/cards'; });
  await expect(page.locator('.flashcard')).toHaveCount(0);
});

test('selecting text on Results offers Highlight & save and stores the highlight', async ({ page }) => {
  await openApp(page);
  await lookup(page, 'Mitochondrion');

  // Programmatically select the word "organelle" and fire the mouseup the app listens for.
  await page.evaluate(() => {
    const ex = document.querySelector('.extract');
    const node = ex.firstChild;
    const i = node.textContent.indexOf('organelle');
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + 'organelle'.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ex.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  const toolbar = page.locator('.sel-toolbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('button').first()).toHaveText('Highlight & save');
  await toolbar.locator('button').first().click();

  await expect(page.locator('.toast')).toContainText('Highlight saved');
  await expect(page.locator('.extract mark.hl')).toContainText('organelle');
  await expect(page.locator('.hl-item blockquote')).toContainText('organelle');
});
