/* PWA install plumbing — PRD §2.1/§7. The install nudge is Safari-only
   (iOS + macOS), because Safari evicts localStorage after 7 days of non-use;
   Chromium browsers get a captured beforeinstallprompt instead. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macEdge: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

test('installPlatform tells the three install cases apart', () => {
  const comp = newComp();
  assert.equal(comp.installPlatform(UA.iphone, 5), 'ios');
  assert.equal(comp.installPlatform(UA.macSafari, 0), 'mac-safari');
  assert.equal(comp.installPlatform(UA.winChrome, 0), 'other');
});

test('iPadOS masquerading as Macintosh is detected via touch points', () => {
  const comp = newComp();
  // identical UA string — only the touch capability differs
  assert.equal(comp.installPlatform(UA.macSafari, 5), 'ios');
  assert.equal(comp.installPlatform(UA.macSafari, 0), 'mac-safari');
});

test('Chrome and Edge on macOS are NOT mac-safari (their UA contains "Safari/")', () => {
  const comp = newComp();
  assert.equal(comp.installPlatform(UA.macChrome, 0), 'other');
  assert.equal(comp.installPlatform(UA.macEdge, 0), 'other');
});

test('installHint matches the detected platform', () => {
  const comp = newComp();
  comp._ctx.navigator.userAgent = UA.iphone;
  assert.match(comp.installHint(), /Add to Home Screen/);
  comp._ctx.navigator.userAgent = UA.macSafari;
  assert.match(comp.installHint(), /Add to Dock/);
  comp._ctx.navigator.userAgent = UA.winChrome;
  assert.match(comp.installHint(), /address bar/);
});

test('isStandalone is safely false when the APIs are missing (test sandbox = older browsers)', () => {
  const comp = newComp();
  assert.equal(comp.isStandalone(), false);
});

test('dismissing the nudge hides it now and persists the choice for next launch', () => {
  const comp = newComp();
  comp.installNudge = true;
  comp.dismissInstallNudge();
  assert.equal(comp.installNudge, false);
  assert.equal(comp.prefs.installNudgeDismissed, true);
  const stored = JSON.parse(comp._ctx.localStorage.getItem('glossary.prefs'));
  assert.equal(stored.installNudgeDismissed, true);
});

test('promptInstall fires the captured event once and clears it (single-use)', () => {
  const comp = newComp();
  let fired = 0;
  comp.installPrompt = { prompt: () => { fired++; } };
  comp.promptInstall();
  assert.equal(fired, 1);
  assert.equal(comp.installPrompt, null);
  comp.promptInstall(); // no captured event left — must be a no-op, not a crash
  assert.equal(fired, 1);
});
