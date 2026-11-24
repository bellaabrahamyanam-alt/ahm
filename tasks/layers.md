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

## Prototype screenshot references

Prototype frames: none for the Layers tab (`s21.png`, categories, is in More and belongs to task `more`; check whether categories move). The prototype has only these 19 frames (ids s1 to s49 are not consecutive); every screen not named here has no design.

## Missing screens and states

No frame for any Layers screen: list, layer sheet, Choose places, Only / Hide, categories in the tab. The list below is ASSUMED from the code.

- No layers yet, no match, empty category.
- Layer with no places; layer whose place was deleted.
- Choose places: nothing changed (Save disabled), unsaved changes warning on leave, save error.
- Validation errors, delete confirmation (administrators only).
- Role differences: visitor, editor, administrator.

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
5. `bun tools/build.js` done; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/ui-layers.test.js`: list and sheet states, Choose places Save disabled until a change, role differences, categories cannot be deleted. Then `node tests/js/run.js 2>&1 | tail -15`.

## Hand-off rules (set by the main agent, override anything above)
- Branch: work on a branch of your own from `feat/shared-foundation-tasks` (`feat/ui-layers`); never push to `feat/shared-foundation-tasks` or `master`.
- Do NOT commit generated files: `app/dist/`, `graph/`, `context/`. The main agent builds and regenerates them once after all workers merge.
- Do NOT edit `changes/*.md`, `docs/`, `tools/`, `app/index.html`, `app/css/sidebar.css`, `app/css/base.css`, `app/js/sidebar/components.js`, `period.js`, `layout.js`, `ui.js`, `tests/js/sidebar.test.js`, `tests/js/lib/`. Need one of them changed: say so in your report (what and why), do not edit.
- Tests go in `tests/js/ui-layers.test.js` (already exists, empty). Run `node tests/js/run.js --no-browser` (all must pass; one real-browser test is welcome if a browser is available, see the report rule below).
- New class names: no collision with daisyUI (it owns stack, label, tabs, badge, sm, list, toast, card, menu, tab, badge ...); use your own prefix.
- Report: files changed, what was built, frames matched, tests (counts), what you could not verify, and requests for shared changes.
