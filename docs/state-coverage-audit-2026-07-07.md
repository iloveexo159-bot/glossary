# State Coverage Audit — WikiSearch Glossary

**Date:** 2026-07-07
**Scope:** Diagnostic-only. Read of `app/index.html`, `app/app.js`, `app/styles.css` as ground truth. No code was changed and the app was not run.
**Method:** Traced each route/major function, then evaluated Empty / Success / Failure states against the actual DOM templates and handlers. "Covered/Partial" claims cite a `file:line` verified by reading; "Missing" cites the nearest function that would own the state.

---

## 1. Summary

Coverage is strong on the **happy-path and the network-failure states of the term-lookup flow** — loading, ok, no-result, offline, and disambiguation each have a dedicated `state-box` with human-readable copy and a screen-reader announcement (`app.js:90-96`). The systemic weakness is at the **edges of collections and persistence**: filtered-to-zero collections, disambiguation pages with zero candidates, and every `localStorage` write share the same failure mode — the UI shows nothing wrong (or even a success toast) while the underlying operation produced no result. The second systemic gap is **silent `catch` blocks that collapse "network error" into "no results"**: suggestion fetches, and to a lesser degree lookups, cannot tell the user whether they typed a dead-end term or simply lost connectivity.

**Biggest systemic gaps:** (1) `lsSet` swallows quota/write failures everywhere, so any save (card, note, highlight, prefs) can silently no-op after a success toast; (2) collection grid has no "no cards match your filters" empty state — it just goes blank; (3) `lsGet` only guards against invalid JSON, not against valid-JSON-of-wrong-type, so a corrupted `glossary.cards` object (not array) would break the collection render.

**Grouping note:** The ~9 candidate units were consolidated to **8**. The PRD's "Search / term resolution" (2), "Search results list" (3), and "Term detail render" (4) all live on the single `#/results` route and share one `resultState` machine, so they are audited together as **§4 Term resolution & results render** (with the disambiguation candidate-list called out as its own rows). "Saved-card detail" (`#/detail`) is audited separately (§5) because it is a distinct route with its own not-found path. The review session lives under §6 (Collection) since its completion state is the "completed flashcard review" empty state called out in the brief.

---

## 2. Per-unit state tables

### §1 — Home / first arrival (`#/home`)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Empty: no recent searches (page body) | Covered | `index.html:122` | `.empty-note` "There are no recent searches. Type a term above to look it up." shown via `x-show="recent.length === 0"`. |
| Empty: no recent searches (top-bar dropdown, other pages) | Covered | `index.html:52` | `.empty` "There are no recent searches." Separate template from the home body. |
| Success: hero + recent list render | Covered | `index.html:86-123` | Section gated `x-show="page==='home'"`; recent rows `x-for="r in recent"`. |
| Failure | N/A | — | Home is static/local-only; no async work can fail. Correctly has no failure surface. |

### §2 — Search autocomplete dropdown (suggestions)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Empty: query blank (top bar) → recent searches | Covered | `index.html:44-53` | Shows recent list inside dropdown when `query.trim().length === 0`. |
| Empty: zero suggestions after typing | Partial | `index.html:63-65`, `108-110` | "No article matches …" shows only when `suggestions.length === 0 && !sugLoading`. But this same message renders on a **fetch failure** (see below), so "network down" and "genuinely no match" are indistinguishable. |
| Success: suggestions render (+ Dictionary tag) | Covered | `index.html:57-62`; `app.js:187-208` | Wikipedia rows plus an appended `source:'dictionary'` row when Wikipedia has no exact title match. |
| Failure: suggestion fetch throws (offline/CORS) | Partial | `app.js:190` | `catch { this.suggestions = []; }` — swallowed silently. UI falls through to the "No article matches" empty copy, misattributing a network error to a spelling problem. |
| Failure: dictionary probe throws | Covered (intentional) | `app.js:209` | Silent `catch` is acceptable here — the Dictionary row is purely additive; its absence degrades gracefully. |
| Loading: suggestions in flight | Missing | `app.js:178-179`, `191` | `sugLoading` is set/cleared but only used to *suppress* the empty message. There is no visible "Searching…" affordance in the dropdown, so a slow network shows an empty, ambiguous dropdown. Low severity. |

