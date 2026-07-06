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
  devices: 'glossary.devices',
};

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/blocked */ }
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
    query: '', lastQuery: '',
    suggestions: [], sugLoading: false, showDropdown: false, activeSug: -1,
    recent: [],
    result: null, resultState: 'idle', candidates: [], expanded: false,
    cards: [], mode: 'overview', cardSearch: '',
    tagFilters: [], reviewedFilter: 'all', exportedFilter: 'all', starFilter: false,
    cardPage: 1, cardPageSize: 12,
    selectMode: false, selectIntent: 'review', selected: [], flipped: {}, reviewOrder: [],
    // focused review session (#/review) — survives detours to a card's detail page
    session: { ids: [], idx: 0, flipped: false, done: false },
    _histStack: [], _lastHash: '', _backNav: false,
    detailId: null,
    toolbar: { show: false, x: 0, y: 0, text: '', context: 'results' },
    noteDialog: { show: false, quote: '', text: '', tags: [], tagInput: '', highlightId: null, cardId: null },
    cardDialog: { show: false, cardId: null, note: '', tags: [], tagInput: '' },
    exportSheet: false,
    prefs: { theme: 'light', brightness: 20, warmth: 0, fontScale: 1 },
    devices: [], pairCode: '', enterCode: '',
    toast: '', _toastTimer: null, _sugTimer: null,
    announce: '', _announceTimer: null,

    /* ---------- init & routing ---------- */
    init() {
      this.cards = lsGet(LS.cards, []);
      this.recent = lsGet(LS.recent, []);
      this.prefs = Object.assign(this.prefs, lsGet(LS.prefs, {}));
      this.devices = lsGet(LS.devices, [{ id: 'this', name: 'This device', current: true }]);
      this.applyPrefs();
      this.regenCode();
      window.addEventListener('hashchange', () => this.route());
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
      this.$watch('cardDialog.show', open => this.syncDialogFocus(open));
      this.$watch('exportSheet', open => this.syncDialogFocus(open));
      // lookup lifecycle is otherwise silent to assistive tech
      this.$watch('resultState', s => {
        if (s === 'loading') this.announceLive('Looking up…');
        else if (s === 'error') this.announceLive('No article found for "' + this.lastQuery + '".');
        else if (s === 'offline') this.announceLive("You're offline and this term isn't cached yet.");
        else if (s === 'disambig') this.announceLive('Several articles match — pick one from the list.');
        else if (s === 'ok') this.announceLive((this.result ? this.result.title : 'Article') + ' — article loaded.');
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
        // route() is the single lookup trigger; lastQuery dedupes repeat fires
        if (this.lastQuery !== term) this.lookup(term);
      } else if (p === 'card' && parts[1]) {
        this.page = 'detail';
        this.detailId = parts[1];
        this.markReviewed(parts[1]);
      } else if (p === 'review') {
        // the session lives in component state, not the URL — a deep link or
        // reload with no session running falls back to the collection page
        if (this.session.ids.length) this.page = 'review';
        else this.nav('cards');
      } else if (['home', 'cards', 'settings', 'pairing'].includes(p)) {
        this.page = p;
        // re-entering the collection page refreshes the frozen flip-deck order
        if (p === 'cards' && this.mode === 'flashcards') this.reviewOrder = this.computeReviewOrder();
        if (p === 'home') this.$nextTick(() => this.focusSearch());
      } else {
        this.page = 'home';
      }
      this.toolbar.show = false;
      this.showDropdown = false;
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
        if (e.key === 'ArrowRight') this.sessionNext();
        if (e.key === 'ArrowLeft') this.sessionPrev();
        if (e.key === ' ') { e.preventDefault(); this.sessionFlip(); }
      }
    },
    focusSearch() {
      const el = document.getElementById(this.page === 'home' ? 'search-home' : 'search-top');
      if (el && (this.page === 'home' || this.page === 'results')) el.focus();
    },

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
        const res = await fetch(url);
        const data = await res.json();
        if (this.query.trim() !== q) return; // stale response
        this.suggestions = (data[1] || []).map((title, i) => ({ title, description: (data[2] || [])[i] || '' }));
      } catch { this.suggestions = []; }
      finally { this.sugLoading = false; }
    },
    moveSug(delta) {
      if (!this.suggestions.length) return;
      this.activeSug = (this.activeSug + delta + this.suggestions.length) % this.suggestions.length;
    },
    submitFromInput() {
      if (this.activeSug >= 0 && this.suggestions[this.activeSug]) {
        this.submitSearch(this.suggestions[this.activeSug].title);
      } else if (this.query.trim()) {
        this.submitSearch(this.query.trim());
      }
    },
    submitSearch(term) {
      this.showDropdown = false;
      this.query = term;
      const target = '#/results/' + encodeURIComponent(term);
      if (location.hash === target) {
        // same hash: no hashchange will fire — retry failed/offline lookups directly
        if (this.lastQuery !== term || ['error', 'offline'].includes(this.resultState)) this.lookup(term);
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

    /* ---------- lookup ---------- */
    async lookup(term) {
      this.lastQuery = term;
      this.resultState = 'loading';
      this.result = null; this.candidates = []; this.expanded = false;
      const cache = lsGet(LS.cache, {});
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, '_'))}?redirect=true`;
        const res = await fetch(url, { headers: WIKI_HEADERS });
        if (res.status === 404) { this.resultState = 'error'; return; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.type === 'disambiguation') {
          this.resultState = 'disambig';
          await this.fetchCandidates(term);
          return;
        }
        this.result = {
          title: data.title,
          extract: data.extract || '(No summary available for this article.)',
          image: data.thumbnail ? data.thumbnail.source : null,
          revision: data.revision || null,
        };
        this.resultState = 'ok';
        this.pushRecent(data.title); // only successful lookups, canonical title (QA bug 7)
        this.checkDrift(this.findByTitle(data.title), this.result); // PRD: passive Wikipedia-drift detection
        cache[data.title.toLowerCase()] = { ...this.result, ts: Date.now() };
        cache[term.toLowerCase()] = cache[data.title.toLowerCase()];
        const keys = Object.keys(cache);
        if (keys.length > 60) delete cache[keys[0]];
        lsSet(LS.cache, cache);
      } catch {
        const hit = cache[term.toLowerCase()];
        if (hit) { this.result = hit; this.resultState = 'ok'; this.pushRecent(hit.title); }
        else this.resultState = navigator.onLine ? 'error' : 'offline';
      }
    },
    async fetchCandidates(term) {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=8&namespace=0&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        this.candidates = (data[1] || [])
          .filter(t => t.toLowerCase() !== term.toLowerCase())
          .map((title, i) => ({ title, description: (data[2] || [])[i] || '' }));
      } catch { this.candidates = []; }
    },
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
        revision: this.result.revision,
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
      this.persistCards();
      return card;
    },
    /* Bookmark icon: the single save control. First click saves the card and
       opens the note+tags dialog; when already saved it reopens the dialog. */
    toggleSaveIcon(context) {
      let card = context === 'results' ? this.resultCard() : this.currentCard();
      if (!card && context === 'results') {
        card = this.createCardFromResult();
        if (card) this.showToast('✓ Saved to flashcards');
      }
      if (card) this.openCardDialog(card.id);
    },
    openCardDialog(id) {
      const c = this.cards.find(x => x.id === id);
      if (!c) return;
      this.cardDialog = { show: true, cardId: id, note: c.note || '', tags: [...(c.tags || [])], tagInput: '' };
      this.$nextTick(() => this.$refs.cardNoteText && this.$refs.cardNoteText.focus());
    },
    cardDialogTitle() {
      const c = this.cards.find(x => x.id === this.cardDialog.cardId);
      return c ? c.title : 'Note & tags';
    },
    closeCardDialog(save) {
      if (save) {
        const c = this.cards.find(x => x.id === this.cardDialog.cardId);
        if (c) {
          const pending = this.cardDialog.tagInput.trim().replace(/^#/, '');
          if (pending) this.cardDialog.tags.push(pending);
          c.note = this.cardDialog.note.trim();
          c.tags = [...new Set(this.cardDialog.tags)];
          this.persistCards();
          this.showToast('✓ Note & tags saved');
        }
      }
      this.cardDialog.show = false;
    },
    /* DELETE in the dialog unsaves the whole card (icon unshades);
       confirm first when highlights would be lost with it. */
    deleteFromCardDialog() {
      const c = this.cards.find(x => x.id === this.cardDialog.cardId);
      if (!c) { this.cardDialog.show = false; return; }
      const n = (c.highlights || []).length;
      if (n > 0 && !confirm(`Delete "${c.title}"? Its ${n} highlight${n === 1 ? '' : 's'} will be lost too.`)) return;
      this.cards = this.cards.filter(x => x.id !== c.id);
      this.persistCards();
      this.cardDialog.show = false;
      this.showToast('Card deleted');
      if (this.page === 'detail') this.nav('cards');
    },
    persistCards() { lsSet(LS.cards, this.cards); },
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
    flipGridCard(c) {
      // during selection a tap picks the card instead of flipping it
      if (this.selectMode) { this.cardClick(c); return; }
      this.flipped[c.id] = !this.flipped[c.id];
      if (this.flipped[c.id]) this.markReviewed(c.id);
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
      const changed = live.extract !== card.extract || (live.image || null) !== (card.image || null);
      if (changed) {
        card.drifted = true;
        card.pendingUpdate = { extract: live.extract, image: live.image || null, revision: live.revision || null };
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
      this.persistCards();
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
      this.mode = m; this.flipped = {};
      if (m === 'flashcards') { this.selectMode = false; this.selected = []; this.reviewOrder = this.computeReviewOrder(); }
    },
    /* Two entry points, one selection mode: "Start Review" and "Export" both
       open selection with their own intent — each intent exposes exactly one
       launch verb, so the user always knows what the selection is for. */
    toggleSelectMode(intent = 'review') {
      this.selectMode = !this.selectMode;
      this.selectIntent = intent;
      this.selected = [];
    },
    /* "Select all" operates on the filtered set (tags + search + status), not the
       whole collection — filter to a topic, select all, review just that topic. */
    selectAllVisible() { this.selected = this.visibleCards().map(c => c.id); },
    clearSelection() { this.selected = []; },
    allVisibleSelected() {
      const vis = this.visibleCards();
      return vis.length > 0 && vis.every(c => this.selected.includes(c.id));
    },
    /* One launch verb per intent — the selection bar shows exactly one primary
       action, so there is never more than one primary button in play. */
    launchSelection() {
      if (!this.selected.length) return;
      if (this.selectIntent === 'review') this.startSession(this.selected);
      else this.exportSheet = true;
    },
    toggleTagFilter(t) {
      // reassign (never mutate) so the $watch that resets pagination fires
      this.tagFilters = this.tagFilters.includes(t)
        ? this.tagFilters.filter(x => x !== t)
        : [...this.tagFilters, t];
    },

    /* ---------- focused review session ---------- */
    startSession(ids) {
      const valid = ids.filter(id => this.cards.some(c => c.id === id));
      if (!valid.length) return;
      this.session = { ids: valid, idx: 0, flipped: false, done: false };
      this.selectMode = false; this.selectIntent = 'review'; this.selected = [];
      this.nav('review');
    },
    sessionCard() { return this.cards.find(c => c.id === this.session.ids[this.session.idx]) || null; },
    sessionFlip() {
      const c = this.sessionCard();
      if (!c) return;
      this.session.flipped = !this.session.flipped;
      if (this.session.flipped) this.markReviewed(c.id); // revealing the answer counts as a review
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
    sessionStarredIds() {
      return this.session.ids.filter(id => (this.cards.find(c => c.id === id) || {}).starred);
    },
    finishSession() {
      // starred cards earn an offer to run them again; otherwise straight home
      if (this.sessionStarredIds().length) this.session.done = true;
      else { this.exitSession(); this.showToast('✓ Review complete'); }
    },
    reviewStarredAgain() { this.startSession(this.sessionStarredIds()); },
    exitSession() {
      this.session = { ids: [], idx: 0, flipped: false, done: false };
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
      if (this.mode === 'flashcards') {
        const order = this.reviewOrder;
        list.sort((a, b) => {
          const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
          return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
        });
      } else {
        list.sort((a, b) => b.savedAt - a.savedAt);
      }
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
      // click on an existing highlight/marker opens its note
      const hlEl = e.target.closest && e.target.closest('[data-hl]');
      if (hlEl) { this.openNoteDialog(hlEl.dataset.hl); return; }
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
      this.openNoteDialog(hlEl.dataset.hl);
    },
    /* Keyboard path to CREATE a highlight: extending a selection with
       Shift+arrows (caret browsing) surfaces the same toolbar mouseup does. */
    onTextKeyUp(e, context) {
      if (!e.shiftKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      this.showToolbarForSelection(e.currentTarget, context);
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
      this.persistCards();
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

    /* ---------- note dialog ---------- */
    openNoteDialog(hlId) {
      const found = this.findHighlight(hlId);
      if (!found) return;
      this.noteDialog = {
        show: true, quote: found.h.text, text: found.h.note || '',
        tags: [...(found.h.tags || [])], tagInput: '',
        highlightId: hlId, cardId: found.card.id,
      };
      this.$nextTick(() => this.$refs.noteText && this.$refs.noteText.focus());
    },
    closeNoteDialog(save) {
      if (save) {
        const found = this.findHighlight(this.noteDialog.highlightId);
        if (found) {
          // commit any tag still sitting in the input
          const pending = this.noteDialog.tagInput.trim().replace(/^#/, '');
          if (pending) this.noteDialog.tags.push(pending);
          found.h.note = this.noteDialog.text.trim();
          found.h.tags = [...new Set(this.noteDialog.tags)];
          this.persistCards();
          this.showToast('✓ Note saved');
        }
      }
      this.noteDialog.show = false;
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

    /* ---------- tags ---------- */
    onTagKeydown(e, target) {
      const dlg = target === 'note' ? this.noteDialog : this.cardDialog;
      const isCommit = e.key === ' ' || e.key === 'Enter' || e.key === ',';
      if (isCommit) {
        e.preventDefault();
        const tag = dlg.tagInput.trim().replace(/^#/, '').replace(/\s+/g, '-');
        if (!tag) return;
        if (!dlg.tags.includes(tag)) dlg.tags.push(tag);
        dlg.tagInput = '';
      } else if (e.key === 'Backspace' && dlg.tagInput === '') {
        dlg.tags.pop();
      }
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
    async doExport() {
      const chosen = this.cards.filter(c => this.selected.includes(c.id));
      if (!chosen.length) return;
      const anyImage = chosen.some(c => c.image);
      if (chosen.length === 1 && (!anyImage || !window.JSZip)) {
        this.downloadBlob(new Blob([this.buildMarkdown(chosen[0])], { type: 'text/markdown' }),
          this.safeFilename(chosen[0].title));
      } else if (window.JSZip) {
        const zip = new JSZip();
        for (const c of chosen) {
          const imgPath = await this.fetchImageInto(zip, c);
          zip.file(this.safeFilename(c.title), this.buildMarkdown(c, imgPath));
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const name = chosen.length === 1 ? this.safeBase(chosen[0].title) + '.zip' : 'glossary-export.zip';
        this.downloadBlob(blob, name);
      } else {
        // JSZip CDN unavailable — fall back to one combined file
        const combined = chosen.map(c => this.buildMarkdown(c)).join('\n\n---\n\n');
        this.downloadBlob(new Blob([combined], { type: 'text/markdown' }), 'glossary-export.md');
      }
      // stamp what actually went out — feeds the "Exported / Not exported" filter
      const now = Date.now();
      chosen.forEach(c => { c.lastExportedAt = now; });
      this.persistCards();
      this.exportSheet = false;
      this.selectMode = false;
      this.selected = [];
      this.showToast('✓ Export downloaded');
    },

    /* ---------- settings ---------- */
    setPref(key, value) { this.prefs[key] = value; this.applyPrefs(); this.persistPrefs(); },
    applyPrefs() {
      const root = document.documentElement;
      root.setAttribute('data-theme', this.prefs.theme);
      root.style.setProperty('--user-font-scale', this.prefs.fontScale);
      if (this.prefs.theme === 'light') {
        root.style.setProperty('--reading-brightness', (0.85 + (this.prefs.brightness - 1) / 19 * 0.15).toFixed(3));
        root.style.setProperty('--reading-warmth', (this.prefs.warmth / 20 * 0.18).toFixed(3));
      } else {
        root.style.setProperty('--reading-brightness', 1);
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
        image: (typeof raw.image === 'string' && /^https:\/\/upload\.wikimedia\.org\//.test(raw.image)) ? raw.image : null,
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
          this.persistCards();
          this.showToast(`✓ Imported ${added} card${added === 1 ? '' : 's'}`);
        } catch {
          this.showToast('Import failed — not a Glossary backup file');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },

    /* ---------- pairing (simulated) ---------- */
    regenCode() { this.pairCode = String(Math.floor(100000 + Math.random() * 900000)); },
    pairDevice() {
      const code = this.enterCode.trim();
      if (!/^\d{6}$/.test(code)) { this.showToast('Enter the 6-digit code from your other device'); return; }
      this.devices.push({ id: uid(), name: 'Paired device · code ' + code, current: false });
      lsSet(LS.devices, this.devices);
      this.enterCode = '';
      this.showToast('✓ Device linked (simulated)');
      this.nav('settings');
    },
    revokeDevice(id) {
      this.devices = this.devices.filter(d => d.id !== id);
      lsSet(LS.devices, this.devices);
      this.showToast('Device access revoked');
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
