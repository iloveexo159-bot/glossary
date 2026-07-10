/* ============================================================
   cloud-sync.test.js — the Phase B Firestore diff-sync engine.

   All pure logic: canonical JSON, the snapshot merge rules, and
   the flush diff. Firebase itself is faked through the same
   window.GlossaryFirebase bridge the app uses, so these tests
   exercise the real app code paths with recorded writes.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert');
const { newComp } = require('./helpers/load-app');

/* A recording fake of the Firestore slice of the bridge. */
function fakeFirebase() {
  const writes = { set: [], delete: [], commits: 0, setDocs: [] };
  return {
    writes,
    db: {},
    collection: (db, ...path) => ({ _path: path.join('/') }),
    doc: (colRef, id) => ({ _col: colRef._path, _id: id || 'auto-' + (writes.setDocs.length + writes.set.length) }),
    setDoc: async (ref, data) => { writes.setDocs.push({ ref, data }); },
    onSnapshot: () => () => {},
    writeBatch: () => ({
      set: (ref, data) => writes.set.push({ id: ref._id, data }),
      delete: (ref) => writes.delete.push(ref._id),
      commit: async () => { writes.commits += 1; },
    }),
  };
}

/* A comp in cloud mode with the fake bridge installed in its sandbox. */
function cloudComp() {
  const comp = newComp();
  const fb = fakeFirebase();
  comp._ctx.window.GlossaryFirebase = fb;
  comp.authState = 'signedIn';
  comp.user = { uid: 'u1', name: 'T', email: 't@x', photo: '' };
  return { comp, fb };
}

function snapOf(docs) {
  return { forEach: (fn) => docs.forEach(d => fn({ data: () => d })) };
}

/* comp.cards lives in the vm realm — its arrays have a foreign Array.prototype
   that fails deepStrictEqual. Array.from here rebuilds ids in the host realm. */
function ids(comp) {
  return Array.from(comp.cards, c => c.id).sort();
}

function card(id, extra = {}) {
  return { id, title: 'T' + id, extract: 'body', savedAt: 1, tags: [], highlights: [], ...extra };
}

test('_stableJson canonicalizes key order and drops undefined', () => {
  const comp = newComp();
  const a = comp._stableJson({ b: 1, a: { d: 2, c: 3 } });
  const b = comp._stableJson({ a: { c: 3, d: 2 }, b: 1 });
  assert.strictEqual(a, b);
  assert.strictEqual(comp._stableJson({ a: 1, gone: undefined }), '{"a":1}');
});

test('snapshot loads the server deck into memory', () => {
  const { comp } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a'), card('b')]));
  assert.deepStrictEqual(ids(comp), ['a', 'b']);
  assert.ok(comp._synced['a'] && comp._synced['b']);
});

test('dirty local edit survives a snapshot arriving mid-debounce', () => {
  const { comp } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a')]));
  comp.cards[0].note = 'local edit not yet flushed';
  comp.applyCardsSnapshot(snapOf([card('a')])); // stale server copy
  assert.strictEqual(comp.cards[0].note, 'local edit not yet flushed');
});

test('locally deleted card is not resurrected by a stale snapshot', () => {
  const { comp } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a'), card('b')]));
  comp.cards = comp.cards.filter(c => c.id !== 'a'); // deleted, flush pending
  comp.applyCardsSnapshot(snapOf([card('a'), card('b')])); // server hasn't seen the delete
  assert.deepStrictEqual(ids(comp), ['b']);
});

test('locally created unacked card survives a snapshot', () => {
  const { comp } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a')]));
  comp.cards.push(card('new1'));
  comp.applyCardsSnapshot(snapOf([card('a')]));
  assert.deepStrictEqual(ids(comp), ['a', 'new1']);
});

test('remote delete of a clean card drops it locally', () => {
  const { comp } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a'), card('b')]));
  comp.applyCardsSnapshot(snapOf([card('b')])); // another device deleted "a"
  assert.deepStrictEqual(ids(comp), ['b']);
  assert.strictEqual(comp._synced['a'], undefined);
});

test('flush writes only dirty docs and deletes removed ones', async () => {
  const { comp, fb } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a'), card('b'), card('c')]));
  comp.cards.find(c => c.id === 'b').starred = true;   // dirty
  comp.cards = comp.cards.filter(c => c.id !== 'c');   // deleted
  await comp.flushCloudSync();
  assert.deepStrictEqual(fb.writes.set.map(w => w.id), ['b']);
  assert.deepStrictEqual(fb.writes.delete, ['c']);
  assert.strictEqual(fb.writes.commits, 1);
});

test('flush with nothing dirty commits nothing', async () => {
  const { comp, fb } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a')]));
  await comp.flushCloudSync(); // e.g. checkDrift found no change
  assert.strictEqual(fb.writes.commits, 0);
});

test('persistCards stays on localStorage when signed out', () => {
  const comp = newComp();
  comp.cards = [card('a')];
  assert.strictEqual(comp.persistCards(), true);
  const stored = JSON.parse(comp._ctx.localStorage.getItem('glossary.cards'));
  assert.strictEqual(stored[0].id, 'a');
});

test('persistCards in cloud mode never touches localStorage', () => {
  const { comp } = cloudComp();
  comp.cards = [card('a')];
  assert.strictEqual(comp.persistCards(), true);
  assert.strictEqual(comp._ctx.localStorage.getItem('glossary.cards'), null);
});

test('finishSession records exactly one review-history doc', () => {
  const { comp, fb } = cloudComp();
  comp.applyCardsSnapshot(snapOf([card('a'), card('b')]));
  comp.session = { ids: ['a', 'b'], idx: 1, flipped: false, done: false, verdicts: { a: 'correct' } };
  comp.finishSession();
  assert.strictEqual(fb.writes.setDocs.length, 1);
  const rec = fb.writes.setDocs[0].data;
  assert.strictEqual(rec.total, 2);
  assert.strictEqual(rec.correct, 1);
  assert.strictEqual(rec.skipped, 1);
  assert.strictEqual(rec.verdicts.a, 'correct');
});

test('review history is not recorded when signed out', () => {
  const comp = newComp();
  comp.session = { ids: ['a'], idx: 0, flipped: false, done: false, verdicts: {} };
  comp.finishSession(); // must not throw with no Firebase at all
  assert.strictEqual(comp.session.done, true);
});
