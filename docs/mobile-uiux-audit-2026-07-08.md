# Mobile UI/UX Audit — WikiSearch Glossary

**Date:** 2026-07-08
**Scope:** Diagnostic-only. Static read of `app/index.html`, `app/styles.css`, `app/app.js`, plus live emulation (Playwright Chromium, iPhone 13 Pro profile: 390×844, DPR 3, `isMobile`, `hasTouch`; variants at 320×568 and 844×390 landscape). No code was changed.
**Method:** Every measured value below ("measured") comes from the live run with 6 seeded cards (including a 45-character single-word title and a ~700-word extract). Wikipedia/dictionary/Datamuse requests were blocked; CDN (Alpine/JSZip/fonts) allowed. `file:line` references were verified by reading. Findings are labeled **Pass / Partial / Fail**; severity is called out where it matters.

---

## 1. Guidelines for good mobile UI/UX

A curated checklist drawn from Apple HIG, Material Design 3, and WCAG 2.2 — the criteria the table in §2 grades against.

| # | Guideline | Source / rationale |
|---|---|---|
| G1 | **Touch targets ≥ 44×44 pt** (Apple HIG) / 48dp (Material). WCAG 2.2 SC 2.5.8 sets a hard floor of 24×24 CSS px. Targets that fail should at least have ≥ 8px spacing from neighbors. | HIG, M3, WCAG 2.5.8 |
| G2 | **Correct viewport meta**: `width=device-width, initial-scale=1`, `viewport-fit=cover` when using safe-area insets; never `user-scalable=no` or `maximum-scale=1` (blocks zoom, WCAG 1.4.4). | MDN, WCAG 1.4.4 |
| G3 | **Safe-area insets** (`env(safe-area-inset-*)`) on every fixed/sticky edge element (bottom nav, toasts, floating bars) so the home indicator and notch never overlap controls. | Apple HIG |
| G4 | **Fixed bottom nav ergonomics**: content must clear the bar at max scroll (`padding-bottom` ≥ bar height); the bar itself gets safe-area padding; any *additional* floating bar must also be budgeted for. | HIG, M3 bottom app bar |
| G5 | **Thumb-zone reachability**: primary and frequent actions in the bottom half of the screen; top corners are the hardest to reach one-handed. | Steven Hoober's thumb-zone research, HIG |
| G6 | **No horizontal overflow** on any page, at any supported width (down to 320px per WCAG 1.4.10 Reflow), including long unbroken words and user content. | WCAG 1.4.10 |
| G7 | **Readable type without zoom**: body text ≥ 16px equivalent; UI labels ≥ ~13px; respect user font scaling without breaking the 44px touch floor. | HIG typography, WCAG 1.4.4 |
| G8 | **Inputs ≥ 16px font-size on iOS** — Safari auto-zooms the page when focusing an input styled below 16px, and the page stays zoomed after blur. Also: correct `type`/`inputmode`/`enterkeyhint`/`autocomplete` so the right keyboard appears. | WebKit behavior, MDN |
| G9 | **Gesture affordances with non-gesture fallbacks**: every swipe/drag action needs a visible tap/button equivalent (WCAG 2.5.1 Pointer Gestures); gestures must be axis-locked so they don't fight scrolling (`touch-action`). | WCAG 2.5.1 |
| G10 | **Motion & reduced motion**: animations on `transform`/`opacity` only (compositor-friendly); honor `prefers-reduced-motion`; functionality must survive with animations disabled. | WCAG 2.3.3, web.dev |
| G11 | **Contrast**: text ≥ 4.5:1 (normal) / 3:1 (≥ 24px or ≥ 18.7px bold); non-text UI boundaries ≥ 3:1. Mobile outdoor use makes marginal ratios worse in practice. | WCAG 1.4.3, 1.4.11 |
| G12 | **Tap feedback & state visibility**: a pressed state (`:active` or equivalent) on touch; hover-only styling must be guarded with `@media (hover: hover)` or it "sticks" after a tap on touch devices. | M3 state layers, MDN |
| G13 | **Dialog/sheet ergonomics on small screens**: fit within the viewport (beware `100vh` vs. dynamic toolbars — prefer `dvh`/`svh`), internal scroll, scrim dismissal, focus trap, Escape/back to close, actions reachable above the keyboard. | HIG sheets, M3 dialogs |
| G14 | **Landscape behavior**: no broken layouts at ~390px height; primary controls reachable without excessive scroll; navigation still present. | HIG |
| G15 | **Scroll & animation performance**: passive touch listeners, no layout-thrashing on drag (track the finger via `transform`), avoid `filter`/paint-heavy properties on scroll containers. | web.dev rendering |
| G16 | **Selection/contextual UI must work with touch input** — features triggered by `mouseup`/hover/keyboard need a touch path (e.g. `selectionchange` for text-selection UI). | WCAG 2.5 input modality independence |

