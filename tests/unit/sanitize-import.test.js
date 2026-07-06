/* JSON import sanitization — PRD §7 security ("imported backups are untrusted
   input: rebuilt field-by-field, ids regenerated, image URLs allowlisted").
   This is the highest-severity pure-logic path: it accepts external data. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

test('a valid card is rebuilt with a fresh id', () => {
  const comp = newComp();
  const clean = comp.sanitizeCard({ id: 'attacker-controlled', title: 'Atom', extract: 'x' });
  assert.notEqual(clean.id, 'attacker-controlled', 'id is regenerated, never trusted');
  assert.equal(clean.title, 'Atom');
  assert.equal(clean.drifted, false);
});

test('a non-Wikimedia image URL is rejected (dropped to null)', () => {
  const comp = newComp();
  const evil = comp.sanitizeCard({ title: 'X', image: 'https://evil.example/track.gif' });
  assert.equal(evil.image, null);
  const ok = comp.sanitizeCard({ title: 'X', image: 'https://upload.wikimedia.org/pic.jpg' });
  assert.equal(ok.image, 'https://upload.wikimedia.org/pic.jpg');
});

test('a card with no usable title is rejected entirely', () => {
  const comp = newComp();
  assert.equal(comp.sanitizeCard({ title: '   ' }), null);
  assert.equal(comp.sanitizeCard({}), null);
  assert.equal(comp.sanitizeCard(null), null);
});

test('non-string fields are coerced or dropped, not passed through', () => {
  const comp = newComp();
  const clean = comp.sanitizeCard({
    title: 'X', extract: 12345, note: { evil: true },
    tags: ['ok', 42, '  spaced  ', ''], savedAt: 'not-a-number',
  });
  assert.equal(clean.extract, '', 'non-string extract becomes empty string');
  assert.equal(clean.note, '', 'non-string note becomes empty string');
  assert.deepEqual(Array.from(clean.tags), ['ok', 'spaced'], 'only trimmed string tags survive');
  assert.equal(typeof clean.savedAt, 'number', 'invalid savedAt falls back to a timestamp');
});

test('imported image dimensions survive only as finite numbers', () => {
  const comp = newComp();
  const ok = comp.sanitizeCard({ title: 'X', image: 'https://upload.wikimedia.org/pic.jpg', imageW: 320, imageH: 240 });
  assert.equal(ok.imageW, 320);
  assert.equal(ok.imageH, 240);
  const bad = comp.sanitizeCard({ title: 'X', imageW: '320', imageH: Infinity });
  assert.equal(bad.imageW, null, 'a string width is dropped, not coerced');
  assert.equal(bad.imageH, null, 'a non-finite height is dropped');
});

test('highlights with empty text are dropped; valid ones keep their fields', () => {
  const comp = newComp();
  const clean = comp.sanitizeCard({
    title: 'X',
    highlights: [
      { text: '', note: 'nope' },
      { text: 'keep me', note: 'yes', tags: ['t'], start: 5 },
    ],
  });
  assert.equal(clean.highlights.length, 1);
  assert.equal(clean.highlights[0].text, 'keep me');
  assert.notEqual(clean.highlights[0].id, undefined, 'highlight gets a fresh id');
});
