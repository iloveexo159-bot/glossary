/* ============================================================
   migration.test.js — first-login local→account card import
   (PRD §8.6, Phase D). Drives the real app code with the fake
   Firestore bridge from cloud-sync.test.js's pattern.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert');
const { newComp } = require('./helpers/load-app');

function fakeFirebase() {
  const writes = { set: [], delete: [], commits: 0, setDocs: [] };
  return {
    writes,
    db: {},
    collection: (db, ...path) => ({ _path: path.join('/') }),
    doc: (colRef, id) => ({ _col: colRef._path, _id: id || 'auto' }),
    setDoc: async (ref, data) => { writes.setDocs.push({ ref, data }); },
    onSnapshot: () => () => {},
    writeBatch: () => ({
      set: (ref, data) => writes.set.push({ id: ref._id, data }),
      delete: (ref) => writes.delete.push(ref._id),
      commit: async () => { writes.commits += 1; },
    }),
  };
}

function cloudComp() {
  const comp = newComp();
  comp._ctx.window.GlossaryFirebase = fakeFirebase();
  comp.authState = 'signedIn';
  comp.user = { uid: 'u1', name: 'T', email: 't@x', photo: '' };
  return comp;
}

function snapOf(docs) {
  return { forEach: (fn) => docs.forEach(d => fn({ data: () => d })) };
}

function card(id, title, extra = {}) {
  return { id, title, extract: 'body', savedAt: 1, tags: [], highlights: [], ...extra };
}

function seedLocalDeck(comp, cards) {
  comp._ctx.localStorage.setItem('glossary.cards', JSON.stringify(cards));
}

test('first snapshot after sign-in offers the local deck once, deduped by title', () => {
  const comp = cloudComp();
  seedLocalDeck(comp, [card('l1', 'Fresh term'), card('l2', 'Cloud term')]);
  comp._pendingImportCheck = true;
  comp.applyCardsSnapshot(snapOf([card('c1', 'Cloud term')]));
  assert.strictEqual(comp.importOffer.show, true);
  assert.strictEqual(comp.importOffer.count, 1); // "Cloud term" already in the account
});

test('no offer when every local card already exists in the account', () => {
  const comp = cloudComp();
  seedLocalDeck(comp, [card('l1', 'Cloud term')]);
  comp._pendingImportCheck = true;
  comp.applyCardsSnapshot(snapOf([card('c1', 'Cloud term')]));
  assert.strictEqual(comp.importOffer.show, false);
  // and the question is considered answered — no ambush on the next snapshot
  comp._pendingImportCheck = true;
  seedLocalDeck(comp, [card('l9', 'Now something new')]);
  comp.applyCardsSnapshot(snapOf([card('c1', 'Cloud term')]));
  assert.strictEqual(comp.importOffer.show, false);
});

test('offer appears at most once per account per device', () => {
  const comp = cloudComp();
  seedLocalDeck(comp, [card('l1', 'Fresh term')]);
  comp._pendingImportCheck = true;
  comp.applyCardsSnapshot(snapOf([]));
  assert.strictEqual(comp.importOffer.show, true);
  comp.skipImport();
  assert.strictEqual(comp.importOffer.show, false);
  comp._pendingImportCheck = true; // e.g. sign out and back in on this device
  comp.applyCardsSnapshot(snapOf([]));
  assert.strictEqual(comp.importOffer.show, false);
});

test('importDeviceCards copies new local cards into the account deck', () => {
  const comp = cloudComp();
  seedLocalDeck(comp, [card('l1', 'Fresh term', { source: 'dictionary', phonetic: '/frɛʃ/' })]);
  comp.applyCardsSnapshot(snapOf([card('c1', 'Cloud term')]));
  comp.importDeviceCards();
  const titles = Array.from(comp.cards, c => c.title).sort();
  assert.deepStrictEqual(titles, ['Cloud term', 'Fresh term']);
  const imported = comp.cards.find(c => c.title === 'Fresh term');
  assert.notStrictEqual(imported.id, 'l1'); // sanitizeCard mints a fresh id
  assert.strictEqual(imported.source, 'dictionary');   // fields survive sanitize
  assert.strictEqual(imported.phonetic, '/frɛʃ/');
  // the signed-out deck in localStorage is untouched
  const local = JSON.parse(comp._ctx.localStorage.getItem('glossary.cards'));
  assert.strictEqual(local.length, 1);
  assert.strictEqual(local[0].id, 'l1');
});

test('settings import with nothing new toasts and changes nothing', () => {
  const comp = cloudComp();
  seedLocalDeck(comp, [card('l1', 'Cloud term')]);
  comp.applyCardsSnapshot(snapOf([card('c1', 'Cloud term')]));
  comp.importDeviceCards();
  assert.strictEqual(comp.cards.length, 1);
  assert.match(comp.toast, /Nothing new to import/);
});

test('sanitizeCard keeps dictionary fields and rejects junk in them', () => {
  const comp = newComp();
  const good = comp.sanitizeCard({ title: 'x', source: 'dictionary', phonetic: '/x/', audio: 'https://a.example/x.mp3', synonyms: ['a', '', 3, 'b'] });
  assert.strictEqual(good.source, 'dictionary');
  assert.strictEqual(good.audio, 'https://a.example/x.mp3');
  assert.deepStrictEqual(Array.from(good.synonyms), ['a', 'b']);
  const bad = comp.sanitizeCard({ title: 'y', source: 'evil', audio: 'javascript:alert(1)', synonyms: 'nope' });
  assert.strictEqual(bad.source, 'wikipedia');
  assert.strictEqual(bad.audio, null);
  assert.deepStrictEqual(Array.from(bad.synonyms), []);
});
