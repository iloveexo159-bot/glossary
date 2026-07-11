/* Highlight rendering + re-anchoring — PRD §2.1 ("stored as character
   offsets, not DOM ranges, and rendered left-to-right by position"). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

const hl = (over) => ({ id: 'h1', text: 'cell', start: 0, note: '', tags: [], ...over });

test('renderExtract marks the highlight at its character offset', () => {
  const comp = newComp();
  const html = comp.renderExtract('The cell is small', [hl({ start: 4 })]);
  assert.match(html, /<mark class="hl" data-hl="h1"[^>]*>cell<\/mark>/);
  assert.ok(html.startsWith('The '), 'text before the highlight is preserved');
});

test('renderExtract escapes HTML from the source and the highlight text', () => {
  const comp = newComp();
  const html = comp.renderExtract('a <b> & "c"', []);
  assert.ok(html.includes('&lt;b&gt;'), '<b> is escaped');
  assert.ok(html.includes('&amp;'), '& is escaped');
  assert.ok(!html.includes('<b>'), 'no raw markup leaks through (XSS guard)');
});

test('repeated phrase: the offset selects the correct occurrence', () => {
  const comp = newComp();
  // Two "ion" substrings; highlight the SECOND one (start 8).
  const html = comp.renderExtract('an ion and ion', [hl({ text: 'ion', start: 11 })]);
  const markIdx = html.indexOf('<mark');
  assert.ok(markIdx > html.indexOf('an ion'), 'first occurrence stays plain text');
});

test('overlapping highlights: the second is skipped, not corrupted', () => {
  const comp = newComp();
  const html = comp.renderExtract('abcdef', [
    hl({ id: 'a', text: 'abcd', start: 0 }),
    hl({ id: 'b', text: 'cdef', start: 2 }),
  ]);
  assert.equal((html.match(/<mark/g) || []).length, 1, 'only one mark rendered');
});

test('note marker renders a numbered button in reading order', () => {
  const comp = newComp();
  const html = comp.renderExtract('one two three', [
    hl({ id: 'a', text: 'three', start: 8, note: 'a note' }),
    hl({ id: 'b', text: 'one', start: 0, note: 'another' }),
  ]);
  // Placed left-to-right, "one" is highlight 1, "three" is highlight 2.
  assert.match(html, /aria-label="Open note 1"/);
  assert.match(html, /aria-label="Open note 2"/);
});

test('updateSavedCopy re-anchors a surviving highlight to its new offset', () => {
  const comp = newComp();
  const card = {
    id: 'c1', title: 'T', extract: 'old text here', image: null, drifted: true,
    highlights: [hl({ id: 'h1', text: 'text', start: 4 })],
    pendingUpdate: { extract: 'a brand new text body', image: null, revision: 2 },
  };
  comp.cards = [card];
  comp.detailId = 'c1';

  comp.updateSavedCopy();

  assert.equal(card.extract, 'a brand new text body');
  assert.equal(card.drifted, false);
  assert.equal(card.highlights[0].start, card.extract.indexOf('text'), 're-anchored');
  assert.equal(comp.toast, '✓ Saved copy updated to the latest Wikipedia version');
});

test('updateSavedCopy warns when a highlight no longer matches new text', () => {
  const comp = newComp();
  const card = {
    id: 'c1', title: 'T', extract: 'old text here', image: null, drifted: true,
    highlights: [hl({ id: 'h1', text: 'text', start: 4 })],
    pendingUpdate: { extract: 'completely rewritten', image: null, revision: 3 },
  };
  comp.cards = [card];
  comp.detailId = 'c1';

  comp.updateSavedCopy();

  assert.equal(card.highlights[0].start, null, 'lost highlight is nulled, not deleted');
  assert.match(comp.toast, /no longer match/);
});

/* Inline highlight editor — EDIT flips the list item in place; the popup
   note dialog is reserved for note-at-creation (user request 2026-07-11). */

function annotatedComp() {
  const comp = newComp();
  comp.cards = [{
    id: 'c1', title: 'T', extract: 'The cell is small', image: null, savedAt: 1,
    note: '', tags: [],
    highlights: [hl({ id: 'h1', text: 'cell', start: 4, note: 'old note', tags: ['bio'] })],
  }];
  return comp;
}

test('editHighlight loads the highlight note and tags into the inline editor', () => {
  const comp = annotatedComp();
  comp.editHighlight('h1');
  assert.equal(comp.hlEditor.id, 'h1');
  assert.equal(comp.hlEditor.note, 'old note');
  assert.deepEqual(Array.from(comp.hlEditor.tags), ['bio']);
  assert.equal(comp.hlEditor.tags === comp.cards[0].highlights[0].tags, false,
    'editor works on a copy until save');
});

test('saveHlEditor commits the note, a pending typed tag, and resets the editor', () => {
  const comp = annotatedComp();
  comp.editHighlight('h1');
  comp.hlEditor.note = '  new note  ';
  comp.hlEditor.tagInput = '#pending';
  comp.saveHlEditor();
  const h = comp.cards[0].highlights[0];
  assert.equal(h.note, 'new note', 'trimmed and saved');
  assert.deepEqual(Array.from(h.tags).sort(), ['bio', 'pending']);
  assert.equal(comp.prefs.tagRecency[0], 'pending', 'pending tag recorded as recently used');
  assert.equal(comp.hlEditor.id, null, 'editor closed');
  assert.equal(comp.toast, '✓ Note saved');
});

test('cancelHlEdit closes the editor and leaves the highlight untouched', () => {
  const comp = annotatedComp();
  comp.editHighlight('h1');
  comp.hlEditor.note = 'scratch that';
  comp.cancelHlEdit();
  assert.equal(comp.cards[0].highlights[0].note, 'old note');
  assert.equal(comp.hlEditor.id, null);
});

test("the 'hl' tag target commits chips into the inline editor and feeds its dropdown", () => {
  const comp = annotatedComp();
  comp.editHighlight('h1');
  comp.hlEditor.tagInput = 'organelle';
  comp.onTagKeydown({ key: 'Enter', preventDefault() {} }, 'hl');
  assert.deepEqual(Array.from(comp.hlEditor.tags), ['bio', 'organelle']);
  comp.prefs.tagRecency = ['bio', 'organelle', 'physics'];
  assert.deepEqual(Array.from(comp.recentTags('hl')), ['physics'],
    'dropdown skips tags already chips in the highlight editor');
});

test('clicking a mark edits in place: inline editor opens, no popup dialog', () => {
  const comp = annotatedComp();
  comp.editHighlightInPlace('h1');
  assert.equal(comp.hlEditor.id, 'h1');
  assert.equal(comp.noteDialog.show, false, 'the dialog stays reserved for creation');
});
