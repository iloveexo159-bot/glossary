---
description: Sync docs/design.md, docs/design.html, and PRD to the final app state from this session, then commit them
argument-hint: "[optional focus, e.g. 'just the Collection page']"
---

You are wrapping up a working session on the Glossary project — a build-free
Wikipedia lookup + flashcard web app. Your job: bring the three living docs into
line with the **final** state of the app, using everything you already know from
this conversation.

Docs you may edit (and ONLY these three):
- `docs/design.md` — source of truth: design tokens + prose
- `docs/design.html` — human-readable MIRROR of design.md; keep the two identical in meaning
- `PRD_WikiSearch_MVP.md` — product requirements, page inventory

Optional focus from the user: **$ARGUMENTS** (if empty, review the whole session).

## Step 1 — Determine what actually shipped

You have the live conversation context — use it, but verify against ground truth:
- `app/` (index.html, app.js, styles.css) is GROUND TRUTH for what the app does.
- Run `git status --porcelain -- app/` and `git diff -- app/` for uncommitted work,
  and `git log --oneline -15 -- app/` to see this session's committed changes; inspect
  any you're unsure about with `git show <sha> -- app/`.
- Capture only the **net, final outcome**. Ignore intermediate attempts and anything
  that was tried then reverted this session — those must NOT reach the docs.
- Never invent features. Only document design/behavior that exists in `app/` right now.

## Step 2 — Propose the doc edits (do NOT write yet)

Per this project's convention (get approval before applying doc changes), first show me:
- A short bullet list of what changed in the app and therefore what needs updating in each doc.
- The specific edits you intend to make (file + section + before→after gist).
- Call out anything ambiguous or that you're choosing to leave out.

Then ask me to confirm before touching any file.

## Step 3 — On my approval, apply and commit

- Make minimal, targeted edits — preserve each doc's existing structure, tone, and formatting.
- Keep `docs/design.md` and `docs/design.html` perfectly consistent with each other.
- If you edit the design docs, bump their "updated <date>" footer to today's date.
- Stage EXACTLY the doc files you changed (`git add` them) — never `app/` or anything else — and commit. Do not push.
- Commit message: a concise summary, e.g. `docs: sync design + PRD to app changes (<one-line summary>)`, ending with the trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- If nothing about the app changed in a way the docs need to reflect, say so and make no edits.
