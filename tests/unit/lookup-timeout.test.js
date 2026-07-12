/* Lookup fetch timeout — mobile QA (2026-07-12): a stalled request left
   "Looking up…" on screen forever in the installed iOS PWA. fetchT aborts
   after _fetchTimeoutMs so resultState always settles — into the dedicated
   'timeout' state (with its retry action), never a lying "no article found". */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

/* A fetch that never responds — it only rejects (with the same AbortError
   name a real aborted fetch carries) when fetchT aborts it. */
function hangingFetch() {
  return (url, opts) => new Promise((resolve, reject) => {
    if (opts && opts.signal) opts.signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
    });
    // no signal → genuinely hangs, which would fail the test by timeout
  });
}

test('a lookup whose fetch never responds settles into the timeout state', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.fetch = hangingFetch();
  await comp.lookup('animosity');
  assert.equal(comp.resultState, 'timeout'); // distinct from error: retry is offered
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

test('a hung fetch while offline reports the offline state, not timeout', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.navigator.onLine = false;
  comp._ctx.fetch = hangingFetch();
  await comp.lookup('nonexistentterm');
  assert.equal(comp.resultState, 'offline');
});

test('a non-abort failure still lands on the plain error state', async () => {
  const comp = newComp();
  comp._ctx.fetch = async () => { throw new Error('connection reset'); };
  await comp.lookup('animosity');
  assert.equal(comp.resultState, 'error');
});

test('the dictionary path settles into timeout when BOTH sources hang', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.fetch = hangingFetch();
  comp.lastQuery = 'sesquipedalian';
  await comp.fetchDictionary('sesquipedalian');
  assert.equal(comp.resultState, 'timeout');
});
