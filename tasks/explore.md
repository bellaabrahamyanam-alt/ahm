# Task: explore

**Depends on:** Foundation v2 merged. Parallel with borders, routes, layers.
**Read first (nothing else for exploration):** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`; then only the source files listed under "Files this task owns".

## Rules (owner decision 2026-11-24; override anything older)
- Markup = static HTML in your own `app/index.html` regions + daisyUI v5 component classes (mapping table: `docs/design-migration/01-design-system.md`). Repeated items = `<template>` in your `tpl-explore` region. JS only clones/fills templates (`textContent`, `value`, `dataset`, attributes), toggles `hidden`/classes, handles events. **No HTML built from strings in JS** (`innerHTML = '<...' + x`), no `esc()`, no `insertAdjacentHTML` of strings.
- Custom CSS only where daisyUI has no class; in your own CSS file; no class name daisyUI owns (list in 01). No framework, no new dependency.
- Keep behaviour and stored data exactly as before; rewrite the rendering, keep the logic functions and their tests; tests that assert on HTML strings become browser tests (`docs/design-migration/05-browser-testing.md`).
- Visual bar: "matches the frame by eye" in a 400x860 screenshot; never claim a pixel match; say what you could not verify.

## Routes and views
- Tab `explore` (`#tab-explore`, `tab('explore')`); permanent link `#place-<id>`.
- Views: list (s001), Filters (s002, s055), place card in the list (s003) and as the whole panel (s098), card as editor (s071) and visitor (s070), notes list (s045), note form (s046, s067), place form in three screens (s064, s065, s066), Moment list (s022), states (s060), other places search (s061, s062), map point menu (s063).

## Functionality
- List: search (names, note text, highlight, x/Esc), count "N of M places" / "N places at c. 85 BCE", sort, fit map; rows = symbol tile, name, dates, note count; sorted by date in Moment (s022).
- Filters (accordion, closed): Type chips with counts, Certainty chips with counts, Language chips (top 5 by count + "+N" picker with checkboxes, counts, Clear/Done), Period From/To (date field, icons, CE|BCE, "Empty field = no limit"); filter button with red count; removable chips + Clear all.
- Place card: icons (edit, directions/route, add to layer, locate, expand), names with language tags, certainty/radius, sources (links), layers chips with x + "Add to a layer", routes chips + "Find a path from here..." / "Start a route here" (editor), notes: scoped "Notes of the layer X (2 of 8) Show all notes", Expand all, Add note; visitor: lock line + Log in.
- Notes: timeline items (title, language badge, date or period, text clamped with Show more/less), edit/delete, language filter chips, sort, collapse, pagination ("1-3 of 8").
- Note form: language pills, layers it belongs to (checkboxes), date field, title (required), text.
- Place form (new/edit): names (language pills +N, name, up, remove, Period row Set/Edit/Done), type pills, Began/Ended (or Height for a mountain), certainty, radius, sources (+ new source), position lat/lon (drag the pin), add the new place to layers; inline validation messages exactly as in s066; "Save failed: HTTP 500"; sticky Save/Cancel.
- Search other places (Nominatim, only on Enter or button, 3+ letters, cached, throttled): section "Other places (OpenStreetMap)", rows with chevron, skeleton while searching, "No other places found", "service is not available" alert, attribution.
- Map point menu: Open border..., Add place here, Route from here, Route to here; visitor: locked "Add place here" + message.
- Moment list: "N places at c. 85 BCE" and sorted by date (s022). The first moment `tbOpen()` picks (middle of the span instead of its first year) lives in `timebar.js`, which is foundation-owned: it is done there.

## Existing vs new (judged by keyword search only; confirm in code)
Browser tests: list+search, each filter and chip removal, language picker, place card expand/collapse, note add/edit/delete via the confirm modal, form validation messages (height, radius, lat/lon, name, unknown language), visitor (no edit buttons), Nominatim states with a stubbed fetch, `#place-<id>`, point menu. Logic tests in node for sort/filter/pagination.

## Prototype frames (`docs/prototype/png-v2/`)
Exists (verify): search, filters, notes, place form, Nominatim, Time travel, point menu. Likely new: language chips with "+N" picker, Certainty counts, scoped layer notes + "Show all notes", pagination of notes, "Find a path from here" chips, inline validation texts, read-only lock block, skeleton/empty/error states, other-places states.

## Missing screens and states (no frame; extend in the same style)
`s002` `s003` `s007` `s028` `s045` `s046` `s055` `s060` `s061` `s062` `s063` `s064` `s065` `s066` `s067` `s070` `s071` `s098` and the list content of `s001`, `s022`.

## Files this task owns
Hover popup and point card of a place on the map (no frame); unknown `#place-<id>`; throttled Nominatim; delete-note confirm (use the shared modal); place form save running state; empty data (no places).

## Shared components used
`app/js/sidebar/places.js`, `placeform.js`, `searchfield.js`, `actions.js` (place-card actions only), `app/js/map/map.js` (popup, point card, point menu only), `app/css/explore.css`, `tests/js/ui-explore.test.js`, regions `tab-explore` and `tpl-explore` of `app/index.html`.

## Must NOT modify
dateEditor, languagePills (+N picker), languageFilter, nameEditor, typePills, form frame, validation, notes list/note, states, confirm, toast, list row, footer (read only).

## Acceptance criteria
All files of other tasks; `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `app/css/base.css`, `app/css/sidebar.css`, `app/js/core/` (except `layer-rules.js` for layers), `service/`, `controller/`, `dev/`, `INTERFACES.md`, other regions of `app/index.html`. `timebar.js`, `period.js` (foundation).

## Tests
1. Every view, state and interaction listed renders as in its frame (by eye, 400x860), using daisyUI classes and templates; no HTML string is built in JS; no inline colours.
2. A record saved before and after has identical stored data; every behaviour in `docs/02-implemented-features.md` for this tab still works.
3. No new `window.AHM` call beyond `INTERFACES.md`; no cross-domain call added.
4. The whole suite passes (`NODE_PATH=... node tests/js/run.js`); `node tools/ci-check-pr.js <branch> origin/master` passes (build artifacts are the main agent's).

## Hand-off rules (set by the main agent)
- Work on your own branch from `feat/shared-foundation-tasks` (`feat/ui-explore`); never push `feat/shared-foundation-tasks` or `master`.
- Do NOT commit `app/dist/`, `graph/`, `context/`; the main agent builds them once.
- Do NOT edit: `docs/`, `tools/`, `changes/`, `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, `sidebar.css`, the `head shell footer dialogs templates` regions and other workers' regions of `app/index.html`, other workers' files, `tests/js/lib/`. Need one changed: put the exact request in your report.
- `index.html`: edit only between `<!-- ahm:region tab-explore -->` and `<!-- ahm:region tpl-explore -->` markers (and their closing markers).
- Tests: `tests/js/ui-explore.test.js` (logic in node; UI in a real browser per `05-browser-testing.md`). Run the whole suite; all pass.
- Report: files changed; what was built per frame; tests (counts); what you could not verify; requests for shared changes. Nothing else.
