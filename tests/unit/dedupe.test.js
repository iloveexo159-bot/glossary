/* Duplicate-save prevention — PRD §2.1, §7 risk register.
   "Saving checks the canonical Wikipedia title against existing flashcards
   first — if already saved, the bookmark reflects that, never a duplicate." */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

test('findByTitle matches case-insensitively', () => {
  const comp = newComp();
  comp.cards = [{ id: 'c1', title: 'Mitochondrion', highlights: [] }];
  assert.ok(comp.findByTitle('mitochondrion'));
  assert.ok(comp.findByTitle('MITOCHONDRION'));
  assert.equal(comp.findByTitle('Nucleus'), undefined);
});

test('first bookmark save creates exactly one card', () => {
  const comp = newComp();
  comp.result = { title: 'Mitochondrion', extract: 'The powerhouse.', image: null };
  assert.equal(comp.alreadySaved(), false);

  comp.toggleSaveIcon('results');
  assert.equal(comp.cards.length, 1);
  assert.equal(comp.alreadySaved(), true);
  assert.equal(comp.toast, '✓ Saved to flashcards');
});

test('saving an already-saved term never creates a duplicate', () => {
  const comp = newComp();
  comp.result = { title: 'Mitochondrion', extract: 'The powerhouse.', image: null };
  comp.toggleSaveIcon('results');
  comp.closeCardDialog(false);

  // Re-open the same result and hit the bookmark again.
  comp.toggleSaveIcon('results');
  assert.equal(comp.cards.length, 1, 'must reuse the existing card, not duplicate');
  assert.equal(comp.cardDialog.show, true, 'should reopen the note/tags dialog instead');
});

test('duplicate check uses canonical title regardless of query casing', () => {
  const comp = newComp();
  comp.cards = [{ id: 'c1', title: 'Photosynthesis', extract: 'x', highlights: [], note: '', tags: [] }];
  comp.result = { title: 'photosynthesis', extract: 'x', image: null };
  assert.equal(comp.alreadySaved(), true);
  assert.ok(comp.resultCard(), 'resultCard resolves to the existing card');
});
