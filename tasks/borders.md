# Task: borders

Needs F0. Parallel with explore, routes, layers, more. `rivers` needs this task (same panel and files).

## Routes and views

- Tab `shapes`, label "Borders" (`#tab-shapes`, `data-tab="shapes"`), calling `tab('shapes')`.
- Views: borders list with search, filters and types; border card (colour, opacity, width slider, pattern, label, dates, certainty, source, notes); draw / edit on the map; names with periods; border notes.

## Functionality

Rebuild on the F0 components, no behaviour change:
- List: search by any name (old names too), type filter, the time bar hides borders outside their life.
- Card: Style editor, Names (each with a period), HistDate, certainty (exact, approximate, disputed) and sources from the shared list ("New source").
- Draw an area or a line on the map, edit points, delete (archived copy kept).
- Notes of a border: title, language, optional date, text.
- The sidebar panel is also used by the Rivers tab in its own mode: keep that mode working and do not rename its entry points.

## Prototype screenshot references

Prototype frames: `docs/prototype/png/s33.png` border, new version in time (Add another name, date field). The prototype has only these 19 frames (ids s1 to s49 are not consecutive); every screen not named here has no design.

## Missing screens and states

No frame for: borders list, border card (colour, opacity, width), drawing mode, notes, empty and error states, read-only visitor. The list below is ASSUMED from the code.

- Empty list, no match, no border in the current period.
- Drawing active with Cancel (Esc) and a point counter; too few points.
- Validation errors (no name, invalid date), save running, save error.
- Delete confirmation naming the archived copy.
- Read-only visitor.
- Disputed or approximate certainty shown on list rows.

## Files this task owns

`app/js/sidebar/shapes.js`, `app/js/map/shapes.js`, `app/js/core/shapes.js`, `app/css/shapes.css`, `tests/js/sidebar.test.js` (section `ui-borders`) (new), `changes/sidebar.md`, `changes/map.md`, `changes/core.md`.

## Shared components used

`nameList`, `typeSelect` (`kind: area`), `styleEditor`, `dateEditor`, `periodField`, `momentField`, `languageSelect`.

## Must NOT modify

`app/js/map/map.js`, `app/js/sidebar/places.js`, `routes.js`, `layers.js`, `admin.js`, `app/css/sidebar.css`, `service/`, `dev/`, `INTERFACES.md`. Not in scope (own TODO items): T-042 border change, T-052, T-067, T-068.

## Acceptance criteria

1. Every view and state above renders with F0 components and tokens.
2. A border saved before and after has the same stored data; Rivers mode still opens from `tab('rivers')`.
3. Certainty and sources, periods of names and notes work as in `docs/02-implemented-features.md`.
4. No new `window.AHM` call beyond `INTERFACES.md`.
5. `bun tools/build.js` done; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/sidebar.test.js` (section `ui-borders`): list states, card renders each field through the shared component, drawing cancel, delete confirmation, read-only. Then `node tests/js/run.js 2>&1 | tail -15`.
