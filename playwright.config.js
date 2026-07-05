// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/* E2E config for the Glossary app.
   - Serves the static app via our tiny Node server (no external tooling).
   - Wikipedia is mocked per-test (see tests/e2e/fixtures/wiki.js); the only
     real network dependency is the Alpine/JSZip CDN the app loads itself.
   - Default desktop viewport exercises the top-bar nav + hover controls. */
const PORT = 8322;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    // Touch/mobile parity (PRD §2.3) — select-mode + tap shortcuts differ.
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node tests/e2e/static-server.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
