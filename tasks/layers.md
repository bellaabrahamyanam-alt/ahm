# Task: layers

**Depends on:** Foundation v2 merged. Parallel with explore, borders, routes. Blocks more (category admin moves out of `layers.js`).
**Read first (nothing else for exploration):** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`; then only the source files listed under "Files this task owns".

## Rules (owner decision 2026-11-24; override anything older)
- Markup = static HTML in your own `app/index.html` regions + daisyUI v5 component classes (mapping table: `docs/design-migration/01-design-system.md`). Repeated items = `<template>` in your `tpl-layers` region. JS only clones/fills templates (`textContent`, `value`, `dataset`, attributes), toggles `hidden`/classes, handles events. **No HTML built from strings in JS** (`innerHTML = '<...' + x`), no `esc()`, no `insertAdjacentHTML` of strings.
- Custom CSS only where daisyUI has no class; in your own CSS file; no class name daisyUI owns (list in 01). No framework, no new dependency.
- Keep behaviour and stored data exactly as before; rewrite the rendering, keep the logic functions and their tests; tests that assert on HTML strings become browser tests (`docs/design-migration/05-browser-testing.md`).
- Visual bar: "matches the frame by eye" in a 400x860 screenshot; never claim a pixel match; say what you could not verify.

## Routes and views
- Tab `layers` (`#tab-layers`); views: list (s085), card (s086), choose places and borders (s087), form (s088).

## Functionality
- List: info card, search + category select, count, layer cards: colour edge, name, category in capitals, "3 places · 1 border", three-state buttons (show / only / hide) as one `join`, hidden layer greyed; pinned "Add layer".
- Card: icons (edit, choose places, fit, delete), description, PLACES rows with x and "+ N more", BORDERS AND ROUTES rows, NOTES ABOUT THIS LAYER timeline + Add note, visitor line "Log in to change layers".
- Choose places and borders: instruction banner, "+3" / "-1" change chips ("no changes yet when both are 0"), find field, checkbox list of places with type tag, BORDERS list, "Nothing matches.", Save places / Cancel.
- Form (add/edit): names (+N picker), description per language (textarea, add a description, remove), category select, optional dates (date field from/to), optional colour (checkbox + swatches), error "Give the layer at least one name.", Save/Cancel.
- Delete: shared confirm (s069 text); frames s085/s086 also show an inline red bar: use the modal (decision D3).

## Existing vs new (judged by keyword search only; confirm in code)
Browser tests for show/only/hide, category filter, choose places (+/- counts, save), form validation, delete modal. Existing layer-rules node tests stay green.

## Prototype frames (`docs/prototype/png-v2/`)
Exists (verify): layers list, three states (Only/Hide today), choose places, layer notes, categories (admin moves to More). Likely new: the three-state join look, +N/-N change chips, description per language, optional colour/dates form layout, "+ N more" lists.

## Missing screens and states (no frame; extend in the same style)
`s085` `s086` `s087` `s088`, `s067` (note belongs to layers, built by explore), `s069` (delete layer text).

## Files this task owns
Empty list (no layers); no category; very long lists (the "+ N more" rule); save failure; loading.

## Shared components used
`app/js/sidebar/layers.js`, `app/js/core/layer-rules.js`, `tests/js/ui-layers.test.js`, regions `tab-layers`, `tpl-layers`. Owns the layer form in `lyDlg`.

## Must NOT modify
nameEditor, dateEditor, languagePills, styleEditor (colour swatches), form frame, validation, states, confirm, list row, notes, accordion.

## Acceptance criteria
All files of other tasks; `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `app/css/base.css`, `app/css/sidebar.css`, `app/js/core/` (except `layer-rules.js` for layers), `service/`, `controller/`, `dev/`, `INTERFACES.md`, other regions of `app/index.html`.

## Tests
1. Every view, state and interaction listed renders as in its frame (by eye, 400x860), using daisyUI classes and templates; no HTML string is built in JS; no inline colours.
2. A record saved before and after has identical stored data; every behaviour in `docs/02-implemented-features.md` for this tab still works.
3. No new `window.AHM` call beyond `INTERFACES.md`; no cross-domain call added.
4. The whole suite passes (`NODE_PATH=... node tests/js/run.js`); `node tools/ci-check-pr.js <branch> origin/master` passes (build artifacts are the main agent's).

## Hand-off rules (set by the main agent)
- Work on your own branch from `feat/shared-foundation-tasks` (`feat/ui-layers`); never push `feat/shared-foundation-tasks` or `master`.
- Do NOT commit `app/dist/`, `graph/`, `context/`; the main agent builds them once.
- Do NOT edit: `docs/`, `tools/`, `changes/`, `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, `sidebar.css`, the `head shell footer dialogs templates` regions and other workers' regions of `app/index.html`, other workers' files, `tests/js/lib/`. Need one changed: put the exact request in your report.
- `index.html`: edit only between `<!-- ahm:region tab-layers -->` and `<!-- ahm:region tpl-layers -->` markers (and their closing markers).
- Tests: `tests/js/ui-layers.test.js` (logic in node; UI in a real browser per `05-browser-testing.md`). Run the whole suite; all pass.
- Report: files changed; what was built per frame; tests (counts); what you could not verify; requests for shared changes. Nothing else.

## Fidelity loop (mandatory; owner request 2026-11-27)
Read `docs/design-migration/06-visual-fidelity.md` BEFORE you write markup and follow its loop for every frame: transcribe the frame, build, `node tools/ui.js shot` + `compare`, LOOK, list the differences, fix, repeat. First run `node tools/ui.js setup` (once). Your report must contain, per frame, the screenshot path, the comparison path, the differences found and fixed, and what remains. A report without comparison images is rejected.
