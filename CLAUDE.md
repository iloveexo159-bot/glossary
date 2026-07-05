# Glossary — Session Context

Before starting any work in this project, review these three sources for context — do not rely on memory or summaries alone:

1. **`PRD_WikiSearch_MVP.md`** — product requirements, user journeys, use cases, page inventory.
2. **`docs/design.md`** (source of truth) and **`docs/design.html`** (human-readable mirror) — design tokens, component specs, prose rationale. These two files must always be edited together and stay in sync.
3. **`app/`** — the actual built implementation (`index.html`, `app.js`, `styles.css`). The code is ground truth for what's actually built; the PRD/design docs describe intent and may lag behind.

## Stack & constraints

- **No build step.** Alpine.js 3.14.1 via CDN, hash-based SPA routing, vanilla JS/CSS.
- **Persistence:** localStorage only (`glossary.cards/recent/prefs/cache/devices`). Firebase is planned for PRD Phase 9 — not implemented yet.
- **Data:** Wikipedia REST summary API + Action API opensearch, with an `Api-User-Agent` header per Wikimedia etiquette.
- **Serving locally:** `scripts/serve.ps1` (PowerShell `HttpListener`, port 8321, confined to `app/`). Node v24.18.0 (`C:\Program Files\nodejs\node.exe`) and Python 3.14 are both installed and available as alternatives (`npx serve`, `python -m http.server`). Note: Claude Code's own tool shells (Bash/PowerShell tool) don't have `C:\Program Files\nodejs` on PATH by default — invoke Node via its full path or check PATH first if `node` isn't found in a tool call.

## Design conventions

- Strict monochrome e-ink aesthetic. One accent color (`#F0E6A8`, yellow) reserved for highlights only.
- Font split is strict: **Literata** (serif) for reading content, **Mulish** (sans) for UI chrome.
- Type scale is rem-based with a `--user-font-scale` multiplier; `clamp()` for display/title sizes on narrow viewports.
- Touch targets: 44px floor (`max(2.75rem, 44px)`), enforced even as font-scale shrinks.
- Highlights are stored as character offsets, not DOM ranges, and rendered left-to-right by position.

## Working conventions

- **Reference only explicitly-named files.** If the user names specific files to work from, do not pull in other project files for context or inspiration unless asked.
- One git commit per working fix; tag before large/risky jumps.
- Ask before large or ambiguous changes — confirm the exact plan before editing when uncertain.
- Keep `docs/design.md`, `docs/design.html`, and `PRD_WikiSearch_MVP.md` in sync with `app/` — when the app changes behavior, check whether the docs need the same update (and get approval before applying doc changes).
