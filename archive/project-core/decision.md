# Architectural Decisions Log

### 1. Data Storage: `localStorage` vs. Database
* **Decision:** Use browser `localStorage`.
* **Why:** The core problem statement revolves around avoiding web distractions. `localStorage` keeps data firmly on the user's local machine, requiring no backend server, logins, or cloud databases. It fulfills the "offline review" requirement natively.
* **When to revisit:** If the user wants to sync flashcards between their desktop and a mobile device.

### 2. Handling Wikipedia Hyperlinks
* **Decision:** Strip all hyperlinks natively via API.
* **Why:** To prevent the "Wikipedia Rabbit Hole" effect, which violates the core problem statement of keeping the user focused on their physical book.
* **How:** Used the `explaintext=1` parameter in the Wikipedia API request.

### 3. Flashcard Duplication 
* **Decision:** Implement a "Living Card" Hierarchy (Note > Highlight > Article).
* **Why:** If a user saves an article, then highlights a quote, then adds a note, generating three separate flashcards creates a messy, unusable feed. Merging data upward ensures one definitive card per topic.

### 4. Handling Wikipedia Text Drift
* **Decision:** Hybrid model (`revid` tracking + Fuzzy String Alignment).
* **Why:** Relying solely on exact string matching (`.includes()`) breaks the moment a Wikipedia editor changes a single comma. Relying solely on `revid` (historical snapshots) prevents the user from seeing live, updated facts. The hybrid model allows loading live text while dynamically adjusting highlight bounds.
* **When to revisit:** If performance drops on extremely long articles, or if the fuzzy matching threshold (`0.45`) proves too strict or too loose during actual usage.

### 5. Visual design system: cool slate e-ink + Literata
* **Decision:** Rebuilt the color and type foundation as named CSS custom properties in `style.css` (see `design-system.md`), landing on a cool grey e-ink palette (background `#E7E7E4`) and Literata (serif) for display/body text paired with Inter (sans) for UI chrome, replacing the original flat `#F4F4F4` + Merriweather palette.
* **Why:** Prototyped five color/background directions (refined e-ink, warm sepia, cool slate, warm paper, deep graphite) and three body-font candidates (Bookerly, Palatino, Cormorant Garamond) against the winning palette. Cool slate read as a dedicated reading device rather than a generic beige webpage; Literata was purpose-built by Google for on-screen long-form reading (used in Play Books) and stayed legible at body size, unlike Cormorant Garamond, which was too delicate, and Bookerly, which isn't legally embeddable outside Amazon devices.
* **How:** Every hex value and font-family in `style.css` was migrated onto tokens (`--bg-color`, `--surface`, `--text-primary/secondary/muted`, `--accent`, `--danger`, `--warning-*`, `--font-display/heading/ui/body`, a `--text-xs` through `--text-hero` size scale, and two radius tokens). Verified with a static pass confirming zero raw hex values remain outside `:root` and every `var()` reference resolves.
* **When to revisit:** Spacing and shadows are still ad hoc (not yet tokenized) — the next design-system pass should formalize those. Flashcard tags still render as one plain accent-colored text string rather than individual chip pills, since chip-per-tag requires an `app.js` change (wrapping tags in `<span>` elements), deliberately deferred to keep this pass CSS-only.