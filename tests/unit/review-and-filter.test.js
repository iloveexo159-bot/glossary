/* Review ordering + list filtering — PRD §2.1 ("Review mode orders cards
   least-recently-reviewed first") and the tag/text filters on the cards page. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

const card = (over) => ({
  id: 'x', title: 'T', extract: '', savedAt: 0, lastReviewedAt: null,
  tags: [], highlights: [], ...over,
});

test('computeReviewOrder puts least-recently-reviewed (and never-reviewed) first', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'recent', lastReviewedAt: 1000 }),
    card({ id: 'never', lastReviewedAt: null }),
    card({ id: 'old', lastReviewedAt: 10 }),
  ];
  // null coalesces to 0, so 'never' sorts first, then 'old', then 'recent'.
  assert.deepEqual(Array.from(comp.computeReviewOrder()), ['never', 'old', 'recent']);
});

test('overview mode sorts newest-saved first', () => {
  const comp = newComp();
  comp.mode = 'overview';
  comp.cards = [
    card({ id: 'a', savedAt: 100 }),
    card({ id: 'b', savedAt: 300 }),
    card({ id: 'c', savedAt: 200 }),
  ];
  assert.deepEqual(Array.from(comp.visibleCards().map((c) => c.id)), ['b', 'c', 'a']);
});

test('review mode follows the frozen review order, not save order', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'a', savedAt: 300, lastReviewedAt: 50 }),
    card({ id: 'b', savedAt: 100, lastReviewedAt: null }),
  ];
  comp.mode = 'review';
  comp.reviewOrder = comp.computeReviewOrder(); // ['b','a']
  assert.deepEqual(Array.from(comp.visibleCards().map((c) => c.id)), ['b', 'a']);
});

test('tag filter spans both card-level and highlight-level tags', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'cardtag', tags: ['sapiens'] }),
    card({ id: 'hltag', highlights: [{ id: 'h', text: 't', tags: ['sapiens'] }] }),
    card({ id: 'nomatch', tags: ['other'] }),
  ];
  comp.tagFilter = 'sapiens';
  const ids = Array.from(comp.visibleCards().map((c) => c.id)).sort();
  assert.deepEqual(ids, ['cardtag', 'hltag']);
});

test('text search matches title or extract, case-insensitively', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'a', title: 'Photosynthesis', extract: '' }),
    card({ id: 'b', title: 'Atom', extract: 'about light and energy' }),
    card({ id: 'c', title: 'Gravity', extract: 'mass' }),
  ];
  comp.cardSearch = 'LIGHT';
  assert.deepEqual(Array.from(comp.visibleCards().map((c) => c.id)), ['b']);
});

test('status filter matches reviewed / exported timestamps', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'rev', lastReviewedAt: 5 }),
    card({ id: 'exp', lastExportedAt: 9 }),
    card({ id: 'fresh' }),
  ];
  const ids = () => Array.from(comp.visibleCards().map((c) => c.id)).sort();
  comp.statusFilter = 'reviewed';
  assert.deepEqual(ids(), ['rev']);
  comp.statusFilter = 'unreviewed';
  assert.deepEqual(ids(), ['exp', 'fresh']);
  comp.statusFilter = 'exported';
  assert.deepEqual(ids(), ['exp']);
  comp.statusFilter = 'unexported';
  assert.deepEqual(ids(), ['fresh', 'rev']);
});

test('a review session from a selection sees only the selected cards', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  comp.selected = ['a', 'c'];
  comp.startReviewSelected();
  assert.equal(comp.mode, 'review');
  assert.deepEqual(Array.from(comp.visibleCards().map((c) => c.id)).sort(), ['a', 'c']);
  comp.reviewSelection = []; // REVIEW ALL escape hatch
  assert.equal(comp.visibleCards().length, 3);
});

test('toggleSelectAll selects exactly the filtered set, then clears', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'a', tags: ['x'] }),
    card({ id: 'b', tags: ['x'] }),
    card({ id: 'c', tags: ['y'] }),
  ];
  comp.tagFilter = 'x';
  comp.toggleSelectAll();
  assert.deepEqual(Array.from(comp.selected).sort(), ['a', 'b']);
  assert.equal(comp.allVisibleSelected(), true);
  comp.toggleSelectAll();
  assert.deepEqual(Array.from(comp.selected), []);
});

test('allTags returns a de-duplicated, sorted union of all tags', () => {
  const comp = newComp();
  comp.cards = [
    card({ tags: ['zebra', 'apple'], highlights: [{ id: 'h', text: 't', tags: ['apple', 'mango'] }] }),
  ];
  assert.deepEqual(Array.from(comp.allTags()), ['apple', 'mango', 'zebra']);
});
