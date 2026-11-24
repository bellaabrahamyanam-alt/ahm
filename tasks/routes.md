# Task: routes

**Depends on:** Foundation v2 merged. Parallel with explore, borders, layers.
**Read first (nothing else for exploration):** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`; then only the source files listed under "Files this task owns".

## Rules (owner decision 2026-11-24; override anything older)
- Markup = static HTML in your own `app/index.html` regions + daisyUI v5 component classes (mapping table: `docs/design-migration/01-design-system.md`). Repeated items = `<template>` in your `tpl-routes` region. JS only clones/fills templates (`textContent`, `value`, `dataset`, attributes), toggles `hidden`/classes, handles events. **No HTML built from strings in JS** (`innerHTML = '<...' + x`), no `esc()`, no `insertAdjacentHTML` of strings.
- Custom CSS only where daisyUI has no class; in your own CSS file; no class name daisyUI owns (list in 01). No framework, no new dependency.
- Keep behaviour and stored data exactly as before; rewrite the rendering, keep the logic functions and their tests; tests that assert on HTML strings become browser tests (`docs/design-migration/05-browser-testing.md`).
- Visual bar: "matches the frame by eye" in a 400x860 screenshot; never claim a pixel match; say what you could not verify.

## Routes and views
- Tab `routes` (`#tab-routes`); views: list + path finder (s080), ways found (s081), no path / input errors (s082), card (s083), drawing (s084), save form (s034).

## Functionality
- Path finder accordion (collapsed subtitle shows "Van -> Artashat" or "No path"): From/To (place search), swap, clear, Find path, Clear, help text; results "3 ways, shortest first": cards "Van -> Tushpa -> Artashat 420 km · 2 routes" with route chips and segment km; errors: empty, same place, "Vann is not a place of the map".
- List: intro + More, search, type chips with counts, count + fit, rows (coloured line icon, name, "Trade · one way · Van -> Artashat · 550 BCE - 300 CE", eye), pinned "Add route".
- Card: icons (edit, edit path, versions, reverse, fit, delete), versions chips, Places on the way (chips with km and "free waypoints"), Joins chips + hint, LOOK (colour, opacity, width, show name), In layers, attribution (OSRM / OSM).
- Drawing: LIVE HINT card that changes while drawing, hints list, errors "needs a start and at least one more point", "No road between these two points: a straight line was used", Undo, Finish/Cancel; editing the path / new version panels.
- Save form: banner "Save the route 212 km · 4 points", places on the way, names, type pills, Usable both ways toggle, Began date field, Save route / Back to the map / Discard (shared confirm).

## Existing vs new (judged by keyword search only; confirm in code)
Browser tests for the finder (found / none / each input error), list, card, drawing errors with a stubbed router, save form (both ways toggle), discard modal. Existing `routes.test.js` stays green.

## Prototype frames (`docs/prototype/png-v2/`)
Exists (verify): path finder, drawing with OSRM, versions, joins. Likely new: swap/clear buttons layout, live hint card, input error texts, free-waypoint note, joins chips.

## Missing screens and states (no frame; extend in the same style)
`s034` `s080` `s081` `s082` `s083` `s084`, confirms `s068` `s069`.

## Files this task owns
OSRM down; empty list; no routes for the period; delete confirm text for routes (s068).

## Shared components used
`app/js/sidebar/routes.js`, `app/js/core/routes.js`, `tests/js/ui-routes.test.js`, regions `tab-routes`, `tpl-routes`.

## Must NOT modify
nameEditor, typePills, dateEditor, styleEditor (line part), form frame, validation, states, confirm, list row, accordion.

## Acceptance criteria
All files of other tasks; `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `app/css/base.css`, `app/css/sidebar.css`, `app/js/core/` (except `layer-rules.js` for layers), `service/`, `controller/`, `dev/`, `INTERFACES.md`, other regions of `app/index.html`.

## Tests
1. Every view, state and interaction listed renders as in its frame (by eye, 400x860), using daisyUI classes and templates; no HTML string is built in JS; no inline colours.
2. A record saved before and after has identical stored data; every behaviour in `docs/02-implemented-features.md` for this tab still works.
3. No new `window.AHM` call beyond `INTERFACES.md`; no cross-domain call added.
4. The whole suite passes (`NODE_PATH=... node tests/js/run.js`); `node tools/ci-check-pr.js <branch> origin/master` passes (build artifacts are the main agent's).

## Hand-off rules (set by the main agent)
- Work on your own branch from `feat/shared-foundation-tasks` (`feat/ui-routes`); never push `feat/shared-foundation-tasks` or `master`.
- Do NOT commit `app/dist/`, `graph/`, `context/`; the main agent builds them once.
- Do NOT edit: `docs/`, `tools/`, `changes/`, `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, `sidebar.css`, the `head shell footer dialogs templates` regions and other workers' regions of `app/index.html`, other workers' files, `tests/js/lib/`. Need one changed: put the exact request in your report.
- `index.html`: edit only between `<!-- ahm:region tab-routes -->` and `<!-- ahm:region tpl-routes -->` markers (and their closing markers).
- Tests: `tests/js/ui-routes.test.js` (logic in node; UI in a real browser per `05-browser-testing.md`). Run the whole suite; all pass.
- Report: files changed; what was built per frame; tests (counts); what you could not verify; requests for shared changes. Nothing else.
