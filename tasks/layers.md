# Task: layers

Needs F0. Parallel with explore, routes, more.

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

`app/js/sidebar/layers.js`, `app/js/core/layer-rules.js`, `app/css/layers.css` (new), `tests/js/ui-layers.test.js` (new), `changes/sidebar.md`, `changes/core.md`.

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
