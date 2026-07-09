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

test('both display modes share one order — a card holds its grid position across the toggle', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'a', savedAt: 300, lastReviewedAt: 50 }),
    card({ id: 'b', savedAt: 100, lastReviewedAt: null }),
  ];
  comp.mode = 'overview';
  const overview = Array.from(comp.visibleCards().map((c) => c.id));
  comp.mode = 'flashcards';
  const flashcards = Array.from(comp.visibleCards().map((c) => c.id));
  // newest-saved first in BOTH modes; toggling the view never reshuffles
  assert.deepEqual(overview, ['a', 'b']);
  assert.deepEqual(flashcards, overview);
});

test('startSession orders the deck least-recently-reviewed first, regardless of selection order', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'recent', lastReviewedAt: 1000 }),
    card({ id: 'never', lastReviewedAt: null }),
    card({ id: 'old', lastReviewedAt: 10 }),
  ];
  // selected newest-first (as the grid now presents them); the session still
  // surfaces neglected terms first: never (null→0), then old, then recent.
  comp.startSession(['recent', 'never', 'old']);
  assert.deepEqual(Array.from(comp.session.ids), ['never', 'old', 'recent']);
});

test('tag filter spans both card-level and highlight-level tags', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'cardtag', tags: ['sapiens'] }),
    card({ id: 'hltag', highlights: [{ id: 'h', text: 't', tags: ['sapiens'] }] }),
    card({ id: 'nomatch', tags: ['other'] }),
  ];
  comp.tagFilters = ['sapiens'];
  const ids = Array.from(comp.visibleCards().map((c) => c.id)).sort();
  assert.deepEqual(ids, ['cardtag', 'hltag']);
});

test('multiple selected tags widen the match (OR), and toggleTagFilter round-trips', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'a', tags: ['physics'] }),
    card({ id: 'b', tags: ['biology'] }),
    card({ id: 'c', tags: ['history'] }),
  ];
  comp.toggleTagFilter('physics');
  comp.toggleTagFilter('biology');
  assert.deepEqual(Array.from(comp.visibleCards().map((x) => x.id)).sort(), ['a', 'b']);
  comp.toggleTagFilter('physics'); // toggle off
  assert.deepEqual(Array.from(comp.visibleCards().map((x) => x.id)), ['b']);
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

test('segmented status filters match reviewed / exported timestamps', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'rev', lastReviewedAt: 5 }),
    card({ id: 'exp', lastExportedAt: 9 }),
    card({ id: 'fresh' }),
  ];
  const ids = () => Array.from(comp.visibleCards().map((c) => c.id)).sort();
  comp.reviewedFilter = 'yes';
  assert.deepEqual(ids(), ['rev']);
  comp.reviewedFilter = 'no';
  assert.deepEqual(ids(), ['exp', 'fresh']);
  comp.reviewedFilter = 'all';
  comp.exportedFilter = 'yes';
  assert.deepEqual(ids(), ['exp']);
  comp.exportedFilter = 'no';
  assert.deepEqual(ids(), ['fresh', 'rev']);
});

test('star filter shows only starred cards', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a', starred: true }), card({ id: 'b' })];
  comp.starFilter = true;
  assert.deepEqual(Array.from(comp.visibleCards().map((c) => c.id)), ['a']);
});

test('a review session walks the selected cards, marks them reviewed, and ends on the results screen', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  comp.startSession(['a', 'c']);
  assert.deepEqual(Array.from(comp.session.ids), ['a', 'c']);
  assert.equal(comp.sessionCard().id, 'a');

  comp.sessionFlip(); // reveal = reviewed
  assert.ok(comp.cards.find((c) => c.id === 'a').lastReviewedAt, 'flip stamps lastReviewedAt');
  comp.sessionNext();
  assert.equal(comp.sessionCard().id, 'c');
  assert.equal(comp.session.flipped, false, 'advancing resets the flip');

  comp.sessionNext(); // past the last card → results screen (not an instant exit)
  assert.equal(comp.session.done, true, 'shows the results screen');
  assert.deepEqual(Array.from(comp.session.ids), ['a', 'c'], 'deck retained for Restart/Revise');
});

test('marking a verdict records it, then rides the fling to the next card', async () => {
  const comp = newComp();
  comp._flingMs = 0; // deterministic: fling resolves on the next timer tick
  comp.cards = [card({ id: 'a' }), card({ id: 'b' })];
  comp.startSession(['a', 'b']);
  comp.sessionFlip();
  comp.markVerdict('wrong');
  assert.equal(comp.session.verdicts.a, 'wrong', 'verdict recorded immediately');
  assert.equal(comp.session.idx, 0, 'still on the card while the fling plays');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(comp.session.idx, 1, 'advanced once the fling landed');
  assert.equal(comp.session.flipped, false, 'next card arrives face down');
});

test('marking a verdict on the last card finishes the session', async () => {
  const comp = newComp();
  comp._flingMs = 0;
  comp.cards = [card({ id: 'a' })];
  comp.startSession(['a']);
  comp.sessionFlip();
  comp.markVerdict('correct');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(comp.session.done, true);
  assert.equal(comp.sessionStats().correct, 1);
});

test('verdicts feed the score; advancing without judging is a skip', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  comp.startSession(['a', 'b', 'c']);
  // verdicts assigned directly: markVerdict's fling-advance is async and has
  // its own test above — these tests target the scoring rules only
  comp.session.verdicts.a = 'correct'; comp.sessionNext();
  comp.sessionNext();                                       // b skipped
  comp.session.verdicts.c = 'wrong'; comp.sessionNext();    // last → finishes
  assert.equal(comp.session.done, true);
  // spread into the test realm: the vm sandbox gives app objects a different
  // Object.prototype, which deepStrictEqual rejects across realms
  assert.deepEqual({ ...comp.sessionStats() }, { total: 3, correct: 1, wrong: 1, skipped: 1, passed: false });
});

