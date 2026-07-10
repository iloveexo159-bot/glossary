/* ============================================================
   Firestore security-rules tests (PRD §8.4)
   Proves the data-isolation model: a signed-in user may touch ONLY
   their own /users/{uid}/** subtree. Runs against the local Firestore
   emulator via `npm run test:rules` (requires a JDK for the emulator).
   ============================================================ */
const { readFileSync } = require('node:fs');
const { test, before, after } = require('node:test');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'glossary-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// A Firestore handle authenticated as the given uid.
const db = (uid) => testEnv.authenticatedContext(uid).firestore();

test('a user can read and write their own card', async () => {
  const alice = db('alice');
  await assertSucceeds(setDoc(doc(alice, 'users/alice/cards/c1'), { title: 'Entropy' }));
  await assertSucceeds(getDoc(doc(alice, 'users/alice/cards/c1')));
});

test('a user can write into their own nested subcollections', async () => {
  const alice = db('alice');
  await assertSucceeds(setDoc(doc(alice, 'users/alice/reviewHistory/s1'), { score: 4 }));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/exports/e1'), { format: 'md' }));
});

test('a user CANNOT read another user\'s card', async () => {
  // Seed Bob's data with rules bypassed, then try to read it as Alice.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/bob/cards/c1'), { title: 'Secret' });
  });
  await assertFails(getDoc(doc(db('alice'), 'users/bob/cards/c1')));
});

test('a user CANNOT write into another user\'s subtree', async () => {
  await assertFails(setDoc(doc(db('alice'), 'users/bob/cards/x'), { title: 'nope' }));
});

test('an unauthenticated client is denied', async () => {
  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'users/alice/cards/c1')));
});

test('an unmatched top-level collection is denied by default', async () => {
  await assertFails(getDoc(doc(db('alice'), 'admin/config')));
});
