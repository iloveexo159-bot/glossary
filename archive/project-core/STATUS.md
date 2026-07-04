# Current Status: In Development / Debugging Phase

## Where the Project Stands Now
WikiSearch has a functional core loop (searching, reading, highlighting, and annotating), but state management still has open bugs, and the visual design just went through its first real overhaul. `style.css` now runs on a documented token system (see `design-system.md`) — cool slate grey palette + Literata/Inter typography — instead of ad hoc hex values. The UI/UX and state management still require refinement before the MVP can be considered stable.

## Recent Milestones
* Transitioned the data model to a hierarchical "Living Card" system (Note > Highlight > Article).
* Built the text-drift synchronization engine (Fuzzy matching + `revid`).
* Integrated the Obsidian-style inline tagging system (`#tag`).
* Implemented the UI foundation for the forward/backward navigation stack.
* Rebuilt the visual design system: cool slate e-ink palette + Literata/Inter typography, fully tokenized in `style.css` (2026-07-02, see `design-system.md` and decision #5).

## Next Actions
* [ ] **Visual QA:** Open `index.html` in an actual browser and eyeball the new cool slate + Literata look across home state, results state, and the flashcards grid — the sandbox had no headless browser available to screenshot-verify this directly.
* [ ] **Debug Navigation:** Fix the forward and backward navigation buttons so they accurately track the user's history and state transitions.
* [ ] **Debug Badge Counter:** Correct the logic on the "My Flashcards" notification badge so it only shows newly added cards and resets properly upon clicking.
* [ ] **Debug Duplicates:** Audit the `saveOrUpdateCard` merge logic to completely eliminate duplicate flashcards from appearing in the grid.
* [ ] **Design System Round 2:** Formalize spacing and shadow/elevation tokens, and consider converting flashcard tags into individual chip pills (requires an `app.js` change).
* [ ] **UX Polish:** Brainstorm and add quality-of-life (QoL) features to ensure a more seamless and intuitive day-to-day usage.
* [ ] **Shortcuts:** Define shortcuts to allow users to jump between different functions (e.g., press '/' to jump to search bar, 'enter' to search, ctrl+s to save)

## Blockers
* **Navigation State Bug:** Forward and backward buttons are currently buggy and not syncing correctly with the visual interface.
* **Notification Bug:** The badge counter on the top navigation bar is not accurately reflecting new saves or resetting properly.
* **Data Merge Bug:** Duplicate flashcards are still bypassing the hierarchical save logic and cluttering the feed.

## Needs Review
* Monitor the `Levenshtein distance` threshold (currently set to 0.45) for the text-drift engine. If it fails to remap highlights on heavily edited Wikipedia pages once the app is stable, this threshold will need adjustment.
* Visually confirm the new cool slate + Literata palette in an actual browser (see Next Actions) since it was only verified statically (token consistency), not by rendering.