---

## 2. Does the app follow these guidelines?

### Summary verdict

The foundation is genuinely good — viewport meta, safe-area plumbing, zero horizontal overflow even at 320px with a 45-char word, a swipe gesture with real fallbacks, and a reduced-motion kill switch. The failures cluster in three places: **(1) highlighting — a core feature — cannot be performed by touch at all**, (2) a **swath of controls sits well under the app's own 44px floor** (including one coarse-pointer rule that is dead CSS due to a specificity bug), and (3) **touch feedback is inverted** — no pressed state, but 23 unguarded hover rules that stick after taps.

### Pass/fail table

| Guideline | Verdict | Evidence |
|---|---|---|
| G1 Touch targets ≥ 44px | **Fail** (broad) | Measured at 390×844 with coarse pointer active. Under the floor: mode-toggle buttons **28px** tall (Overview/Flashcards, Light/Dark — `styles.css:318-323`); Reviewed/Exported filter toggles **24px** tall (`mode-toggle-sm`, `styles.css:324`) — at the WCAG 2.5.8 absolute minimum, far under the app's own floor; `.chip-filter` tag/star filters **38-39px** (coarse bump exists but is too small, `styles.css:557`); `.card-article-link` **39px** (`styles.css:402-407`); search clear button `.icon-clear` **25×24px** (see specificity bug below); tag-remove `.x` buttons ≈ **10×13px** (`styles.css:286-290`, no coarse bump); settings range sliders **234×16px** native thumbs (`styles.css:527`); `.input-search` 40px tall (`styles.css:140`). Passing: `.icon-btn`, `.btn-primary`, `.btn-outline`, verdict buttons (all measured 44px+); `.btn-text` correctly bumped to 44px by the coarse block (`styles.css:555`); bottom-nav links measured 195×55. |
| G1a `@media (pointer: coarse)` block actually applies | **Fail** (bug) | The `.icon-clear` bump at `styles.css:556` (`padding: 0.625rem 0.75rem`) **never applies**: the base rule `.search-wrap .icon-clear` (`styles.css:150`, specificity 0,2,0) beats `.icon-clear` inside the media query (0,1,0) — media queries add no specificity. Measured 25×24px on a touch profile, identical to desktop. Dead CSS. |
| G2 Viewport meta | **Pass** | `index.html:5` — `width=device-width, initial-scale=1.0, viewport-fit=cover`; no `maximum-scale`/`user-scalable` restriction (pinch-zoom preserved). |
| G3 Safe-area insets | **Pass** | `.nav-bottom` height + `padding-bottom: env(safe-area-inset-bottom)` (`styles.css:539-541`); `.toast` bottom `calc(4.5rem + env(...))` (`styles.css:562`); floating `.select-bar` bottom `calc(4rem + env(...))` (`styles.css:314`). Emulation reports `env()` = 0, so this is verified statically; a device/WebKit check is still worthwhile. Top inset unused — acceptable while the app runs in a browser tab (no PWA manifest), revisit if standalone mode is added. |
| G4 Bottom nav: content clears it | **Pass** / **Fail for select-bar** | `main` reserves `6rem` bottom padding (`styles.css:174`); measured at max scroll: main bottom 844 ≤ nav top — content clears the nav. **But** in select mode the floating `.select-bar` (fixed, measured **122px tall** — it wraps to 3 rows at 390px) adds ~130px of occlusion nothing budgets for: measured last card bottom **699** vs. bar top **658** at max scroll — the last row of cards is permanently hidden behind the bar and can't be tapped. `styles.css:309-317`, `index.html:285-300`. |
| G5 Thumb-zone reachability | **Partial** | Good: bottom nav for the two main destinations; select-bar verbs float above the nav (measured 44px buttons, bottom-anchored); verdict + arrow controls in the lower half of the review screen. Weak: Settings only via top-right icon and back via top-left (hardest zones, low frequency — acceptable); top-bar search on results/cards/detail pages is top-anchored (unavoidable with this layout). |
| G6 No horizontal overflow | **Pass** | Measured `scrollWidth == innerWidth` on every route (`#/home`, `#/cards`, `#/card/c1`, `#/settings`, `#/pairing`, `#/review`) at 390px, 320px, and 844×390 — including the 45-character unbroken title (`overflow-wrap: anywhere`, `styles.css:352`). |
| G7 Readable type | **Pass** (one note) | Reading body 20px Literata / 1.7lh (`styles.css:47`); rem-based scale with `--user-font-scale` (`styles.css:55-56`); 44px floors use `max(2.75rem, 44px)` so they survive scale-down (`styles.css:131`). Note: `--type-caption-size` is **11px** (`styles.css:50`) — used for real content ("Tap to flip", card dates, credits); small but bold+uppercase, borderline acceptable. |
| G8 Inputs ≥ 16px (iOS zoom) + input semantics | **Fail** | Measured font sizes: both search inputs **15px** (`--type-ui-size`, `styles.css:141`), pairing code input **15px** (`styles.css:533`), tag inputs **13px** (`styles.css:517`). All will trigger Safari's zoom-on-focus, and the page stays zoomed afterward. Textareas are 16px (pass). Semantics: pairing input has `inputmode="numeric" pattern="[0-9]{6}"` (`index.html:653`) — good; search inputs are plain `type="text"` with no `enterkeyhint="search"` (`index.html:34,94`) so the keyboard's confirm key reads "return" instead of "search" — minor. |
| G9 Gestures + fallbacks | **Pass** | Swipe measured working: CDP touch swipe left advanced `session.idx` 0→1, right returned 1→0; sub-threshold drags snap back; the drag-ending tap doesn't flip (`_suppressFlip`, `app.js:657,690` — verified: tap-to-flip still works after a swipe). Axis lock at 8px (`app.js:681-683`) + `touch-action: pan-y` (`styles.css:419`) keeps vertical scrolling native. Fallbacks: arrow buttons (44px, `index.html:466-469`), verdict buttons (44px), keyboard arrows/space (`app.js:170-174`). WCAG 2.5.1 satisfied. |
| G10 Motion & reduced motion | **Pass** | Global `prefers-reduced-motion` kill switch (`styles.css:75-77`). Swipe advance uses `setTimeout(240)` not `transitionend` (`app.js:700`), so with transitions disabled the deck still advances (cards jump instead of flinging). Flip/fling animate `transform`/`opacity` only. |
| G11 Contrast | **Partial** | Computed WCAG ratios: secondary `#54544E` on `#EEEFEA` = **6.60** (pass); dark secondary = **7.79** (pass); muted on surface = 4.82 light / 4.80 dark (pass); dark muted on bg = 5.28 (pass). **Marginal fail:** light muted `#6F6E66` on background `#EEEFEA` = **4.43** — just under 4.5:1, and it's used for 11px-bold caption text (below the 18.7px-bold large-text exemption) across captions, credits, placeholders. Also: disabled buttons at `opacity: 0.35` (`styles.css:227-233`) land near ~1.6:1 — WCAG-exempt but hard to see in sunlight; the review verdict buttons start disabled, so their existence is nearly invisible pre-flip. |
| G12 Tap feedback & sticky hover | **Fail** | Measured: **23 of 23** `:hover` rules are unguarded by any `@media (hover: hover)` (e.g. `styles.css:134, 213, 219, 225, 339, 451`), so on touch, tapped controls keep their hover styling until the next tap elsewhere — the `.icon-btn` hover *outline ring* (`styles.css:134`) is especially visible when stuck. And **0** `:active` rules exist — no pressed-state feedback anywhere. The feedback model is inverted for touch: nothing on press, stale styling after release. |
| G13 Dialog ergonomics | **Pass** (one note) | Export dialog measured 358×335 at 390×844, centered, `max-height: 85vh` + internal scroll (`styles.css:498`), scrim tap + Escape close (`index.html:700`), focus trap + inert background (`app.js:998+`), action buttons measured 44px. Note: `85vh` and body `min-height: 100vh` (`styles.css:64`) use static viewport units — under iOS Safari's dynamic toolbar the visual viewport is smaller; `dvh`/`svh` would be more accurate. The note dialog's textarea sits mid-dialog, so keyboard overlap is plausible on short screens — untested in emulation. |
| G14 Landscape (844×390) | **Partial** | No overflow on any route (measured); nav swaps correctly to top links (`.nav-bottom` hidden > 640px, top links visible — measured). **But** the review session doesn't fit: session controls bottom edge measured at **479** vs. 390 viewport — verdict and nav buttons are below the fold on every card and require a scroll per card. The card keeps `min-height: min(52vh, 420px)` = 203px (fine); it's the stacked rows below that overflow. |
| G15 Scroll/animation performance | **Pass** (one note) | Touch handlers are `.passive` (`index.html:433-434`); live drag applies inline `transform` with `transition: none` (`app.js:712-714`) — 1:1 tracking, no layout work. Note: `filter: brightness(...)` sits on `body` (`styles.css:72`) permanently — it forces a containing block and full-page compositing even at brightness 1; cheap on modern devices but worth knowing. |
| G16 Touch path for selection UI (highlighting) | **Fail** (most severe) | Highlight creation — a core PRD feature — is triggered only by `@mouseup` (`index.html:178, 518`) and Shift+arrow `@keyup` (`app.js:924-927`). **Measured:** programmatic text selection + `touchend` + `selectionchange` → toolbar stays hidden; the same selection + `mouseup` → toolbar shows. Mobile browsers do not synthesize `mouseup` after a long-press text selection (iOS Safari never does), and there is no `selectionchange` listener (verified by grep). A phone user cannot highlight at all — they get the native copy callout and nothing from the app. The toolbar is also positioned *above* the selection (`y: rect.top - 52`, `app.js:942`), exactly where the native iOS callout appears, so even a fixed trigger would collide with it. |

