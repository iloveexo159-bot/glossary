# Glossary — Web Interface Best-Practices Audit

> Audit date: 2026-07-06 · Scope: `app/index.html`, `app/app.js`, `app/styles.css`
> Purpose: diagnostic only — no code was changed. To be actioned in a separate session.
> Line numbers reflect the files at the time of the audit; re-verify before editing.

## 1. Summary

Glossary is a well-crafted, thoughtfully-built SPA whose author clearly cares about accessibility and interaction detail: nearly every icon button has an `aria-label`, toggles carry `aria-pressed`, dialogs use `role="dialog"`/`aria-modal`, the 44px touch floor is rigorously enforced with `max()`, reduced-motion is honored globally, and there's a strong CSP with no inline event handlers leaking past it. The main gaps are systemic rather than sloppy:

- **(a)** every hidden "page" stays in the DOM and can leak into the tab order because `x-show` only sets `display:none` after Alpine hydrates and `x-cloak` is applied inconsistently;
- **(b)** no live regions exist, so toasts, filter-result changes, and loading states are silent to screen readers;
- **(c)** dialogs lack focus trapping and focus restoration.

None are catastrophic for a personal single-user tool, but the tab-order leakage and silent dynamic updates are the two things that most undercut an otherwise strong a11y posture.

## 2. What's working well

- **Icon buttons are consistently labeled.** Back (`index.html:27`), clear-search (`:40`), settings (`:76`), bookmark with dynamic label + `aria-pressed` (`:157-160`), star with dynamic label + `aria-pressed` (`:290-292`), shuffle (`:348`), session nav (`:377-380`). This is the single most commonly-failed rule and it's handled thoroughly.
- **Decorative SVGs correctly carry `aria-hidden="true"`** everywhere (`:33, :77, :91, :161, :211, :349`, etc.), so they don't pollute the accessibility tree.
- **Toggle state is exposed semantically** via `:aria-pressed` on stars, bookmarks, the flip areas (`:315, :360`), and the Starred filter (`:265`).
- **Strong focus-visible system** — a single global rule covers buttons, inputs, textareas, links, and `[tabindex]` with a 2px outline + offset (`styles.css:86-87`), and it's `:focus-visible`, not `:focus`. Compound tag inputs use `:focus-within` (`styles.css:449`).
- **Reduced-motion is honored globally** and collapses both transitions and animations, including the 3D flip (`styles.css:75-77`).
- **44px touch floor is enforced against font-scale shrink** using `max(2.75rem, 44px)` (`styles.css:126`) and re-applied to text buttons/chips on coarse pointers (`styles.css:480-484`).
- **CSP is strict and the code respects it** — all handlers are Alpine `@`-directives (compiled, not inline `onclick`), so nothing depends on `'unsafe-inline'` for scripts (`index.html:7`).
- **Roving `tabindex` on the flip-card article link** — the back-face "View full article" button is `tabindex="-1"` until the card is flipped (`:325, :370`), a genuinely nice touch that keeps hidden affordances out of the tab order.
- **`color-scheme` is set** on `<html>` and in both theme token blocks (`index.html:6`, `styles.css:8, 23`), and `scrollbar-gutter: stable` prevents layout shift (`styles.css:59`).
- **Destructive actions confirm** — card deletion uses `confirm()` with highlight-count context (`app.js:323, 557`).
- **Escape and backdrop-click close all three dialogs** (`index.html:540, 564, 586`).

## 3. Needs improvement

### High

**H1 — Hidden pages leak into the tab order (all-in-DOM `x-show` risk).**
`index.html:84, 125, 205, 343, 402, 452, 508` — Every page section is toggled with `x-show`, which sets `display:none` **only after Alpine hydrates**. The home section (`:84`) has no `x-cloak`, and `x-show`'d elements without `x-cloak` are focusable during the pre-hydration flash. More importantly, once loaded, an SPA on `#/home` still has the Collection, Review, Detail, Settings, and Pairing sections in the DOM. `display:none` does remove them from the tab order, so *steady-state* is mostly OK — but any element that ends up shown when it shouldn't be, or momentarily un-cloaked, becomes reachable. **Verify with a keyboard:** Tab through `#/home` and confirm focus never lands in Collection/Settings controls. Why it matters: this is the classic failure mode of "all pages coexist," and it's the highest-risk area for this architecture.

