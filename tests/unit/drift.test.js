/* Passive Wikipedia-drift detection — PRD §2.1 ("your saved content never
   changes on its own"). checkDrift only FLAGS; updateSavedCopy is the only
   path that mutates the saved copy, always reader-initiated.
   NOTE: the *live* fetch that would populate `live` is Phase 11 / simulated;
   here we test the comparison logic that is already built. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

test('a changed extract sets the drift flag and stashes the pending update', () => {
  const comp = newComp();
  const c = { title: 'T', extract: 'original', image: null, drifted: false, highlights: [] };
  comp.cards = [c];
  comp.checkDrift(c, { extract: 'edited on wikipedia', image: null });
  assert.equal(c.drifted, true);
  assert.equal(c.pendingUpdate.extract, 'edited on wikipedia');
});

test('an unchanged summary leaves the card un-drifted', () => {
  const comp = newComp();
  const c = { title: 'T', extract: 'same', image: null, drifted: false, highlights: [] };
  comp.cards = [c];
  comp.checkDrift(c, { extract: 'same', image: null });
  assert.equal(c.drifted, false);
  assert.equal(c.pendingUpdate, undefined);
});

test('drift clears itself when live text matches the saved copy again', () => {
  const comp = newComp();
  const c = { title: 'T', extract: 'same', image: null, drifted: true, pendingUpdate: { extract: 'x' }, highlights: [] };
  comp.cards = [c];
  comp.checkDrift(c, { extract: 'same', image: null });
  assert.equal(c.drifted, false);
  assert.equal(c.pendingUpdate, undefined, 'stale pending update is discarded');
});

test('an image-only change also counts as drift', () => {
  const comp = newComp();
  const c = { title: 'T', extract: 'same', image: 'https://upload.wikimedia.org/old.jpg', drifted: false, highlights: [] };
  comp.cards = [c];
  comp.checkDrift(c, { extract: 'same', image: 'https://upload.wikimedia.org/new.jpg' });
  assert.equal(c.drifted, true);
});
