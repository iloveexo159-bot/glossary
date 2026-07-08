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
