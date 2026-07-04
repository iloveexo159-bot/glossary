# WikiSearch Design System

Living reference for WikiSearch's visual language. Update this file whenever a token is added, changed, or retired — it should always match `style.css`.

## Direction: Cool slate e-ink

Chosen after prototyping five directions (refined e-ink, warm sepia, cool slate/Kindle, warm paper/Kobo, deep graphite) and three body-font tests (Bookerly, Palatino, Cormorant Garamond) against the cool slate palette. Cool slate + Literata won on: a cooler, less "paper-yellow" grey that reads as a dedicated reading device rather than a generic beige webpage, and Literata's proven legibility at body size (it's Google's own typeface for Play Books, designed specifically for on-screen long-form reading).

## Colors

All values are CSS custom properties on `:root` in `style.css`. Never hardcode a hex value in a component rule — reference the token.

| Token | Value | Use |
|---|---|---|
| `--bg-color` | `#E7E7E4` | Page background |
| `--surface` | `#F2F2EF` | Cards, inputs, dropdowns, tooltips, flashcards |
| `--surface-inverse` | `#1F1F1D` | Dark surfaces (highlight tooltip popover) |
| `--text-primary` | `#1F1F1D` | Body copy, headings, primary labels |
| `--text-secondary` | `#63635E` | Supporting text, descriptions |
| `--text-muted` | `#8C8B84` | Timestamps, hints, least-important captions |
| `--text-on-inverse` | `#F2F2EF` | Text on `--surface-inverse` |
| `--border` | `#D3D3CD` | Default hairline border |
| `--border-strong` | `#B9B8AF` | Hover/active border, dividers that need more weight |
| `--accent` | `#3B5B7A` | Focus rings, tag text, links, active states |
| `--accent-tint` | `#DEE6EC` | Background behind accent-colored tags/chips |
| `--highlight-color` | `#E4DAB0` | Saved text highlights (unchanged from original palette — this predates the redesign and stays for continuity) |
| `--danger` | `#9C3B32` | Delete actions |
| `--danger-tint` | `#F3DEDA` | Hover background behind delete actions |
| `--warning-bg` | `#F0E4C8` | Drift-notification banner background |
| `--warning-border` | `#E0CFA0` | Drift-notification banner border |
| `--warning-text` | `#6B5423` | Drift-notification banner text/icon |

Rule of thumb: `--bg-color` is the page, `--surface` is anything sitting on the page (a card, an input, a popover). Two elevations only — do not introduce a third without a reason.

## Type

Two families, four roles:

| Token | Family | Role |
|---|---|---|
| `--font-display` | Literata (serif) | The "WikiSearch" wordmark only |
| `--font-heading` | Inter (sans) | Content headings (article title, "My Flashcards") |
| `--font-ui` | Inter (sans) | Buttons, nav, labels, dates, tags, form inputs |
| `--font-body` | Literata (serif) | Reading text — article summaries, card descriptions, highlights |

Literata carries the "e-reader" feel; Inter keeps UI chrome calm and out of the way so it doesn't compete with reading text. Never introduce a third family.

### Scale

| Token | Size | Current usage |
|---|---|---|
| `--text-xs` | 11px | Card date, badge number |
| `--text-sm` | 13px | Tags, tooltip buttons |
| `--text-base` | 15px | Buttons, nav labels |
| `--text-md` | 16px | Search input, note textarea |
| `--text-lg` | 20px | Article reading text, flashcard title |
| `--text-xl` | 28px | Compact logo (results state) |
| `--text-2xl` | 42px | Article title, flashcards header |
| `--text-hero` | 70px | Home-state logo (deliberate one-off, not part of the step scale) |

## Radius

| Token | Size | Use |
|---|---|---|
| `--radius-sm` | 4px | Inputs, buttons, tags, badges |
| `--radius-md` | 8px | Cards, tooltips, dropdowns, notification banner |

## Not yet formalized

These still use ad hoc values in `style.css` and are the logical next layer to tokenize:
- **Spacing** — paddings/margins are still literal px per rule, not pulled from a shared scale.
- **Shadows** — flashcard and dropdown shadows are still raw `rgba(0,0,0,...)` values, not elevation tokens.
- **Tag chips** — flashcard tags currently render as one plain accent-colored text string (`card.tags` is a joined string in `app.js`), not individual chip pills like the prototype's `#physics` example. Turning each tag into its own `--accent-tint` chip means wrapping tags in `<span>` elements in `app.js`, not just a CSS change — deferred so this pass stays CSS-only and doesn't touch data-rendering logic that's already on the bug list.

Tackle these next once the color/type foundation has been used for a while and any gaps become obvious.

## Revisit triggers

- If a screen genuinely needs a third elevation level, add `--surface-2` rather than reusing `--surface` for something it wasn't meant for.
- If Literata proves too heavy/slow to load on first paint, the fallback stack should degrade to Georgia (already the closest system substitute tested).
