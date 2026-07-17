/* ============================================================
   Glossary — app.js
   Alpine.js component. Plain JS, no build step (PRD tech stack).
   Storage: localStorage (PRD phase 3 — pre-Firebase).
   APIs: Wikipedia REST summary + Action API opensearch.
   ============================================================ */

const LS = {
  cards: 'glossary.cards',
  recent: 'glossary.recent',
  prefs: 'glossary.prefs',
  cache: 'glossary.cache',
  importOffered: 'glossary.importOffered', // + '.' + uid — one ask per account per device
};

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  // returns whether the write landed — callers surface a warning (and roll back)
  // rather than firing a success toast over a silently-dropped save
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* Wikimedia API etiquette: browsers block a custom User-Agent on fetch,
   but Wikimedia explicitly supports Api-User-Agent for CORS clients. */
const WIKI_HEADERS = { 'Api-User-Agent': 'Glossary/0.1 (personal reading companion; iloveexo159@gmail.com)' };

function glossaryApp() {
  return {
    /* ---------- state ---------- */
    page: 'home',
    // narrow screens: settings + account tuck behind a «/» toggle so the
    // top-bar search gets their width — collapsed (false) by default; the
    // class this drives only applies ≤640px, so desktop never changes
    topChromeOpen: false,
    query: '', lastQuery: '',
    suggestions: [], sugLoading: false, showDropdown: false, activeSug: -1,
    recent: [],
    // resultMode records which lookup path produced the current result —
    // 'wiki' (Wikipedia-first, #/results/…) or 'dict' (definition-first,
    // #/define/…). route() dedupes on it so navigating between the two routes
    // for the same term re-runs the right lookup instead of showing stale state.
    result: null, resultState: 'idle', resultMode: null, candidates: [], expanded: false,
    dictOption: null, // exact-word dictionary hit offered on a disambiguation page
    cards: [], mode: 'overview', cardSearch: '', filtersOpen: false,
    tagFilters: [], reviewedFilter: 'all', exportedFilter: 'all', starFilter: false,
    cardPage: 1, cardPageSize: 12,
    selectMode: false, selected: [], flipped: {},
    // focused review session (#/review) — survives detours to a card's detail page.
    // verdicts maps cardId → 'correct'|'wrong'; a card with no entry was skipped.
    session: { ids: [], idx: 0, flipped: false, done: false, verdicts: {} },
    // tinder-style swipe on the session card: dx tracks the live touch drag,
    // anim drives the fling-out / rise-in CSS classes between cards. The same
    // fling also serves the arrow buttons, keyboard arrows, and verdicts.
    swipe: { dx: 0, dragging: false, anim: '' },
    _swipeStartX: 0, _swipeStartY: 0, _swipeAxis: null, _suppressFlip: false,
    _flingMs: 240, // fling duration; unit tests set 0 for determinism
    _histStack: [], _lastHash: '', _backNav: false,
    detailId: null,
    toolbar: { show: false, x: 0, y: 0, text: '', context: 'results' },
    noteDialog: { show: false, quote: '', text: '', tags: [], tagInput: '', highlightId: null, cardId: null },
    // inline card-level note/tags editor (results + detail) — replaces the old modal.
    // The editor is an ADD/EDIT input that starts empty; a saved note moves to the
    // "Existing notes" list below. `editing` re-opens the editor over a saved note.
    cardEditor: { id: null, note: '', tags: [], tagInput: '', editing: false },
    hlEditor: { id: null, note: '', tags: [], tagInput: '' },
    // recent-tags dropdown on the tag inputs. `id` names which of the three
    // inputs owns the open menu (rc/dc/note) so only one opens at a time;
    // `target` picks the editor object the chosen tag lands in.
    tagMenu: { open: false, target: 'card', id: '' },
    exportSheet: false,
    // tagRecency: most-recently-used tags, newest first (capped). Local-only
    // like every pref — feeding the dropdown costs no Firestore reads/writes.
    prefs: { theme: 'light', brightness: 20, warmth: 0, fontScale: 1, tagRecency: [], installNudgeDismissed: false },
    // PWA install (PRD §2.1/§7): installPrompt holds Chrome/Edge's captured
    // beforeinstallprompt event (null elsewhere — Safari has no equivalent);
    // installNudge shows the one-time Safari home-page nudge, where 7 days of
    // non-use evicts localStorage unless the app is installed.
    installPrompt: null, installNudge: false,
    // auth (PRD §8.2): pending → signedOut ⇄ signedIn. `user` is a minimal
    // snapshot ({uid,name,email,photo}) — never the SDK User object, which
    // Alpine's reactive proxy would wrap and break. authUnavailable = Firebase
    // failed to init (offline first load, CSP block): the app keeps working
    // locally and the login page explains why the button is disabled.
    authState: 'pending', user: null, authUnavailable: false,
    // cloud sync (PRD §8, Phase B): signed in, cards live in Firestore at
    // users/{uid}/cards/{cardId} — one doc per card (§8.5). _synced maps each
    // card id to its last server-known canonical JSON, so persistCards() can
    // diff out only the docs that actually changed; writes debounce into one
    // batch. Signed out, everything stays in localStorage exactly as before.
    syncError: false,
    _unsubCards: null, _synced: {}, _syncTimer: null,
    // first-login migration (PRD §8.6): after sign-in, once the account deck
    // has arrived, offer — once per account per device — to import the cards
    // this browser saved before signing in. Never automatic (shared machines).
    importOffer: { show: false, count: 0 },
    _pendingImportCheck: false,
    // self-serve account deletion (PRD §8.6): dialog explains what's erased;
    // busy guards the confirm button while the purge runs.
    deleteDialog: { show: false, busy: false },
    toast: '', _toastTimer: null, _sugTimer: null, _selChangeTimer: null,
    announce: '', _announceTimer: null,
    // lookup fetch abort window (overridable in tests). 12s is generous for a
    // slow cellular link but guarantees resultState always settles — mobile QA
    // found a stalled dictionaryapi.dev request left "Looking up…" forever.
    _fetchTimeoutMs: 12000,
    // self-update on resume: the server's app.js validator captured at load,
    // and the timestamp of the last freshness probe (throttle)
    _appTag: null, _lastFreshCheck: 0,

    /* ---------- init & routing ---------- */
    init() {
      this.cards = lsGet(LS.cards, []);
      this.recent = lsGet(LS.recent, []);
      this.prefs = Object.assign(this.prefs, lsGet(LS.prefs, {}));
      this.applyPrefs();
      // Offline app shell (PRD §6 phase 8). Registered here, not inline in
      // index.html — the CSP allows no 'unsafe-inline' scripts. Relative path
      // so the scope is right both at localhost root and the /glossary/ subpath.
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
      // An installed iOS app RESUMES from memory when reopened — no page load,
      // so the network-first SW never gets a chance to fetch a new deploy and
      // a phone can run stale code for days (mobile QA, 2026-07-12: eternal
      // "Looking up…" from a copy that predated the lookup timeout). Baseline
      // the server's app.js validator now; re-check whenever the app becomes
      // visible again and reload into the fresh copy when it changed.
      this.fetchAppTag().then((tag) => { this._appTag = tag; });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refreshIfStale();
      });
      // Chromium fires this when the app qualifies for install; capturing it
      // powers the Settings "Install app" button. Safari never fires it — the
      // nudge below covers iOS/macOS Safari, whose 7-day storage eviction is
      // the real stake (PRD §7): it can wipe local cards and the sync identity.
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.installPrompt = e; });
      const plat = this.installPlatform();
      this.installNudge = (plat === 'ios' || plat === 'mac-safari')
        && !this.isStandalone() && !this.prefs.installNudgeDismissed;
      this.initAuth();
      window.addEventListener('hashchange', () => this.route());
      // closing the tab inside the 300ms sync debounce would strand the last
      // edit — hand it to Firestore's offline queue on the way out (best effort)
      window.addEventListener('pagehide', () => this.flushCloudSync());
      // Touch highlight path: a long-press selection never fires mouseup, so
      // watch selectionchange instead — debounced past the handle-dragging so
      // the toolbar appears once the selection settles. Idempotent for mouse
      // users, who already got the toolbar from mouseup.
      document.addEventListener('selectionchange', () => {
        if (this.page !== 'results' && this.page !== 'detail') return;
        clearTimeout(this._selChangeTimer);
        this._selChangeTimer = setTimeout(() => this.onSelectionSettled(), 350);
      });
      this.route();
      this.$nextTick(() => this.focusSearch());
      // any change to the flashcard filters lands you back on page 1 —
      // a stale page index against a shorter filtered list would look empty.
      // The same change re-announces the visible count for screen readers
      // (debounced: typing in the card search must not spam the live region).
      const onFilterChange = () => {
        this.cardPage = 1;
        if (this.page === 'cards' && this.cards.length) this.announceLive(this.footerText(), 500);
      };
      this.$watch('cardSearch', onFilterChange);
      this.$watch('tagFilters', onFilterChange);
      this.$watch('reviewedFilter', onFilterChange);
      this.$watch('exportedFilter', onFilterChange);
      this.$watch('starFilter', onFilterChange);
      this.$watch('mode', () => { this.cardPage = 1; });
      // modal focus management: one watcher set covers every open/close path,
      // including the inline `exportSheet = false` handlers in the HTML
      this.$watch('noteDialog.show', open => this.syncDialogFocus(open));
      this.$watch('exportSheet', open => this.syncDialogFocus(open));
      this.$watch('importOffer.show', open => this.syncDialogFocus(open));
      this.$watch('deleteDialog.show', open => this.syncDialogFocus(open));
      // lookup lifecycle is otherwise silent to assistive tech
      this.$watch('resultState', s => {
        if (s === 'loading') this.announceLive('Looking up…');
        else if (s === 'error') this.announceLive('No article found for "' + this.lastQuery + '".');
        else if (s === 'offline') this.announceLive("You're offline and this term isn't cached yet.");
        else if (s === 'timeout') this.announceLive('The lookup timed out — try again.');
        else if (s === 'disambig') this.announceLive('Several articles match — pick one from the list.');
        else if (s === 'ok') { this.announceLive((this.result ? this.result.title : 'Article') + ' — article loaded.'); this.syncCardEditor(this.resultCard()); }
      });
    },
    route() {
      const h = location.hash || '#/home';
      // back-stack bookkeeping: normal navigation records where we came from;
      // a goBack() navigation consumes the stack instead of growing it
      if (this._lastHash && this._lastHash !== h && !this._backNav) this._histStack.push(this._lastHash);
      this._backNav = false;
      this._lastHash = h;
      const parts = h.slice(2).split('/');
      const p = parts[0] || 'home';
      if (p === 'results' && parts[1]) {
        const term = decodeURIComponent(parts[1]);
        this.page = 'results';
        // route() is the single lookup trigger; (term, mode) dedupes repeat fires
        if (this.lastQuery !== term || this.resultMode !== 'wiki') this.lookup(term);
      } else if (p === 'define' && parts[1]) {
        // definition-first route (Enter on a raw term, the dropdown's Dictionary
        // row): lead with the dictionary, falling back to Wikipedia when the word
        // has no entry — see lookupDictFirst
        const term = decodeURIComponent(parts[1]);
        this.page = 'results';
        if (this.lastQuery !== term || this.resultMode !== 'dict') this.lookupDictFirst(term);
      } else if (p === 'card' && parts[1]) {
        this.page = 'detail';
        this.detailId = parts[1];
        this.markReviewed(parts[1]);
        this.syncCardEditor(this.currentCard());
      } else if (p === 'review') {
        // the session lives in component state, not the URL — a deep link or
        // reload with no session running falls back to the collection page
        if (this.session.ids.length) this.page = 'review';
        else this.nav('cards');
      } else if (['home', 'cards', 'settings', 'login', 'privacy', 'terms'].includes(p)) {
        this.page = p;
        if (p === 'home') this.$nextTick(() => this.focusSearch());
      } else {
        this.page = 'home';
      }
      this.toolbar.show = false;
      this.showDropdown = false;
      // every page switch starts reading from the top — otherwise the next
      // page inherits the previous one's scroll offset (mobile QA gap #3)
      window.scrollTo(0, 0);
      // the search box reflects the *current* results context only — leaving
      // the results page empties it so old terms don't haunt other pages
      if (this.page !== 'results') { this.query = ''; this.suggestions = []; this.activeSug = -1; }
    },
    nav(page, param) {
      location.hash = param ? `#/${page}/${encodeURIComponent(param)}` : `#/${page}`;
    },
    goBack() {
      const prev = this._histStack.pop();
      if (prev) {
        this._backNav = true;
        location.hash = prev;
      } else {
        // no in-app history (e.g. deep link straight to this page) — sensible default
        this.nav(this.page === 'detail' ? 'cards' : 'home');
      }
    },
    closeTransient() {
      this.showDropdown = false;
      // Bug fix: a mouse drag-select ends with a click event that bubbles here —
      // don't hide the selection toolbar while a text selection is still active,
      // or it disappears the same frame it was shown.
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) this.toolbar.show = false;
    },
    onKeydown(e) {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); this.focusSearch(); }
      if (e.key === 'Escape') { this.showDropdown = false; this.toolbar.show = false; }
      // review session: arrows page through the deck, space flips the card
      if (this.page === 'review' && !typing && !this.session.done) {
        if (e.key === 'ArrowRight') this.flingNext();
        if (e.key === 'ArrowLeft') this.flingPrev();
        if (e.key === ' ') { e.preventDefault(); this.sessionFlip(); }
      }
    },
    focusSearch() {
      const el = document.getElementById(this.page === 'home' ? 'search-home' : 'search-top');
      if (el && (this.page === 'home' || this.page === 'results')) el.focus();
    },
    // which pages carry the top-bar search (home uses the centered hero search)
    topSearchVisible() { return this.page === 'results' || this.page === 'cards' || this.page === 'detail'; },

    /* ---------- search & suggestions ---------- */
    onSearchFocus() { this.showDropdown = true; },
    onQueryInput() {
      this.showDropdown = true;
      this.activeSug = -1;
      clearTimeout(this._sugTimer);
      const q = this.query.trim();
      if (!q) { this.suggestions = []; return; }
      this.sugLoading = true;
      this._sugTimer = setTimeout(() => this.fetchSuggestions(q), 250);
    },
    async fetchSuggestions(q) {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&namespace=0&format=json&origin=*`;
        const res = await this.fetchT(url);
        const data = await res.json();
        if (this.query.trim() !== q) return; // stale response
        const wiki = (data[1] || []).map((title, i) => ({ title, description: (data[2] || [])[i] || '', source: 'wikipedia' }));
        this.suggestions = wiki;
        this.probeDictionarySuggestion(q); // async; prepends a Dictionary row when the word has an entry
      } catch { this.suggestions = []; }
      finally { this.sugLoading = false; }
    },
    /* dictionaryapi.dev has no prefix search — only exact lookups — so we probe
       the exact typed word. Whenever it's a real word we surface it as the FIRST
       suggestion, ahead of the Wikipedia rows: looking up what a word MEANS is
       the app's core job, so the definition leads even when Wikipedia also has
       articles that merely contain the term ("vapid" → the adjective first, the
       band member "Dan Vapid" below). */
    async probeDictionarySuggestion(q) {
      if (q.length < 3) return;
      try {
        const entry = await this.dictLookupEntry(q);
        if (!entry) return;
        if (this.query.trim() !== q) return; // a newer keystroke moved on
        const pos = entry.meanings?.[0]?.partOfSpeech || 'definition';
        const row = { title: entry.word, description: pos, source: 'dictionary' };
        // prepend; drop any prior dictionary row and any wiki row that is just the
        // same word (avoids a duplicate x-for key and a redundant second row)
        this.suggestions = [row, ...this.suggestions.filter(s =>
          s.source !== 'dictionary' && s.title.toLowerCase() !== entry.word.toLowerCase())];
      } catch { /* offline or rate-limited — the dropdown simply omits the row */ }
    },
    moveSug(delta) {
      if (!this.suggestions.length) return;
      this.activeSug = (this.activeSug + delta + this.suggestions.length) % this.suggestions.length;
    },
    submitFromInput() {
      if (this.activeSug >= 0 && this.suggestions[this.activeSug]) {
        // a highlighted suggestion is submitted in its own source's mode —
        // a Wikipedia row opens the article, the Dictionary row the definition
        const s = this.suggestions[this.activeSug];
        if (s.source === 'dictionary') this.submitDefine(s.title);
        else this.submitSearch(s.title);
      } else if (this.query.trim()) {
        // raw Enter, no suggestion picked: definition-first. lookupDictFirst
        // falls back to Wikipedia for anything the dictionary doesn't cover, so
        // phrases and proper nouns still resolve.
        this.submitDefine(this.query.trim());
      }
    },
    submitSearch(term) {
      this.showDropdown = false;
      this.query = term;
      const target = '#/results/' + encodeURIComponent(term);
      if (location.hash === target) {
        // same hash: no hashchange will fire — retry failed/offline lookups directly
        if (this.lastQuery !== term || this.resultMode !== 'wiki' || ['error', 'offline'].includes(this.resultState)) this.lookup(term);
        this.page = 'results';
      } else {
        location.hash = target; // route() performs the single lookup
      }
    },
    /* Definition-first sibling of submitSearch — routes to #/define/<term> so the
       choice survives a reload (route() calls lookupDictFirst). Used by Enter on
       a raw term and by the dropdown's Dictionary row. */
    submitDefine(term) {
      this.showDropdown = false;
      this.query = term;
      const target = '#/define/' + encodeURIComponent(term);
      if (location.hash === target) {
        if (this.lastQuery !== term || this.resultMode !== 'dict' || ['error', 'offline'].includes(this.resultState)) this.lookupDictFirst(term);
        this.page = 'results';
      } else {
        location.hash = target; // route() performs the single lookup
      }
    },
    clearSearch() {
      this.query = ''; this.suggestions = [];
      if (this.page === 'results') this.nav('home');
      else this.focusSearch();
    },
    closeSearch() { this.showDropdown = false; },
    pushRecent(term) {
      this.recent = [term, ...this.recent.filter(r => r.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      lsSet(LS.recent, this.recent);
    },
    clearRecent() { this.recent = []; lsSet(LS.recent, this.recent); },

    /* ---------- self-update on resume ---------- */
    /* app.js's validator (ETag / Last-Modified) as the SERVER reports it right
       now. HEAD bypasses the SW (it only intercepts GET) and `no-store` skips
       the HTTP cache, so this really is the deployed version — null when
       offline or when the server sends no validator (local dev). */
    async fetchAppTag() {
      try {
        const res = await fetch('app.js', { method: 'HEAD', cache: 'no-store' });
        return res.headers.get('etag') || res.headers.get('last-modified');
      } catch { return null; }
    },
    async refreshIfStale() {
      if (Date.now() - this._lastFreshCheck < 60000) return; // one probe per minute
      this._lastFreshCheck = Date.now();
      const tag = await this.fetchAppTag();
      if (!tag) return; // offline (or dev server): nothing to learn
      if (!this._appTag) { this._appTag = tag; return; } // load-time probe failed — adopt late
      if (tag === this._appTag || !this.canReloadNow()) return;
      location.reload(); // route() rebuilds the page from the hash
    },
    /* A reload is loss-free except mid-review (the session deck lives only in
       memory), under an open dialog, or while a lookup is in flight. */
    canReloadNow() {
      return !(this.page === 'review' && this.session.ids.length && !this.session.done)
        && !this.noteDialog.show && !this.exportSheet && !this.importOffer.show
        && !this.deleteDialog.show && this.resultState !== 'loading';
    },
    /* Deploy time of the RUNNING copy (index.html's Last-Modified header) —
       the Settings "Build" stamp that answers "which build is this device on?" */
    buildStamp() {
      const d = new Date(document.lastModified);
      return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    },

    /* ---------- lookup ---------- */
    /* fetch that cannot hang a lookup: aborts after `ms` (callers may pass a
       shorter per-call leash, e.g. dictionaryapi.dev) so every lookup settles
       into ok / error / offline / timeout. Falls back to a plain fetch where
       AbortController is missing (very old WebKit). */
    fetchT(url, opts = {}, ms = this._fetchTimeoutMs) {
      if (typeof AbortController !== 'function') return fetch(url, opts);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
    },
    async lookup(term) {
      term = term.trim();
      this.lastQuery = term;
      this.resultMode = 'wiki';
      this.resultState = 'loading';
      this.result = null; this.candidates = []; this.expanded = false; this.dictOption = null;
      const cache = lsGet(LS.cache, {});
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, '_'))}?redirect=true`;
        const res = await this.fetchT(url, { headers: WIKI_HEADERS });
        // Wikipedia has no article — fall through to the dictionary rather than
        // dead-ending. This is the ONLY thing that differs by source: everything
        // downstream (highlight, review, export) treats both the same.
        if (res.status === 404) { await this.fetchDictionary(term); return; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.type === 'disambiguation') {
          // A disambiguation stub is "no useful single article" — the same
          // dead-end the dictionary rescues. Resolve candidates FIRST, then
          // decide: a non-empty list shows the picker (with a dictionary banner
          // alongside, e.g. "ignominy"); an empty list would strand the reader
          // on a heading with nothing under it, so we fall through to the
          // dictionary, which lands on a definition or the real error screen.
          await this.fetchCandidates(term);
          if (this.lastQuery !== term) return; // a newer lookup superseded this one
          if (this.candidates.length) {
            this.resultState = 'disambig';
            this.probeDictionaryOption(term);
          } else {
            await this.fetchDictionary(term);
          }
          return;
        }
        this.result = {
          title: data.title,
          extract: data.extract || '(No summary available for this article.)',
          image: data.thumbnail ? data.thumbnail.source : null,
          // intrinsic dimensions let <img width/height> reserve layout space
          // before the thumbnail loads — no reflow mid-reading
          imageW: data.thumbnail ? data.thumbnail.width || null : null,
          imageH: data.thumbnail ? data.thumbnail.height || null : null,
          revision: data.revision || null,
          source: 'wikipedia',
          // fields the dictionary path also populates — kept present (empty) on
          // Wikipedia results so the card schema is uniform across both sources
          phonetic: '', audio: null, synonyms: [],
        };
        this.resultState = 'ok';
        this.pushRecent(data.title); // only successful lookups, canonical title (QA bug 7)
        this.checkDrift(this.findByTitle(data.title), this.result); // PRD: passive Wikipedia-drift detection
        cache[data.title.toLowerCase()] = { ...this.result, ts: Date.now() };
        cache[term.toLowerCase()] = cache[data.title.toLowerCase()];
        const keys = Object.keys(cache);
        if (keys.length > 60) delete cache[keys[0]];
        lsSet(LS.cache, cache);
      } catch (e) {
        const hit = cache[term.toLowerCase()];
        if (hit) { this.result = hit; this.resultState = 'ok'; this.pushRecent(hit.title); }
        else if (!navigator.onLine) this.resultState = 'offline';
        // fetchT abort: reachable but too slow — its own state, because "no
        // article found" would be a lie and a retry is genuinely worth offering
        else if (e && e.name === 'AbortError') this.resultState = 'timeout';
        else this.resultState = 'error';
      }
    },
    /* Definition-first lookup (Enter on a raw term, the dropdown's Dictionary
       row). Probe the dictionary for the exact word: a real word lands on its
       definition; anything without an entry — multi-word phrases, proper nouns
       like "Dan Vapid" — hands off to the Wikipedia-first lookup so the search
       never dead-ends. The Wikipedia path owns timeout / offline / cache
       handling, so a stalled dictionary defers to it too. */
    async lookupDictFirst(term) {
      term = term.trim();
      this.lastQuery = term;
      this.resultMode = 'dict';
      this.resultState = 'loading';
      this.result = null; this.candidates = []; this.expanded = false; this.dictOption = null;
      let entry;
      try {
        entry = await this.dictLookupEntry(term);
      } catch {
        // dictionary source stalled/aborted — defer to the wiki path (it can
        // still serve a cached copy or settle into timeout/offline)
        if (this.lastQuery === term) { this.resultMode = 'wiki'; return this.lookup(term); }
        return;
      }
      if (this.lastQuery !== term) return; // a newer lookup superseded this one
      if (!entry) { this.resultMode = 'wiki'; return this.lookup(term); }
      return this.fetchDictionary(term, entry); // reuse the resolved entry
    },
    async fetchCandidates(term) {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=8&namespace=0&format=json&origin=*`;
        const res = await this.fetchT(url);
        const data = await res.json();
        this.candidates = (data[1] || [])
          .filter(t => t.toLowerCase() !== term.toLowerCase())
          .map((title, i) => ({ title, description: (data[2] || [])[i] || '' }));
      } catch { this.candidates = []; }
    },
    /* Does the dictionary have this exact word? If so, surface a banner on the
       disambiguation page. Guarded against staleness so a slow probe can't
       attach an option to a page the reader has already navigated past. */
    async probeDictionaryOption(term) {
      try {
        const entry = await this.dictLookupEntry(term);
        if (!entry) return;
        if (this.lastQuery === term && this.resultState === 'disambig') this.dictOption = entry.word;
      } catch { /* no dictionary entry offered — candidates stand on their own */ }
    },
    /* Reader chose the dictionary definition over the disambiguation candidates */
    showDictionaryFor(term) {
      this.dictOption = null;
      // The chosen word IS the query now. It can differ from the typed one in
      // case — iOS autocapitalizes ("Animosity") while the dictionary APIs
      // answer lowercase — and fetchDictionary's supersede guard must not
      // read that as "the reader moved on" (mobile QA round 3: the discarded
      // response left "Looking up…" on screen forever).
      this.lastQuery = term;
      this.resultState = 'loading';
      return this.fetchDictionary(term);
    },
    /* ---------- dictionary fallback (Wikipedia 404) ----------
       Two definition sources tried in order (dictLookupEntry), plus Datamuse
       `ml=` for synonyms, since neither source's own synonym lists cover the
       uncommon words that miss Wikipedia. Definitions and synonyms are fired
       in parallel; a Datamuse failure never blocks a definition. */
    /* 1. dictionaryapi.dev — richest result (IPA, audio) but a free community
          proxy that stalls under load (mobile QA, 2026-07-12), so it gets a
          short leash instead of the full lookup timeout.
       2. Wiktionary's REST definition endpoint — same Wikimedia infra as the
          article lookups, fast and dependable, definitions only (no audio).
       Returns a dictionaryapi-shaped entry, or null = no such word. A miss on
       the primary (404 / non-array payload) also falls through: Wiktionary
       covers more words. Fallback aborts propagate so callers can tell a
       timeout from a miss. */
    async dictLookupEntry(term) {
      try {
        const res = await this.fetchT(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
          {}, Math.min(4000, this._fetchTimeoutMs));
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) return data[0];
        }
      } catch { /* stalled or down — the fallback takes over */ }
      return this.fetchWiktionaryEntry(term);
    },
    async fetchWiktionaryEntry(term) {
      const res = await this.fetchT(
        `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term.toLowerCase())}`,
        { headers: WIKI_HEADERS });
      if (!res.ok) return null;
      const data = await res.json();
      const senses = Array.isArray(data.en) ? data.en : [];
      // definitions arrive as HTML fragments (links, italics) — flatten to the
      // plain text the highlight character-offsets require
      const strip = (h) => String(h).replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      const meanings = senses.map(s => ({
        partOfSpeech: (s.partOfSpeech || '').toLowerCase(),
        definitions: (s.definitions || []).map(d => ({ definition: strip(d.definition || '') })).filter(d => d.definition),
        synonyms: [],
      })).filter(m => m.definitions.length);
      if (!meanings.length) return null;
      return { word: term.toLowerCase(), phonetic: '', phonetics: [], meanings };
    },
    async fetchDictionary(term, prefetchedEntry) {
      const cache = lsGet(LS.cache, {});
      try {
        const [entry, synData] = await Promise.all([
          // lookupDictFirst already resolved the entry — reuse it rather than
          // hitting the dictionary source a second time
          prefetchedEntry !== undefined ? prefetchedEntry : this.dictLookupEntry(term),
          this.fetchT(`https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=8`)
            .then(r => r.ok ? r.json() : []).catch(() => []),
        ]);
        // Staleness first: a newer lookup superseded this one, so return before
        // touching resultState — otherwise a slow/failed response for an
        // abandoned term clobbers the state of the term now on screen.
        // Case-insensitive: "Animosity" (iOS autocapitalize) and "animosity"
        // (what the dictionary APIs return) are the same word, not a move-on.
        if (this.lastQuery.toLowerCase() !== term.toLowerCase()) return;
        if (!entry) { this.resultState = 'error'; return; }
        this.result = this.buildDictionaryResult(entry, synData);
        this.resultState = 'ok';
        this.pushRecent(this.result.title);
        // no checkDrift: dictionary entries have no Wikipedia revision to track
        const key = this.result.title.toLowerCase();
        cache[key] = { ...this.result, ts: Date.now() };
        cache[term.toLowerCase()] = cache[key];
        const keys = Object.keys(cache);
        if (keys.length > 60) delete cache[keys[0]];
        lsSet(LS.cache, cache);
      } catch (e) {
        // abandoned lookup — leave current state alone (case-insensitive, as above)
        if (this.lastQuery.toLowerCase() !== term.toLowerCase()) return;
        const hit = cache[term.toLowerCase()];
        if (hit) { this.result = hit; this.resultState = 'ok'; this.pushRecent(hit.title); }
        else if (!navigator.onLine) this.resultState = 'offline';
        else if (e && e.name === 'AbortError') this.resultState = 'timeout';
        else this.resultState = 'error';
      }
    },
    /* Fuller definition: one line per part of speech (first sense of each),
       joined by newlines and rendered with white-space:pre-line so senses stack
       without any HTML — keeping the extract a plain string the highlight
       offsets can index exactly as they do a Wikipedia paragraph. */
    buildDictionaryResult(entry, synData) {
      const senses = (entry.meanings || []).map(m => {
        const def = m.definitions?.[0]?.definition || '';
        return m.partOfSpeech ? `${m.partOfSpeech}. ${def}` : def;
      }).filter(s => s.trim());
      const ph = entry.phonetics || [];
      // audio is frequently "" even when a phonetics entry exists — take the
      // first non-empty one, and render the play control only when it's present
      const audio = (ph.find(p => p.audio) || {}).audio || null;
      const phonetic = entry.phonetic || (ph.find(p => p.text) || {}).text || '';
      const dictSyns = (entry.meanings || []).flatMap(m => m.synonyms || []);
      const dmSyns = Array.isArray(synData) ? synData.map(r => r.word) : [];
      const synonyms = [...new Set([...dmSyns, ...dictSyns])].slice(0, 8);
      return {
        title: entry.word,
        extract: senses.join('\n') || '(No definition available.)',
        image: null, imageW: null, imageH: null, revision: null,
        source: 'dictionary', phonetic, audio, synonyms,
      };
    },
    playAudio(url) { if (url) { try { new Audio(url).play().catch(() => {}); } catch { /* no-op */ } } },
    sourceLabel(source) { return source === 'dictionary' ? 'Dictionary' : 'Wikipedia'; },
    isLong() { return (this.result?.extract || '').length > 700; },

    /* ---------- flashcards ---------- */
    findByTitle(title) {
      return this.cards.find(c => c.title.toLowerCase() === String(title).toLowerCase());
    },
    alreadySaved() { return this.result && !!this.findByTitle(this.result.title); },
    resultCard() { return this.result ? this.findByTitle(this.result.title) || null : null; },
    createCardFromResult() {
      if (!this.result) return null;
      const card = {
        id: uid(),
        title: this.result.title,
        extract: this.result.extract,
        image: this.result.image,
        imageW: this.result.imageW || null,
        imageH: this.result.imageH || null,
        revision: this.result.revision,
        // source is the only field distinguishing the two kinds of card;
        // pre-Firebase cards without it are treated as 'wikipedia' at read time
        source: this.result.source || 'wikipedia',
        phonetic: this.result.phonetic || '',
        audio: this.result.audio || null,
        synonyms: this.result.synonyms || [],
        savedAt: Date.now(),
        lastReviewedAt: null,
        lastExportedAt: null,
        starred: false,
        note: '',
        tags: [],
        highlights: [],
        drifted: false,
      };
      this.cards.push(card);
      // don't keep a card the store refused — roll back so the icon and the
      // in-memory list stay honest (no phantom that vanishes on reload)
      if (!this.persistCards()) {
        this.cards.pop();
        this.showToast('⚠ Couldn’t save — device storage may be full');
        return null;
      }
      return card;
    },
    /* Bookmark icon: the single save control. Saving is immediate — no dialog.
       Notes & tags are edited inline below the article. Clicking an already-
       saved icon removes the card (guarded when it holds notes/highlights). */
    toggleSaveIcon(context) {
      const card = context === 'results' ? this.resultCard() : this.currentCard();
      if (card) { this.unsaveCard(card); return; }
      if (context === 'results') {
        const made = this.createCardFromResult();
        if (made) {
          this.showToast('✓ Saved to flashcards');
          this.syncCardEditor(made);
          // saving reveals the notes editor below the article — bring it into
          // view so the next step (notes & tags) isn't stranded below the fold
          this.$nextTick(() => {
            const ed = [...document.querySelectorAll('.note-editor')].find(el => el.getClientRects().length);
            if (ed) ed.scrollIntoView({
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              block: 'start',
            });
          });
        }
      }
    },
    unsaveCard(card) {
      const n = (card.highlights || []).length;
      const hasContent = n > 0 || (card.note && card.note.trim()) || (card.tags || []).length;
      if (hasContent && !confirm(`Remove “${card.title}” from flashcards? Your notes and ${n} highlight${n === 1 ? '' : 's'} will be lost.`)) return;
      this.cards = this.cards.filter(c => c.id !== card.id);
      this.persistCards();
      this.syncCardEditor(null);
      this.showToast('Removed from flashcards');
      if (this.page === 'detail') this.nav('cards');
    },
    /* ---------- inline card note & tags editor (results + detail) ----------
       The editor is an ADD/EDIT input: it always points at the active card but
       starts empty. Saving commits the note/tags to the card and clears the
       input, so the note surfaces in the "Existing notes" list below rather than
       lingering in the box. EDIT there loads it back for changes. */
    editorCard() { return this.cards.find(c => c.id === this.cardEditor.id) || null; },
    resetEditor(id) {
      this.cardEditor = { id: id ?? null, note: '', tags: [], tagInput: '', editing: false };
      this.tagMenu.open = false;
    },
    syncCardEditor(card) { this.resetEditor(card ? card.id : null); this.cancelHlEdit(); },
    editCardNote() {
      const c = this.editorCard();
      if (!c) return;
      this.cardEditor.note = c.note || '';
      this.cardEditor.tags = [...(c.tags || [])];
      this.cardEditor.tagInput = '';
      this.cardEditor.editing = true;
    },
    cancelCardNote() { this.resetEditor(this.cardEditor.id); },
    saveCardEditor() {
      const c = this.editorCard();
      if (!c) return;
      const pending = this.cardEditor.tagInput.trim().replace(/^#/, '');
      if (pending && !this.cardEditor.tags.includes(pending)) this.cardEditor.tags.push(pending);
      if (pending) this.recordTagUse(pending);
      c.note = this.cardEditor.note.trim();
      c.tags = [...new Set(this.cardEditor.tags)];
      const ok = this.persistCards();
      this.resetEditor(c.id); // clear the input; the saved note now shows below
      this.showToast(ok ? '✓ Note & tags saved' : '⚠ Couldn’t save — device storage may be full');
    },
    removeCardNote() {
      const c = this.editorCard();
      if (!c) return;
      c.note = ''; c.tags = [];
      this.persistCards();
      this.resetEditor(c.id);
      this.showToast('Note & tags removed');
    },
    /* Single persistence entry point for the deck. Signed out: whole-array
       localStorage write, exactly as pre-Firebase. Signed in: schedule a
       debounced diff-sync — only changed card docs are written (§8.5), so
       callers keep calling this freely after any mutation. Cloud mode always
       returns true: the localStorage-quota rollback paths don't apply, and
       cloud failures surface asynchronously via the sync error toast. */
    persistCards() {
      if (this.cloudMode()) { this.scheduleCloudSync(); return true; }
      return lsSet(LS.cards, this.cards);
    },
    currentCard() { return this.cards.find(c => c.id === this.detailId) || null; },
    cardClick(c) {
      if (this.selectMode) {
        this.selected = this.selected.includes(c.id)
          ? this.selected.filter(id => id !== c.id)
          : [...this.selected, c.id];
      } else {
        this.nav('card', c.id);
      }
    },
    flipGridCard(c, ev) {
      // during selection a tap picks the card instead of flipping it
      if (this.selectMode) { this.cardClick(c); return; }
      this.flipped[c.id] = !this.flipped[c.id];
      if (this.flipped[c.id]) this.markReviewed(c.id);
      // the back face never unmounts, so a scrolled answer would otherwise
      // reopen mid-text on the next reveal — every flip starts it at the top
      const body = ev && ev.currentTarget && ev.currentTarget.querySelector('.back-body');
      if (body) body.scrollTop = 0;
    },
    markReviewed(id) {
      const c = this.cards.find(x => x.id === id);
      if (c) { c.lastReviewedAt = Date.now(); this.persistCards(); }
    },
    /* PRD drift model: the saved copy never changes on its own. On lookup we
       compare the live summary against the frozen copy; a meaningful change
       (extract text differs) sets a passive flag and stashes the live version
       for the reader to pull in manually via updateSavedCopy(). Revision-id
       alone isn't used — an edit elsewhere in the article can bump the revid
       without touching the summary we actually saved. */
    checkDrift(card, live) {
      if (!card || !live || !live.extract) return;
      // dictionary cards have no Wikipedia article to drift against — leave them
      if ((card.source || 'wikipedia') === 'dictionary') return;
      const changed = live.extract !== card.extract || (live.image || null) !== (card.image || null);
      if (changed) {
        card.drifted = true;
        card.pendingUpdate = {
          extract: live.extract, image: live.image || null,
          imageW: live.imageW || null, imageH: live.imageH || null,
          revision: live.revision || null,
        };
      } else if (card.drifted) {
        card.drifted = false; // saved copy now matches live again (e.g. after an update)
        delete card.pendingUpdate;
      }
      this.persistCards();
    },
    updateSavedCopy() {
      const c = this.currentCard();
      if (!c || !c.pendingUpdate) return;
      c.extract = c.pendingUpdate.extract;
      c.image = c.pendingUpdate.image;
      c.imageW = c.pendingUpdate.imageW || null;
      c.imageH = c.pendingUpdate.imageH || null;
      c.revision = c.pendingUpdate.revision;
      c.drifted = false;
      delete c.pendingUpdate;
      // re-anchor highlights to the new text; ones whose text no longer exists
      // keep their data but won't render until re-added
      let lost = 0;
      (c.highlights || []).forEach(h => {
        const idx = c.extract.indexOf(h.text);
        h.start = idx >= 0 ? idx : null;
        if (idx < 0) lost += 1;
      });
      if (!this.persistCards()) { this.showToast('⚠ Couldn’t save — device storage may be full'); return; }
      this.showToast(lost
        ? `✓ Updated — ${lost} highlight${lost === 1 ? '' : 's'} no longer match the new text`
        : '✓ Saved copy updated to the latest Wikipedia version');
    },
    /* Review order is frozen when entering review mode: flipping a card updates
       its reviewed timestamp but the deck doesn't re-sort under the reader —
       the fresh least-recently-reviewed order applies next time review opens. */
    computeReviewOrder() {
      return [...this.cards]
        .sort((a, b) => (a.lastReviewedAt || 0) - (b.lastReviewedAt || 0))
        .map(c => c.id);
    },
    setMode(m) {
      // Switching display mode only resets flip state (which is per-view). An
      // in-progress selection carries across the toggle — a card picked in
      // Overview stays picked in Flashcards and vice versa, now that the
      // flashcard checkbox is itself clickable.
      this.mode = m; this.flipped = {};
    },
    /* One "Select" entry into a neutral selection mode; the selection bar
       offers every verb (Review / Export / Delete) at once, with a visual
       hierarchy instead of intent-scoped buttons — three doors would crowd
       the toolbar and give Delete top-level prominence it shouldn't have. */
    toggleSelectMode() {
      this.selectMode = !this.selectMode;
      this.selected = [];
      // one surface at a time: entering selection folds the filter panel away
      // (the filter icon stays available for a deliberate re-open)
      if (this.selectMode) this.filtersOpen = false;
    },
    /* "Select all" operates on the filtered set (tags + search + status), not the
       whole collection — filter to a topic, select all, review just that topic. */
    selectAllVisible() { this.selected = this.visibleCards().map(c => c.id); },
    clearSelection() { this.selected = []; },
    allVisibleSelected() {
      const vis = this.visibleCards();
      return vis.length > 0 && vis.every(c => this.selected.includes(c.id));
    },
    /* Selection-bar verbs. All three act on the current pick; each no-ops on an
       empty selection (the buttons are also disabled at zero). Delete is the
       only destructive one, so it alone confirms first. */
    reviewSelected() {
      if (this.selected.length) this.startSession(this.selected);
    },
    exportSelected() {
      if (this.selected.length) this.exportSheet = true;
    },
    deleteSelected() {
      const n = this.selected.length;
      if (!n) return;
      if (!confirm(`Delete ${n} flashcard${n === 1 ? '' : 's'}? Their notes and highlights will be lost.`)) return;
      const drop = new Set(this.selected);
      this.cards = this.cards.filter(c => !drop.has(c.id));
      this.persistCards();
      this.selectMode = false;
      this.selected = [];
      this.showToast(`${n} card${n === 1 ? '' : 's'} removed from collection`);
    },
    toggleTagFilter(t) {
      // reassign (never mutate) so the $watch that resets pagination fires
      this.tagFilters = this.tagFilters.includes(t)
        ? this.tagFilters.filter(x => x !== t)
        : [...this.tagFilters, t];
    },
    /* One reset for the "no cards match your filters" empty state — clears every
       narrowing control at once so the full collection reappears. */
    clearCardFilters() {
      this.cardSearch = ''; this.tagFilters = [];
      this.reviewedFilter = 'all'; this.exportedFilter = 'all'; this.starFilter = false;
    },
    /* How many filters are narrowing the collection — shown on the collapsed
       mobile Filters chip so an active filter is never invisible. */
    activeFilterCount() {
      return (this.reviewedFilter !== 'all' ? 1 : 0)
        + (this.exportedFilter !== 'all' ? 1 : 0)
        + (this.starFilter ? 1 : 0)
        + this.tagFilters.length;
    },

    /* ---------- focused review session ---------- */
    startSession(ids) {
      // PRD: a review deck surfaces neglected terms first (least-recently-
      // reviewed), regardless of the order they were selected in or which
      // collection view they came from. computeReviewOrder ranks all cards;
      // we keep just the selected ones, preserving that ranking.
      const want = new Set(ids);
      const valid = this.computeReviewOrder().filter(id => want.has(id));
      if (!valid.length) return;
      this.session = { ids: valid, idx: 0, flipped: false, done: false, verdicts: {} };
      this.selectMode = false; this.selected = [];
      this.nav('review');
    },
    sessionCard() { return this.cards.find(c => c.id === this.session.ids[this.session.idx]) || null; },
    sessionFlip() {
      // the tap that ends a horizontal drag must not also flip the card
      if (this._suppressFlip) { this._suppressFlip = false; return; }
      const c = this.sessionCard();
      if (!c) return;
      this.session.flipped = !this.session.flipped;
      if (this.session.flipped) this.markReviewed(c.id); // revealing the answer counts as a review
      // same reset as flipGridCard: the shared back-body element keeps its
      // scroll offset across flips AND across card advances otherwise
      const body = document.querySelector('.session-card .back-body');
      if (body) body.scrollTop = 0;
    },
    /* ---------- swipe navigation (session card, touch) ----------
       Tinder-style: the card follows the finger (translate + slight rotate),
       snaps back under the 80px threshold, or flings off-screen and advances.
       Horizontal only — a vertical start hands the gesture back to scrolling
       (touch-action: pan-y lets the browser keep vertical pans). */
    swipeStart(e) {
      if (this.session.done || this.swipe.anim) return;
      const t = e.touches[0];
      this._swipeStartX = t.clientX; this._swipeStartY = t.clientY;
      this._swipeAxis = null; this._suppressFlip = false;
      this.swipe.dragging = true; this.swipe.dx = 0;
    },
    swipeMove(e) {
      if (!this.swipe.dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - this._swipeStartX;
      const dy = t.clientY - this._swipeStartY;
      // lock the gesture to one axis on first meaningful movement
      if (!this._swipeAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        this._swipeAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (this._swipeAxis === 'x') this.swipe.dx = dx;
    },
    swipeEnd() {
      if (!this.swipe.dragging) return;
      this.swipe.dragging = false;
      const dx = this.swipe.dx;
      this._suppressFlip = Math.abs(dx) > 10;
      const threshold = 80;
      if (dx < -threshold) this.swipeFling(-1);                            // left → next / finish
      else if (dx > threshold && this.session.idx > 0) this.swipeFling(1); // right → previous
      else this.swipe.dx = 0;                                             // snap back
    },
    /* Fling out (CSS class animates the card off-screen), advance the deck,
       then let the incoming card rise in from a scaled-down start frame.
       Shared by the swipe gesture, the arrow buttons/keys, and verdicts. */
    swipeFling(dir) {
      // one card in flight at a time — but the incoming card's brief rise-in
      // ('in') may be interrupted by the next fling, or rapid ←/→ taps would
      // intermittently swallow clicks
      if (this.swipe.anim && this.swipe.anim !== 'in') return;
      if (dir > 0 && this.session.idx === 0) return; // nothing before the first card
      this.swipe.anim = dir < 0 ? 'out-left' : 'out-right';
      setTimeout(() => {
        if (dir < 0) this.sessionNext(); else this.sessionPrev();
        this.swipe = { dx: 0, dragging: false, anim: 'in' };
        const release = () => { if (this.swipe.anim === 'in') this.swipe.anim = ''; };
        // two frames: the first paints the scaled-down start state, the second
        // removes it so the transition runs to the resting card. rAF is
        // throttled in background tabs, so a timeout guarantees the release —
        // a stuck 'in' frame would otherwise block all further navigation.
        requestAnimationFrame(() => requestAnimationFrame(release));
        setTimeout(release, Math.min(120, this._flingMs || 120));
      }, this._flingMs);
    },
    /* Animated navigation: every way of moving through the deck (buttons,
       ←/→ keys, verdicts, swipes) plays the same fling, so the deck has one
       motion language everywhere — including on desktop. */
    flingNext() { this.swipeFling(-1); },
    flingPrev() { this.swipeFling(1); },
    swipeStyle() {
      if (!this.swipe.dragging || !this.swipe.dx) return '';
      return `transform: translateX(${this.swipe.dx}px) rotate(${(this.swipe.dx * 0.06).toFixed(2)}deg); transition: none;`;
    },
    sessionNext() {
      if (this.session.idx < this.session.ids.length - 1) {
        this.session.idx++; this.session.flipped = false;
      } else {
        this.finishSession();
      }
    },
    sessionPrev() {
      if (this.session.idx > 0) { this.session.idx--; this.session.flipped = false; }
    },
    shuffleSession() {
      const a = [...this.session.ids];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      this.session.ids = a; this.session.idx = 0; this.session.flipped = false;
      this.showToast('Shuffled');
    },
    toggleStar(id) {
      const c = this.cards.find(x => x.id === id);
      if (c) { c.starred = !c.starred; this.persistCards(); }
    },
    /* Right/Wrong record a verdict for the current card, then ride the fling
       animation to the next one (tinder-style — the judged card flies off).
       ← always goes back if second thoughts strike. A card passed with no
       verdict recorded is the "skip". */
    markVerdict(v) {
      if (this.swipe.anim && this.swipe.anim !== 'in') return; // card is mid-flight
      const c = this.sessionCard();
      if (!c) return;
      this.session.verdicts[c.id] = v;
      this.markReviewed(c.id);
      this.swipeFling(-1);
    },
    finishSession() {
      this.session.done = true;
      this.recordReviewHistory();
    },
    sessionStats() {
      const total = this.session.ids.length;
      let correct = 0, wrong = 0;
      this.session.ids.forEach(id => {
        const v = this.session.verdicts[id];
        if (v === 'correct') correct += 1;
        else if (v === 'wrong') wrong += 1;
      });
      const skipped = total - correct - wrong;
      // pass = a strict majority of the whole deck is correct; skips count against you
      return { total, correct, wrong, skipped, passed: correct > wrong + skipped };
    },
    restartSession() { this.startSession(this.session.ids); },
    /* Re-drill everything not marked correct — wrong answers AND cards skipped
       past. Skips are a "not now", so the natural next pass gathers them with
       the misses rather than stranding them. */
    reviseMissed() {
      const missed = this.session.ids.filter(id => this.session.verdicts[id] !== 'correct');
      if (missed.length) this.startSession(missed);
    },
    exitSession() {
      this.session = { ids: [], idx: 0, flipped: false, done: false, verdicts: {} };
      this.nav('cards');
    },

    visibleCards() {
      let list = [...this.cards];
      if (this.tagFilters.length) {
        // multiple tags widen the net (OR); the other filter rows narrow it (AND)
        list = list.filter(c => this.tagFilters.some(t =>
          (c.tags || []).includes(t) ||
          (c.highlights || []).some(h => (h.tags || []).includes(t))));
      }
      if (this.reviewedFilter !== 'all') {
        list = list.filter(c => this.reviewedFilter === 'yes' ? !!c.lastReviewedAt : !c.lastReviewedAt);
      }
      if (this.exportedFilter !== 'all') {
        list = list.filter(c => this.exportedFilter === 'yes' ? !!c.lastExportedAt : !c.lastExportedAt);
      }
      if (this.starFilter) list = list.filter(c => !!c.starred);
      const q = this.cardSearch.trim().toLowerCase();
      if (q) list = list.filter(c => (c.title || '').toLowerCase().includes(q) || (c.extract || '').toLowerCase().includes(q));
      // One order for both display modes — a card sits in the same grid position
      // whether you're in Overview or Flashcards. The least-recently-reviewed
      // ordering that revision needs lives on the review *session* (startSession),
      // not on the browsing grid, so toggling the view never shuffles the cards.
      list.sort((a, b) => b.savedAt - a.savedAt);
      return list;
    },
    cardTags(c) {
      const set = new Set([...(c.tags || [])]);
      (c.highlights || []).forEach(h => (h.tags || []).forEach(t => set.add(t)));
      return [...set];
    },
    allTags() {
      const set = new Set();
      this.cards.forEach(c => this.cardTags(c).forEach(t => set.add(t)));
      return [...set].sort();
    },
    pageCount() {
      return Math.max(1, Math.ceil(this.visibleCards().length / this.cardPageSize));
    },
    pagedCards() {
      // deleting cards or narrowing a filter can strand cardPage past the end —
      // clamp here so the grid never renders an empty page
      const pages = this.pageCount();
      if (this.cardPage > pages) this.cardPage = pages;
      const start = (this.cardPage - 1) * this.cardPageSize;
      return this.visibleCards().slice(start, start + this.cardPageSize);
    },
    setCardPage(p) {
      this.cardPage = Math.min(Math.max(1, p), this.pageCount());
      window.scrollTo(0, 0);
    },
    cardMeta(c) {
      const d = new Date(c.savedAt);
      const saved = 'Saved ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const rev = c.lastReviewedAt
        ? ' · Reviewed ' + new Date(c.lastReviewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : ' · Not reviewed yet';
      return saved + rev;
    },
    savedThisWeek() {
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      return this.cards.filter(c => c.savedAt > weekAgo).length;
    },
    footerText() {
      const v = this.visibleCards().length, t = this.cards.length;
      const base = (v === t)
        ? `${t} card${t === 1 ? '' : 's'}`
        : `${v} of ${t} cards shown`;
      return `${base} · ${this.savedThisWeek()} saved this week`;
    },
    deleteCard(id) {
      if (!confirm('Delete this flashcard and all its highlights?')) return;
      this.cards = this.cards.filter(c => c.id !== id);
      this.persistCards();
      this.showToast('Card deleted');
      this.nav('cards');
    },

    /* ---------- highlight rendering ---------- */
    /* Highlights carry a character offset (h.start) into the source extract.
       Rendering walks the text left→right by position, so repeated phrases
       mark the right occurrence and note markers number in reading order.
       Every interpolated value is escaped — ids included (import path). */
    renderExtract(text, highlights) {
      const t = String(text || '');
      const placed = (highlights || []).map(h => {
        let start = (typeof h.start === 'number') ? h.start : -1;
        if (start < 0 || t.slice(start, start + h.text.length) !== h.text) {
          start = t.indexOf(h.text); // legacy highlights without offsets
        }
        return { h, start };
      }).filter(p => p.start >= 0).sort((a, b) => a.start - b.start);

      let html = '', pos = 0, n = 0;
      for (const { h, start } of placed) {
        if (start < pos) continue; // overlap safety — skip rather than corrupt markup
        n += 1;
        const safeId = escapeHtml(h.id);
        html += escapeHtml(t.slice(pos, start));
        html += `<mark class="hl" data-hl="${safeId}" role="button" tabindex="0" aria-label="Highlight ${n}">${escapeHtml(h.text)}</mark>`;
        if (h.note) html += `<button class="note-marker" data-hl="${safeId}" aria-label="Open note ${n}">${n}</button>`;
        pos = start + h.text.length;
      }
      html += escapeHtml(t.slice(pos));
      return html;
    },
    resultExtractHtml() {
      if (!this.result) return '';
      const existing = this.findByTitle(this.result.title);
      return this.renderExtract(this.result.extract, existing ? existing.highlights : []);
    },
    detailExtractHtml() {
      const c = this.currentCard();
      return c ? this.renderExtract(c.extract, c.highlights) : '';
    },

    /* ---------- selection → highlight ---------- */
    /* Selections are mapped back to character offsets in the SOURCE extract.
       Injected note-marker digits are stripped from both the selected text
       and the offset calculation, so selecting across an existing highlight
       can't capture stray "1"s that would never match the source again. */
    getTextOffset(container, node, nodeOffset) {
      const range = document.createRange();
      range.selectNodeContents(container);
      try { range.setEnd(node, nodeOffset); } catch { return -1; }
      const frag = range.cloneContents();
      frag.querySelectorAll('.note-marker').forEach(el => el.remove());
      return frag.textContent.length;
    },
    cleanSelectionText(range) {
      const frag = range.cloneContents();
      frag.querySelectorAll('.note-marker').forEach(el => el.remove());
      return frag.textContent;
    },
    onTextMouseUp(e, context) {
      // click on an existing highlight/marker edits its note in place, in the list below
      const hlEl = e.target.closest && e.target.closest('[data-hl]');
      if (hlEl) { this.editHighlightInPlace(hlEl.dataset.hl); return; }
      this.showToolbarForSelection(e.currentTarget, context);
    },
    /* Keyboard twin of the mouseup path: rendered marks are role="button" via
       x-html, so no Alpine directive can sit on them — the container catches
       Enter/Space and opens the note the mark promises. */
    onExtractKeydown(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const hlEl = e.target.closest && e.target.closest('[data-hl]');
      if (!hlEl) return;
      e.preventDefault(); // also swallows the native click a real <button> would fire
      this.editHighlightInPlace(hlEl.dataset.hl);
    },
    /* Keyboard path to CREATE a highlight: extending a selection with
       Shift+arrows (caret browsing) surfaces the same toolbar mouseup does. */
    onTextKeyUp(e, context) {
      if (!e.shiftKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      this.showToolbarForSelection(e.currentTarget, context);
    },
    /* Runs ~350ms after the selection stops changing (see init). Finds the
       visible extract that owns the selection and surfaces the same toolbar
       the mouseup path shows — this is the only path for touch long-press. */
    onSelectionSettled() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return; // closeTransient owns hiding
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const container = [...document.querySelectorAll('.extract')]
        .find(el => el.getClientRects().length && el.contains(node));
      if (!container) return;
      this.showToolbarForSelection(container, this.page === 'detail' ? 'detail' : 'results');
    },
    showToolbarForSelection(container, context) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { this.toolbar.show = false; return; }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { this.toolbar.show = false; return; }
      const raw = this.cleanSelectionText(range);
      const text = raw.trim();
      if (text.length < 2) { this.toolbar.show = false; return; }
      let start = this.getTextOffset(container, range.startContainer, range.startOffset);
      if (start >= 0) start += raw.length - raw.trimStart().length; // account for trimmed leading space
      const rect = range.getBoundingClientRect();
      this.toolbar = {
        show: true, context, text, start,
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY - 52,
      };
    },
    confirmHighlight(withNote) {
      const { text, context } = this.toolbar;
      let start = this.toolbar.start;
      this.toolbar.show = false;
      if (!text) return;
      let card;
      if (context === 'results') {
        card = this.resultCard() || this.createCardFromResult();
        if (!card) return;
      } else {
        card = this.currentCard();
        if (!card) return;
      }
      const source = card.extract || '';
      // verify the DOM-derived offset against the source; fall back to first match
      if (typeof start !== 'number' || source.slice(start, start + text.length) !== text) {
        start = source.indexOf(text);
      }
      if (start < 0) { this.showToast("Couldn't match that selection — try again"); return; }
      const end = start + text.length;
      const overlaps = (card.highlights || []).some(h => {
        const hs = (typeof h.start === 'number') ? h.start : source.indexOf(h.text);
        return hs >= 0 && hs < end && start < hs + h.text.length;
      });
      if (overlaps) {
        this.showToast('That overlaps an existing highlight');
        window.getSelection()?.removeAllRanges();
        return;
      }
      const h = { id: uid(), text, start, note: '', tags: [], createdAt: Date.now() };
      card.highlights.push(h);
      if (!this.persistCards()) {
        card.highlights.pop(); // don't leave a highlight the store dropped
        this.showToast('⚠ Couldn’t save — device storage may be full');
        window.getSelection()?.removeAllRanges();
        return;
      }
      if (withNote) {
        this.openNoteDialog(h.id);
      } else {
        this.showToast('✓ Highlight saved');
      }
      window.getSelection()?.removeAllRanges();
    },
    findHighlight(hlId) {
      for (const c of this.cards) {
        const h = (c.highlights || []).find(x => x.id === hlId);
        if (h) return { card: c, h };
      }
      return null;
    },

    /* ---------- modal focus management ---------- */
    /* aria-modal alone doesn't contain keyboard focus. While any dialog is
       open the page behind it is inert, Tab wraps inside the dialog (trapTab),
       and closing restores focus to the control that opened it — unless that
       control is gone/hidden (e.g. the selection toolbar), in which case focus
       is left alone rather than thrown to the top of the document. */
    _dialogOpener: null,
    focusables(root) {
      return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.getClientRects().length);
    },
    trapTab(e) {
      const list = this.focusables(e.currentTarget);
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
    syncDialogFocus(open) {
      const behind = ['.top-bar', 'main', '.nav-bottom']
        .map(s => document.querySelector(s)).filter(Boolean);
      if (open) {
        this._dialogOpener = document.activeElement;
        behind.forEach(el => { el.inert = true; });
        // the open* helpers focus their textarea; this only steps in for
        // dialogs with no autofocus of their own (the export sheet)
        this.$nextTick(() => {
          const dlg = [...document.querySelectorAll('.dialog')].find(d => d.getClientRects().length);
          if (dlg && !dlg.contains(document.activeElement)) {
            const first = this.focusables(dlg)[0];
            if (first) first.focus();
          }
        });
      } else {
        behind.forEach(el => { el.inert = false; });
        const opener = this._dialogOpener;
        this._dialogOpener = null;
        if (opener && opener.isConnected && opener.getClientRects().length) opener.focus();
      }
    },

    /* ---------- note dialog (creation only) ----------
       The popup appears only when a note is first created ("Note" on the
       selection toolbar). Editing an existing highlight note happens in
       place inside its list item — see the inline highlight editor below. */
    openNoteDialog(hlId) {
      const found = this.findHighlight(hlId);
      if (!found) return;
      this.noteDialog = {
        show: true, quote: found.h.text, text: found.h.note || '',
        tags: [...(found.h.tags || [])], tagInput: '',
        highlightId: hlId, cardId: found.card.id,
      };
      this.tagMenu.open = false; // never inherit a menu left open elsewhere
      this.$nextTick(() => this.$refs.noteText && this.$refs.noteText.focus());
    },
    closeNoteDialog(save) {
      if (save) {
        const found = this.findHighlight(this.noteDialog.highlightId);
        if (found) {
          // commit any tag still sitting in the input
          const pending = this.noteDialog.tagInput.trim().replace(/^#/, '');
          if (pending) this.noteDialog.tags.push(pending);
          if (pending) this.recordTagUse(pending);
          found.h.note = this.noteDialog.text.trim();
          found.h.tags = [...new Set(this.noteDialog.tags)];
          this.showToast(this.persistCards() ? '✓ Note saved' : '⚠ Couldn’t save — device storage may be full');
        }
      }
      this.noteDialog.show = false;
      this.tagMenu.open = false;
    },
    deleteFromDialog() {
      const found = this.findHighlight(this.noteDialog.highlightId);
      if (found) {
        found.card.highlights = found.card.highlights.filter(h => h.id !== this.noteDialog.highlightId);
        this.persistCards();
        this.showToast('Highlight removed');
      }
      this.noteDialog.show = false;
    },
    removeHighlight(hlId) {
      const found = this.findHighlight(hlId);
      if (!found) return;
      found.card.highlights = found.card.highlights.filter(h => h.id !== hlId);
      this.persistCards();
    },

    /* ---------- inline highlight editor ----------
       EDIT on a highlight item flips that item into an editor, exactly like
       the card-note item; only one highlight edits at a time (hlEditor.id). */
    editHighlight(hlId) {
      const found = this.findHighlight(hlId);
      if (!found) return;
      this.hlEditor = { id: hlId, note: found.h.note || '', tags: [...(found.h.tags || [])], tagInput: '' };
      this.tagMenu.open = false;
    },
    cancelHlEdit() {
      this.hlEditor = { id: null, note: '', tags: [], tagInput: '' };
      this.tagMenu.open = false;
    },
    saveHlEditor() {
      const found = this.findHighlight(this.hlEditor.id);
      if (!found) return;
      // commit any tag still sitting in the input
      const pending = this.hlEditor.tagInput.trim().replace(/^#/, '');
      if (pending && !this.hlEditor.tags.includes(pending)) this.hlEditor.tags.push(pending);
      if (pending) this.recordTagUse(pending);
      found.h.note = this.hlEditor.note.trim();
      found.h.tags = [...new Set(this.hlEditor.tags)];
      const ok = this.persistCards();
      this.cancelHlEdit();
      this.showToast(ok ? '✓ Note saved' : '⚠ Couldn’t save — device storage may be full');
    },
    /* Clicking a mark in the text (or Enter/Space on it) edits that highlight
       in place: open its item's editor, bring it into view, focus the note. */
    editHighlightInPlace(hlId) {
      this.editHighlight(hlId);
      this.$nextTick(() => {
        const el = [...document.querySelectorAll('[data-hl-item="' + hlId + '"]')]
          .find(x => x.getClientRects().length);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ta = el.querySelector('textarea');
        if (ta) ta.focus({ preventScroll: true });
      });
    },

    /* ---------- tags ---------- */
    /* One helper maps a tag-input target to its editor state: the note-creation
       dialog ('note'), the inline highlight editor ('hl'), or the card editor. */
    tagTarget(target) {
      if (target === 'note') return this.noteDialog;
      if (target === 'hl') return this.hlEditor;
      return this.cardEditor;
    },
    onTagKeydown(e, target) {
      const dlg = this.tagTarget(target);
      const isCommit = e.key === ' ' || e.key === 'Enter' || e.key === ',';
      if (isCommit) {
        e.preventDefault();
        const tag = dlg.tagInput.trim().replace(/^#/, '').replace(/\s+/g, '-');
        if (!tag) return;
        if (!dlg.tags.includes(tag)) dlg.tags.push(tag);
        this.recordTagUse(tag);
        dlg.tagInput = '';
      } else if (e.key === 'Backspace' && dlg.tagInput === '') {
        dlg.tags.pop();
      }
    },
    /* Recency is recorded at commit time (chip created), not on save, so the
       list mirrors what the user actually typed or picked most recently. */
    recordTagUse(tag) {
      const list = (this.prefs.tagRecency || []).filter(t => t !== tag);
      list.unshift(tag);
      this.prefs.tagRecency = list.slice(0, 30);
      this.persistPrefs();
    },
    /* Top 5 latest tags for the dropdown, minus ones already chips in the
       active editor. First run (nothing recorded yet) falls back to tags off
       the newest-saved cards so the menu is never pointlessly empty. */
    recentTags(target) {
      const dlg = this.tagTarget(target);
      let pool = this.prefs.tagRecency || [];
      if (!pool.length) {
        pool = [];
        [...this.cards].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
          .forEach(c => this.cardTags(c).forEach(t => { if (!pool.includes(t)) pool.push(t); }));
      }
      return pool.filter(t => !dlg.tags.includes(t)).slice(0, 5);
    },
    toggleTagMenu(target, id) {
      if (this.tagMenu.open && this.tagMenu.id === id) { this.tagMenu.open = false; return; }
      this.tagMenu = { open: true, target, id };
    },
    pickRecentTag(target, tag) {
      const dlg = this.tagTarget(target);
      if (!dlg.tags.includes(tag)) dlg.tags.push(tag);
      this.recordTagUse(tag);
      this.tagMenu.open = false;
    },

    /* ---------- export ---------- */
    buildMarkdown(c, imagePath) {
      const tags = this.cardTags(c);
      const fm = [
        '---',
        `title: "${c.title.replace(/"/g, '\\"')}"`,
        `saved: ${new Date(c.savedAt).toISOString().slice(0, 10)}`,
        `tags: [${tags.join(', ')}]`,
        'source: Wikipedia (CC BY-SA)',
        '---', '',
      ].join('\n');
      let body = `# ${c.title}\n\n`;
      if (c.image) body += `![${c.title}](${imagePath || c.image})\n\n`;
      body += c.extract + '\n';
      if (c.note) body += `\n## My note\n\n${c.note}\n`;
      if (c.highlights.length) {
        body += '\n## Highlights\n';
        c.highlights.forEach(h => {
          body += `\n> ${h.text}\n`;
          if (h.note) body += `\n${h.note}\n`;
          if (h.tags.length) body += `\n${h.tags.map(t => '#' + t).join(' ')}\n`;
        });
      }
      body += '\n---\n*via Wikipedia · text available under CC BY-SA*\n';
      return fm + body;
    },
    safeBase(title) { return title.replace(/[\\/:*?"<>|]/g, '-'); },
    safeFilename(title) { return this.safeBase(title) + '.md'; },
    downloadBlob(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
    /* PRD: exports embed images for offline vaults. Cards with an image export
       as a .zip containing the .md plus an images/ folder, with the markdown
       referencing the local relative path. If the image fetch fails, the
       markdown falls back to the remote URL rather than losing the reference. */
    async fetchImageInto(zip, c) {
      if (!c.image) return null;
      try {
        const res = await fetch(c.image);
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = (c.image.split('.').pop() || 'jpg').split(/[?#]/)[0].slice(0, 4) || 'jpg';
        const path = `images/${this.safeBase(c.title)}.${ext}`;
        zip.file(path, blob);
        return path;
      } catch { return null; }
    },
    async doExport(mode = 'download') {
      const chosen = this.cards.filter(c => this.selected.includes(c.id));
      if (!chosen.length) return;
      if (mode === 'email') return this.doEmailExport(chosen);
      const anyImage = chosen.some(c => c.image);
      if (chosen.length === 1 && (!anyImage || !window.JSZip)) {
        this.downloadBlob(new Blob([this.buildMarkdown(chosen[0])], { type: 'text/markdown' }),
          this.safeFilename(chosen[0].title));
      } else if (window.JSZip) {
        const blob = await this.buildExportZip(chosen);
        const name = chosen.length === 1 ? this.safeBase(chosen[0].title) + '.zip' : 'glossary-export.zip';
        this.downloadBlob(blob, name);
      } else {
        // JSZip CDN unavailable — fall back to one combined file
        const combined = chosen.map(c => this.buildMarkdown(c)).join('\n\n---\n\n');
        this.downloadBlob(new Blob([combined], { type: 'text/markdown' }), 'glossary-export.md');
      }
      this.finishExport(chosen, '✓ Export downloaded');
    },
    async buildExportZip(chosen) {
      const zip = new JSZip();
      for (const c of chosen) {
        const imgPath = await this.fetchImageInto(zip, c);
        zip.file(this.safeFilename(c.title), this.buildMarkdown(c, imgPath));
      }
      return zip.generateAsync({ type: 'blob' });
    },
    exportEmailName() {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      return `(${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}) Glossary Export`;
    },
    /* Email export. A browser cannot attach a file to an outgoing email on its
       own — that needs a mail-sending backend, ruled out on the Spark plan
       (§8.1). Closest no-infrastructure flow: on phones the zip goes to the
       native share sheet, where Gmail receives it as a ready attachment; on
       desktop the zip downloads and a Gmail compose tab opens pre-addressed
       to the account with the export title as subject — attaching the fresh
       download is the one manual step. */
    async doEmailExport(chosen) {
      if (!window.JSZip) {
        this.showToast('⚠ Email export needs the zip library — check your connection and reload');
        return;
      }
      const subject = this.exportEmailName();
      const zipName = subject + '.zip';
      const isMobile = navigator.userAgentData?.mobile
        ?? /Android|iPhone|iPad/i.test(navigator.userAgent);
      const canShareFiles = !!(navigator.canShare
        && navigator.canShare({ files: [new File([''], zipName, { type: 'application/zip' })] }));
      // desktop: open the compose tab NOW, inside the click's user activation,
      // so the popup isn't blocked while the zip builds
      if (!(isMobile && canShareFiles)) {
        window.open('https://mail.google.com/mail/?view=cm&fs=1'
          + '&to=' + encodeURIComponent(this.user?.email || '')
          + '&su=' + encodeURIComponent(subject)
          + '&body=' + encodeURIComponent(`Attach "${zipName}" from your downloads folder, then send.`),
          '_blank');
      }
      const blob = await this.buildExportZip(chosen);
      if (isMobile && canShareFiles) {
        try {
          await navigator.share({ files: [new File([blob], zipName, { type: 'application/zip' })], title: subject });
        } catch (err) {
          if (err && err.name === 'AbortError') return; // user closed the share sheet — nothing went out
          this.downloadBlob(blob, zipName); // share refused (target/size) — at least hand over the file
        }
        this.finishExport(chosen, '✓ Zip handed to the share sheet');
      } else {
        this.downloadBlob(blob, zipName);
        this.finishExport(chosen, '✓ Zip downloaded — attach it in the Gmail tab');
      }
    },
    // stamp what actually went out — feeds the "Exported / Not exported" filter
    finishExport(chosen, toastMsg) {
      const now = Date.now();
      chosen.forEach(c => { c.lastExportedAt = now; });
      this.persistCards();
      this.recordExport(chosen);
      this.exportSheet = false;
      this.selectMode = false;
      this.selected = [];
      this.showToast(toastMsg);
    },

    /* ---------- settings ---------- */
    /* ---------- PWA install (PRD §2.1/§7) ---------- */
    // UA params are injectable for unit tests. iPadOS ≥13 masquerades as
    // "Macintosh" — more than one touch point is what gives it away.
    installPlatform(ua, touchPoints) {
      ua = ua !== undefined ? ua : (navigator.userAgent || '');
      touchPoints = touchPoints !== undefined ? touchPoints : (navigator.maxTouchPoints || 0);
      if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
      if (/Macintosh/.test(ua) && touchPoints > 1) return 'ios';
      if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'mac-safari';
      return 'other';
    },
    isStandalone() {
      return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
        || navigator.standalone === true; // iOS Safari's non-standard flag
    },
    // per-platform "how to install" copy: Safari needs manual steps; 'other'
    // covers Chromium before beforeinstallprompt fires (or already installed)
    installHint() {
      const plat = this.installPlatform();
      if (plat === 'ios') return 'In Safari, tap the Share button, then "Add to Home Screen".';
      if (plat === 'mac-safari') return 'In Safari’s File menu, choose "Add to Dock".';
      return 'Look for an install icon in your browser’s address bar.';
    },
    promptInstall() {
      if (!this.installPrompt) return;
      const p = this.installPrompt;
      this.installPrompt = null; // a prompt event is single-use either way
      p.prompt();
    },
    dismissInstallNudge() { this.installNudge = false; this.setPref('installNudgeDismissed', true); },

    setPref(key, value) { this.prefs[key] = value; this.applyPrefs(); this.persistPrefs(); },
    applyPrefs() {
      const root = document.documentElement;
      root.setAttribute('data-theme', this.prefs.theme);
      root.style.setProperty('--user-font-scale', this.prefs.fontScale);
      // browser chrome (PWA title bar, mobile status bar) follows the manual
      // theme toggle — values mirror --color-background in styles.css
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', this.prefs.theme === 'dark' ? '#131312' : '#EEEFEA');
      if (this.prefs.theme === 'light') {
        // dim overlay opacity replaces the old body brightness filter (a filter
        // on <body> broke every position:fixed element — see styles.css body rule).
        // brightness 20 → dim 0; brightness 1 → dim 0.15 (same visual range).
        root.style.setProperty('--reading-dim', ((20 - this.prefs.brightness) / 19 * 0.15).toFixed(3));
        root.style.setProperty('--reading-warmth', (this.prefs.warmth / 20 * 0.18).toFixed(3));
      } else {
        root.style.setProperty('--reading-dim', 0);
        root.style.setProperty('--reading-warmth', 0);
      }
    },
    persistPrefs() { lsSet(LS.prefs, this.prefs); },
    exportJson() {
      const data = { cards: this.cards, exportedAt: new Date().toISOString(), app: 'Glossary' };
      this.downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'glossary-backup.json');
    },
    /* Imported backups are untrusted input: every card is rebuilt field-by-field
       (ids regenerated, types coerced, image URLs allowlisted) — never pushed verbatim. */
    sanitizeHighlight(raw) {
      if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) return null;
      return {
        id: uid(),
        text: raw.text,
        start: (typeof raw.start === 'number' && raw.start >= 0) ? raw.start : null,
        note: typeof raw.note === 'string' ? raw.note : '',
        tags: Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : [],
        createdAt: (typeof raw.createdAt === 'number') ? raw.createdAt : Date.now(),
      };
    },
    sanitizeCard(raw) {
      if (!raw || typeof raw.title !== 'string' || !raw.title.trim()) return null;
      const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
      return {
        id: uid(),
        title: raw.title.trim(),
        extract: typeof raw.extract === 'string' ? raw.extract : '',
        note: typeof raw.note === 'string' ? raw.note : '',
        // dictionary-card fields (post-98c9039 cards) — dropped silently before,
        // which stripped the source badge and pronunciation on import
        source: raw.source === 'dictionary' ? 'dictionary' : 'wikipedia',
        phonetic: typeof raw.phonetic === 'string' ? raw.phonetic : '',
        audio: (typeof raw.audio === 'string' && /^https:\/\//.test(raw.audio)) ? raw.audio : null,
        synonyms: Array.isArray(raw.synonyms) ? raw.synonyms.filter(s => typeof s === 'string' && s.trim()).slice(0, 20) : [],
        image: (typeof raw.image === 'string' && /^https:\/\/upload\.wikimedia\.org\//.test(raw.image)) ? raw.image : null,
        imageW: num(raw.imageW),
        imageH: num(raw.imageH),
        revision: num(raw.revision),
        savedAt: num(raw.savedAt) || Date.now(),
        lastReviewedAt: num(raw.lastReviewedAt),
        lastExportedAt: num(raw.lastExportedAt),
        starred: raw.starred === true,
        tags: Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : [],
        highlights: Array.isArray(raw.highlights) ? raw.highlights.map(h => this.sanitizeHighlight(h)).filter(Boolean) : [],
        drifted: false,
      };
    },
    importJson(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data.cards)) throw new Error('bad format');
          let added = 0;
          data.cards.forEach(c => {
            const clean = this.sanitizeCard(c);
            if (clean && !this.findByTitle(clean.title)) { this.cards.push(clean); added++; }
          });
          this.showToast(this.persistCards()
            ? `✓ Imported ${added} card${added === 1 ? '' : 's'}`
            : '⚠ Couldn’t save import — device storage may be full');
        } catch {
          this.showToast('Import failed — not a Glossary backup file');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },

    /* ---------- auth (Google sign-in — PRD §8, Phase C) ----------
       firebase.js (a CDN ES module) may finish before or after Alpine mounts,
       so wire the auth listener either way: if window.GlossaryFirebase already
       exists we attach now; otherwise the ready/error events fire exactly once
       when the module settles. onAuthStateChanged is the single source of
       truth for authState — signIn/signOut never set it directly. */
    initAuth() {
      const wire = () => {
        const fb = window.GlossaryFirebase;
        if (!fb) { this.authState = 'signedOut'; this.authUnavailable = true; return; }
        fb.onAuthStateChanged(fb.auth, u => {
          const prevUid = this.user?.uid || null;
          this.user = u ? {
            uid: u.uid,
            name: u.displayName || '',
            email: u.email || '',
            photo: u.photoURL || '',
          } : null;
          this.authState = u ? 'signedIn' : 'signedOut';
          // account boundary: switch the in-memory deck between the account's
          // cloud collection and this browser's local one. The local deck is
          // NOT auto-merged into the account (deliberate import is Phase D) —
          // on a shared machine that would leak this browser's cards into
          // whoever signs in. localStorage keeps the signed-out deck intact.
          if (u && u.uid !== prevUid) {
            this.stopCardsListener();
            this.cards = [];            // cloud deck arrives via the snapshot
            this.syncCardEditor(null);
            this._pendingImportCheck = true; // offer the local-deck import once the account deck lands
            this.startCardsListener();
          } else if (!u && prevUid) {
            this.stopCardsListener();
            this.cards = lsGet(LS.cards, []);
            this.syncCardEditor(null);
          }
        });
      };
      if (window.GlossaryFirebase !== undefined) wire();
      else {
        window.addEventListener('glossary-firebase-ready', wire, { once: true });
        window.addEventListener('glossary-firebase-error', wire, { once: true });
      }
    },
    async signIn() {
      const fb = window.GlossaryFirebase;
      if (!fb) { this.showToast('Sign-in is unavailable right now'); return; }
      try {
        await fb.signInWithPopup(fb.auth, fb.googleProvider);
        // onAuthStateChanged updates user/authState; we only handle navigation
        this.showToast('✓ Signed in');
      } catch (err) {
        this.handleSignInError(err);
      }
    },
    /* Each failure mode gets its own message: a closed popup is the user's own
       action (gentle note), a blocked popup looks like "nothing happened" so it
       must explain itself, and offline points at the connection — not the app. */
    handleSignInError(err) {
      console.error('[Glossary] sign-in failed:', err);
      const messages = {
        'auth/popup-closed-by-user': 'Sign-in cancelled',
        'auth/cancelled-popup-request': 'Sign-in cancelled',
        'auth/popup-blocked': '⚠ Popup blocked — allow popups for this site and try again',
        'auth/network-request-failed': '⚠ You’re offline — check your connection and try again',
      };
      this.showToast(messages[err?.code] || '⚠ Sign-in didn’t complete — try again');
    },
    async signOutUser() {
      const fb = window.GlossaryFirebase;
      if (!fb) return;
      try {
        await this.flushCloudSync(); // don't strand an edit in the debounce window
        await fb.signOut(fb.auth);
        this.showToast('Signed out');
      } catch (err) {
        console.error('[Glossary] sign-out failed:', err);
        this.showToast('⚠ Couldn’t sign out — try again');
      }
    },

    /* ---------- cloud data layer (Firestore — PRD §8, Phase B) ----------
       Model: users/{uid}/cards/{cardId}, one doc per card. this.cards stays
       the in-memory truth the UI renders; a single onSnapshot listener keeps
       it aligned with the account, and persistCards() diffs it back out.
       Firestore's offline persistence (firebase.js) queues writes and serves
       cached reads, so the flows behave the same offline as localStorage did. */
    cloudMode() { return this.authState === 'signedIn' && !!this.user && !!window.GlossaryFirebase; },
    /* Canonical JSON: Firestore returns map keys sorted, local objects keep
       insertion order — a naive stringify compare would flag every card as
       changed forever and rewrite the whole collection each save. Sorting keys
       in the replacer makes the diff stable (and drops undefined, which
       Firestore rejects). */
    _stableJson(v) {
      return JSON.stringify(v, (k, val) =>
        (val && typeof val === 'object' && !Array.isArray(val))
          ? Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {})
          : val);
    },
    _isDirty(c) { return this._stableJson(c) !== this._synced[c.id]; },
    _cardsCol() {
      const fb = window.GlossaryFirebase;
      return fb.collection(fb.db, 'users', this.user.uid, 'cards');
    },
    startCardsListener() {
      if (!this.cloudMode()) return;
      const fb = window.GlossaryFirebase;
      this._synced = {};
      this._unsubCards = fb.onSnapshot(this._cardsCol(),
        snap => this.applyCardsSnapshot(snap),
        err => {
          console.error('[Glossary] cards listener failed:', err);
          this.syncError = true;
        });
    },
    stopCardsListener() {
      if (this._unsubCards) { this._unsubCards(); this._unsubCards = null; }
      clearTimeout(this._syncTimer);
      this._synced = {};
      this.syncError = false;
    },
    /* Merge rules (local edits vs a snapshot arriving mid-debounce):
       - dirty local card (edited, flush pending) beats the server copy;
       - card in _synced but missing locally = deleted here, flush pending —
         the server copy must not resurrect it;
       - card with no _synced entry = created here, not acked — keep it;
       - clean local card missing from the server = deleted remotely — drop it.
       (Edit-vs-remote-delete resolves as delete wins.) Our own writes come
       back latency-compensated, so applying a snapshot is idempotent. */
    applyCardsSnapshot(snap) {
      const server = [];
      snap.forEach(d => server.push(d.data()));
      const local = new Map(this.cards.map(c => [c.id, c]));
      const merged = server
        .filter(s => !(this._synced[s.id] !== undefined && !local.has(s.id)))
        .map(s => {
          const l = local.get(s.id);
          return (l && this._isDirty(l)) ? l : s;
        });
      const serverIds = new Set(server.map(s => s.id));
      this.cards.forEach(c => {
        if (this._synced[c.id] === undefined && !serverIds.has(c.id)) merged.push(c);
      });
      const next = {};
      server.forEach(s => { next[s.id] = this._stableJson(s); });
      this._synced = next;
      this.cards = merged;
      // migration check waits for the FIRST snapshot: only with the account
      // deck in hand can "which local cards are actually new" be answered
      if (this._pendingImportCheck) {
        this._pendingImportCheck = false;
        this.maybeOfferImport();
      }
    },
    scheduleCloudSync() {
      clearTimeout(this._syncTimer);
      this._syncTimer = setTimeout(() => this.flushCloudSync(), 300);
    },
    /* One batch per flush: upsert every dirty card, delete every card that
       left the deck. _synced is NOT updated here — the snapshot listener is
       the sole bookkeeper, fed by latency compensation the moment the batch
       is enqueued. If a write is rejected (rules, quota), Firestore reverts
       the compensated data, the next snapshot re-marks those cards dirty,
       and the next persist retries them. */
    async flushCloudSync() {
      if (!this.cloudMode()) return;
      clearTimeout(this._syncTimer);
      const fb = window.GlossaryFirebase;
      const batch = fb.writeBatch(fb.db);
      let ops = 0;
      const seen = new Set();
      for (const c of this.cards) {
        seen.add(c.id);
        const json = this._stableJson(c);
        if (json !== this._synced[c.id]) {
          batch.set(fb.doc(this._cardsCol(), c.id), JSON.parse(json));
          ops += 1;
        }
      }
      for (const id of Object.keys(this._synced)) {
        if (!seen.has(id)) { batch.delete(fb.doc(this._cardsCol(), id)); ops += 1; }
      }
      if (!ops) return;
      try {
        await batch.commit();
        this.syncError = false;
      } catch (err) {
        console.error('[Glossary] cloud sync failed:', err);
        this.syncError = true;
        this.showToast('⚠ Sync failed — changes kept on this device, will retry');
      }
    },
    /* ---------- first-login migration (PRD §8.6, Phase D) ----------
       The signed-out deck (localStorage) never auto-merges into an account.
       Instead: one dialog per account per device offering the import, plus a
       manual "Import this device's cards" action in Settings as the catch-up
       path. Cards go through sanitizeCard (fresh ids, coerced fields — the
       same untrusted-input door the JSON import uses) and dedupe by title. */
    localOnlyCards() {
      return lsGet(LS.cards, [])
        .map(c => this.sanitizeCard(c))
        .filter(c => c && !this.findByTitle(c.title));
    },
    maybeOfferImport() {
      if (!this.cloudMode()) return;
      if (lsGet(LS.importOffered + '.' + this.user.uid, false)) return;
      const fresh = this.localOnlyCards();
      if (!fresh.length) { this.markImportOffered(); return; } // nothing to ask about
      this.importOffer = { show: true, count: fresh.length };
    },
    markImportOffered() {
      if (this.user) lsSet(LS.importOffered + '.' + this.user.uid, true);
    },
    /* Shared by the sign-in dialog's Import button and the Settings action. */
    importDeviceCards() {
      const fresh = this.localOnlyCards();
      this.importOffer = { show: false, count: 0 };
      this.markImportOffered();
      if (!fresh.length) { this.showToast('Nothing new to import — all cards are already in your account'); return; }
      this.cards.push(...fresh);
      this.persistCards();
      this.showToast(`✓ ${fresh.length} card${fresh.length === 1 ? '' : 's'} added to your account`);
    },
    skipImport() {
      this.importOffer = { show: false, count: 0 };
      this.markImportOffered();
    },

    /* ---------- account deletion (PRD §8.6, Phase D) ----------
       Right to erasure, self-served: purge every per-user collection, then
       delete the Auth user. Runs client-side with the user's own credentials —
       exactly the scope the security rules grant (no Cloud Functions on the
       free plan). Signed-out decks on devices are local property and stay. */
    async deleteAccount() {
      if (!this.cloudMode() || this.deleteDialog.busy) return;
      const fb = window.GlossaryFirebase;
      const uid = this.user.uid;
      this.deleteDialog.busy = true;
      try {
        await this.flushCloudSync();   // don't purge around an in-flight edit
        this.stopCardsListener();      // reads will lose permission mid-purge
        for (const colName of ['cards', 'reviewHistory', 'exports']) {
          const snap = await fb.getDocs(fb.collection(fb.db, 'users', uid, colName));
          const refs = [];
          snap.forEach(d => refs.push(d.ref));
          // Firestore batches cap at 500 ops — chunk well under it
          for (let i = 0; i < refs.length; i += 400) {
            const batch = fb.writeBatch(fb.db);
            refs.slice(i, i + 400).forEach(r => batch.delete(r));
            await batch.commit();
          }
        }
        try {
          await fb.deleteUser(fb.auth.currentUser);
        } catch (err) {
          if (err?.code !== 'auth/requires-recent-login') throw err;
          // destructive auth ops demand a fresh credential — re-prove identity
          // inline (one popup) and retry once instead of dead-ending the user
          await fb.reauthenticateWithPopup(fb.auth.currentUser, fb.googleProvider);
          await fb.deleteUser(fb.auth.currentUser);
        }
        // onAuthStateChanged flips to signedOut and restores the local deck
        this.deleteDialog = { show: false, busy: false };
        this.showToast('✓ Account deleted — your cloud data has been erased');
      } catch (err) {
        console.error('[Glossary] account deletion failed:', err);
        this.deleteDialog.busy = false;
        this.showToast('⚠ Deletion didn’t complete — you’re still signed in, try again');
        // keep the app usable after a failed attempt
        if (this.cloudMode() && !this._unsubCards) this.startCardsListener();
      }
    },

    /* Review history: ONE write per finished session (§8.5), never per flip. */
    recordReviewHistory() {
      if (!this.cloudMode()) return;
      const fb = window.GlossaryFirebase;
      const s = this.sessionStats();
      const ref = fb.doc(fb.collection(fb.db, 'users', this.user.uid, 'reviewHistory'));
      fb.setDoc(ref, {
        finishedAt: Date.now(),
        total: s.total, correct: s.correct, wrong: s.wrong,
        skipped: s.skipped, passed: s.passed,
        verdicts: { ...this.session.verdicts },
      }).catch(err => console.error('[Glossary] review history write failed:', err));
    },
    /* Export log: one small metadata doc per export action (§8.3). */
    recordExport(chosen) {
      if (!this.cloudMode()) return;
      const fb = window.GlossaryFirebase;
      const ref = fb.doc(fb.collection(fb.db, 'users', this.user.uid, 'exports'));
      fb.setDoc(ref, {
        exportedAt: Date.now(),
        count: chosen.length,
        titles: chosen.map(c => c.title),
      }).catch(err => console.error('[Glossary] export log write failed:', err));
    },

    /* ---------- toast & live announcements ---------- */
    showToast(msg) {
      this.toast = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast = ''; }, 2600);
      this.announceLive(msg);
    },
    /* Clear-then-set so repeating the same message (two identical toasts in a
       row) still registers as a change and gets re-announced by aria-live. */
    announceLive(msg, delay = 50) {
      this.announce = '';
      clearTimeout(this._announceTimer);
      this._announceTimer = setTimeout(() => { this.announce = msg; }, delay);
    },
  };
}