**H2 — No live regions; dynamic changes are silent to screen readers.**
`index.html:607` (toast), plus every `showToast()` call in `app.js`. The toast is a plain `<div class="toast" x-show="toast" x-text="toast">` with no `role="status"`/`role="alert"`/`aria-live`. Confirmations ("✓ Saved to flashcards", "Card deleted", "That overlaps an existing highlight", export/import results) are never announced. Same for: the results loading state ("Looking up…", `:127`), error/offline states, and the filtered card count in the footer (`:339`). Grep confirms **zero** `aria-live`/`role="status"` in the file. Why it matters: a screen-reader user gets no feedback that a save, delete, import, or search succeeded or failed.

**H3 — Dialogs have no focus trap and no focus restoration.**
`index.html:540-561, 564-583, 586-604`. The three modals set `role="dialog" aria-modal="true"` and autofocus the first field (`app.js:297, 697`), and Escape/backdrop close them — good. But: (1) Tab is **not trapped**, so keyboard focus can leave the dialog and land on the page behind it (which is also not `inert`/`aria-hidden`); (2) on close, focus is **not restored** to the control that opened the dialog (the bookmark/EDIT/highlight button), so the user is dumped at the top of the document. `aria-modal="true"` tells AT to isolate the dialog, but real focus containment and restoration are still required for keyboard users. Why it matters: modal keyboard UX is broken in both directions (escape into the page, lost place on return).

### Medium

**M1 — Highlight marks are `role="button"` but have no keyboard activation handler.**
`app.js:585` renders `<mark class="hl" ... role="button" tabindex="0" aria-label="Highlight N">`. It's focusable and announces as a button, but activation is wired only through `@mouseup` on the container (`onTextMouseUp`, `app.js:620`) — there is no `keydown`/Enter/Space path to open the note. A keyboard user can Tab to the highlight and hear "button" but pressing Enter does nothing. Same applies to the injected `.note-marker` button (`app.js:586`) — it's a real `<button>` so it *is* activatable, but its click is also only caught by the container's `@mouseup`, not a real click handler on the element. Why it matters: promised interactivity (`role="button"`, focusable) that keyboards can't reach is worse than a plain non-interactive element.

**M2 — Overview flashcard has Enter but no Space activation; grid card is a `<div role="button">`.**
`index.html:286-288` — the overview card handles `@keydown.enter.prevent` but not Space; native buttons activate on both. (The flip cards at `:314` and session card at `:359` correctly handle both — the overview card is the inconsistent one.) Also, these are `<div role="button" tabindex="0">` rather than real `<button>`s; a real element would give activation, focus, and semantics for free. Why it matters: keyboard users expect Space to activate anything that announces as a button.

