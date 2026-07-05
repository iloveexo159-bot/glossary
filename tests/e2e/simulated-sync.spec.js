/* ============================================================
   SIMULATED FEATURES — quarantined on purpose.

   Firebase sync, device pairing, and the live Wikipedia-drift FETCH are not
   built yet (PRD §1 build status; Phases 9–11). The code only *simulates* them
   in localStorage. These tests assert the SIMULATION as it exists today.

   >>> UPGRADE TRIGGER: when you build Phase 9 (Firebase), Phase 10 (pairing),
       or Phase 11 (live drift), rewrite the matching block below against the
       real behaviour. See tests/README.md for the trigger table. <<<
   ============================================================ */
const { test, expect } = require('@playwright/test');
const { openApp, hashTo, seedCard } = require('./helpers');

async function gotoSettings(page) {
  await page.locator('button[aria-label="Settings"]').click();
  await expect(page.locator('.page-title:visible')).toHaveText('Settings');
}

test.describe('SIMULATED — display prefs (real, per-device, never synced)', () => {
  test('theme toggle applies and persists to localStorage', async ({ page }) => {
    await openApp(page);
    await gotoSettings(page);
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('glossary.prefs')).theme);
    expect(stored).toBe('dark');
  });
});

test.describe('SIMULATED — Phase 10 device pairing (localStorage only)', () => {
  test('pairing adds a device to the list; revoke removes it', async ({ page }) => {
    await openApp(page);
    await gotoSettings(page);
    await page.getByRole('button', { name: 'Pair a new device' }).click();
    await expect(page.locator('.page-title:visible')).toHaveText('Device pairing');

    await page.locator('input[aria-label="Pairing code"]').fill('123456');
    await page.getByRole('button', { name: 'Link device' }).click();

    const paired = page.locator('.device-row', { hasText: 'code 123456' });
    await expect(paired).toBeVisible();
    await paired.getByRole('button', { name: 'REVOKE' }).click();
    await expect(page.locator('.device-row', { hasText: 'code 123456' })).toHaveCount(0);
  });

  test('a non-6-digit code is rejected', async ({ page }) => {
    await openApp(page);
    await gotoSettings(page);
    await page.getByRole('button', { name: 'Pair a new device' }).click();
    await page.locator('input[aria-label="Pairing code"]').fill('12');
    await page.getByRole('button', { name: 'Link device' }).click();
    await expect(page.locator('.toast')).toContainText('6-digit code');
  });
});

test.describe('SIMULATED — Phase 11 live drift (comparison logic is real)', () => {
  test('a changed article surfaces the drift badge + update action', async ({ page }) => {
    const seed = [seedCard({ id: 'c1', title: 'Mitochondrion', extract: 'An OLD saved summary.' })];
    await openApp(page, { seed, drift: true });

    await page.fill('#search-home', 'Mitochondrion');
    await page.press('#search-home', 'Enter');
    await expect(page.locator('.badge-drift:visible')).toBeVisible();

    await hashTo(page, '#/card/c1');
    const updateBtn = page.getByRole('button', { name: 'UPDATE SAVED COPY' });
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();
    await expect(page.locator('.toast')).toContainText('updated');
    await expect(page.locator('.badge-drift:visible')).toHaveCount(0);
  });
});
