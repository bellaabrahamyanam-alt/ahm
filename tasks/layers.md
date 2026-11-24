# Task: layers

**Depends on:** F0. Parallel with explore, borders, routes. Blocks more (category admin moves out of layers.js).
**Read first:** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`; do not re-explore.

Needs F0. Parallel with explore, routes, more.

Note (D3 default 1): the category admin list moves to More (task `more`); this task keeps the category select and filter and does not touch the admin code.

## Routes and views

- Tab `layers` (`#tab-layers`), calling `tab('layers')`.
- Views: layers list with search and category filter; layer sheet (places, notes, category, colour, date range); "Choose places" mode; categories dictionary (administrators); Only and Hide controls.

## Functionality

Rebuild on the F0 components, no behaviour change:
- Layers are named subsets of the general layer; the general layer is implicit and never stored.
- Layer: Names and descriptions in dictionary languages, one optional category, optional colour, optional date range (Period), own notes, ordered list of places.
- Only (OR over several layers) and Hide (NOT IN); they appear as chips in Explore > Filters and are cleared by Reset.
- Choose places: click places on the map or tick them in a list; nothing is saved until "Save places" (one request); members get a ring; no box-select.
- Categories: administrators add and rename, never delete.

## Prototype screenshot references (full design, `docs/prototype/full/`)
- **s85** list; **s86** layer card open in place, with the delete confirm bar; **s87** Choose places; **s88** layer form (add / edit, error state drawn).
- Related: s65 (layers in the place form), s67 (note with layer ticks), s69 (confirms: delete layer, discard), s71 (layer chips and scoped notes in the place card, task explore), s93 (empty lists, no admin rights).
- What they show, read from the PNGs: `01-design-system.md`, section "Full design: what the Layers frames add". Short version: three-state control per layer (shown / Only / Hide), colour edge on the card, card opens in place, icon row (edit, choose places, fit, delete), places with ✕, pinned bottom bars, form as a panel (not a dialog), banner at the top of the tab.
- **State of the branch `feat/ui-layers`** (commits 6cfeba4, 929458a): built from the code before these frames existed. It keeps the old structure (Only / Hide chips, details in the dock, form in a dialog) and does NOT match s85 to s88. Behaviour, rules and tests carry over; the markup and layout are to be redone to the frames.

## Approach (owner, 2026-11-24)
daisyUI components and static HTML first, `<template>` cloning instead of HTML strings; rules in `03-work-plan.md`, "Direction". For this task: the `#tab-layers` block and `<template id="tpl-ly-...">` blocks in `index.html` are written by the layers worker (needs decision D8; until then the main agent applies the markup the worker specifies). Three-state control = daisyUI `join` of three buttons, one value per layer (shown, only, hide); it keeps `lyState.only` / `lyState.hide` exactly (shown clears both).

## Missing screens and states
Not drawn, extend in the same style (check s69 and s93 first): no layers yet, no match, empty category; layer with no places or with a deleted place; Choose places with nothing changed (Save disabled), save error, discard-changes confirm; visitor and editor versions of the list and the card (s86 shows the visitor line and the administrator delete).

## Files this task owns

`app/js/sidebar/layers.js`, `app/js/core/layer-rules.js`, `app/css/layers.css` (already linked; exists, empty, already linked), `tests/js/ui-layers.test.js` (new).

## Shared components used

`nameList`, `languageSelect`, `periodField`, `styleEditor` (colour only), `momentField` (notes).

## Must NOT modify

`app/js/sidebar/places.js` (the layer list inside a place sheet belongs to `explore`), `shapes.js`, `routes.js`, `admin.js`, `app/js/map/`, `app/css/sidebar.css`, `service/`, `dev/`, `INTERFACES.md`. Not in scope: T-031 shapes as layer members, T-065.

## Acceptance criteria

1. Every view and state above renders with F0 components and tokens.
2. Removing a place from a layer never touches the general layer; the period filter still ignores layers.
3. Only and Hide semantics and chips are unchanged; existing `tests/js/layers.test.js` passes unchanged.
4. No new `window.AHM` call beyond `INTERFACES.md`.
5. Matches s85 to s88 (owner review) and follows the "Direction" rules (static markup, templates, daisyUI classes).
6. `bun tools/build.js` done; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/ui-layers.test.js`: list and sheet states, Choose places Save disabled until a change, role differences, categories cannot be deleted. Then `node tests/js/run.js 2>&1 | tail -15`.

## Hand-off rules (set by the main agent, override anything above)
- Branch: work on a branch of your own from `feat/shared-foundation-tasks` (`feat/ui-layers`); never push to `feat/shared-foundation-tasks` or `master`.
- Do NOT commit generated files: `app/dist/`, `graph/`, `context/`. The main agent builds and regenerates them once after all workers merge.
- Do NOT edit `changes/*.md`, `docs/`, `tools/`, `app/index.html`, `app/css/sidebar.css`, `app/css/base.css`, `app/js/sidebar/components.js`, `period.js`, `layout.js`, `ui.js`, `tests/js/sidebar.test.js`, `tests/js/lib/`. Need one of them changed: say so in your report (what and why), do not edit.
- Tests go in `tests/js/ui-layers.test.js` (already exists, empty). Run `node tests/js/run.js --no-browser` (all must pass; one real-browser test is welcome if a browser is available, see the report rule below).
- New class names: no collision with daisyUI (it owns stack, label, tabs, badge, sm, list, toast, card, menu, tab, badge ...); use your own prefix.
- Report: files changed, what was built, frames matched, tests (counts), what you could not verify, and requests for shared changes.
