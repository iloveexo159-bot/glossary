/* Dictionary fallback (Wikipedia 404 / disambiguation) — the definition/
   phonetic/audio/synonym shaping (buildDictionaryResult), the fetch guards that
   were subtle to get right, and the invariant that "source" is the ONLY thing
   distinguishing a dictionary card (drift is skipped, everything else is shared). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

/* A dictionaryapi.dev entry, overridable per test. */
const entry = (over = {}) => ({
  word: 'ignominy',
  phonetic: '/ˈɪɡnəˌmɪni/',
  phonetics: [{ text: '/ˈɪɡnəˌmɪni/', audio: '' }],
  meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Great dishonor.' }], synonyms: [] }],
  ...over,
});

test('buildDictionaryResult composes one line per part of speech (the "fuller" format)', () => {
  const comp = newComp();
  const r = comp.buildDictionaryResult(entry({
    meanings: [
      { partOfSpeech: 'noun', definitions: [{ definition: 'A jog.' }] },
      { partOfSpeech: 'verb', definitions: [{ definition: 'To move fast.' }] },
    ],
  }), []);
  // newline-joined so white-space:pre-line stacks the senses; the chars stay in
  // the string so highlight offsets index it exactly like a Wikipedia paragraph
  assert.equal(r.extract, 'noun. A jog.\nverb. To move fast.');
  assert.equal(r.source, 'dictionary');
  assert.equal(r.image, null);
});

test('buildDictionaryResult falls back to a placeholder when there are no definitions', () => {
  const comp = newComp();
  const r = comp.buildDictionaryResult({ word: 'x', meanings: [], phonetics: [] }, []);
  assert.equal(r.extract, '(No definition available.)');
});

test('buildDictionaryResult takes the first non-empty audio, else null', () => {
  const comp = newComp();
  const none = comp.buildDictionaryResult(entry({ phonetics: [{ text: '/x/', audio: '' }] }), []);
  assert.equal(none.audio, null, 'all-empty audio collapses to null (button stays hidden)');
  const some = comp.buildDictionaryResult(entry({ phonetics: [{ audio: '' }, { audio: 'https://a/x.mp3' }] }), []);
  assert.equal(some.audio, 'https://a/x.mp3');
});

test('buildDictionaryResult uses entry.phonetic, falling back to a phonetics[].text', () => {
  const comp = newComp();
  const r = comp.buildDictionaryResult(entry({ phonetic: '', phonetics: [{ text: '/fallback/', audio: '' }] }), []);
  assert.equal(r.phonetic, '/fallback/');
});

test('buildDictionaryResult merges Datamuse + dictionary synonyms, deduped and capped at 8', () => {
  const comp = newComp();
  const r = comp.buildDictionaryResult(entry({
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'x' }], synonyms: ['shame', 'disgrace'] }],
  }), [{ word: 'disgrace' }, { word: 'scandal' }]);
  // Datamuse results lead; the dictionary's own synonyms follow; 'disgrace' dedupes
  assert.deepEqual(Array.from(r.synonyms), ['disgrace', 'scandal', 'shame']);
});

test('buildDictionaryResult caps the synonym list at 8', () => {
  const comp = newComp();
  const many = Array.from({ length: 20 }, (_, i) => ({ word: 'w' + i }));
  const r = comp.buildDictionaryResult(entry(), many);
  assert.equal(r.synonyms.length, 8);
});

test('fetchWiktionaryEntry normalizes the REST payload and strips definition HTML', async () => {
  const comp = newComp();
  comp._ctx.fetch = async () => ({ ok: true, json: async () => ({
    en: [{
      partOfSpeech: 'Noun', language: 'English',
      definitions: [{ definition: 'Strong <a href="/wiki/hostility">hostility</a> &amp; resentment.' }],
    }],
  }) });
  const e = await comp.fetchWiktionaryEntry('Animosity');
  assert.equal(e.word, 'animosity'); // Wiktionary entries are lowercase
  assert.equal(e.meanings[0].partOfSpeech, 'noun');
  assert.equal(e.meanings[0].definitions[0].definition, 'Strong hostility & resentment.');
  assert.equal(e.phonetic, '', 'no IPA/audio from Wiktionary — fields exist but empty');
});

test('dictLookupEntry falls back to Wiktionary when dictionaryapi stalls', async () => {
  const comp = newComp();
  comp._fetchTimeoutMs = 25;
  comp._ctx.fetch = (url, opts) => {
    if (String(url).includes('dictionaryapi')) {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => { const e = new Error('x'); e.name = 'AbortError'; reject(e); });
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({
      en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'Great dishonor.' }] }],
    }) });
  };
  const e = await comp.dictLookupEntry('ignominy');
  assert.equal(e.meanings[0].definitions[0].definition, 'Great dishonor.');
});

