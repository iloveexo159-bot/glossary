---
version: alpha
name: Glossary
description: A strict-monochrome e-ink design system for Glossary, a distraction-free Wikipedia lookup and flashcard PWA, derived from Kindle e-reader reference imagery.
colors:
  # — Light theme (default) —
  background: "#EEEFEA"
  surface: "#F8F8F5"
  text-primary: "#191918"
  text-secondary: "#54544E"
  text-muted: "#6F6E66"
  border: "#D7D7D0"
  border-strong: "#A9A89E"
  highlight: "#F0E6A8"
  # — Dark theme (same semantic roles, -dark suffix) —
  background-dark: "#131312"
  surface-dark: "#1D1D1B"
  text-primary-dark: "#E8E8E2"
  text-secondary-dark: "#A9A8A0"
  text-muted-dark: "#8A897F"
  border-dark: "#343431"
  border-strong-dark: "#4C4C46"
  highlight-dark: "#5A5122"

typography:
  display:
    fontFamily: Literata, Georgia, serif
    fontSize: 3.5rem
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: Literata, Georgia, serif
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.2
  heading:
    fontFamily: Mulish, system-ui, sans-serif
    fontSize: 1.375rem
    fontWeight: 700
    lineHeight: 1.25
  body-reading:
    fontFamily: Literata, Georgia, serif
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: Literata, Georgia, serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: Mulish, system-ui, sans-serif
    fontSize: 0.9375rem
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: Mulish, system-ui, sans-serif
    fontSize: 0.8125rem
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: Mulish, system-ui, sans-serif
    fontSize: 0.6875rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.08em

rounded:
  none: 0px
  sm: 4px
  md: 8px
  full: 9999px

spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  base: 1rem
  lg: 1.5rem
  xl: 2rem
  2xl: 3rem
  3xl: 4rem

components:
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.background}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 0rem 1.5rem
    height: 2.75rem
  button-primary-hover:
    backgroundColor: "#33332F"
    textColor: "{colors.background}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 0rem 1.5rem
    height: 2.75rem
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0rem 1rem
    height: 2.75rem
  button-outline-hover:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0rem 1rem
    height: 2.75rem
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0.5rem 0.75rem
  bookmark-save:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    size: 2.25rem
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    padding: 0rem 1.25rem
    height: 3rem
  input-search-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    padding: 0rem 1.25rem
    height: 3rem
  dropdown-suggestions:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  chip-filter:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0.375rem 0.875rem
  chip-filter-active:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0.375rem 0.875rem
  chip-tag:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0.1875rem 0.625rem
  chip-tag-removable:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0.1875rem 0.375rem 0.1875rem 0.625rem
  input-tags:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0.375rem 0.5rem
  card-flashcard:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  card-flip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
    flipDurationMs: 250
  card-article-link:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    padding: 0.75rem
  session-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
  verdict-btn:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 0.5rem 1.5rem
  verdict-btn-marked:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.surface}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 0.5rem 1.5rem
  select-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: 0.5rem 1rem
  star-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    size: 2.25rem
  saved-item-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.base}"
  toolbar-selection:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  dialog-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  note-editor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.base}"
  highlight-mark:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-reading}"
  note-marker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    size: 0.875rem
  slider-track:
    backgroundColor: "{colors.border-strong}"
    rounded: "{rounded.full}"
    height: 2px
  slider-thumb:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: 1.5rem
  nav-top:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    typography: "{typography.ui}"
    height: 3rem
  nav-bottom:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.ui}"
    height: 3.5rem
  book-footer:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    padding: "{spacing.base}"
  badge-drift:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0.25rem 0.625rem
  badge-source:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    borderColor: "{colors.border}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0.25rem 0.625rem
  toast:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 0.75rem 1.25rem
---

# Glossary Design System

## Overview

Glossary is a distraction-free Wikipedia lookup and flashcard PWA for physical-book readers, used in stolen seconds mid-chapter on a phone and in longer review sessions on a laptop. The design's job is to feel like a dedicated e-reading device — the Kindle interfaces in the reference imagery — not a website: strictly monochrome, typographic, flat, and calm, so a lookup never becomes browsing. The signature is the device vernacular itself: letterspaced-caps "book footer" progress lines (CARD 3 OF 12), squarer hardware-style dialogs, the quick-settings brightness/warmth sheet, and a fill-vs-outline bookmark that carries saved state without a word. Two anti-patterns rule everything: never look like a generic web page (colored buttons, gradients, decorative motion), and never suggest a way out (nothing may resemble an outbound link). This system is derived solely from the MVP PRD and the annotated e-reader reference screenshots.

