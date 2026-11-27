# Task: foundation v2 (one agent, FIRST, sequential; nobody else starts before it is merged)

**Depends on:** nothing. **Blocks:** every screen task.
**Read first:** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`, `04-design-v2-frame-map.md`, `05-browser-testing.md`, the design-to-production SKILL.md, then the files listed under "Files this task owns".

## Why
The v1 foundation (2026-11-23) built shared pieces as JS strings with its own CSS and used daisyUI almost only for colours. The owner wants static HTML + daisyUI, no markup generated in JS, no framework. This task rebuilds the shared layer that way and prepares `index.html` so four workers can edit it in parallel.

## Rules
`01-design-system.md` "The rule" (static HTML, daisyUI classes, `<template>` + clone/fill, no HTML strings in JS, no daisyUI-owned class names, no framework). Keep logic and stored data unchanged.

## Deliverables
1. **Theme** `paper-and-pencil` in `base.css`: full daisyUI variable set per 01 (base-100/200/300, primary, neutral, error, radii, font); remove CSS that only re-implements what daisyUI classes now do.
2. **`index.html` restructure** with the regions of 02 (`head shell footer dialogs templates` and, empty, `tab-<name>` + `tpl-<name>` for explore, borders, routes, rivers, layers, more). Move each existing tab's current markup UNCHANGED into its region (no redesign of tabs; workers do that). Same page for forum and dev; `tools/build.js` and `controller/` must keep working (comments only).
3. **Static shell**: header + brand + tab bar (`tabs`), collapse chevron, rail 60px with tooltips and the Period dot (s050-s052), resize edge + double-click reset (existing `layout.js` logic kept), dock grip, larger panel (s098), phone bottom sheet with grab handle and the Time button when hidden (s099, s100), 320px rule for pills (s057). Files: `shell.js` (new), restyle `layout.js` only as far as needed.
4. **Static footer** (`footer` region): Period | Moment `join` toggle, "Any" / range text, x, histogram (48 bars created once at start, then only heights/classes change), two range handles; Moment: play, speed `join`, one handle, "Show undated places" toggle. Logic stays in `period.js` (`periodBounds`, `periodActive`, `initPeriod`) and `timebar.js` (`tb*`); `footer.js` (new) binds. `tbOpen()` starts at the middle of the data span (s022). Hidden while a form with its own Save bar is open (as v1). Remove the string footer and the old `#tbOpen`.
5. **`kit.js`** (new): `tpl`, `fill`, `show`, `on`, `list`, `state(container, kind, text, retry)`, `invalid(el, msg)`, `clear(form)` (API in 02).
6. **`fields.js`** (new) with templates in the `templates` region: date field (s047/s048: mode join, format dropdown with groups, CE|BCE join, preview; reads/writes the same value as `dfRead`/`dfSafe`), language pills with "+N" picker and the fit/narrow rules (s056-s058), language filter (s055), name editor with Period row Set/Edit/Done (s028) reading/writing `[{lang,name,date_from,date_to}]`, type pills, style editor for point/line/area/river (s020, s042-s044, reading/writing `{color, style}`), form frame with sticky bar, notes list/note (s045, s046), list row.
7. **`dialogs.js`** (new): `confirm(kind, vars)` -> Promise<bool> with the six texts of s068/s069 in one `<dialog class="modal">`; `toast(msg, kind)`; offline/online toasts.
8. **States** (s060, s061, s062, s070, s093): empty, skeleton, error + Retry, service down, read-only lock block.
9. **Tests**: browser tests for each deliverable (footer Period/Moment, rail, tooltips, phone sheet at 390px, date menu, pills +N at 320/400px, name editor, style editor four kinds, confirm variants, toast, states); node tests for pure logic (`uiHistogram`, pill-fit calculation, date read/write). Existing 313 tests stay green or are rewritten into browser tests when they assert on removed v1 HTML.
10. **Docs**: update `02-shared-components.md` statuses (component, file, interface, usage example, ready/not ready); `docs/09-code-style.md` and `AGENTS.md` rule text (needs owner `Approved:`; if not given, write the proposed text in the report and leave the files).
11. **Retire v1 only where nothing uses it**: the old tabs still call `pfRow`, `uiLanguagePills`, `uiTypePills`, `uiDateEditor`; keep them until the screen workers convert; list in the report which are now unused.

## Frames
`s001` `s022` `s047` `s048` `s049` `s050` `s051` `s052` `s055` `s056` `s057` `s058` `s060` `s068` `s069` `s097` `s098` `s099` `s100`, and the field parts of `s007` `s020` `s028` `s033` `s042` `s043` `s044` `s045` `s046` `s065` `s066` `s088`.

## Files this task owns
`app/index.html` (all regions, but only moves tab markup, never edits it), `app/css/base.css`, `app/css/sidebar.css`, new `app/css/shell.css` (needs a `tools/domains.json` line: owner approved), `app/js/sidebar/{kit,fields,footer,shell,dialogs,components,period,timebar,layout,ui,datefield,placeform(only the parts moved)}.js`, `tests/js/sidebar.test.js`, `tests/js/browser.test.js`, `tests/js/lib/` (only to add what browser tests need), `docs/design-migration/*`, `tools/domains.json` + generated CODEOWNERS (owner-approved line).

## Must NOT modify
Tab logic files of the screen tasks (`places.js`, `searchfield.js`, `actions.js`, `sidebar/shapes.js`, `routes.js`, `layers.js`, `admin.js`, `map/*`, `core/*`) except to keep them running on the moved markup; `controller/`, `service/`, `dev/`, stored formats.

## Acceptance criteria
1. Every frame listed matches by eye in a 400x860 screenshot (and 320, 390, 1100 where the frame says so); screenshots attached to the report with paths; no pixel-match claim.
2. `index.html` has the 7 x 2 region markers; each existing tab works unchanged inside its region; a diff of one region does not touch another.
3. Shared pieces contain no string-built markup (grep of `kit.js fields.js footer.js shell.js dialogs.js` for `innerHTML`/`insertAdjacentHTML` with `<` finds nothing).
4. No class name that daisyUI owns is defined by app CSS (check script in the report: classes in `daisyui.css` vs yours).
5. Whole suite incl. browser tests passes; `tools/ci-check-pr.js` passes with the owner's `Owner-approved` line; `bun tools/build.js` works.
6. `02-shared-components.md` updated per component; report lists what is ready, what is not, and which v1 pieces are still used.

## Hand-off
Branch `feat/foundation-v2` from `feat/shared-foundation-tasks`; do not push elsewhere; do not commit `app/dist/`, `graph/`, `context/` (main agent builds). Report: files, per-frame result with screenshot paths, tests, what you could not verify, owner decisions needed.

## Fidelity loop (mandatory; owner request 2026-11-27)
Read `docs/design-migration/06-visual-fidelity.md` BEFORE you write markup and follow its loop for every frame: transcribe the frame, build, `node tools/ui.js shot` + `compare`, LOOK, list the differences, fix, repeat. First run `node tools/ui.js setup` (once). Your report must contain, per frame, the screenshot path, the comparison path, the differences found and fixed, and what remains. A report without comparison images is rejected.