**M3 — `<img>` elements have no `width`/`height` → layout shift.**
`index.html:164` (result image) and `:419` (detail image) set only `:src`/`:alt`. With no intrinsic dimensions, the reading column reflows when the Wikipedia thumbnail loads (it's floated right into serif body text). CSS caps `max-width/max-height` (`styles.css:226`) but that doesn't reserve space. Add `width`/`height` (or an aspect-ratio box) and `loading="lazy"`. Why it matters: content jump while reading is exactly what this e-ink-calm app is trying to avoid.

**M4 — Segmented toggles use `role="tablist"` / `role="group"` incorrectly.**
`index.html:219` marks the Overview/Flashcards switch as `role="tablist"` but the buttons have no `role="tab"`, no `aria-selected`, and control no `role="tabpanel"` — so AT announces a tablist with no tabs. The Reviewed/Exported groups (`:248, :256`) use `role="group"` with buttons that lack `aria-pressed`, so the active state (conveyed only by the `.active` class / background color) isn't exposed to AT at all. Why it matters: state and structure that sighted users see via color are invisible to screen readers; and a malformed tablist actively misleads.

**M5 — Theme toggle `id` collides with its `<label for>` but points at a non-labelable element.**
`index.html:458-459` — `<label for="set-theme">Theme</label>` targets `<div class="mode-toggle" id="set-theme">`. A `<div>` isn't a labelable form element, so the association is inert; clicking "Theme" does nothing and AT won't tie the label to the control group. (The range inputs at `:465-474` are correctly `for`/`id` paired — this is the one broken pairing.) Why it matters: broken label semantics on the one settings control that isn't a native input.

**M6 — Selection toolbar is a floating menu with no roles, no keyboard reachability, and pixel-positioned off a mouse selection.**
`index.html:534-537`, positioned in `onTextMouseUp` (`app.js:634-639`). It appears only on `@mouseup` after a drag-select, is placed by absolute `left/top` px, and has no `role="menu"`/`toolbar` or keyboard entry point. Text selection + this popover is inherently mouse-only; there is no keyboard path to create a highlight at all. Why it matters: the app's core "select text → highlight & save" feature is unavailable to keyboard/AT users.

**M7 — Pairing code input lacks `autocomplete="off"` and a labeled pattern.**
`index.html:520` — `inputmode="numeric" maxlength="6"` is good, but no `autocomplete="off"` (browsers may offer irrelevant autofill on a 6-digit field) and no `pattern`. The Wikipedia search inputs correctly use `autocomplete="off"` (`:34, :92, :212`); this one is the omission. Minor since pairing is simulated.

### Low

**L1 — Two `<nav aria-label="Primary">` landmarks.**
`index.html:71` (top links) and `:528` (bottom nav) share the identical accessible name "Primary". Even though only one is visible per breakpoint, both are in the DOM; duplicate landmark names are a navigation smell. Give them distinct labels (e.g. "Primary" / "Bottom").

**L2 — No skip link; heading order can jump.**
Each view has its own `<h1>` (good), but on the results page the "Highlights & notes" `<h2>` (`:179`) can render before the user has scrolled the article, and there's no skip-to-content link past the sticky top bar. Low impact for a short-page app; worth a skip link if the header grows.

**L3 — `confirm()`/`alert()`-style native dialogs for destructive actions.**
`app.js:323, 557` use `window.confirm`. It works and is accessible, but it's visually jarring against the e-ink aesthetic and can't be styled. Consider an in-app confirm dialog (the modal pattern already exists). Purely cosmetic/consistency.

**L4 — `transition: background .15s, color .15s` on `<body>`.**
`styles.css:73` transitions `background`/`color` (not `transform`/`opacity`). It's cheap and reduced-motion-guarded, so low priority, but color transitions on the root can cause a paint on every theme-derived variable change (brightness/warmth sliders fire it on every `input`). Consider limiting to the theme switch.

**L5 — Tag input commits on Space, which can surprise.**
`app.js:733` treats Space as a tag delimiter. Intentional and documented, but a user typing a multi-word tag gets it split. Minor UX; the placeholder does say "space to confirm" (`:552`), so it's disclosed.

## 4. Recommended next steps (prioritized)

1. **Add live regions (H2).** Give the toast `role="status" aria-live="polite"` (`index.html:607`). Add a visually-hidden `aria-live="polite"` region that announces result loading/error/offline transitions and the filtered card count. Highest impact-to-effort ratio here.
2. **Fix modal focus management (H3).** Trap Tab within each `.dialog`, mark the page behind as `inert` while open, and restore focus to the opening control on close. One shared helper covers all three dialogs.
3. **Verify and seal the tab-order leak (H1).** Keyboard-Tab through every route; ensure hidden sections are unreachable. Add `x-cloak` to the home section (`:84`) for consistency, and confirm no `x-show` element is focusable pre-hydration.
4. **Make highlights keyboard-operable (M1, M6).** Add Enter/Space handlers to the `<mark role="button">` and note-markers to open the note dialog; provide any keyboard path to create a highlight (even a "highlight selection" button), or drop `role="button"`/`tabindex` if it can't be made operable.
5. **Correct the toggle/tab semantics (M4, M2, M5).** Either make Overview/Flashcards a real tablist (`role="tab"` + `aria-selected` + `role="tabpanel"`) or downgrade to `role="group"` with `aria-pressed` buttons; add `aria-pressed` to the Reviewed/Exported segments; add Space activation to the overview card; fix or remove the `for="set-theme"` label.
6. **Reserve image space (M3).** Add `width`/`height` (or `aspect-ratio`) and `loading="lazy"` to the two `<img>` tags to stop reflow while reading.
7. **Polish (L1–L5, M7).** Distinct nav landmark labels, `autocomplete="off"` on the pairing input, and optionally replace native `confirm()` with the in-app dialog for aesthetic consistency.

## Overall

The foundation is strong — labeling, focus-visible, reduced-motion, and touch targets are already at a level many production apps miss. The work that remains is concentrated in three systemic areas (**tab-order integrity, live-region announcements, modal focus management**) plus the keyboard-operability of the highlight feature, which is currently the app's most mouse-locked interaction.