test('pass rule is a strict majority: correct must exceed wrong + skipped', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  // 2 correct, 1 skipped → 2 > 1 → pass
  comp.startSession(['a', 'b', 'c']);
  comp.session.verdicts.a = 'correct'; comp.sessionNext();
  comp.session.verdicts.b = 'correct'; comp.sessionNext();
  comp.sessionNext(); // skip the last
  assert.equal(comp.sessionStats().passed, true, '2 correct vs 1 skipped passes');

  // 1 correct, 1 wrong, 1 skipped → 1 > 2 is false → fail
  comp.startSession(['a', 'b', 'c']);
  comp.session.verdicts.a = 'correct'; comp.sessionNext();
  comp.session.verdicts.b = 'wrong'; comp.sessionNext();
  comp.sessionNext();
  assert.equal(comp.sessionStats().passed, false, 'skips count against a pass');
});

test('Revise restarts with the wrong AND skipped cards and clears verdicts', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  comp.startSession(['a', 'b', 'c']);
  comp.session.verdicts.a = 'correct'; comp.sessionNext(); // a correct
  comp.sessionNext();                                      // b skipped
  comp.session.verdicts.c = 'wrong'; comp.sessionNext();   // c wrong → finishes
  comp.reviseMissed();
  assert.deepEqual(Array.from(comp.session.ids).sort(), ['b', 'c'], 'wrong + skipped both return');
  assert.equal(comp.session.done, false);
  assert.equal(Object.keys(comp.session.verdicts).length, 0, 'verdicts reset for the new pass');
});

test('Restart replays the whole deck and clears verdicts', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' })];
  comp.startSession(['a', 'b']);
  comp.session.verdicts.a = 'correct'; comp.sessionNext();
  comp.session.verdicts.b = 'wrong'; comp.sessionNext(); // finishes
  comp.restartSession();
  assert.deepEqual(Array.from(comp.session.ids).sort(), ['a', 'b']);
  assert.equal(comp.session.done, false);
  assert.equal(Object.keys(comp.session.verdicts).length, 0);
});

test('shuffleSession keeps the same cards and returns to the first position', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  comp.startSession(['a', 'b', 'c']);
  comp.session.idx = 2; comp.session.flipped = true;
  comp.shuffleSession();
  assert.deepEqual(Array.from(comp.session.ids).sort(), ['a', 'b', 'c']);
  assert.equal(comp.session.idx, 0);
  assert.equal(comp.session.flipped, false);
});

test('selection survives a display-mode toggle in both directions', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' })];
  comp.mode = 'overview';
  comp.toggleSelectMode('review');
  comp.selected = ['a'];

  comp.setMode('flashcards'); // overview → flashcards must NOT drop the pick
  assert.equal(comp.selectMode, true, 'still in selection mode after switching to flashcards');
  assert.deepEqual(Array.from(comp.selected), ['a'], 'selection kept switching to flashcards');

  comp.setMode('overview'); // flashcards → overview stays intact too
  assert.deepEqual(Array.from(comp.selected), ['a'], 'selection kept switching back to overview');
});

test('selectAllVisible picks the filtered set; clearSelection empties it', () => {
  const comp = newComp();
  comp.cards = [
    card({ id: 'a', tags: ['x'] }),
    card({ id: 'b', tags: ['x'] }),
    card({ id: 'c', tags: ['y'] }),
  ];
  comp.tagFilters = ['x'];
  comp.selectAllVisible();
  assert.deepEqual(Array.from(comp.selected).sort(), ['a', 'b']);
  assert.equal(comp.allVisibleSelected(), true);
  comp.clearSelection();
  assert.deepEqual(Array.from(comp.selected), []);
});

test('selection verbs: reviewSelected starts a session, exportSelected opens the sheet', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' })];
  comp.selected = ['a', 'b'];
  comp.reviewSelected();
  assert.deepEqual(Array.from(comp.session.ids), ['a', 'b'], 'review launches the session');
  assert.equal(comp.selectMode, false, 'launching leaves selection mode');

  const comp2 = newComp();
  comp2.cards = [card({ id: 'a' })];
  comp2.exportSelected();
  assert.equal(comp2.exportSheet, false, 'empty selection is a no-op');
  comp2.selected = ['a'];
  comp2.exportSelected();
  assert.equal(comp2.exportSheet, true, 'export opens the export sheet');
});

test('deleteSelected removes the picked cards after confirm, and only then', () => {
  const comp = newComp();
  comp.cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })];
  comp.selectMode = true;
  comp.selected = ['a', 'c'];

  comp._ctx.confirm = () => false; // user backs out — nothing changes
  comp.deleteSelected();
  assert.equal(comp.cards.length, 3, 'declining the confirm keeps every card');
  assert.equal(comp.selectMode, true, 'declining stays in selection mode');

  comp._ctx.confirm = () => true;
  comp.deleteSelected();
  assert.deepEqual(comp.cards.map(c => c.id), ['b'], 'confirmed delete removes exactly the picked cards');
  assert.equal(comp.selectMode, false, 'delete exits selection mode');
  assert.deepEqual(Array.from(comp.selected), [], 'selection is cleared');
});

test('allTags returns a de-duplicated, sorted union of all tags', () => {
  const comp = newComp();
  comp.cards = [
    card({ tags: ['zebra', 'apple'], highlights: [{ id: 'h', text: 't', tags: ['apple', 'mango'] }] }),
  ];
  assert.deepEqual(Array.from(comp.allTags()), ['apple', 'mango', 'zebra']);
});
