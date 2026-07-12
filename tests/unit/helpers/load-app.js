/* ============================================================
   load-app.js — loads app/app.js UNMODIFIED into a sandbox.

   Why a vm sandbox instead of require()?
   app.js is a browser script: it declares `function glossaryApp()`
   as a global and never calls module.exports. Rather than add a
   test-only export line to ground-truth app code, we evaluate the
   file inside a Node `vm` context that supplies just enough fake
   browser globals (localStorage, document, window, ...) for the
   pure-logic methods to run. The app file stays pristine.

   Each newComp() call builds a FRESH context + storage, so tests
   are fully isolated from one another.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_PATH = path.resolve(__dirname, '../../../app/app.js');
const SOURCE = fs.readFileSync(APP_PATH, 'utf8');

/* Minimal localStorage that behaves like the real one for our purposes. */
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

/* Build a fresh vm context with fake browser globals and run app.js in it.
   Standard intrinsics (Object, Array, Set, Date, Math, JSON) are provided
   by the vm context itself — we only inject host/browser integrations. */
function createContext() {
  const noop = () => {};
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    AbortController, // fetchT's lookup-timeout path (host global, not a vm intrinsic)
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    localStorage: makeStorage(),
    navigator: { onLine: true },
    location: { hash: '', reload: noop }, // reload: self-update-on-resume path
    confirm: () => true,
    fetch: async () => {
      throw new Error('fetch() called in a unit test — stub it on comp._ctx.fetch');
    },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: noop },
    Blob: function Blob(parts, opts) { this.parts = parts; this.opts = opts; },
    FileReader: function FileReader() {},
    window: {
      addEventListener: noop,
      getSelection: () => null,
      scrollX: 0,
      scrollY: 0,
      scrollTo: noop,
    },
    document: {
      documentElement: { style: { setProperty: noop }, setAttribute: noop },
      getElementById: () => null,
      createElement: () => ({ style: {}, click: noop, remove: noop, setAttribute: noop, appendChild: noop }),
      body: { appendChild: noop, removeChild: noop },
      createRange: () => ({}),
      addEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'app/app.js' });
  return sandbox;
}

/* Create a ready-to-drive Alpine component instance.
   - $nextTick runs synchronously so dialog-open code doesn't hang.
   - $refs is empty; app code guards every $refs access.
   - showToast is captured into comp.toast (no timer) so tests can assert on it. */
function newComp(overrides = {}) {
  const ctx = createContext();
  const comp = ctx.glossaryApp();
  comp.$nextTick = (fn) => { if (fn) fn(); };
  comp.$refs = {};
  comp.showToast = function (m) { this.toast = m; };
  comp._ctx = ctx; // exposed so tests can swap confirm/fetch/localStorage
  Object.assign(comp, overrides);
  return comp;
}

module.exports = { newComp, createContext, makeStorage };