---

## 3. Suggested fixes and regression tests

### 3.1 Fixes, ranked by severity

**S1 — Touch users can't highlight (G16).** `app.js`
- Add a debounced `document.addEventListener('selectionchange', ...)` (registered in `init()`) that, when the selection's `commonAncestorContainer` is inside a `.extract` on the results/detail page, calls the existing `showToolbarForSelection()`. Debounce ~250ms so the toolbar appears when the selection settles, not on every drag-handle move.
- On coarse pointers, position the toolbar **below** the selection rect (`rect.bottom + 12`) instead of `rect.top - 52` to avoid the native selection callout.
- Keep the existing mouseup/keyup paths; the new listener is additive.

**S2 — Dead coarse-pointer rule + sub-44px targets (G1/G1a).** `styles.css`
- Fix the specificity bug: change the media-query selector to `.search-wrap .icon-clear` (or move the bump into the base rule with `min-width/min-height: max(2.75rem, 44px)` on `.icon-clear`, which is simpler and self-documenting).
- In the `@media (pointer: coarse)` block, extend the floor to the rest: `.mode-toggle button { min-height: max(2.75rem, 44px); }` (the pill container can stay visually slim by keeping padding small — height comes from min-height), `.chip-filter { min-height: max(2.75rem, 44px); }`, `.card-article-link { min-height: max(2.75rem, 44px); }`, `.chip-tag .x { min-width: 24px; min-height: 24px; }` (24px WCAG floor is defensible for an inline chip control; 44px would distort the chip), and `.input-search { height: max(2.75rem, 44px); }`.
- Settings sliders: give `input[type="range"]` extra vertical hit area on coarse pointers (`padding: 0.75rem 0; background-clip: content-box;` or a wrapper with min-height 44px).