### §3 — (folded into §2 and §4)

_Autocomplete is §2; the results list / disambiguation candidate list is audited within §4 below._

### §4 — Term resolution & results render (`#/results`, `resultState` machine)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Loading | Covered | `index.html:129`; `app.js:249`,`90-91` | `state-box` "Looking up…" + live-region announcement. |
| Success: article renders | Covered | `index.html:159-223`; `app.js:271-285` | Title, image, extract, source badge, bookmark, credit line. |
| Success edge: article has no summary text | Covered | `app.js:273` | Falls back to "(No summary available for this article.)". |
| Success edge: dictionary fallback result | Covered | `app.js:258`,`332-388`; `index.html:192` | Wikipedia 404 routes to `fetchDictionary`; distinct credit line + phonetic/audio/synonyms. |
| Failure: no article found | Covered | `index.html:131-135`; `app.js:296` | `resultState:'error'` state-box with the queried term and a "Back to search" action. |
| Failure: offline, term not cached | Covered | `index.html:137-141`; `app.js:296`,`362` | `navigator.onLine` distinguishes offline from not-found; dedicated copy. Cached terms resolve from `LS.cache` offline (`app.js:294-295`). |
| Failure: disambiguation with candidates | Covered | `index.html:143-157`; `app.js:261-270` | Candidate list + optional Dictionary banner. |
| **Failure: disambiguation with ZERO candidates and no dictionary hit** | **Missing** | `index.html:143-157`; `app.js:299-308` | If `fetchCandidates` returns `[]` (all filtered out or fetch failed → `catch{ candidates=[] }` at `app.js:307`) **and** `probeDictionaryOption` finds nothing, the page renders only the heading "“…” could mean:" with an empty `.candidates` div and no fallback message or exit button. Dead-end screen. Matches the brief's "disambiguation with zero valid candidates". |
| Failure: candidate fetch throws | Partial | `app.js:307` | Swallowed to `[]`; collapses into the zero-candidate dead-end above rather than showing a network message. |
| Failure: same-hash retry of a failed/offline lookup | Covered | `app.js:226-232` | Re-clicking the same term while in `error`/`offline` re-triggers `lookup` (no hashchange would otherwise fire). |
| Failure: stale/abandoned response clobbering current state | Covered | `app.js:186`,`343`,`359` | `this.query`/`this.lastQuery` guards drop late responses for superseded terms. |

### §5 — Saved-card detail render (`#/detail`, `#/card/:id`)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Success: card renders | Covered | `index.html:434-497`; `app.js:476` | Full read view with source badge, drift badge, delete/update actions. |
| Empty: card has no note/tags/highlights | Covered | `index.html:482-484` | `.muted` prompt "Select any text in the summary above to highlight it…". |
| Failure: card id not found (bad deep link / deleted) | Covered | `index.html:498`; `app.js:476` | "Card not found." + "Back to flashcards". |
| Success edge: drifted saved copy | Covered | `index.html:440`,`449`; `app.js:502-542` | "Updated on Wikipedia" badge + "UPDATE SAVED COPY" action; re-anchors highlights and reports losses (`app.js:539-541`). |

