# Task: explore

**Depends on:** F0 (F1-F6 done). Parallel with borders, routes, layers.
**Read first:** `docs/design-migration/00-project-map.md`, `01-design-system.md`, `02-shared-components.md`; do not re-explore.

Needs F0. Parallel with routes, layers, more.

Note (D4 default 1): the Period and Moment footer (F5, s1, s22) is the Explore footer; the old "Time" button over the map goes only if D4 = 1.

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

Prototype frames (`docs/prototype/png/`, titles from `docs/prototype/sidebar.js`): `s1.png` Explore with Period footer and Time-travel button; `s2.png` filters (type, certainty, language, Period From/To); `s3.png` place details as one card; `s7.png` edit a place; `s28.png` period of a name; `s45.png` notes; `s46.png` note edit (new date field); `s22.png` Moment (time travel); `s49.png` Period vs Moment. The prototype has only these 19 frames (ids s1 to s49 are not consecutive); every screen not named here has no design.

## Missing screens and states

No frame for: place list rows with no filters, hover popup, point card, Nominatim results, empty and error states, read-only visitor, add-place from the map. The list below is ASSUMED from the code.

- Empty data (no places yet), no search results, no results for the current period.
- Nominatim: running, no result, error, throttled.
- `#place-<id>` for an unknown id.
- Read-only visitor: no add, edit, delete buttons.
- Place form: invalid date, no name, save running, save error.
- Time bar: objects without dates shown by the rule in TODO T-049 (answer pending; do not decide here).

## Files this task owns

`app/js/sidebar/places.js`, `placeform.js`, `searchfield.js`, `actions.js` (point card actions only), `app/js/map/map.js` (popup, point card, point menu only), `app/css/explore.css` (already linked; exists, empty, already linked), `tests/js/ui-explore.test.js` (new), `changes/sidebar.md`, `changes/map.md`.

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

**Exception:** in `timebar.js` you may change only the first moment `tbOpen()` picks (middle of the data span instead of its start, as in frame s22); nothing else in that file.

## Hand-off rules (set by the main agent, override anything above)
- Branch: work on a branch of your own from `feat/shared-foundation-tasks` (`feat/ui-explore`); never push to `feat/shared-foundation-tasks` or `master`.
- Do NOT commit generated files: `app/dist/`, `graph/`, `context/`. The main agent builds and regenerates them once after all workers merge.
- Do NOT edit `changes/*.md`, `docs/`, `tools/`, `app/index.html`, `app/css/sidebar.css`, `app/css/base.css`, `app/js/sidebar/components.js`, `period.js`, `layout.js`, `ui.js`, `tests/js/sidebar.test.js`, `tests/js/lib/`. Need one of them changed: say so in your report (what and why), do not edit.
- Tests go in `tests/js/ui-explore.test.js` (already exists, empty). Run `node tests/js/run.js --no-browser` (all must pass; one real-browser test is welcome if a browser is available, see the report rule below).
- New class names: no collision with daisyUI (it owns stack, label, tabs, badge, sm, list, toast, card, menu, tab, badge ...); use your own prefix.
- Report: files changed, what was built, frames matched, tests (counts), what you could not verify, and requests for shared changes.
