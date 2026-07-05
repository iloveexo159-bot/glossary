/* Markdown export shape — PRD §2.1 / §5 (YAML frontmatter, embedded image,
   highlights section, CC BY-SA credit). Formatted for Obsidian/Notion. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

const baseCard = (over) => ({
  id: 'c1', title: 'Mitochondrion', extract: 'The powerhouse of the cell.',
  image: 'https://upload.wikimedia.org/x.jpg', savedAt: Date.UTC(2026, 0, 15),
  note: '', tags: [], highlights: [], ...over,
});

test('frontmatter carries title, ISO date, tags and source', () => {
  const comp = newComp();
  const md = comp.buildMarkdown(baseCard({ tags: ['biology', 'sapiens'] }));
  assert.match(md, /^---\n/);
  assert.match(md, /title: "Mitochondrion"/);
  assert.match(md, /saved: 2026-01-15/);
  assert.match(md, /tags: \[biology, sapiens\]/);
  assert.match(md, /source: Wikipedia \(CC BY-SA\)/);
});

test('frontmatter merges card-level and highlight-level tags', () => {
  const comp = newComp();
  const md = comp.buildMarkdown(baseCard({
    tags: ['card-tag'],
    highlights: [{ id: 'h', text: 'cell', note: '', tags: ['hl-tag'] }],
  }));
  assert.match(md, /card-tag/);
  assert.match(md, /hl-tag/, 'highlight tags are hoisted into frontmatter');
});

test('image is embedded with the provided local path when given', () => {
  const comp = newComp();
  const md = comp.buildMarkdown(baseCard(), 'images/Mitochondrion.jpg');
  assert.match(md, /!\[Mitochondrion\]\(images\/Mitochondrion\.jpg\)/);
});

test('image falls back to the remote URL when no local path is given', () => {
  const comp = newComp();
  const md = comp.buildMarkdown(baseCard());
  assert.match(md, /!\[Mitochondrion\]\(https:\/\/upload\.wikimedia\.org\/x\.jpg\)/);
});

test('highlights render as blockquotes with note and tag lines', () => {
  const comp = newComp();
  const md = comp.buildMarkdown(baseCard({
    highlights: [{ id: 'h', text: 'powerhouse', note: 'key idea', tags: ['bio'] }],
  }));
  assert.match(md, /## Highlights/);
  assert.match(md, /> powerhouse/);
  assert.match(md, /key idea/);
  assert.match(md, /#bio/);
});

test('a double-quote in the title is escaped in frontmatter', () => {
  const comp = newComp();
  const md = comp.buildMarkdown(baseCard({ title: 'The "Big" Bang' }));
  assert.match(md, /title: "The \\"Big\\" Bang"/);
});

test('safeFilename strips characters illegal on Windows/macOS', () => {
  const comp = newComp();
  assert.equal(comp.safeFilename('A/B:C*?"<>|D'), 'A-B-C------D.md');
});