### §6 — Collection list + filters + review session (`#/cards`, `#/review`)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Empty: no saved cards | Covered | `index.html:302-306` | `state-box` "No flashcards yet." + "Search Wikipedia" action. Search/filters/toolbar all gated on `cards.length` so they hide when empty. |
| **Empty: filters/search match zero cards (but collection non-empty)** | **Missing** | `index.html:302`,`309-331`; `app.js:682-689` | The empty `state-box` is gated on `cards.length === 0`, **not** on `visibleCards().length`. When filters/search exclude everything, the grid (`pagedCards()`) renders nothing and no "no matches" message appears — the page area goes blank while filter chips stay lit. Footer still reads "0 of N cards shown" (`index.html:371`), the only signal. |
| Success: grid renders (overview / flashcards) | Covered | `index.html:309-363` | Both display modes; pager shown when `pageCount() > 1`. |
| Success: pagination clamp after delete/filter | Covered | `app.js:684-688` | `pagedCards()` clamps `cardPage` so a stranded page never renders empty. |
| Empty: no filters applied yet (default) | Covered | `app.js:645-668`,`43` | Defaults (`reviewedFilter:'all'`, `exportedFilter:'all'`, no tags/star) show the full set; "All" chips render active. |
| Review session: completion with starred cards | Covered | `index.html:418-425`; `app.js:634-637` | "Session complete." + starred count + "Review starred again". |
| Review session: completion with no starred cards | Partial | `app.js:637` | No completion screen — `exitSession()` navigates straight back to the collection with a "✓ Review complete" toast only. Intentional per the comment, but the "completed review session" empty state the brief names has no dwell screen in this (common) path. |
| Review session: deep-link/reload with no session | Covered | `index.html:427-430`; `app.js:116-120` | Route falls back to `cards`; a defensive "No review session is running." state-box also exists. |
| Failure: corrupted `localStorage` on load (invalid JSON) | Covered | `app.js:16-19`,`61-64` | `lsGet` try/catch returns the fallback (`[]` / defaults). |
| **Failure: `localStorage` valid JSON but wrong type** (e.g. `cards` is `{}`) | **Missing** | `app.js:16-19`,`61` | `lsGet` only falls back on a parse *throw*. Valid JSON of the wrong shape passes through: `this.cards` becomes a non-array, and `cards.length` / `visibleCards()` / `x-for` break with no guard. Robustness gap for corrupted-but-parseable storage. |

### §7 — Card save / bookmark

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Success: first save from a result | Covered | `app.js:430-437`,`399-427` | Creates card, toast "✓ Saved to flashcards", opens note/tags dialog. |
| Success: bookmark on an already-saved term | Covered | `app.js:431`,`436-437`; `index.html:164-167` | Re-opens the card dialog; icon shows `saved` state via `alreadySaved()`. |
| Success: note & tags saved from dialog | Covered | `app.js:448-461` | Toast "✓ Note & tags saved". |
| Success: delete/unsave from dialog (with highlight confirm) | Covered | `app.js:464-474` | `confirm()` guard when highlights would be lost. |
| **Failure: `localStorage` write fails (quota/blocked)** | **Missing** | `app.js:20-22`,`424-426` | `persistCards()` → `lsSet` swallows the error in an empty `catch`. The card is pushed to the in-memory array and the "✓ Saved" toast fires regardless, so on a full/blocked store the save is lost on reload with no warning. Same silent-write path affects notes, highlights, prefs, devices. High-impact because the success feedback is affirmatively wrong. |
| Success (toggle star) | Covered | `app.js:627-630` | Persists; no user-facing failure path (shares the silent-write gap above). |

### §8 — Highlights & notes

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Success: highlight saved | Covered | `app.js:845-852` | Toast "✓ Highlight saved" (or opens note dialog when `withNote`). |
| Success: note on a highlight saved | Covered | `app.js:915-929` | Toast "✓ Note saved"; pending tag committed. |
| Empty: card with no annotations | Covered | `index.html:482-484` | Prompt copy on detail view. |
| Failure: selection can't be matched to source offset | Covered | `app.js:831-834` | Toast "Couldn't match that selection — try again". |
| Failure: selection overlaps an existing highlight | Covered | `app.js:840-844` | Toast "That overlaps an existing highlight"; clears selection. |
| Edge: selection under 2 chars | Covered (intentional) | `app.js:806` | Toolbar simply not shown; no error needed. |
| Failure: highlight persist write fails | Missing | `app.js:847`,`20-22` | Inherits the silent `lsSet` gap — highlight appears saved but may not persist. |

