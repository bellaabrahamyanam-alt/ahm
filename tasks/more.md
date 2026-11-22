# Task: more

Needs F0. Parallel with explore, routes, layers.

## Routes and views

- Tab `more` (`#tab-more`), calling `tab('more')`; `tab('route')` and similar open the right fold.
- Folds: Maps & base map (base map list, layer toggles Water, Roads, Places, Boundaries, historical map images, 3D view, terrain, rivers size); Directions; Languages; Types (administrators).
- Overlay editor: four-corner pinning, rotation and scale sliders, opacity, zoom range.

## Functionality

Rebuild on the F0 components, no behaviour change:
- Base map list (Liberty, Sentinel-2, optional Map + relief only when `basemap.terrain.tiles` is set) and its credit text.
- Overlays: add image (PNG, JPEG, WebP, up to 12 MB, shrunk to 4096 px in the browser), edit, delete (copy archived); visitors hide and set opacity for themselves.
- 3D: tilt 0-85, rotation 0-359, Flat, Tilt 60, North up, 3D terrain checkbox. River size slider 0.5x to 4x.
- Directions: two points or places, distance and time, swap, clear.
- Languages: dictionary table, only administrators add (code, English name, optional native name).
- Types: administrators add and edit place types (names, symbol, colour, size) with Type and Style components.

## Prototype screenshot references

Not provided. Slots: `prototype/more-maps.png`, `more-overlay-editor.png`, `more-3d.png`, `more-directions.png`, `more-languages.png`, `more-types.png`. Do not start before they exist.

## Missing screens and states (ASSUMED, check against prototype)

- Overlay upload: too large, wrong type, shrinking, saving, error.
- Terrain not configured (control hidden or explained).
- Directions: no route found, service error, one point only.
- Languages and Types for non-administrators: read-only with the hint "ask an administrator".
- Add language: duplicate code, invalid code.
- Types: duplicate code, code with `_` allowed only if T-026 is answered (do not decide here).

## Files this task owns

`app/js/sidebar/admin.js`, `app/js/sidebar/actions.js` (Directions only), `app/js/map/overlays.js`, `app/css/more.css` (new), `tests/js/ui-more.test.js` (new), `changes/sidebar.md`, `changes/map.md`.

## Shared components used

`languageSelect`, `nameList`, `typeSelect`, `styleEditor`.

## Must NOT modify

`app/js/map/map.js` (use the existing `AHM.map` commands only), `app/js/sidebar/places.js`, `shapes.js`, `routes.js`, `layers.js`, `app/css/sidebar.css`, `service/`, `dev/`, `INTERFACES.md`. The place-type list stays in its three places (`AGENTS.md` section 4). Not in scope: T-026, T-061, T-062.

## Acceptance criteria

1. Every fold, view and state above renders with F0 components and tokens.
2. Languages, types and overlays saved before and after have the same stored data.
3. Role rules unchanged: only administrators add languages and types.
4. No new `window.AHM` call beyond `INTERFACES.md`.
5. `bun tools/build.js` done; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/ui-more.test.js`: upload rejections, role differences, duplicate language code, terrain-not-configured state, directions error. Then `node tests/js/run.js 2>&1 | tail -15`.
