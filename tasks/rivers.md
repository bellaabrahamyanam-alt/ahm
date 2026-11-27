# Task: rivers

**Depends on:** Foundation v2 merged AND borders merged (it reuses the drawing-a-line panel and `shapes.js`).
**Read first (nothing else for exploration):** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`; then only the source files listed under "Files this task owns".

## Rules (owner decision 2026-11-24; override anything older)
- Markup = static HTML in your own `app/index.html` regions + daisyUI v5 component classes (mapping table: `docs/design-migration/01-design-system.md`). Repeated items = `<template>` in your `tpl-rivers` region. JS only clones/fills templates (`textContent`, `value`, `dataset`, attributes), toggles `hidden`/classes, handles events. **No HTML built from strings in JS** (`innerHTML = '<...' + x`), no `esc()`, no `insertAdjacentHTML` of strings.
- Custom CSS only where daisyUI has no class; in your own CSS file; no class name daisyUI owns (list in 01). No framework, no new dependency.
- Keep behaviour and stored data exactly as before; rewrite the rendering, keep the logic functions and their tests; tests that assert on HTML strings become browser tests (`docs/design-migration/05-browser-testing.md`).
- Visual bar: "matches the frame by eye" in a 400x860 screenshot; never claim a pixel match; say what you could not verify.

## Routes and views
- Tab `rivers` (`tab('rivers')`): own sub-section; views: select rivers (s078), find and add (s079), drawing a line following a river (s077).

## Functionality
- Intro with More; search rivers; count + fit; accordion "Select rivers": Select by rectangle (button, active hint), "only fully inside" checkbox, Select by area (type a name; result chips with kind), note "5 new of 7 rivers found for Lori...", "N selected" header with show, fit, clear; selection list (icon tile, name, MAP tag, x).
- Find rivers: OSM search by name (Find), FOUND list with + (River/Canal, region, km), searching / none notes, "OR DRAW IT" (pencil, upload), "Follow a river between the points I click" toggle, Close.
- Drawing a line: reuse the borders panel (s077).

## Existing vs new (judged by keyword search only; confirm in code)
Browser tests: select by rectangle (stubbed map events), by area, only-fully-inside, selection list actions, find with stubbed OSM, follow-a-river.

## Prototype frames (`docs/prototype/png-v2/`)
Exists (verify): select by rectangle, by area, find, follow a river. Likely new: "only fully inside", result chips with kinds, MAP tag, upload option.

## Missing screens and states (no frame; extend in the same style)
`s077` `s078` `s079`.

## Files this task owns
Empty selection; OSM down; no river lines found (text is in s079); loading.

## Shared components used
The rivers mode code of `app/js/sidebar/shapes.js` (move it to a new `app/js/sidebar/rivers.js` if it separates cleanly), `tests/js/ui-rivers.test.js`, regions `tab-rivers`, `tpl-rivers`.

## Must NOT modify
nameEditor, typePills, styleEditor (line part), validation, states, list row, accordion, the drawing panel from borders.

## Acceptance criteria
All files of other tasks; `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `app/css/base.css`, `app/css/sidebar.css`, `app/js/core/` (except `layer-rules.js` for layers), `service/`, `controller/`, `dev/`, `INTERFACES.md`, other regions of `app/index.html`. the borders code and region.

## Tests
1. Every view, state and interaction listed renders as in its frame (by eye, 400x860), using daisyUI classes and templates; no HTML string is built in JS; no inline colours.
2. A record saved before and after has identical stored data; every behaviour in `docs/02-implemented-features.md` for this tab still works.
3. No new `window.AHM` call beyond `INTERFACES.md`; no cross-domain call added.
4. The whole suite passes (`NODE_PATH=... node tests/js/run.js`); `node tools/ci-check-pr.js <branch> origin/master` passes (build artifacts are the main agent's).

## Hand-off rules (set by the main agent)
- Work on your own branch from `feat/shared-foundation-tasks` (`feat/ui-rivers`); never push `feat/shared-foundation-tasks` or `master`.
- Do NOT commit `app/dist/`, `graph/`, `context/`; the main agent builds them once.
- Do NOT edit: `docs/`, `tools/`, `changes/`, `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, `sidebar.css`, the `head shell footer dialogs templates` regions and other workers' regions of `app/index.html`, other workers' files, `tests/js/lib/`. Need one changed: put the exact request in your report.
- `index.html`: edit only between `<!-- ahm:region tab-rivers -->` and `<!-- ahm:region tpl-rivers -->` markers (and their closing markers).
- Tests: `tests/js/ui-rivers.test.js` (logic in node; UI in a real browser per `05-browser-testing.md`). Run the whole suite; all pass.
- Report: files changed; what was built per frame; tests (counts); what you could not verify; requests for shared changes. Nothing else.

## Fidelity loop (mandatory; owner request 2026-11-27)
Read `docs/design-migration/06-visual-fidelity.md` BEFORE you write markup and follow its loop for every frame: transcribe the frame, build, `node tools/ui.js shot` + `compare`, LOOK, list the differences, fix, repeat. First run `node tools/ui.js setup` (once). Your report must contain, per frame, the screenshot path, the comparison path, the differences found and fixed, and what remains. A report without comparison images is rejected.
