/* Lookup fetch timeout — mobile QA (2026-07-12): a stalled request left
   "Looking up…" on screen forever in the installed iOS PWA. fetchT aborts
   after _fetchTimeoutMs so resultState always settles into ok/error/offline. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

/* A fetch that never responds — it only rejects when fetchT aborts it. */
function hangingFetch() {
  return (url, opts) => new Promise((resolve, reject) => {
    if (opts && opts.signal) opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    // no signal → genuinely hangs, which would fail the test by timeout
  });
}

test('a lookup whose fetch never responds settles into the error state', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.fetch = hangingFetch();
  await comp.lookup('animosity');
  assert.equal(comp.resultState, 'error'); // navigator.onLine is true in the sandbox
});

test('a timed-out lookup still serves the cached copy when one exists', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.localStorage.setItem('glossary.cache', JSON.stringify({
    animosity: {
      title: 'animosity', extract: 'noun. strong hostility.', image: null,
      source: 'dictionary', phonetic: '', audio: null, synonyms: [], ts: 1,
    },
  }));
  comp._ctx.fetch = hangingFetch();
  await comp.lookup('animosity');
  assert.equal(comp.resultState, 'ok');
  assert.equal(comp.result.title, 'animosity');
});

test('a hung fetch while offline reports the offline state, not a generic error', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.navigator.onLine = false;
  comp._ctx.fetch = hangingFetch();
  await comp.lookup('nonexistentterm');
  assert.equal(comp.resultState, 'offline');
});

test('the dictionary fallback path also settles when its fetches hang', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.fetch = hangingFetch();
  comp.lastQuery = 'sesquipedalian';
  await comp.fetchDictionary('sesquipedalian');
  assert.equal(comp.resultState, 'error');
});
