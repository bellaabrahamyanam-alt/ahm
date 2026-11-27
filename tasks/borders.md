# Task: borders

**Depends on:** Foundation v2 merged. Parallel with explore, routes, layers. Rivers starts after it (same files).
**Read first (nothing else for exploration):** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`; then only the source files listed under "Files this task owns".

## Rules (owner decision 2026-11-24; override anything older)
- Markup = static HTML in your own `app/index.html` regions + daisyUI v5 component classes (mapping table: `docs/design-migration/01-design-system.md`). Repeated items = `<template>` in your `tpl-borders` region. JS only clones/fills templates (`textContent`, `value`, `dataset`, attributes), toggles `hidden`/classes, handles events. **No HTML built from strings in JS** (`innerHTML = '<...' + x`), no `esc()`, no `insertAdjacentHTML` of strings.
- Custom CSS only where daisyUI has no class; in your own CSS file; no class name daisyUI owns (list in 01). No framework, no new dependency.
- Keep behaviour and stored data exactly as before; rewrite the rendering, keep the logic functions and their tests; tests that assert on HTML strings become browser tests (`docs/design-migration/05-browser-testing.md`).
- Visual bar: "matches the frame by eye" in a 400x860 screenshot; never claim a pixel match; say what you could not verify.

## Routes and views
- Tab "Borders" (`tab('shapes')`, `#tab-shapes`, mode borders); views: list (s073), card (s074), add (s075), drawing an area (s076), drawing a line (s077), new version form (s033).

## Functionality
- List: intro with More, search, type chips with counts (from the dictionary), count + fit, rows (type icon tile, name, "Kingdom · area · 860 - 590 BCE", "also called ...", eye toggle, hidden = off-eye), pinned "Add border".
- Card: icons on top (edit, edit shape, versions history, fit, delete in red), names with language tags, Versions in time chips (dates or "no dates"), certainty + sources, LOOK (colour swatches, fill opacity, show name on the map), In layers chips + add, notes timeline + Add note, attribution line for OSM outlines.
- Add a border: OSM search with results and + buttons, "Or draw it" (area, line, import GeoJSON), limits and attribution text, Close.
- Drawing: title with point count; hints (Click, Drag, Right-click, Enter, Esc); error "An area needs at least 3 points."; Undo; Finish (disabled until valid) / Cancel; editing the shape and new version panels; follow-a-river option for lines (shared with rivers; you build it, rivers reuses it).
- New version form: banner, names, type pills, Began/Ended date fields, Save version.
- Delete border: shared confirm; import: shared confirm "Import N shapes as borders?"; discard drawing.

## Existing vs new (judged by keyword search only; confirm in code)
Browser tests: list/search/type chips/eye toggle, card actions, version chip switches the shape, draw area (<3 points error, Finish enabled at 3), new version save, delete via modal, import limit message. Node tests for the geometry rules already in `tests/js/shapes.test.js` must stay green.

## Prototype frames (`docs/prototype/png-v2/`)
Exists (verify): list, card, drawing, versions, import GeoJSON, OSM search. Likely new: "Versions in time" chips UI, eye/off-eye hidden state, intro text, 100-shape import limit text.

## Missing screens and states (no frame; extend in the same style)
`s033` `s073` `s074` `s075` `s076` `s077` (the drawing part), confirms `s068` `s069`.

## Files this task owns
Loading and empty list; OSM search errors (use the s062 patterns); GeoJSON import errors; save failure. Contradiction: s073 "Territory" vs s033 "Country": use the dictionary (decision D3).

## Shared components used
`app/js/sidebar/shapes.js` (borders mode), `app/js/map/shapes.js`, `app/js/core/shapes.js`, `app/css/shapes.css` (restyle only), `tests/js/ui-borders.test.js`, regions `tab-borders`, `tpl-borders`.

## Must NOT modify
nameEditor, typePills, dateEditor, styleEditor (colour part), form frame, validation, states, confirm, list row, notes.

## Acceptance criteria
All files of other tasks; `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `app/css/base.css`, `app/css/sidebar.css`, `app/js/core/` (except `layer-rules.js` for layers), `service/`, `controller/`, `dev/`, `INTERFACES.md`, other regions of `app/index.html`. the rivers region.

## Tests
1. Every view, state and interaction listed renders as in its frame (by eye, 400x860), using daisyUI classes and templates; no HTML string is built in JS; no inline colours.
2. A record saved before and after has identical stored data; every behaviour in `docs/02-implemented-features.md` for this tab still works.
3. No new `window.AHM` call beyond `INTERFACES.md`; no cross-domain call added.
4. The whole suite passes (`NODE_PATH=... node tests/js/run.js`); `node tools/ci-check-pr.js <branch> origin/master` passes (build artifacts are the main agent's).

## Hand-off rules (set by the main agent)
- Work on your own branch from `feat/shared-foundation-tasks` (`feat/ui-borders`); never push `feat/shared-foundation-tasks` or `master`.
- Do NOT commit `app/dist/`, `graph/`, `context/`; the main agent builds them once.
- Do NOT edit: `docs/`, `tools/`, `changes/`, `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, `sidebar.css`, the `head shell footer dialogs templates` regions and other workers' regions of `app/index.html`, other workers' files, `tests/js/lib/`. Need one changed: put the exact request in your report.
- `index.html`: edit only between `<!-- ahm:region tab-borders -->` and `<!-- ahm:region tpl-borders -->` markers (and their closing markers).
- Tests: `tests/js/ui-borders.test.js` (logic in node; UI in a real browser per `05-browser-testing.md`). Run the whole suite; all pass.
- Report: files changed; what was built per frame; tests (counts); what you could not verify; requests for shared changes. Nothing else.

## Fidelity loop (mandatory; owner request 2026-11-27)
Read `docs/design-migration/06-visual-fidelity.md` BEFORE you write markup and follow its loop for every frame: transcribe the frame, build, `node tools/ui.js shot` + `compare`, LOOK, list the differences, fix, repeat. First run `node tools/ui.js setup` (once). Your report must contain, per frame, the screenshot path, the comparison path, the differences found and fixed, and what remains. A report without comparison images is rejected.
