/* ============================================================
   SIMULATED FEATURES — quarantined on purpose.

   Upgrade log: Phases 9–10 (Firebase sync + device pairing) fired their
   trigger in the multi-user accounts build (PRD §8, Phases A–D): sync is now
   real (per-account Firestore, covered by tests/unit/cloud-sync.test.js and
   tests/rules/isolation.test.js) and pairing was REMOVED — accounts replaced
   it, so its block is gone rather than rewritten. Real cross-device E2E needs
   two authenticated browsers and stays a manual pre-release step (PRD §8.8
   Phase E checklist).

   Still simulated below: the live Wikipedia-drift FETCH (Phase 11) — the
   drift comparison logic is real, the "live" article is a mock.

   >>> UPGRADE TRIGGER: when you build Phase 11 (live drift), rewrite that
       block against the real behaviour. See tests/README.md. <<<
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

test.describe('Sync section (accounts replaced pairing — PRD §8.2)', () => {
  test('signed out, Settings offers sign-in instead of pairing', async ({ page }) => {
    await openApp(page);
    await gotoSettings(page);
    await expect(page.getByText('Local only — flashcards live in this browser')).toBeVisible();
    // scoped: the top-bar account icon is also named "Sign in"
    await page.locator('.settings-group').getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.page-title:visible')).toHaveText('Account');
    // the retired pairing route now falls back to home instead of a dead page
    await hashTo(page, '#/pairing');
    await expect(page.locator('.page-title:visible')).toHaveCount(0); // home has no .page-title
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
