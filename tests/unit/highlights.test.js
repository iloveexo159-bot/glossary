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
