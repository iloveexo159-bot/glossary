/* ============================================================
   account-deletion.test.js — self-serve right-to-erasure flow
   (PRD §8.6, Phase D): purge users/{uid}/** client-side, then
   delete the Auth user, with the requires-recent-login retry.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert');
const { newComp } = require('./helpers/load-app');

function fakeFirebase({ docsPerCol = {}, deleteUserFails = [] } = {}) {
  const log = { deleted: [], commits: 0, deleteUserCalls: 0, reauths: 0 };
  const failures = [...deleteUserFails]; // error codes to throw, in order
  return {
    log,
    db: {},
    auth: { currentUser: { uid: 'u1' } },
    googleProvider: {},
    collection: (db, ...path) => ({ _path: path.join('/'), _name: path[path.length - 1] }),
    doc: (colRef, id) => ({ _col: colRef._path, _id: id || 'auto' }),
    getDocs: async (colRef) => {
      const ids = docsPerCol[colRef._name] || [];
      return { forEach: (fn) => ids.forEach(id => fn({ ref: { _col: colRef._path, _id: id } })) };
    },
    writeBatch: () => {
      const staged = [];
      return {
        set: () => {},
        delete: (ref) => staged.push(ref),
        commit: async () => { log.commits += 1; log.deleted.push(...staged.map(r => r._col + '/' + r._id)); },
      };
    },
    onSnapshot: () => () => {},
    setDoc: async () => {},
    deleteUser: async () => {
      log.deleteUserCalls += 1;
      const code = failures.shift();
      if (code) { const e = new Error(code); e.code = code; throw e; }
    },
    reauthenticateWithPopup: async () => { log.reauths += 1; },
  };
}

function comp(fbOpts) {
  const c = newComp();
  const fb = fakeFirebase(fbOpts);
  c._ctx.window.GlossaryFirebase = fb;
  c.authState = 'signedIn';
  c.user = { uid: 'u1', name: 'T', email: 't@x', photo: '' };
  c.deleteDialog = { show: true, busy: false };
  return { c, fb };
}

test('deleteAccount purges cards, reviewHistory and exports, then the auth user', async () => {
  const { c, fb } = comp({ docsPerCol: { cards: ['a', 'b'], reviewHistory: ['r1'], exports: ['e1'] } });
  await c.deleteAccount();
  assert.strictEqual(fb.log.deleted.length, 4);
  assert.ok(fb.log.deleted.includes('users/u1/cards/a'));
  assert.ok(fb.log.deleted.includes('users/u1/reviewHistory/r1'));
  assert.ok(fb.log.deleted.includes('users/u1/exports/e1'));
  assert.strictEqual(fb.log.deleteUserCalls, 1);
  assert.strictEqual(c.deleteDialog.show, false);
  assert.match(c.toast, /Account deleted/);
});

test('large collections are deleted in chunks under the 500-op batch cap', async () => {
  const many = Array.from({ length: 900 }, (_, i) => 'c' + i);
  const { c, fb } = comp({ docsPerCol: { cards: many } });
  await c.deleteAccount();
  assert.strictEqual(fb.log.deleted.length, 900);
  assert.ok(fb.log.commits >= 3); // 900 cards → 3 chunks of ≤400
});

test('requires-recent-login triggers one reauth popup and a retry', async () => {
  const { c, fb } = comp({ deleteUserFails: ['auth/requires-recent-login'] });
  await c.deleteAccount();
  assert.strictEqual(fb.log.reauths, 1);
  assert.strictEqual(fb.log.deleteUserCalls, 2);
  assert.match(c.toast, /Account deleted/);
});

test('any other failure keeps the user signed in and resets the dialog for retry', async () => {
  const { c, fb } = comp({ deleteUserFails: ['auth/network-request-failed'] });
  await c.deleteAccount();
  assert.strictEqual(fb.log.reauths, 0);
  assert.strictEqual(c.deleteDialog.busy, false);
  assert.match(c.toast, /Deletion didn’t complete/);
});

test('deleteAccount is a no-op when signed out', async () => {
  const c = newComp();
  await c.deleteAccount(); // must not throw with no Firebase at all
  assert.strictEqual(c.deleteDialog.show, false);
});