test('a dictionaryapi 404 still consults Wiktionary (it covers more words)', async () => {
  const comp = newComp();
  comp._ctx.fetch = async (url) => String(url).includes('dictionaryapi')
    ? { ok: false, status: 404, json: async () => ({ title: 'No Definitions Found' }) }
    : { ok: true, json: async () => ({ en: [{ partOfSpeech: 'Adjective', definitions: [{ definition: 'Rare.' }] }] }) };
  const e = await comp.dictLookupEntry('recondite');
  assert.equal(e.meanings[0].definitions[0].definition, 'Rare.');
});

test('fetchDictionary treats a non-array (404 {title,message}) payload as no result', async () => {
  const comp = newComp();
  comp.lastQuery = 'zzzznotaword';
  comp._ctx.fetch = async (url) => String(url).includes('dictionaryapi')
    ? { ok: true, json: async () => ({ title: 'No Definitions Found' }) } // object, not array
    : { ok: true, json: async () => [] };
  await comp.fetchDictionary('zzzznotaword');
  assert.equal(comp.resultState, 'error');
  assert.equal(comp.result, null);
});

test('the disambiguation banner survives an autocapitalized search (mobile QA round 3)', async () => {
  // iOS capitalizes the typed term ("Animosity"); the dictionary APIs answer
  // lowercase. The supersede guard used to read that case twin as "the reader
  // moved on" and silently discarded the SUCCESSFUL response — leaving
  // "Looking up…" on screen forever, with no history entry and no timeout.
  const comp = newComp();
  comp.lastQuery = 'Animosity';
  comp.resultState = 'disambig';
  comp._ctx.fetch = async (url) => String(url).includes('dictionaryapi')
    ? { ok: true, json: async () => [entry({ word: 'animosity' })] }
    : { ok: true, json: async () => [] };
  await comp.showDictionaryFor('animosity'); // the lowercase word the banner offers
  assert.equal(comp.resultState, 'ok');
  assert.equal(comp.result.title, 'animosity');
  assert.equal(comp.lastQuery, 'animosity', 'the chosen word becomes the current query');
});

test('a failing lookup with a case-twin query still reaches the error state', async () => {
  const comp = newComp();
  comp.lastQuery = 'Ignominy';
  comp.resultState = 'loading';
  comp._ctx.fetch = async () => { throw new Error('connection reset'); };
  await comp.fetchDictionary('ignominy');
  assert.equal(comp.resultState, 'error', 'the catch-path guard is case-insensitive too');
});

test('fetchDictionary ignores a stale response after the reader has moved on', async () => {
  const comp = newComp();
  comp.lastQuery = 'newterm';      // a newer lookup already superseded this one
  comp.resultState = 'loading';
  comp._ctx.fetch = async (url) => String(url).includes('dictionaryapi')
    ? { ok: true, json: async () => [entry({ word: 'oldterm' })] }
    : { ok: true, json: async () => [] };
  await comp.fetchDictionary('oldterm');
  assert.equal(comp.result, null, 'a stale definition must not clobber the current term');
});

test('fetchDictionary populates the result on a live hit and marks the source', async () => {
  const comp = newComp();
  comp.lastQuery = 'ignominy';
  comp.resultState = 'loading';
  comp._ctx.fetch = async (url) => String(url).includes('dictionaryapi')
    ? { ok: true, json: async () => [entry()] }
    : { ok: true, json: async () => [{ word: 'shame' }] };
  await comp.fetchDictionary('ignominy');
  assert.equal(comp.resultState, 'ok');
  assert.equal(comp.result.source, 'dictionary');
  assert.equal(comp.result.title, 'ignominy');
  assert.deepEqual(Array.from(comp.result.synonyms), ['shame']);
});

test('a dictionary-sourced card never drifts — there is no Wikipedia article to compare', () => {
  const comp = newComp();
  const c = { id: 'd', title: 'ignominy', source: 'dictionary', extract: 'noun. Shame.', image: null, highlights: [], drifted: false };
  comp.cards = [c];
  // even when the "live" text differs wildly, a dictionary card stays undrifted
  comp.checkDrift(c, { extract: 'noun. SOMETHING ELSE ENTIRELY.', image: null });
  assert.equal(c.drifted, false);
  assert.equal(c.pendingUpdate, undefined);
});

test('sourceLabel maps the source to a human label, defaulting to Wikipedia', () => {
  const comp = newComp();
  assert.equal(comp.sourceLabel('dictionary'), 'Dictionary');
  assert.equal(comp.sourceLabel('wikipedia'), 'Wikipedia');
  assert.equal(comp.sourceLabel(undefined), 'Wikipedia', 'pre-source cards read as Wikipedia');
});
