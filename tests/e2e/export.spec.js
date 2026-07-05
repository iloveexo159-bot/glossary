/* Journey: curate / export (PRD §3 "Curate/export"). Multi-select → export sheet
   → download. Verifies the download actually fires with a sensible filename. */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

test('select a card, open the export sheet, and download a Markdown file', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom', extract: 'An atom.' })] });
  await hashTo(page, '#/cards');

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.locator('.flashcard').click(); // select it
  await expect(page.locator('.flashcard.selected')).toHaveCount(1);

  const exportBtn = page.getByRole('button', { name: /Export \(1\)/ });
  await expect(exportBtn).toBeVisible();
  await exportBtn.click();

  const dlg = page.locator('.dialog[aria-label="Export flashcards"]');
  await expect(dlg).toContainText('1 flashcard');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/Atom\.(md|zip)/);

  // export stamps the card, so the "Exported" status filter now catches it
  await page.getByRole('button', { name: 'Exported', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(1);
  await page.getByRole('button', { name: 'Not exported', exact: true }).click();
  await expect(page.locator('.flashcard')).toHaveCount(0);
});

test('cancelling selection clears the selected state', async ({ page }) => {
  await openApp(page, { seed: [seedCard({ title: 'Atom' })] });
  await hashTo(page, '#/cards');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.locator('.flashcard').click();
  await expect(page.locator('.flashcard.selected')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.flashcard.selected')).toHaveCount(0);
});
