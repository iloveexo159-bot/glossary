/* Recent-searches list + tag entry — the small "recover from an interrupted
   or rushed search" and "stop tag drift" behaviours from PRD §2.1. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

test('pushRecent puts the newest term first', () => {
  const comp = newComp();
  comp.pushRecent('Atom');
  comp.pushRecent('Gravity');
  assert.deepEqual(Array.from(comp.recent), ['Gravity', 'Atom']);
});

test('pushRecent de-duplicates case-insensitively and re-floats the term', () => {
  const comp = newComp();
  comp.pushRecent('Atom');
  comp.pushRecent('Gravity');
  comp.pushRecent('atom'); // same term, different case
  assert.deepEqual(Array.from(comp.recent), ['atom', 'Gravity'], 'no dupe; moves back to front');
});

test('recent list is capped at 8 entries', () => {
  const comp = newComp();
  for (let i = 0; i < 12; i++) comp.pushRecent('term' + i);
  assert.equal(comp.recent.length, 8);
  assert.equal(comp.recent[0], 'term11', 'newest kept');
});

test('clearRecent empties the list', () => {
  const comp = newComp();
  comp.pushRecent('Atom');
  comp.clearRecent();
  assert.deepEqual(Array.from(comp.recent), []);
});

/* Tag entry: space/enter/comma commit; spaces become dashes; dupes ignored. */
function tagEvent(key) {
  return { key, preventDefault() {} };
}

test('a tag commits on space and multi-word tags become dash-joined', () => {
  const comp = newComp();
  comp.noteDialog.tagInput = 'World War';
  // the input model already holds the text; commit key fires
  comp.onTagKeydown(tagEvent(' '), 'note');
  assert.deepEqual(Array.from(comp.noteDialog.tags), ['World-War']);
  assert.equal(comp.noteDialog.tagInput, '', 'input clears after commit');
});

test('a leading # is stripped and duplicate tags are ignored', () => {
  const comp = newComp();
  comp.noteDialog.tags = ['sapiens'];
  comp.noteDialog.tagInput = '#sapiens';
  comp.onTagKeydown(tagEvent('Enter'), 'note');
  assert.deepEqual(Array.from(comp.noteDialog.tags), ['sapiens'], 'no duplicate added');
});

test('backspace on an empty input pops the last tag (inline card editor)', () => {
  const comp = newComp();
  comp.cardEditor.tags = ['a', 'b'];
  comp.cardEditor.tagInput = '';
  comp.onTagKeydown(tagEvent('Backspace'), 'card');
  assert.deepEqual(Array.from(comp.cardEditor.tags), ['a']);
});

/* Recent-tags dropdown (the ▾ on every tag input): fed by prefs.tagRecency,
   which is local-only — the feature adds no Firestore reads or writes. */

test('committing a tag records it at the head of the recency list', () => {
  const comp = newComp();
  comp.prefs.tagRecency = ['old'];
  comp.noteDialog.tagInput = 'fresh';
  comp.onTagKeydown(tagEvent('Enter'), 'note');
  assert.deepEqual(Array.from(comp.prefs.tagRecency), ['fresh', 'old']);
});

test('recordTagUse re-floats a known tag and caps the list at 30', () => {
  const comp = newComp();
  for (let i = 0; i < 32; i++) comp.recordTagUse('t' + i);
  assert.equal(comp.prefs.tagRecency.length, 30, 'capped');
  comp.recordTagUse('t5');
  assert.equal(comp.prefs.tagRecency[0], 't5', 're-floated, not duplicated');
  assert.equal(comp.prefs.tagRecency.filter(t => t === 't5').length, 1);
});

test('recentTags returns the top 5, minus tags already chips in the editor', () => {
  const comp = newComp();
  comp.prefs.tagRecency = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  comp.cardEditor.tags = ['b'];
  assert.deepEqual(Array.from(comp.recentTags('card')), ['a', 'c', 'd', 'e', 'f']);
});

test('with nothing recorded yet, recentTags falls back to tags off the newest cards', () => {
  const comp = newComp();
  comp.prefs.tagRecency = [];
  comp.cards = [
    { id: '1', title: 'Older', savedAt: 100, tags: ['history'], highlights: [{ id: 'h1', text: 'x', tags: ['empire'] }] },
    { id: '2', title: 'Newer', savedAt: 200, tags: ['physics'], highlights: [] },
  ];
  assert.deepEqual(Array.from(comp.recentTags('note')), ['physics', 'history', 'empire'],
    'newest card first; highlight tags count too');
});

test('pickRecentTag adds the chip, floats the tag, and closes the menu', () => {
  const comp = newComp();
  comp.prefs.tagRecency = ['a', 'b'];
  comp.tagMenu = { open: true, target: 'note', id: 'note' };
  comp.pickRecentTag('note', 'b');
  assert.deepEqual(Array.from(comp.noteDialog.tags), ['b']);
  assert.equal(comp.prefs.tagRecency[0], 'b');
  assert.equal(comp.tagMenu.open, false);
});
