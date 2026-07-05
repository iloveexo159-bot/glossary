# Glossary — Test Suite

Two layers, both intended to run as a **$0, deterministic pre-commit gate**.

| Layer | Runner | Needs a browser? | What it covers |
|---|---|---|---|
| **Unit** | `node:test` (built into Node v24 — zero deps) | No | Pure logic in `app/app.js`: dedupe, highlight offsets & re-anchoring, Markdown export, JSON-import sanitization, review ordering, tag/text filters, drift comparison, tag entry, reverse-flow logic. |
| **E2E** | Playwright | Yes (Chromium) | Real user journeys & reverse flows through the UI, with Wikipedia's API **mocked** so runs are offline & deterministic. |

The app itself stays **build-free** (Alpine via CDN, no bundler). `package.json` exists **only** for this test tooling.

## Running

```bash
# one-time (E2E only): install Playwright + its browser
npm install
npx playwright install chromium

npm run test:unit    # fast, no browser
npm run test:e2e     # Playwright journeys
npm test             # both
```

> Node isn't always on the tool PATH on this machine. If `node`/`npm` aren't found, use the full path, e.g. `"C:\Program Files\nodejs\node.exe" --test "tests/unit/**/*.test.js"`.

### How `app.js` is tested without a build step
The unit layer loads `app/app.js` **unmodified** into a Node `vm` sandbox that supplies fake browser globals (`tests/unit/helpers/load-app.js`). The app file is never edited for testability. The E2E layer serves the real `app/` folder via a tiny Node static server (`tests/e2e/static-server.js`) and mocks only the Wikipedia endpoints (`tests/e2e/fixtures/wiki.js`); the Alpine/JSZip CDNs are the one real network dependency.

## Simulated features & upgrade triggers

Firebase sync, device pairing, and the *live* drift fetch are **not built yet** (PRD §1, Phases 9–11). The suite tests the **simulation as it exists today**, quarantined in clearly-labelled `describe('SIMULATED — ...')` blocks. When a phase lands, rewrite the matching block against the real behaviour:

| When you build… | Rewrite these tests | New expectation |
|---|---|---|
| **Phase 9 — Firebase / Firestore** | new `sync.spec.js`; the "never synced" note in `simulated-sync.spec.js` | Real cross-device sync; security-rules enforcement |
| **Phase 10 — Device pairing** | `SIMULATED — Phase 10` block in `simulated-sync.spec.js` | Real pairing code exchange + rules-enforced revoke (not just a localStorage row) |
| **Phase 11 — Live drift check** | `SIMULATED — Phase 11` block in `simulated-sync.spec.js`; `tests/unit/drift.test.js` header | Real on-view fetch populates `live`; the comparison logic stays as-is |

## Known PRD-vs-code gaps captured as tests

These are encoded so they **fail loudly** if the behaviour changes — see `tests/unit/reverse-flows.test.js`:

- **`GAP:` Detail-page "DELETE CARD" confirm** uses a generic prompt, while the bookmark-dialog delete names the exact highlight count (PRD §2.1 wants the count on the destructive unsave). If you unify them, update that test's expectation.

## Adding coverage
- **New pure function** → add a `*.test.js` under `tests/unit/`.
- **New journey / interaction** → add a `*.spec.js` under `tests/e2e/`; extend the mock dictionary in `tests/e2e/fixtures/wiki.js` for any new term.
