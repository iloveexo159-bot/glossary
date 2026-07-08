/* Reverse journeys (PRD user question #3: "is the reverse experience
   seamless?"): cancel, escape, clear, and delete-with-confirmation. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

test('Escape closes the suggestions dropdown', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'mit');
  await expect(page.locator('.home-hero .dropdown .row').first()).toBeVisible();
  await page.press('#search-home', 'Escape');
  await expect(page.locator('.home-hero .dropdown')).toBeHidden();
});

test('clearing the search on Results returns to Home', async ({ page }) => {
  await openApp(page);
  await page.fill('#search-home', 'Photosynthesis');
  await page.press('#search-home', 'Enter');
  await expect(page.locator('.page-title:visible')).toHaveText('Photosynthesis');
  await page.locator('.top-bar .icon-clear:visible').click();
  await expect(page.locator('.home-hero')).toBeVisible();
});

test('typing in the inline note editor without saving does not persist across reload', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom' })] });
  await hashTo(page, '#/card/c1');
  await page.locator('.note-editor:visible textarea').fill('temporary — should not stick');
  // no Save pressed → reloading drops the uncommitted buffer; storage stays clean
  await page.reload();
  await expect(page.locator('.note-editor:visible textarea')).toHaveValue('');
});

test('deleting a card asks for confirmation and removes it on accept', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom' })] });
  await hashTo(page, '#/card/c1');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'DELETE CARD' }).click();
  await expect(page).toHaveURL(/#\/cards/);
  await expect(page.locator('.state-box:visible')).toContainText('No flashcards yet');
});

test('declining the delete confirmation keeps the card', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom' })] });
  await hashTo(page, '#/card/c1');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'DELETE CARD' }).click();
  await expect(page.locator('.page-title:visible')).toHaveText('Atom');
});
