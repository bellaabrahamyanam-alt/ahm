# Task: rivers

Needs F0 and `borders` merged (the Rivers tab is the Borders panel in its own mode: same `app/js/sidebar/shapes.js`, `app/js/map/shapes.js`, `app/css/shapes.css`).

## Routes and views

- Tab `rivers` (`data-tab="rivers"`; no own `<section>`, it reuses `#tab-shapes`), calling `tab('rivers')`.
- Views: rivers list with its own filters and types; river card; "Select by rectangle" and "Select by area" (T-057); river size control.

## Functionality

Rebuild on the F0 components, no behaviour change:
- River shapes are `river: true` lines without stops; not used by route path finding.
- Card: Names with periods, Type (`kind: line`), Style (colour, opacity, width slider, label), HistDate, certainty, sources, notes.
- Select by rectangle (drag a box, Esc cancels) and by area (type an area name, any language, old names too).
- River size slider 0.5x to 4x, saved in the browser (its control sits in More > Maps & base map; here only the markup and states).

## Prototype screenshot references

Not provided. Slots: `prototype/rivers-list.png`, `river-card.png`, `rivers-select.png`. Do not start before they exist.

## Missing screens and states (ASSUMED, check against prototype)

- Empty list, no match.
- Selection: running, nothing found, N rivers selected with Clear, Esc hint.
- Area name not found.
- Validation errors, save running, save error, delete confirmation.
- Read-only visitor.

## Files this task owns

Rivers-mode parts of `app/js/sidebar/shapes.js` and `app/css/shapes.css` (after `borders` merged), `app/css/rivers.css` (new), `tests/js/ui-rivers.test.js` (new), `changes/sidebar.md`.

## Shared components used

`nameList`, `typeSelect` (`kind: line`), `styleEditor`, `dateEditor`, `languageSelect`.

## Must NOT modify

Borders-mode code paths, `app/js/map/map.js` (river width stays there), `app/js/sidebar/places.js`, `routes.js`, `layers.js`, `admin.js`, `app/css/sidebar.css`, `service/`, `dev/`, `INTERFACES.md`. Not in scope (own items): T-058 river filters, T-064 river size scope, T-065 add to layer, T-059, T-061, T-062.

## Acceptance criteria

1. Every view and state above renders with F0 components and tokens.
2. A river saved before and after has the same stored data.
3. Selection by rectangle and by area return the same rivers as before.
4. The Borders tab is unchanged by this task (its tests still pass).
5. `bun tools/build.js` done; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/ui-rivers.test.js`: list states, selection states, card fields, read-only. Then `node tests/js/run.js 2>&1 | tail -15`.
