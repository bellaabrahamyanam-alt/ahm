# Task: explore

Needs F0. Parallel with routes, layers, more.

## Routes and views

- Tab `explore` (`#tab-explore`), calling `tab('explore')`.
- Views: list with search and sort; Filters (closed by default, active ones as removable chips); place sheet (names, type, dates, notes, layers of the place); place form (new and edit); note dialog; search for other places (Nominatim); Time bar over the map (button "Time"); point card and hover popup on the map.
- Permanent link `#place-<id>`.

## Functionality

Restyle and rebuild these on the F0 components, with no behaviour change:
- Search over all names and note full text, highlighted match, ✕ and Esc to clear.
- Filters: type chips with counts, language, period (Period component). Sort A-Z or by date. Fit map.
- Place sheet and form: Names, Type, HistDate (began, ended), mountain `height_m` instead of dates, drag the red pin or type coordinates.
- Notes: several per place and language, title, optional Moment, text, layer tick boxes.
- Nominatim search only on Enter or button; cached, throttled.
- Time bar: slider, date field, play.

## Prototype screenshot references

Not provided. Slots to fill by the owner: `prototype/explore-list.png`, `explore-filters.png`, `place-sheet.png`, `place-form.png`, `note-dialog.png`, `time-bar.png`, `point-card.png`. Do not start before they exist.

## Missing screens and states (ASSUMED, check against prototype)

- Empty data (no places yet), no search results, no results for the current period.
- Nominatim: running, no result, error, throttled.
- `#place-<id>` for an unknown id.
- Read-only visitor: no add, edit, delete buttons.
- Place form: invalid date, no name, save running, save error.
- Time bar: objects without dates shown by the rule in TODO T-049 (answer pending; do not decide here).

## Files this task owns

`app/js/sidebar/places.js`, `placeform.js`, `searchfield.js`, `actions.js` (point card actions only), `timebar.js`, `app/js/map/map.js` (popup, point card, point menu only), `app/css/explore.css` (new), `tests/js/ui-explore.test.js` (new), `changes/sidebar.md`, `changes/map.md`.

## Shared components used

`dateEditor`, `periodField`, `momentField`, `languageSelect`, `nameList`, `typeSelect`.

## Must NOT modify

`app/css/sidebar.css`, `app/css/shapes.css`, `app/js/sidebar/shapes.js`, `routes.js`, `layers.js`, `admin.js`, `app/js/map/shapes.js`, `overlays.js`, `app/js/core/`, `service/`, `dev/`, `INTERFACES.md`, the `<section id="tab-...">` of other tabs in `app/index.html`. The terrain, 3D and river-size code in `map.js` stays as is (task `more` uses it through existing `AHM.map` commands).

## Acceptance criteria

1. Every view and state above renders with F0 components and tokens, no inline colours.
2. A place saved before and after the change has the same stored data.
3. Search, filters, sort, fit map, `#place-<id>`, notes and Nominatim behave as listed in `docs/02-implemented-features.md`.
4. No new `window.AHM` call beyond `INTERFACES.md`; no new cross-domain call.
5. `bun tools/build.js` done and `app/dist/` committed; `node tools/ci-check-pr.js <branch> origin/master` passes.

## Tests

`tests/js/ui-explore.test.js`: each state above renders its message; filter chips add and remove; `#place-unknown` shows the not-found state; read-only hides edit buttons; place form blocks an invalid date. Then `node tests/js/run.js 2>&1 | tail -15`. A manual run of the app is left to the critic.