**S3 — iOS zoom-on-focus (G8).** `styles.css`
- In the coarse-pointer (or a `max-width: 640px`) block, raise input font sizes to 16px: `.input-search, .text-input { font-size: max(1rem, 16px); }` and `.input-tags input { font-size: 16px; }`. This is the standard, complete fix; no viewport-meta hacks needed (and `maximum-scale` must stay unset for WCAG 1.4.4).
- Add `enterkeyhint="search"` to both search inputs in `index.html` (`#search-home`, `#search-top`) — one-attribute win.

**S4 — Sticky hover + missing pressed state (G12).** `styles.css`
- Wrap all 23 `:hover` rules in `@media (hover: hover)` (mechanical change — they're already grouped by component).
- Add `:active` states for the main controls, e.g. `.btn-primary:active { background: var(--btn-primary-hover-bg); }`, `.btn-outline:active, .btn-text:active, .icon-btn:active { background: var(--color-surface); }`, `.flashcard:active, .dropdown .row:active { background: var(--color-background); }`. Monochrome-safe: reuse the existing hover treatments as the pressed state.

**S5 — Select-bar occludes the last card row (G4).** `styles.css`
- When the bar is fixed (≤ 640px), budget for it: e.g. `body:has(.select-bar:not([style*="display: none"])) main { padding-bottom: calc(6rem + 9rem); }` — or, simpler and more robust with Alpine, bind a class on `<body>`/`<main>` while `selectMode` is true and pad in CSS.
- Also consider slimming the bar to two rows at 390px (fold "Select all / Clear / Cancel" into a single row with the count) so it covers ~80px instead of the measured 122px.

**S6 — Landscape review requires a scroll per card (G14).** `styles.css`
- `@media (max-height: 480px) { .session-card .flip-area { min-height: min(42vh, 260px); } .verdict-row, .session-controls { margin-top: var(--space-sm); } }` — pulls the measured 479px stack under a 390px viewport. Alternatively place verdict buttons beside the card in landscape (`flex-direction: row` on `.session-wrap`).

**S7 — Muted-text contrast hairline miss (G11).** `styles.css:13`
- Darken light-theme `--color-text-muted` from `#6F6E66` to ~`#6A6961` (≈ 4.8:1 on `#EEEFEA`) — visually indistinguishable, clears AA. Dark theme already passes.
- Consider raising disabled opacity from 0.35 to ~0.5 so the disabled verdict buttons (the primary affordance hint on an unflipped card) survive outdoor glare.

### 3.2 Tests to keep future builds mobile-friendly

All E2E additions belong in a new `tests/e2e/mobile-guardrails.spec.js`, gated to the existing `mobile-chromium` project (`test.skip(({ isMobile }) => !isMobile)` or project filter), reusing `openApp`/`hashTo`/`seedCard` from `tests/e2e/helpers.js`. Seed should include one card with a 45+ character unbroken title and one with a very long extract — that's what nearly breaks layouts.

1. **No horizontal overflow, every route** — for each of `#/home`, `#/cards`, `#/card/<id>`, `#/settings`, `#/pairing`, and an in-app-started `#/review`: assert `document.documentElement.scrollWidth <= window.innerWidth`. Repeat once with `page.setViewportSize({ width: 320, height: 568 })`. This is the single highest-value guardrail and is nearly free.
2. **Touch-target sweep** — on each route, iterate visible `button, a[href], input, [role="button"], [tabindex]:not([tabindex="-1"])` and assert `getBoundingClientRect()` ≥ 44px in both dimensions, with an explicit, commented allowlist for deliberate exceptions (e.g. inline `.chip-tag .x` at the 24px floor). Run only in the mobile project. This directly pins the S2 fixes, including the `.icon-clear` specificity regression.
3. **Input font-size ≥ 16px** — on routes with inputs, assert `parseFloat(getComputedStyle(input).fontSize) >= 16` for every visible input/textarea. Pins S3.
4. **Select-bar reachability** — seed 13+ cards (2 pages) or enough to force scroll; enter select mode, scroll to bottom, assert the last `.flashcard`'s rect does not intersect the `.select-bar` rect, and that all bar buttons are ≥ 44px. Pins S5.
5. **Swipe navigation** — using a CDP touch-drag helper (`Input.dispatchTouchEvent` sequence — Playwright's `tap()` alone can't drag): (a) left swipe past 80px advances `session.idx`; (b) right swipe goes back; (c) a 40px drag snaps back without advancing; (d) a tap immediately after a drag does **not** flip (`_suppressFlip`); (e) with `page.emulateMedia({ reducedMotion: 'reduce' })`, a fling still advances. The audit's working CDP swipe helper can be lifted directly.
6. **Touch highlighting** (after S1 lands) — on the detail page, create a `Range` over the extract, dispatch `selectionchange`, assert the `.sel-toolbar` becomes visible and that confirming it produces a `mark.hl`; also assert the toolbar renders *below* the selection rect on the mobile project.
7. **Safe-area + fixed-bar CSS presence** (unit layer, cheap) — a `node:test` that reads `app/styles.css` and asserts `env(safe-area-inset-bottom)` appears in the `.nav-bottom`, `.toast`, and `.select-bar` rules, and (after S4) that every `:hover` occurrence sits inside an `@media` block containing `hover: hover`. Emulation can't measure `env()`, so a source-level assertion is the honest guardrail.
8. **Landscape review reachability** — viewport 844×390, start a session, assert `.verdict-row` and `.session-controls` are within the viewport without scrolling (or, if the scroll-per-card tradeoff is accepted, assert `scrollHeight - innerHeight` stays under one comfortable flick, e.g. < 200px). Pins S6.
9. **Bottom-nav clearance** — on a seeded `#/cards` at 390×844, scroll to bottom and assert `main`'s bottom edge ≤ `.nav-bottom`'s top edge (already true today — this pins it).

### 3.3 Explicitly *not* recommended

- Don't add `maximum-scale=1` to suppress iOS input zoom — it breaks pinch-zoom (WCAG 1.4.4). Fix the font sizes instead (S3).
- Don't convert the caption scale (11px) wholesale to a larger size — it's bold/uppercase/short-string usage and part of the e-ink identity; only the muted *color* needs the S7 nudge.
- Don't replace the swipe threshold/axis-lock logic — it measured correctly and already satisfies WCAG 2.5.1 via the button fallbacks.

---

## Appendix: raw measurements (iPhone 13 Pro profile, 390×844, DPR 3)

| Probe | Result |
|---|---|
| Horizontal overflow, all 6 routes @ 390 / 320 / 844×390 | none (`scrollWidth == innerWidth` everywhere) |
| Bottom nav | 56px tall, links 195×55 & 196×55; content clears at max scroll |
| Select-bar (390px) | fixed, **122px tall** (3 wrapped rows), 8px above nav; last card bottom 699 vs bar top 658 → **occluded** |
| Verdict buttons | 115×44 and 104×44, disabled until flip |
| Session controls (portrait) | bottom edge 696 < 844 → fits without scroll |
| Session controls (landscape 844×390) | bottom edge **479 > 390** → scroll required |
| Swipe left / right (CDP touch) | idx 0→1→0 — both directions work; tap-flip unaffected after drag |
| Touch text-selection → toolbar | `touchend` + `selectionchange`: **not shown**; `mouseup`: shown |
| `.icon-clear` (coarse) | **25×24px** — coarse bump dead (specificity) |
| Mode toggles / filter toggles / chips / article-link | 28px / 24px / 38-39px / 39px tall |
| Input font sizes | search 15px, pairing 15px, tag inputs 13px, textareas 16px |
| Hover/active rules | 23/23 `:hover` unguarded; 0 `:active` rules |
| Export dialog | 358×335 centered, buttons 44px, `max-height: 85vh` |
| Contrast (computed) | muted/bg light **4.43** (fail by hair); muted/surface 4.82; secondary/bg 6.60 light, 7.79 dark; dark muted/bg 5.28 |
