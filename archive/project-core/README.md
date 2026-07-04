# WikiSearch

## Overview
WikiSearch is a minimalist, local-first web application designed to act as a distraction-free companion for reading physical books. It provides instant access to Wikipedia summaries without exposing the user to the distractions of a standard web browser, hyperlinks, or rabbit holes.

## Problem Statement
When encountering foreign concepts while reading physical books, turning to a laptop to Google the term often results in getting distracted by open tabs, messages, and unrelated links.

## Solution
A localized, distraction-free environment that fetches plain-text Wikipedia introductory summaries. It features an e-reader aesthetic and acts as a Personal Knowledge Management (PKM) tool by allowing users to save, highlight, and annotate concepts for later review.

## Key Features
* **Distraction-Free Reading:** Fetches Wikipedia summaries with all hyperlinks stripped out.
* **E-Reader Aesthetic:** Uses a high-legibility "E-Ink Crisp" UI (Inter + Merriweather typography) designed to reduce eye strain on desktop monitors.
* **Smart Search:** Debounced autocomplete suggestions and fuzzy-search routing for typos/capitalization.
* **Interactive Highlights & Annotations:** Users can highlight text natively in the browser to save snippets, add custom notes, and append Obsidian-style tags (e.g., `#philosophy`).
* **Hierarchical Flashcards:** A "Living Card" system that prevents duplicate entries by upgrading saved articles to highlighted snippets, and snippets to annotated notes.
* **Drift Protection:** Uses a hybrid architecture of Wikipedia Revision IDs (`revid`) and Levenshtein distance (fuzzy string alignment) to preserve user highlights even if live Wikipedia articles are edited.
* **Offline Review:** Saved flashcards are stored locally via the browser's `localStorage` and can be reviewed without an active Wi-Fi connection.

## Tech Stack
* HTML5
* CSS3 (Flexbox/Grid/CSS Variables)
* Vanilla JavaScript (ES6+, DOM Manipulation, Selection API)
* Wikipedia OpenSearch & Query APIs

## How AI Was Used
This project was co-developed with an AI acting as a senior developer and mentor. The creator (a beginner coder) provided product requirements, UX mockups, and feature ideas, while the AI guided the technical architecture, wrote the foundational code, and explained advanced JavaScript concepts like state management, API fetching, and fuzzy text alignment.