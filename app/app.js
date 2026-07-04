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

function glossaryApp() {
  return {
    /* ---------- state ---------- */
    page: 'home',
    query: '', lastQuery: '',
    suggestions: [], sugLoading: false, showDropdown: false, activeSug: -1,
    recent: [],
    result: null, resultState: 'idle', candidates: [], expanded: false,
    cards: [], mode: 'overview', tagFilter: null, cardSearch: '',
    selectMode: false, selected: [], flipped: {},
    detailId: null,
    toolbar: { show: false, x: 0, y: 0, text: '', context: 'results' },
    noteDialog: { show: false, quote: '', text: '', tags: [], tagInput: '', highlightId: null, cardId: null },
    cardTagInput: '',
    exportSheet: false,
    prefs: { theme: 'light', brightness: 20, warmth: 0, fontScale: 1 },
    devices: [], pairCode: '', enterCode: '',
    toast: '', _toastTimer: null, _sugTimer: null,

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
    },
    route() {
      const h = location.hash || '#/home';
      const parts = h.slice(2).split('/');
      const p = parts[0] || 'home';
      if (p === 'results' && parts[1]) {
        const term = decodeURIComponent(parts[1]);
        this.page = 'results';
        if (!this.result || this.result.title !== term) this.lookup(term);
      } else if (p === 'card' && parts[1]) {
        this.page = 'detail';
        this.detailId = parts[1];
        this.markReviewed(parts[1]);
      } else if (['home', 'cards', 'settings', 'pairing'].includes(p)) {
        this.page = p;
        if (p === 'home') this.$nextTick(() => this.focusSearch());
      } else {
        this.page = 'home';
      }
      this.toolbar.show = false;
      this.showDropdown = false;
    },
    nav(page, param) {
      location.hash = param ? `#/${page}/${encodeURIComponent(param)}` : `#/${page}`;
    },
    goBack() {
      if (this.page === 'detail') this.nav('cards');
      else this.nav('home');
    },
    closeTransient() { this.showDropdown = false; this.toolbar.show = false; },
    onKeydown(e) {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); this.focusSearch(); }
      if (e.key === 'Escape') { this.showDropdown = false; this.toolbar.show = false; }
    },
    focusSearch() {
      const el = document.getElementById('search-input');
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
      this.pushRecent(term);
      this.nav('results', term);
      this.lookup(term);
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
        const res = await fetch(url);
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
        cache[data.title.toLowerCase()] = { ...this.result, ts: Date.now() };
        cache[term.toLowerCase()] = cache[data.title.toLowerCase()];
        const keys = Object.keys(cache);
        if (keys.length > 60) delete cache[keys[0]];
        lsSet(LS.cache, cache);
      } catch {
        const hit = cache[term.toLowerCase()];
        if (hit) { this.result = hit; this.resultState = 'ok'; }
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
    saveCard() {
      if (!this.result) return;
      const existing = this.findByTitle(this.result.title);
      if (existing) {
        this.showToast('Already saved — opening existing card');
        this.nav('card', existing.id);
        return existing;
      }
      const card = {
        id: uid(),
        title: this.result.title,
        extract: this.result.extract,
        image: this.result.image,
        revision: this.result.revision,
        savedAt: Date.now(),
        lastReviewedAt: null,
        tags: [],
        highlights: [],
        drifted: false,
      };
      this.cards.push(card);
      this.persistCards();
      this.showToast('✓ Saved to flashcards');
      return card;
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
    reviewClick(c) {
      if (!this.flipped[c.id]) {
        this.flipped[c.id] = true;
        this.markReviewed(c.id);
      } else {
        this.nav('card', c.id);
      }
    },
    markReviewed(id) {
      const c = this.cards.find(x => x.id === id);
      if (c) { c.lastReviewedAt = Date.now(); this.persistCards(); }
    },
    setMode(m) { this.mode = m; this.flipped = {}; if (m === 'review') { this.selectMode = false; this.selected = []; } },
    toggleSelectMode() { this.selectMode = !this.selectMode; this.selected = []; },
    visibleCards() {
      let list = [...this.cards];
      if (this.tagFilter) {
        list = list.filter(c =>
          (c.tags || []).includes(this.tagFilter) ||
          (c.highlights || []).some(h => (h.tags || []).includes(this.tagFilter)));
      }
      const q = this.cardSearch.trim().toLowerCase();
      if (q) list = list.filter(c => c.title.toLowerCase().includes(q) || c.extract.toLowerCase().includes(q));
      if (this.mode === 'review') list.sort((a, b) => (a.lastReviewedAt || 0) - (b.lastReviewedAt || 0));
      else list.sort((a, b) => b.savedAt - a.savedAt);
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
    deleteCard(id) {
      if (!confirm('Delete this flashcard and all its highlights?')) return;
      this.cards = this.cards.filter(c => c.id !== id);
      this.persistCards();
      this.showToast('Card deleted');
      this.nav('cards');
    },

    /* ---------- highlight rendering ---------- */
    renderExtract(text, highlights) {
      let html = escapeHtml(text || '');
      const sorted = [...(highlights || [])].sort((a, b) => b.text.length - a.text.length);
      sorted.forEach((h) => {
        const needle = escapeHtml(h.text);
        if (!html.includes(needle)) return;
        const n = (highlights || []).indexOf(h) + 1;
        const marker = h.note
          ? `<button class="note-marker" data-hl="${h.id}" aria-label="Open note ${n}">${n}</button>`
          : '';
        html = html.replace(needle,
          `<mark class="hl" data-hl="${h.id}" role="button" tabindex="0" aria-label="Highlight ${n}">${needle}</mark>${marker}`);
      });
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
    onTextMouseUp(e, context) {
      // click on an existing highlight/marker opens its note
      const hlEl = e.target.closest && e.target.closest('[data-hl]');
      if (hlEl) { this.openNoteDialog(hlEl.dataset.hl); return; }
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length < 2) { this.toolbar.show = false; return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      this.toolbar = {
        show: true, context, text,
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY - 52,
      };
    },
    confirmHighlight(withNote) {
      const text = this.toolbar.text;
      const context = this.toolbar.context;
      this.toolbar.show = false;
      if (!text) return;
      let card;
      if (context === 'results') {
        card = this.findByTitle(this.result?.title) || this.saveCard();
        if (!card) return;
      } else {
        card = this.currentCard();
        if (!card) return;
      }
      const h = { id: uid(), text, note: '', tags: [], createdAt: Date.now() };
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
      const isCommit = e.key === ' ' || e.key === 'Enter' || e.key === ',';
      const input = target === 'note' ? this.noteDialog.tagInput : this.cardTagInput;
      if (isCommit) {
        e.preventDefault();
        const tag = input.trim().replace(/^#/, '').replace(/\s+/g, '-');
        if (!tag) return;
        if (target === 'note') {
          if (!this.noteDialog.tags.includes(tag)) this.noteDialog.tags.push(tag);
          this.noteDialog.tagInput = '';
        } else {
          const c = this.currentCard();
          if (c && !c.tags.includes(tag)) { c.tags.push(tag); this.persistCards(); }
          this.cardTagInput = '';
        }
      } else if (e.key === 'Backspace' && input === '') {
        if (target === 'note') this.noteDialog.tags.pop();
        else { const c = this.currentCard(); if (c) { c.tags.pop(); this.persistCards(); } }
      }
    },
    removeCardTag(t) {
      const c = this.currentCard();
      if (!c) return;
      c.tags = c.tags.filter(x => x !== t);
      this.persistCards();
    },

    /* ---------- export ---------- */
    buildMarkdown(c) {
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
      if (c.image) body += `![${c.title}](${c.image})\n\n`;
      body += c.extract + '\n';
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
    safeFilename(title) { return title.replace(/[\\/:*?"<>|]/g, '-') + '.md'; },
    downloadBlob(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
    async doExport() {
      const chosen = this.cards.filter(c => this.selected.includes(c.id));
      if (!chosen.length) return;
      if (chosen.length === 1) {
        this.downloadBlob(new Blob([this.buildMarkdown(chosen[0])], { type: 'text/markdown' }),
          this.safeFilename(chosen[0].title));
      } else if (window.JSZip) {
        const zip = new JSZip();
        chosen.forEach(c => zip.file(this.safeFilename(c.title), this.buildMarkdown(c)));
        const blob = await zip.generateAsync({ type: 'blob' });
        this.downloadBlob(blob, 'glossary-export.zip');
      } else {
        // JSZip CDN unavailable — fall back to one combined file
        const combined = chosen.map(c => this.buildMarkdown(c)).join('\n\n---\n\n');
        this.downloadBlob(new Blob([combined], { type: 'text/markdown' }), 'glossary-export.md');
      }
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
            if (!this.findByTitle(c.title)) { this.cards.push(c); added++; }
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

    /* ---------- toast ---------- */
    showToast(msg) {
      this.toast = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast = ''; }, 2600);
    },
  };
}
