/* Reverse journeys (undo / cancel / delete) at the logic level — PRD user
   question #3 ("is the reverse experience seamless?").

   Some assertions here are DOCUMENTING CURRENT BEHAVIOUR, including two spots
   where the code diverges from PRD intent. Those are marked GAP: — if you
   later "fix" the app to match the PRD, these tests should be updated to the
   new expectation (that's the point — they'll fail loudly and remind you). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

test('editing the inline note buffer without saving leaves the card untouched', () => {
  const comp = newComp();
  comp.cards = [{ id: 'c1', title: 'T', note: 'original', tags: [], highlights: [] }];
  comp.syncCardEditor(comp.cards[0]);
  comp.cardEditor.note = 'typed but not saved';
  // no saveCardEditor() call — the buffer is never committed (navigating away)
  assert.equal(comp.cards[0].note, 'original', 'edit is discarded until Save is pressed');
});

test('saving the inline editor commits a pending (uncommitted) tag in the input', () => {
  const comp = newComp();
  comp.cards = [{ id: 'c1', title: 'T', note: '', tags: [], highlights: [] }];
  comp.syncCardEditor(comp.cards[0]);
  comp.cardEditor.tagInput = 'sapiens'; // user typed a tag but never pressed space
  comp.saveCardEditor();
  assert.deepEqual(Array.from(comp.cards[0].tags), ['sapiens'], 'unconfirmed tag is not lost on save');
});

test('removeHighlight (inline REMOVE) deletes a single highlight without confirm', () => {
  const comp = newComp();
  comp.cards = [{ id: 'c1', title: 'T', highlights: [
    { id: 'h1', text: 'a', tags: [] }, { id: 'h2', text: 'b', tags: [] },
  ] }];
  comp.removeHighlight('h1');
  assert.deepEqual(Array.from(comp.cards[0].highlights.map((h) => h.id)), ['h2']);
});

test('unsaving a card WITH highlights warns with the exact highlight count', () => {
  const comp = newComp();
  let asked = '';
  comp._ctx.confirm = (msg) => { asked = msg; return true; };
  comp.cards = [{ id: 'c1', title: 'Atom', note: '', tags: [], highlights: [
    { id: 'h1', text: 'a', tags: [] }, { id: 'h2', text: 'b', tags: [] },
  ] }];
  comp.unsaveCard(comp.cards[0]);
  assert.match(asked, /2 highlights will be lost/, 'confirm names how much is at stake');
  assert.equal(comp.cards.length, 0);
});

test('declining the unsave confirm keeps the card intact', () => {
  const comp = newComp();
  comp._ctx.confirm = () => false; // user clicks Cancel in the browser confirm
  comp.cards = [{ id: 'c1', title: 'Atom', note: '', tags: [], highlights: [{ id: 'h1', text: 'a', tags: [] }] }];
  comp.unsaveCard(comp.cards[0]);
  assert.equal(comp.cards.length, 1, 'nothing removed when the reader backs out');
});

test('GAP: the Detail page "DELETE CARD" button uses a generic confirm (no highlight count)', () => {
  // PRD §2.1 says the destructive unsave should confirm "if highlights would
  // be lost". unsaveCard() (the bookmark toggle) honours that with a counted
  // message, but deleteCard() (the DELETE CARD button on Detail) shows a generic
  // prompt that does not tell the reader how many highlights they are about to lose.
  const comp = newComp();
  let asked = '';
  comp._ctx.confirm = (msg) => { asked = msg; return true; };
  comp.page = 'detail';
  comp.cards = [{ id: 'c1', title: 'Atom', highlights: [{ id: 'h1', text: 'a', tags: [] }] }];
  comp.deleteCard('c1');
  // Documents the current (weaker) behaviour. If you unify the two delete paths
  // to both show a count, update this expectation.
  assert.doesNotMatch(asked, /\d+ highlight/, 'currently no count in the Detail delete confirm');
  assert.match(asked, /Delete this flashcard/);
});
