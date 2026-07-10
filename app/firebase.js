/* ============================================================
   Glossary — firebase.js  (PRD §8, Phase A)
   Firebase initialization for the build-free app. The modular SDK is loaded
   from Google's CDN, pinned to a fixed version (§7). This module initializes
   the app, Auth (Google provider), and Firestore with offline persistence,
   then exposes them on window.GlossaryFirebase for the (non-module) app.js to
   consume in Phases B/C via the `glossary-firebase-ready` event.

   The web API key is NOT a secret (§8.4) — data security lives entirely in
   firestore.rules, not in hiding this config. Init errors are caught so a
   Firebase hiccup degrades gracefully instead of blanking the app.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signOut,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCVlIMG9MEL8r9N-7fo8vAlHzZZHefdhyc',
  authDomain: 'glossary-9363f.firebaseapp.com',
  projectId: 'glossary-9363f',
  storageBucket: 'glossary-9363f.firebasestorage.app',
  messagingSenderId: '599895869593',
  appId: '1:599895869593:web:229424fbc16752dfe59008',
};

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();
  // Offline persistence (§5): Firestore caches locally and syncs in the
  // background. persistentMultipleTabManager keeps multiple open tabs coherent.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  // Bridge module → global: app.js is a classic script and reads from here.
  window.GlossaryFirebase = {
    app, auth, db, googleProvider,
    onAuthStateChanged, signInWithPopup, signOut,
  };
  window.dispatchEvent(new CustomEvent('glossary-firebase-ready'));
} catch (err) {
  console.error('[Glossary] Firebase init failed:', err);
  window.GlossaryFirebase = null;
  window.dispatchEvent(new CustomEvent('glossary-firebase-error', { detail: err }));
}