### §9 — Export & backup (Markdown/ZIP + JSON)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Success: export completes & downloads | Covered | `app.js:1014-1043` | Single `.md`, `.zip` bundle, or combined-`.md` fallback; toast "✓ Export downloaded"; stamps `lastExportedAt`. |
| Success: export sheet preview | Covered | `index.html:640-659` | Lists selected titles, explains format. |
| Failure graceful: image fetch fails during zip | Covered | `app.js:1002-1013` | Returns `null`, markdown falls back to remote image URL. |
| Failure graceful: JSZip CDN unavailable | Covered | `app.js:1030-1033` | Falls back to a single combined `.md`. |
| **Failure: `zip.generateAsync` / `downloadBlob` throws mid-export** | **Missing** | `app.js:1014-1043` | `doExport` is `async` with **no try/catch**. If zip generation or the blob download rejects, the promise rejects unhandled: no toast, `lastExportedAt` is not stamped, the export sheet may stay open. No user-facing failure feedback for the actual export step. |
| Empty: export invoked with no selection | Covered (guarded) | `app.js:576-579`,`1016` | `launchSelection` and `doExport` both early-return on empty selection; sheet only opens from a non-empty selection. |
| Success: JSON backup export | Covered | `app.js:1060-1063` | Downloads `glossary-backup.json`. |
| Success: JSON import | Covered | `app.js:1098-1119` | Sanitizes each card field-by-field, regenerates ids, toast "✓ Imported N cards". |
| Failure: JSON import bad/not-a-backup | Covered | `app.js:1104-1105`,`1113-1114` | Throws on non-array `cards`; toast "Import failed — not a Glossary backup file". |
| Partial: JSON import where all cards are duplicates | Partial | `app.js:1106-1112` | `added` can be 0 (dedup by title at `1109`); still shows a "✓ Imported 0 cards" success toast — technically truthful but reads as success when nothing changed. Low severity. |

### §10 — Device pairing / sync (`#/pairing`, `#/settings`)

| State | Covered? | Evidence (file:line) | Notes/Gap |
|---|---|---|---|
| Status: sync is simulated (disclosed) | Covered | `index.html:545`,`564` | Explicit "Firebase pairing is simulated in this version" / "(Simulated in this version.)". Honest about the non-built feature. |
| Success: pair a device | Covered (simulated) | `app.js:1123-1131` | Validates 6-digit code, pushes a device row, toast "✓ Device linked (simulated)". |
| Failure: invalid/short pairing code | Covered | `app.js:1124-1125`; `index.html:572-573` | Regex guard + toast "Enter the 6-digit code…"; input also has `pattern="[0-9]{6}"`. |
| Success: revoke a device | Covered | `app.js:1132-1136` | Filters device out, toast "Device access revoked". |
| Failure: real sync/pairing network failure | N/A (not built) | `app.js:1121-1122` | No network involved (all local + `Math.random` code). Correctly out of scope pre-Firebase; only note is that persistence still rides the silent `lsSet` (`app.js:1127`). |
| Settings: display prefs persist | Covered | `app.js:1046-1059` | Applied live and persisted; shares silent-write gap on `persistPrefs`. |

---

## 3. Prioritized top gaps

1. **Silent `localStorage` write failures (`lsSet` empty catch) — `app.js:20-22`.** Highest priority: it is cross-cutting (cards, notes, highlights, prefs, devices) and actively *misleads* — every save fires a "✓ saved" toast even when the write was dropped (quota exceeded, private-mode block). A user in a full store loses data believing it was saved. One shared failure path, broad blast radius.
2. **Collection has no "zero cards match your filters" empty state — `index.html:302` / `app.js:682`.** The empty message keys off `cards.length === 0`, not the filtered set, so any over-narrow filter combination blanks the page. This is a routine, easily-hit interaction (unlike the storage edge cases) and looks like the app broke or lost the user's cards — the exact "saved cards disappeared" confusion the in-page card search was earlier moved to avoid.
3. **Disambiguation with zero candidates renders a dead-end screen — `index.html:143-157` / `app.js:299-308`.** A user searching an ambiguous or misspelled term can land on a page that shows only "“X” could mean:" with nothing beneath it and no way forward except the browser back button. It sits directly on the core lookup path (the app's primary job) and, unlike a clean "no results" screen, offers no recovery affordance.

_Runners-up:_ (4) `doExport` has no try/catch around zip/blob generation, so a mid-export failure gives no feedback (`app.js:1014`); (5) `lsGet` doesn't type-check parsed values, so a corrupted-but-valid-JSON `glossary.cards` breaks the collection render (`app.js:16-19`); (6) suggestion-fetch failures are indistinguishable from "no matches", misattributing network errors to spelling (`app.js:190`).
