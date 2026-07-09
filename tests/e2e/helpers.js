/* Shared E2E helpers. */
const { mockWiki } = require('./fixtures/wiki');

/* Open the app with Wikipedia mocked and (optionally) seeded flashcards.
   opts.seed  = array of card objects written to localStorage before load
   opts.drift = summary endpoint returns the edited variant (see wiki.js) */
async function openApp(page, opts = {}) {
  await mockWiki(page, opts);
  if (opts.seed) {
    await page.addInitScript((cards) => {
      localStorage.setItem('glossary.cards', JSON.stringify(cards));
    }, opts.seed);
  }
  await page.goto('/');
  await page.waitForSelector('#search-home', { state: 'visible' });
}

/* SPA navigation that works on any viewport (avoids top-bar vs bottom-nav
   visibility differences). Sets the hash the way the app's router expects. */
async function hashTo(page, route) {
  await page.evaluate((r) => { location.hash = r; }, route);
}

/* Minimal valid card matching app.js's shape. */
function seedCard(over = {}) {
  return {
    id: 'c1', title: 'Atom', extract: 'An atom is the basic particle of matter.',
    image: null, revision: '1', savedAt: Date.now(), lastReviewedAt: null,
    note: '', tags: [], highlights: [], drifted: false, ...over,
  };
}

/* The collection filters collapse behind a "Filters" chip on narrow viewports.
   Call before interacting with filter controls — a no-op on desktop, where the
   toggle is hidden and the filters are always open. */
async function openFilters(page) {
  // isVisible() doesn't auto-wait, and this often runs right after a hash
  // navigation — anchor on the toolbar (present on every viewport) so the
  // cards page has actually rendered before we probe the toggle.
  await page.locator('.cards-toolbar .mode-toggle').waitFor({ state: 'visible' });
  const toggle = page.locator('.filters-toggle');
  if (await toggle.isVisible()) await toggle.click();
}

module.exports = { openApp, hashTo, seedCard, openFilters };
