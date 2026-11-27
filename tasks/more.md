# Task: more

**Depends on:** Foundation v2 merged AND layers merged (category admin leaves `layers.js`).
**Read first (nothing else for exploration):** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`; then only the source files listed under "Files this task owns".

## Rules (owner decision 2026-11-24; override anything older)
- Markup = static HTML in your own `app/index.html` regions + daisyUI v5 component classes (mapping table: `docs/design-migration/01-design-system.md`). Repeated items = `<template>` in your `tpl-more` region. JS only clones/fills templates (`textContent`, `value`, `dataset`, attributes), toggles `hidden`/classes, handles events. **No HTML built from strings in JS** (`innerHTML = '<...' + x`), no `esc()`, no `insertAdjacentHTML` of strings.
- Custom CSS only where daisyUI has no class; in your own CSS file; no class name daisyUI owns (list in 01). No framework, no new dependency.
- Keep behaviour and stored data exactly as before; rewrite the rendering, keep the logic functions and their tests; tests that assert on HTML strings become browser tests (`docs/design-migration/05-browser-testing.md`).
- Visual bar: "matches the frame by eye" in a 400x860 screenshot; never claim a pixel match; say what you could not verify.

## Routes and views
- Tab `more` (`#tab-more`): accordion cards Maps & base map (s037, s038, s090), Directions (s039, s092), Languages (s019, s041, s093), Types (s019, s094, editors s020 s042 s043 s044), Categories (s021, s041, s093), Historical maps (s021, s091, s040).

## Functionality
- Maps & base map: base map thumbs (Terrain, Plain, Relief) with attribution; 3D view (Tilt, Rotation sliders, Flat / Tilt 60 / North up, 3D terrain toggle, Height x); River size; Show on the map toggles (Borders of today, Roads, Place labels, Water labels); Relief (toggles: Colour by height, Shading, Adapt colours to the view, Smooth colours, Smooth colour transitions; Colour ramp select + gradient bar + Edit colours rows (hex, metres, x), Add colour, Reset; Colour strength, Shading strength; Contour lines toggle + step select; Height profile: Draw, Clear, chart, length/up/down, height at pointer); "Relief options appear when the base map is Relief".
- Directions: every state of s092 (empty, start set, coordinates, routing, result with distance/car time, no route).
- Languages: list (code, name, in the language, edit), Add language form (code, name, native name; Save disabled until valid); Types: lists by group with usage counts, "+ N more", four Add buttons, editors: place type (names, symbol grid + uploaded SVG, upload/paste SVG with validation, colour, size, preview), line/river type (colour, width, opacity, pattern, arrow), area type (colour, fill opacity, outline width, pattern, preview), delete type (usage rule, confirm); Categories: list, rename with names; Historical maps: empty, Add image overlay, uploading progress, error (20 MB), overlay row (checkbox, fit, edit, opacity), edit overlay (title, opacity, rotate, scale, zoom range from/to with locate); read-only variants for people without admin rights (s093).

## Existing vs new (judged by keyword search only; confirm in code)
Browser tests per card: base map switch and toggles write the same config as before, ramp editor add/remove/reset, language add (Save disabled until valid), type editors for the four kinds read/write the stored model, SVG upload errors, overlay upload progress with a stubbed request, read-only variants.

## Prototype frames (`docs/prototype/png-v2/`)
Exists (verify): base map, 3D, terrain, relief colours, contour, height profile, Directions, languages, types, categories, overlays. Likely new: upload progress/error UI, SVG paste with transform validation, ramp editor rows, step select, per-section read-only blocks, usage counts in Types.

## Missing screens and states (no frame; extend in the same style)
`s019` `s020` `s021` `s037` `s038` `s039` `s040` `s041` `s042` `s043` `s044` `s090` `s091` `s092` `s093` `s094`; confirms `s068` `s069` (remove type).

## Files this task owns
Loading of each section; server errors on save; empty overlay list is s091; a very long ramp; read-only for Directions (none needed).

## Shared components used
`app/js/sidebar/admin.js`, `app/js/map/overlays.js`, Directions code in `app/js/sidebar/actions.js` (Directions only), the map-option controls code that drives the base map and relief (find it in `app/js/map/map.js`/`relief` files: touch only the controls, not the rendering), `tests/js/ui-more.test.js`, regions `tab-more`, `tpl-more`.

## Must NOT modify
styleEditor (all four kinds), nameEditor, languagePills, form frame, validation, states, confirm, accordion, toasts, progress.

## Acceptance criteria
All files of other tasks; `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `app/css/base.css`, `app/css/sidebar.css`, `app/js/core/` (except `layer-rules.js` for layers), `service/`, `controller/`, `dev/`, `INTERFACES.md`, other regions of `app/index.html`. `app/js/sidebar/layers.js` (merged already).

## Tests
1. Every view, state and interaction listed renders as in its frame (by eye, 400x860), using daisyUI classes and templates; no HTML string is built in JS; no inline colours.
2. A record saved before and after has identical stored data; every behaviour in `docs/02-implemented-features.md` for this tab still works.
3. No new `window.AHM` call beyond `INTERFACES.md`; no cross-domain call added.
4. The whole suite passes (`NODE_PATH=... node tests/js/run.js`); `node tools/ci-check-pr.js <branch> origin/master` passes (build artifacts are the main agent's).

## Hand-off rules (set by the main agent)
- Work on your own branch from `feat/shared-foundation-tasks` (`feat/ui-more`); never push `feat/shared-foundation-tasks` or `master`.
- Do NOT commit `app/dist/`, `graph/`, `context/`; the main agent builds them once.
- Do NOT edit: `docs/`, `tools/`, `changes/`, `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, `sidebar.css`, the `head shell footer dialogs templates` regions and other workers' regions of `app/index.html`, other workers' files, `tests/js/lib/`. Need one changed: put the exact request in your report.
- `index.html`: edit only between `<!-- ahm:region tab-more -->` and `<!-- ahm:region tpl-more -->` markers (and their closing markers).
- Tests: `tests/js/ui-more.test.js` (logic in node; UI in a real browser per `05-browser-testing.md`). Run the whole suite; all pass.
- Report: files changed; what was built per frame; tests (counts); what you could not verify; requests for shared changes. Nothing else.

## Fidelity loop (mandatory; owner request 2026-11-27)
Read `docs/design-migration/06-visual-fidelity.md` BEFORE you write markup and follow its loop for every frame: transcribe the frame, build, `node tools/ui.js shot` + `compare`, LOOK, list the differences, fix, repeat. First run `node tools/ui.js setup` (once). Your report must contain, per frame, the screenshot path, the comparison path, the differences found and fixed, and what remains. A report without comparison images is rejected.

## Scope note for the first launch (2026-11-27)
The layers worker is still running and `layers.js` owns the Categories code. Build now: Maps & base map (s037, s038, s090), Directions (s039, s092), Languages (s019, s041 language part, s093), Types (s019, s094, editors s020, s042, s043, s044), Historical maps (s021, s091, s040). Do NOT build the Categories card (s021 Categories part, s041 rename category): it needs `layers.js`; leave its current markup and code untouched and list it as "deferred" in the report. A second small launch does it after layers merges.
