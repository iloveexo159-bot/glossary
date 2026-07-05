/* Journey: lookup + keep + annotate (PRD §3 "Lookup + keep", "Annotate/enrich").
   Covers bookmark save, the note/tags dialog, duplicate-prevention, and the
   confirm-to-highlight selection path on the Results page. */
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

const cardDialog = (page) => page.locator('.dialog[aria-label="Card note and tags"]');

async function lookup(page, term) {
  await page.fill('#search-home', term);
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toHaveText(term);
}

test('bookmark save creates a card, toasts, and stores the note + tag', async ({ page }) => {
  await openApp(page);
  await lookup(page, 'Photosynthesis');

  await page.locator('.bookmark-btn:visible').click();
  await expect(page.locator('.toast')).toContainText('Saved to flashcards');

  const dlg = cardDialog(page);
  await expect(dlg).toBeVisible();
  await dlg.locator('textarea').fill('key concept');
  await dlg.locator('#card-tags').fill('biology');
  await dlg.locator('#card-tags').press(' ');
  await dlg.getByRole('button', { name: 'SAVE' }).click();

  await page.evaluate(() => { location.hash = '#/cards'; });
  await expect(page.locator('.flashcard .term')).toHaveText('Photosynthesis');
  await expect(page.locator('.flashcard')).toContainText('#biology');
});

test('saving the same term twice never creates a duplicate', async ({ page }) => {
  await openApp(page);
  await lookup(page, 'Photosynthesis');
  await page.locator('.bookmark-btn:visible').click();
  await cardDialog(page).getByRole('button', { name: 'CANCEL' }).click();

  // Bookmark is now filled; clicking again should re-open the editor, not add a card.
  await page.locator('.bookmark-btn:visible').click();
  await expect(cardDialog(page)).toBeVisible();
  await cardDialog(page).getByRole('button', { name: 'CANCEL' }).click();

  await page.evaluate(() => { location.hash = '#/cards'; });
  await expect(page.locator('.flashcard')).toHaveCount(1);
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
