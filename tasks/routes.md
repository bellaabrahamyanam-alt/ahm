# Task: routes

**Depends on:** F0. Parallel with explore, borders, layers.
**Read first:** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`; do not re-explore.

Needs F0. Parallel with explore, layers, more.

## Routes and views

- Tab `routes` (`#tab-routes`), calling `tab('routes')`.
- Views: route list with search, filters and types (trade, military, migration, journey, road); route card; draw mode; stops list; route notes.

## Functionality

Rebuild on the F0 components, no behaviour change:
- Draw on the map: click A, the points, B; a click on a place makes it a stop; free waypoints allowed.
- Card: Names, Type (`kind: line`), Style, HistDate, two-way flag, stops in order, certainty and sources.
- Route notes: title, language, optional date, text.
- Path finding over the stops (`app/js/core/routes.js`) stays as is.

## Prototype screenshot references

**Full design (owner, 2026-11-24): `docs/prototype/full/` frames s34 s77 s80 to s84** (index: its README.md). On a difference with the 19 first frames below, the full design wins. Implementation direction: `docs/design-migration/03-work-plan.md`, "Direction" (daisyUI components, static HTML and templates first).

Prototype frames: `docs/prototype/png/s34.png` route form after drawing. The prototype has only these 19 frames (ids s1 to s49 are not consecutive); every screen not named here has no design.

## Missing screens and states

No frame for: routes list, route card, drawing mode, stops list, notes, empty and error states, read-only visitor. The list below is ASSUMED from the code.

- Empty list, no match.
- Drawing active, Cancel, fewer than 2 points.
- No path found between two stops; a stop whose place was deleted.
- Validation errors, save running, save error, delete confirmation.
- Read-only visitor.

## Files this task owns

`app/js/sidebar/routes.js`, `app/js/core/routes.js`, `app/css/routes.css` (new), `tests/js/sidebar.test.js` (section `ui-routes`) (new), `changes/sidebar.md`, `changes/core.md`.

## Shared components used

`nameList`, `typeSelect` (`kind: line`), `styleEditor`, `dateEditor`, `momentField`, `languageSelect`.

## Must NOT modify

`app/js/sidebar/shapes.js`, `places.js`, `layers.js`, `admin.js`, `app/js/map/`, `app/css/sidebar.css`, `app/css/shapes.css`, `service/`, `dev/`, `INTERFACES.md`, other tabs' sections in `app/index.html`. Not in scope: T-032 (route rules in the parity table), T-044, T-045.

## Acceptance criteria

1. Every view and state above renders with F0 components and tokens.
2. A route saved before and after has the same stored data (`stops`, `twoway`, line geometry).
3. Drawing, stops, path finding and notes behave as in `docs/02-implemented-features.md`.
4. No new `window.AHM` call beyond `INTERFACES.md`.
5. `bun tools/build.js` done; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/sidebar.test.js` (section `ui-routes`): list states, card fields through shared components, stop order after reorder, no-path message, read-only. Existing `tests/js/routes.test.js` must still pass unchanged. Then `node tests/js/run.js 2>&1 | tail -15`.
