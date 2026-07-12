/* Self-update on resume — mobile QA (2026-07-12): an installed iOS PWA
   resumes from memory when reopened, so the network-first service worker
   never sees a page load and a phone can run stale code for days (one kept
   showing the pre-timeout "Looking up…" forever after the fix had shipped).
   refreshIfStale compares the server's app.js validator against the one
   captured at load and reloads into the fresh copy when it changed. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

/* A comp with a load-time baseline, a stubbed server tag, and a reload spy. */
function primed({ baseline = 'v1', server = 'v1' } = {}) {
  const comp = newComp();
  comp._appTag = baseline;
  comp.fetchAppTag = async () => server;
  comp._reloads = 0;
  comp._ctx.location.reload = () => { comp._reloads++; };
  return comp;
}

test('an unchanged server tag never reloads', async () => {
  const comp = primed();
  await comp.refreshIfStale();
  assert.equal(comp._reloads, 0);
});

test('a changed server tag reloads into the fresh copy', async () => {
  const comp = primed({ server: 'v2' });
  await comp.refreshIfStale();
  assert.equal(comp._reloads, 1);
});

test('a mid-review session is never reloaded away (the deck lives in memory)', async () => {
  const comp = primed({ server: 'v2' });
  comp.page = 'review';
  comp.session.ids = ['a'];
  comp.session.done = false;
  await comp.refreshIfStale();
  assert.equal(comp._reloads, 0);
});

test('an open dialog blocks the reload', async () => {
  const comp = primed({ server: 'v2' });
  comp.deleteDialog.show = true;
  await comp.refreshIfStale();
  assert.equal(comp._reloads, 0);
});

test('probes are throttled to one per minute', async () => {
  const comp = primed({ server: 'v2' });
  let probes = 0;
  const inner = comp.fetchAppTag;
  comp.fetchAppTag = async () => { probes++; return inner(); };
  comp.canReloadNow = () => false; // survive the first probe to reach a second
  await comp.refreshIfStale();
  await comp.refreshIfStale();
  assert.equal(probes, 1);
});

test('no baseline yet (offline at load) adopts the tag instead of reloading', async () => {
  const comp = primed({ baseline: null, server: 'v2' });
  await comp.refreshIfStale();
  assert.equal(comp._reloads, 0);
  assert.equal(comp._appTag, 'v2');
});

test('a failed probe (offline resume) changes nothing', async () => {
  const comp = primed({ server: null });
  await comp.refreshIfStale();
  assert.equal(comp._reloads, 0);
  assert.equal(comp._appTag, 'v1');
});

test('fetchAppTag asks via HEAD with the HTTP cache bypassed', async () => {
  const comp = newComp();
  let seen;
  comp._ctx.fetch = async (url, opts) => {
    seen = { url, opts };
    return { headers: { get: (k) => (k === 'etag' ? '"abc123"' : null) } };
  };
  assert.equal(await comp.fetchAppTag(), '"abc123"');
  assert.equal(seen.url, 'app.js');
  assert.equal(seen.opts.method, 'HEAD');
  assert.equal(seen.opts.cache, 'no-store');
});

test('fetchAppTag falls back to Last-Modified, and to null when neither exists', async () => {
  const comp = newComp();
  comp._ctx.fetch = async () => ({ headers: { get: (k) => (k === 'last-modified' ? 'Sun, 12 Jul 2026' : null) } });
  assert.equal(await comp.fetchAppTag(), 'Sun, 12 Jul 2026');
  comp._ctx.fetch = async () => ({ headers: { get: () => null } });
  assert.equal(await comp.fetchAppTag(), null, 'a validator-less dev server disables the feature');
});
