# Project Diary & Roadmap

## Phase 1: Foundation
* **Goal:** Establish the basic UI and search layout.
* **Outcome:** Created `index.html` and `style.css` using a centered, Google-style layout. Implemented basic font styling (DM Sans originally) and color palettes.

## Phase 2: API Integration
* **Goal:** Connect to Wikipedia.
* **Outcome:** Wrote the initial `app.js`. Added debounced typing suggestions using the Wikipedia OpenSearch API. Added the main search fetch utilizing the `explaintext=1` parameter to strip hyperlinks.

## Phase 3: UX Evolution
* **Goal:** Make it feel like an e-reader and improve search intelligence.
* **Outcome:** Shifted to the "E-Ink Crisp" theme (Inter & Merriweather). Configured the API to fetch article thumbnails. Upgraded the search query to use `generator=search` to automatically handle capitalization and typos (e.g., routing "tian jiarui" correctly). Added `/` and `Esc` keyboard shortcuts.

## Phase 4: The PKM Shift
* **Goal:** Allow users to save notes, not just full articles.
* **Outcome:** Introduced the browser Selection API to track mouse highlights. Built floating tooltips and inline editors for adding notes and tags. Transitioned the data model to a hierarchical system to prevent duplicate flashcards (Article < Highlight < Note).

## Phase 5: Resilience & Navigation
* **Goal:** Prevent highlights from breaking when Wikipedia updates, and improve page navigation.
* **Outcome:** Added Back/Forward navigation state tracking. Built a hybrid synchronization engine combining Wikipedia `revid` tracking with a custom Levenshtein distance fuzzy-matching algorithm to auto-remap drifting text highlights.

## Phase 6: Data Portability & Maintenance (Upcoming Roadmap)
* **Goal:** Give users native control over their data lifecycle and integration with external PKM systems.
* **Planned Features:**
    * **Export Engine:** Build a download handler to export saved flashcards as `.csv` (optimized for importing into spaced-repetition tools like Anki) or `.md` files (clean formatting for direct inclusion in personal Obsidian/Logseq vaults).
    * **Storage Purge:** Add a safe "Clear All Flashcards" or "Delete Flashcard" mechanism in the UI to quickly clear out `localStorage` and recover device space when moving to a new book.

## Phase 7: UI Personalization & True Offline Capability (Upcoming Roadmap)
* **Goal:** Elevate the web page into a bulletproof, standalone application tailored to individual reading environments.
* **Planned Features:**
    * **Theme Engine:** Implement a custom CSS Variable switcher to support true Dark Mode, alongside other organic palettes (e.g., warm sepia, deep forest night) to accommodate low-light physical reading environments.
    * **Full Offline PWA Support:** Turn the application into a Progressive Web App (PWA). Register a Service Worker to cache shell assets, icons, and fonts, allowing the interface to boot instantly and let users review their entire local flashcard collection even when completely disconnected from Wi-Fi.

## Phase 8: Visual Design System (2026-07-02)
* **Goal:** Address the "it works but I don't love the look" feedback by giving WikiSearch a real, documented design system instead of ad hoc CSS values.
* **Process:** Prototyped 5 color/background directions (refined e-ink, warm sepia, cool slate, warm paper, deep graphite) and 3 body-font candidates (Bookerly, Palatino, Cormorant Garamond) as visual mockups before touching production code. Landed on cool slate grey + Literata (serif, paired with Inter for UI).
* **Outcome:** Created `project-core/design-system.md` as the living token reference. Rewrote `style.css` so every color and font-family resolves to a named CSS custom property (surfaces, text, borders, accent, danger/warning states, a `--text-xs`→`--text-hero` type scale, two radius tokens) — zero raw hex values remain outside `:root`. Swapped the Google Fonts import from Merriweather to Literata in `index.html`. Verified with a static consistency pass (no leftover hex, no dangling `var()` references) since no headless browser was available in the sandbox to screenshot-verify directly — worth a manual visual check in an actual browser next session.
* **Deferred to next design pass:** spacing scale, shadow/elevation tokens, and converting flashcard tags from a single text string into individual chip pills (needs an `app.js` change, not just CSS).