## Colors

The palette is strict monochrome with exactly one hue. `background` (#EEEFEA) is the cool grey-green cast of an e-ink panel; `surface` (#F8F8F5) is one step lighter for anything sitting on the page — cards, inputs, overlays. Text runs a three-step ink ramp (`text-primary` 15.2:1, `text-secondary` 7.1:1, `text-muted` 4.7:1 against background — all WCAG AA or better at their sizes). There is deliberately no accent color: interactive states are expressed the way the reference hardware expresses them — fills, borders, underlines, and weight. Focus rings are a 2px `text-primary` outline. Destructive actions get no red; like the reference's DELETE, they are quiet uppercase text buttons whose safety comes from confirmation steps, not color. The one hue is `highlight` (#F0E6A8), a soft page-marker yellow reserved exclusively for reader-saved highlights — because it is the only color on the page, "saved by you" is scannable at a glance.

Dark mode mirrors every role with a `-dark` token: warm near-black `background-dark` (#131312) and off-white `text-primary-dark` (#E8E8E2) — never pure black/white, which glares during night reading — and `highlight-dark` (#5A5122), the same yellow compressed to an ember that keeps 7:1 text contrast. Theme is a per-device preference (localStorage, PRD §2.1). Light mode additionally exposes two runtime comfort variables from the PRD's sliders: `--reading-brightness` (a `brightness()` filter on the app root; the Settings slider presents it as steps **1–20**, mapped linearly to 0.85–1.0, matching the reference device's scale) and `--reading-warmth` (0–0.18 opacity of a fixed, pointer-events-none amber overlay, #E0B464). Both live outside the token palette, apply to the whole canvas, and are never active in dark mode. The active theme must also be declared to the platform: set `color-scheme: light` / `color-scheme: dark` on the root (plus `<meta name="color-scheme" content="light dark">`) so native surfaces — the mobile on-screen keyboard, scrollbars, form controls — render in the matching light/dark variant, and set the PWA `theme-color` meta per theme so installed-app chrome matches. Exact keyboard colors cannot be themed (the keyboard belongs to the OS and the user's keyboard app); light/dark agreement is the achievable and expected behavior.

## Typography

Two families with a strict division of labor: **Literata** — Google's e-book typeface, the closest freely-licensable spirit to the reference device's reading serif — for everything the user *reads* (summaries, card content, highlights), and **Mulish**, a quiet humanist sans close in skeleton to the reference UI font, for everything the user *operates* (buttons, nav, labels, inputs). The scale is defined entirely in `rem` because the PRD requires an adjustable font size: the setting changes one root variable (`html { font-size: calc(100% * var(--user-font-scale, 1)) }`) and the whole interface scales coherently — never per-element font-size overrides. Because the base is `100%` rather than a fixed pixel value, the scale also inherits each device's own default and accessibility settings (a reader who has raised their OS/browser font size gets a proportionally larger app before touching the in-app control). The two largest levels are the exception to fixed sizing: `display` and `title` may compress on narrow viewports via `clamp()` (e.g. `clamp(2.5rem, 8vw, 3.5rem)` for `display`) so the wordmark and article titles never crowd a phone screen. `body-reading` (1.25rem / 1.7) is the workhorse: lookup text read in one glance, so the line-height is generous and the measure capped (see Layout). `display` is the wordmark alone; `title` is the article term; `caption` — small, bold, letterspaced caps — is the device's own voice (CHAPTER 1 · 1 OF 24) and is used for the book footer, badges, and metadata. Never introduce a third family, and never set reading content in Mulish: the serif/sans split *is* the hierarchy.

## Layout

Spacing snaps to a 0.25rem-base scale (`xs` through `3xl`); because it is rem-based, rhythm scales with the user's font-size preference. Density is comfortable: reading surfaces pad at `lg`–`xl`, control clusters gap at `sm`–`md`, page sections separate by `xl`–`2xl`. Reading columns cap at 65ch — a book-page measure — centered like a page, with the flashcards grid capped at 900px. The whole app sits inside a frame: the body carries a `clamp(1rem, 5vw, 4rem)` horizontal margin so content never reaches the extreme screen edge — margins only, no drawn border, the calm bezel of a reading device. The app is one column at every width; what changes between phone and laptop is input method, not layout metaphor (PRD §2.3). On narrow/touch viewports navigation lives in a 3.5rem bottom bar (Home | Collection) with an underlined active item; on desktop the same two destinations sit in the top bar. The top bar itself spans the screen (its background and hairline run edge to edge) but its *contents* are constrained to the same centered 900px column as the page body, so on a wide monitor the nav lines up with the content instead of hugging the screen edge; nav links and the Settings gear are pinned to the column's right edge on every page. The root also reserves the scrollbar gutter (`scrollbar-gutter: stable`) so the centered column never shifts sideways between short and long pages. A ← back control opens every page except Home and follows real navigation history — it returns to the page the reader actually came from, not a hardcoded parent. All interactive targets are at least 44px on touch. Every control is keyboard-reachable with a visible focus state — desktop is a first-class input path, not scaled-up touch.

## Elevation & Depth

Depth comes from borders and contrast, not shadows — an e-ink panel cannot render a soft shadow, and honoring that physical constraint is what makes the app read as a device. Two surface levels exist: `background` (the page) and `surface` (anything on it), separated by a 1px `border` hairline; `border-strong` marks hover and working dividers. Shadows exist at exactly two levels, always paired with a hairline border: `shadow-sm` (0 1px 2px rgba(25,25,24,0.10)) for floating-but-attached elements — the suggestions dropdown, the selection toolbar — and `shadow-md` (0 6px 20px rgba(25,25,24,0.15)) for the note dialog and export sheet, which sit above a rgba(19,19,18,0.35) scrim. In dark mode shadows are near-invisible by design; borders carry the depth. Motion follows the same restraint: ambient state changes are instant or a ≤150ms fade and nothing ever animates to *attract* attention. The one deliberate exception is the flashcard **flip** — a 250ms 3D `rotateY` that *is* the interaction, not decoration: it communicates the physical front/back model of a card the way turning a real card does, so the extra duration earns its keep. Even so it obeys the same law as everything else: `prefers-reduced-motion` collapses the flip (and every transition and animation) to an instant swap, so a reduced-motion reader still gets the state change with zero movement.

## Shapes

Three radii, each with a meaning. `full` (pill) marks type-and-tap immediacy: the search field, filter and tag chips, slider thumbs — taken directly from the reference's pill search bar and "bubble filters." `sm` (4px) is the working radius for buttons, the selection toolbar, and dialogs — the reference hardware's dialogs are nearly square, and keeping overlays at `sm` rather than a soft 12–16px is a deliberate device-like choice. `md` (8px) is for resting containers: cards, dropdowns, toasts. Nothing between `md` and `full` — a 16px-rounded card is the fastest way to look like the generic web app this system exists to avoid. `note-marker` is the one sharp-cornered element: a tiny square superscript box, exactly as the reference renders inline note indicators.

## Components

**Search.** `input-search` is the pill field with a leading search icon and trailing ✕ clear control (annotated in the reference: ✕ exits back to home); focus replaces the hairline with the 2px ink outline (`input-search-focus`). On the **Home** page the search is not in the top bar at all: it sits centered under the wordmark as a hero field (Google-homepage style), with recent searches listed directly beneath — so Home's top bar carries only the nav links and Settings gear. The same `input-search` component is reused in all positions; only its placement and placeholder change. The top-bar Wikipedia field appears on Results, Flashcards, and card detail; its value mirrors the *current* results context only — leaving the Results page empties it, so a past search term never lingers in the field on other pages. The leading icon is a stroke SVG (not a glyph character, whose baseline alignment is unreliable across fonts), sized 1.125rem and vertically centered. Icon controls — the ✕ clear, the Settings gear — are real buttons, and all of them share one hover/focus affordance: the same 2px ink outline used for keyboard focus, pill-shaped around the icon. `dropdown-suggestions` floats beneath at `shadow-sm` showing the top 5 live matches while typing, per the annotations; a mistyped or unmatched query gets a plain-language error row telling the reader what to try, not a dead end. Recent searches reuse the same panel anatomy with a header row — "Recent searches" plus a CLEAR HISTORY text button — and the empty state reads "There are no recent searches." exactly as the reference does: a statement, not an apology.

**Buttons.** `button-primary` is the filled-ink bar (search submit): in a monochrome system, maximum contrast *is* the primary affordance. `button-outline` is the secondary pattern; hovering inverts it to filled. `button-text` is the reference's uppercase dialog action (SAVE · CANCEL · DELETE) — including destructive actions, which are distinguished by wording and a confirm step, never by red.

**Filters & chips.** The Collection page filters in three registers, all ANDed with the saved-card text search. **Status** is two compact segmented toggles — the same `mode-toggle` pill used elsewhere, at `mode-toggle-sm` scale — reading **Reviewed: All / Yes / No** and **Exported: All / Yes / No**; two binary questions read cleaner as two three-way switches than as four separate on/off chips. The exported state is stamped on a card whenever it is included in a download (`lastExportedAt`), the same way revealing an answer stamps `lastReviewedAt`. **Tags** are `chip-filter` "bubble filter" pills and are **multi-select**: any number can be active at once and a card matching *any* selected tag shows (OR within the row), with an "All" chip that clears the set; the active chip inverts to filled ink (`chip-filter-active`), exactly like the reference's selected filter. A single **★ Starred** `chip-filter` narrows to cards the reader has starred. `chip-tag` is the smaller bordered pill showing a card's own tags on the card face.

**Collection.** The page (titled **My Collection**) reads top-down: the title, the saved-cards search field directly beneath it (full `input-search` anatomy — it filters the grid live and sits with the content it filters, never in the top bar), a toolbar with the **Overview / Flashcards** display toggle (`mode-toggle`) on the left and the two entry buttons — **Review** (`button-primary`) and **Export** (`button-outline`) — pinned to the column's right edge, then the Status toggles, Tags chips, and ★ Starred filter, then the grid. The grid pages at 12 cards: a centered pager of two `button-text` controls (← PREVIOUS / NEXT →) flanking a `caption` page line (PAGE 1 OF 2) sits between the grid and the book footer, and any filter change snaps back to page 1. Every card carries a corner **star** `icon-btn` (☆ outline / ★ filled) the reader taps to mark for recall — `@click.stop` so it never triggers the card's own tap.

`card-flashcard` (Overview mode) is a `surface` panel with hairline border and `lg` padding: Mulish for the term and metadata, Literata for the summary, tag chips below. Hover deepens the border to `border-strong`, adds `shadow-sm`, and reveals edit/delete controls (always visible on touch). `card-flip` (Flashcards mode) is the same panel that **flips whole**: the card element is a transparent 3D stage and the visible surface (background, hairline, radius) lives on its two **faces**, so a 250ms 3D `rotateY` turns the entire card — not just its contents — between a front face (the term alone, set in `title`, centered) and a back face (the answer in Literata that scrolls from the top, plus a hairline-topped **card-article-link** — an uppercase-caption "VIEW FULL ARTICLE" strip). The article strip lives *on the back face only*, so it exists exactly when the answer does — there is no way to open the article without first revealing it. Tap flips both ways; the strip opens the frozen detail record (never live Wikipedia).

**Selecting cards.** Both entry buttons open one selection mode, distinguished by intent. Rather than morph the browse toolbar, a dedicated **select-bar** appears as its own row — a `surface` banner with a `border-strong` hairline (the "you are picking cards" state) — reading `N selected · Review` (or `· Export`) on the left and, on the right, three management `button-text` verbs **Select all · Clear · Cancel** plus one `button-primary` launch verb (**Review (n)** or **Export (n)**) that appears once at least one card is picked. Select all operates on the currently *filtered* set, so filter-to-a-topic → Select all → Review is two taps; Clear is disabled until something is selected. This is the standard select-then-act pattern (as in a mail or photos app): the browse toolbar never reshuffles under the reader, and there is never more than one primary button in play at a time.

**Review session (focused mode).** Launching Review opens a distinct full-column study view (its own route). A single `session-card` sits centered — the same whole-card flip anatomy as `card-flip` but sized large (`min(52vh, 420px)`), with the full (unclamped) answer on the back. Once the answer is revealed, two `verdict-btn` controls — **✗ Wrong** and **✓ Right** — record how the reader did and advance to the next card; they stay disabled until the card is flipped, so a face is never graded before it is seen, and the chosen verdict inverts to filled (`verdict-btn-marked`). Advancing with **→** instead leaves no verdict, and that counts as a **skip**. Below the card, `session-controls`: a ← / → arrow pair (`icon-btn`, prev disabled on the first card) flanking a `caption` position line (`3 / 12`); above it, a `caption` session count and a **shuffle** `icon-btn`. The whole flow is keyboard-native (arrows move, space flips), and revealing an answer stamps the card reviewed. A detour into a card's full detail via the article strip and back resumes the session in place. Finishing the last card lands on a results `state-box`: a pass/fail line (the reader passes when correct answers outnumber wrong-plus-skipped), the score line (`You got 7/10 correct, and skipped 0 cards`), and two ways forward — **Restart** the whole deck, or **Revise** just the wrong-and-skipped cards — beside a quiet return to the collection. Monochrome throughout: right and wrong are told by glyph, label, and the filled/outline state, never by colour.

**Saving.** `bookmark-save` is the single save control on the results and detail pages — a bookmark icon sized to the `title` beside it (outline = unsaved, filled = saved). It replaces a labeled "Save" button: in this monochrome system a filled-vs-outline icon carries the saved state at a glance. Saving is immediate and wordless — one click saves the card (a `toast` confirms) with no dialog interrupting the read; clicking the filled bookmark again unsaves it (back to outline), confirming first if a note or highlights would be lost with it. Card-level note and tags are entered **inline** below the article in a `note-editor` — an "Add notes & tags" block with a borderless textarea and an `input-tags` field — whose Save commits the note and clears the input. The saved note then drops into an **Existing notes** section just beneath, alongside every highlight: card note and highlights share one white container, `saved-item-card`, each with EDIT / REMOVE controls — one consistent "saved item" treatment for everything the reader has kept, shown right on the result without opening the flashcard. EDIT lifts a saved note back into the same inline editor for changes; while editing, the block is titled "Edit notes & tags" and gains a CANCEL.

**Annotation.** `toolbar-selection` appears over any text selection: a light `surface` strip with hairline border and `shadow-sm` — matching the reference toolbar — offering two labeled actions, Highlight and Note (highlight + note). `dialog-note` is the near-square note dialog: a "Note" heading set in `heading` (so it always outranks the serif body text, which renders optically larger than sans at equal size) with ✕ close, a borderless textarea, then a separate **Tags** field (`input-tags`) below it, and a right-aligned DELETE · CANCEL · SAVE text-button row. In the tags field, typing a space commits the current text as a `chip-tag-removable` — a bordered monochrome pill with a trailing ✕ that removes it (Backspace on an empty field removes the last chip). The field autocompletes against previously-used tags, per the PRD's guard against near-duplicate tag drift. `highlight-mark` is the yellow wash on saved text, and the entire wash is an interactive target: hovering shows a pointer and a 2px ink underline beneath the highlight, and clicking (or tapping, or Enter when focused) anywhere on it opens the attached note — not just the marker. If a note is attached, a `note-marker` — the tiny numbered square box from the reference — sits superscript at the highlight's end as the visible indicator and an equivalent target.

**Device chrome.** `nav-top` is the persistent top bar. Its background and hairline span the screen, its contents share the centered content column, and its anatomy is fixed so nothing moves between pages: ← back, the Glossary wordmark (both on every page except Home), the Wikipedia search field (on Results, Collection, and card detail), then Home | Collection and the Settings gear pinned to the column's right edge — those last three occupy the identical position on every page, Home included. Home keeps its bar minimal (nav + gear only) because search there is the centered hero field. The field keeps the full `input-search` anatomy everywhere (leading SVG icon, focus ring, trailing ✕ clear when it has input); the saved-flashcards search is *not* in the bar — it lives on the Collection page under the title (see Collection). On narrow viewports the wordmark is dropped from the bar (the bottom bar already carries Home) so the search field keeps a usable width beside back + gear. The gear is an `icon-btn`: a real button with the shared pill 2px-ink hover/focus outline. `nav-bottom` is the mobile 3.5rem two-item bar with underlined active state. `book-footer` is the signature element: a letterspaced-caps progress line in `text-muted` (CARD 3 OF 12 · 2 SAVED THIS WEEK) that gives flashcard browsing and review the cadence of a page footer. `slider-track`/`slider-thumb` build the brightness and warmth controls: a 2px track whose filled side is ink, a 1.5rem bordered thumb, − / + step buttons at the ends, and the current value above the thumb, as in the reference quick-settings sheet; brightness runs on the device's own 1–20 scale. `badge-drift` is the PRD's passive "updated on Wikipedia" indicator: a bordered caption pill in muted ink — noticeable when sought, silent otherwise. It appears wherever the frozen saved copy has diverged from live Wikipedia (results and detail). The saved copy never changes on its own; the detail view offers one reader-controlled `button-text` action, **UPDATE SAVED COPY**, that pulls in the live text and re-anchors existing highlights to it, warning via `toast` if any highlight text no longer matches. `toast` is the inverted-ink save confirmation, bottom-center, auto-dismissing — and it doubles as the honest failure signal: if a write can't be persisted (device storage full or blocked), the save is rolled back and the toast warns rather than falsely confirming.

**Source provenance & dictionary fallback.** A lookup that Wikipedia can't answer with a single article — a genuine 404, or a low-value disambiguation stub (e.g. "ignominy", whose disambiguation lists only obscure works by that name) — falls back to a dictionary definition rather than dead-ending. The dictionary is a second *source*, and source is the ONLY thing that distinguishes the two kinds of result: highlighting, notes, tags, review, and export all treat a dictionary card identically to a Wikipedia one (drift is the sole exception — a dictionary entry has no Wikipedia revision to track, so its badge never appears). `badge-source` marks provenance where it aids a reading or saving decision: a bordered caption pill reading **WIKIPEDIA** or **DICTIONARY** on the Results header and card Detail. It is deliberately *absent* from the Collection overview grid, where it only added clutter; there, the card title carries the term and the source is a detail for when the card is opened. In the suggestions dropdown a compact `src-tag` marks a dictionary hit inline (Wikipedia suggestions stay unmarked — the app's whole identity is Wikipedia search, so unmarked reads as Wikipedia). A dictionary result adds three reading affordances the encyclopedic path never had: a `pronounce` line (IPA in reading serif plus a play control, shown only when the API actually returns audio — often it does not), the definition itself composed one line per part of speech, and a `synonyms` row of tappable tag chips that each launch a fresh lookup. On a disambiguation page the dictionary is offered as a `dict-option` — a full-width actionable row above the Wikipedia candidates — so a multi-topic term like "Mercury" keeps its useful disambiguation while a plain word gets its definition in one tap. When a disambiguation yields *no* usable candidates at all, the page never dead-ends on an empty heading: it falls through to the dictionary definition, or — failing that — the standard no-result screen with a way back. Definitions and phonetics come from the Free Dictionary API (dictionaryapi.dev); synonyms from Datamuse — both keyless and CORS-accessible from the browser, so the no-backend architecture holds. On the Collection card the term and its `star-btn` share one centered `card-head` row: the title flexes and wraps to a new line rather than running under the star, so even a long term like "Chimamanda Ngozi Adichie" never collides with the corner control.

## Do's and Don'ts

**Do:**
- Reference every color, size, and radius through its token — no raw hex or px values in component CSS outside `:root`.
- Keep the serif/sans split absolute: Literata is read, Mulish is operated.
- Size and space in rem so the user's font-size setting scales the whole interface coherently.
- Give every interactive element a visible 2px ink `:focus-visible` outline — desktop keyboard use is a first-class path.
- Define light and dark values together whenever a color token is added; a light-only token is incomplete.
- Express hierarchy with contrast, borders, and weight first; reach for a shadow only at the two defined levels.

**Don't:**
- Don't introduce any accent hue — yellow means "saved by the reader" and nothing else may carry color.
- Don't add a third font family, a third surface level, or a radius between `md` and `full`.
- Don't style destructive actions red — quiet text button plus confirmation, like the device.
- Don't animate for attention: nothing pulses, bounces, or slides in; ≤150ms fades only, none under reduced motion.
- Don't render anything that looks like an outbound link — nothing in this app navigates away, and the visual language must never suggest it.
- Don't let chrome grow: if a screen needs explanatory text, reconsider the screen before adding the text.
