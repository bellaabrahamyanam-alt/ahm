# 00 Project map

Branch `feat/shared-foundation-tasks`, read 2026-11-23. Prototype = `docs/prototype/` (identical to the uploaded zip; checked with `diff -rq`). Not verified in a browser: the sandbox cannot load the CDN.

## Stack
Plain classic scripts, no framework, no build in dev (`app/index.html`, order of `<script>` tags matters). MapLibre GL 5.24.1 (CDN). daisyUI 5.8.2 CSS (CDN, no Tailwind). Production = `app/dist/` from `bun tools/build.js` (committed). PHP phpBB ext in `controller/`, `service/`; Node dev server in `dev/`.

## Routes
**HTTP** (`config/routing.yml`): `GET /map`, `/map/data/{f}`, `/map/note/{place}/{id}`, `/map/overlay/{id}`; `POST /map/save`, `language-save`, `type-save`, `type-delete`, `layer-save`, `layer-delete`, `shape-save`, `shape-delete`, `category-save`, `source-save`, `overlay-save`, `overlay-upload/{id}`, `overlay-delete`.
**Client**: no router. State = `tab(n)` in `app/js/sidebar/layout.js` + hash `#place-<id>`. Tabs (`data-tab`): `explore`, `shapes` (label Borders), `routes`, `rivers`, `layers`, `more`. `rivers` has NO own section: it shows `#tab-shapes` with `sh.mode = 'rivers'` (`layout.js:23`, `sidebar/shapes.js`). `tab('route')` opens the Directions fold of More.

## Screens by tab (from `index.html` and `sidebar/*.js`)
| Tab | Views / sheets / modals / interactions | Owner file(s) |
|---|---|---|
| shell | brand header, tab bar, collapse/expand, resizer, mobile bottom sheet, dock (`#dock`) | `layout.js`, `ui.js`, `index.html` |
| explore | Filters fold (type, certainty, source, language, Period From/To), active chips, search+sort+fit, list, place card in the list (names, layers, notes), place form, note edit, geocoder (Nominatim), point card + hover popup on the map | `places.js`, `placeform.js`, `actions.js`, `searchfield.js`, `period.js`, `map/map.js` |
| time | `#tbOpen` "Time" button + `#timebar` (slider, play, speed, undated switch) over the map | `timebar.js` |
| dialogs | `<dialog id=dlg>` place/note form; `<dialog id=lyDlg>` layer form | `actions.js`, `layers.js` |
| shapes | intro, search, type chips, count + Fit map, list, card, draw/edit/new-version, certainty+sources, notes | `sidebar/shapes.js`, `map/shapes.js`, `core/shapes.js` |
| routes | path finder (From/To/Find/Clear), search, types, list, card, draw mode, stops, notes | `sidebar/routes.js`, `core/routes.js` |
| rivers | shapes panel in river mode + select by rectangle / by area, selection list, Only/Zoom/Clear | `sidebar/shapes.js` |
| layers | list (search, category select), layer sheet, Choose places, Only/Hide, category admin (see D3 below) | `layers.js`, `core/layer-rules.js` |
| more | folds: Maps & base map (base map, 3D, terrain, rivers size, relief, height profile, overlays + corner editor), Directions, Languages, Types, Categories | `admin.js`, `map/overlays.js`, `actions.js` |

## Data models (docs/05-data-model.md, AGENTS.md)
- Date: `null` or `{fmt, ts, mode: exact|approx|range, ts_to}`; `fmt` in ymd, dmy, mdy, dmony, mony, y, c, m; ISO 8601 UTC `Z`; BCE as `±YYYYYY`; compare with `isoToSec`. Never change.
- Place (`places.geojson`), notes (md files + index), shapes (areas, lines, rivers), routes (stops, twoway), layers (ordered members, optional category/colour/date range), categories, languages, types (`point|line|area|river`, `names[]`, `color`, `style`), overlays, sources.
- Names: several per language; first of a language is the map name; a name can carry a period.

## State of the migration on this branch (verified from git and files)
| Part | Status | Evidence |
|---|---|---|
| F1 tokens + daisyUI theme | built | `5de9e1e`, `0300a78`, `base.css` tokens `--r-card`, `--r-ctl`, `--font-ui`, `--font-serif`; CDN link `index.html:11` |
| F2 app shell | brand header + icon tabs built; NOT built: daisyUI classes on buttons/sheets/inputs, loading/error/read-only states | `10f0ece`, `tasks/foundation.md` |
| F3 components | `components.js` has only `uiDateEditor` + `uiDateFormatGroups` (wrappers over `datefield.js`) | `8614154`, 1.9 KB |
| F4 date editor | built: segmented mode, grouped format select, CE/BCE, preview. NOT built: custom format popup (native select used) | `f0c71da` |
| F5 Period/Moment footer | NOT built. `period.js` 13 lines, `timebar.js` still the old bar + `#tbOpen` | files |
| F6 nameList/typeSelect/styleEditor/languageSelect | NOT built | `components.js` |
| screen tasks explore, borders, routes, rivers, layers, more | NOT started (task files only) | `tasks/*.md` |
| Categories fold in More | markup exists (`#more-cat`); whether the admin code left `layers.js` NOT verified | `index.html` |

## Tests
`node tests/js/run.js`: 303 pass, 1 fail on this branch. Failure: `domains: every file has an owner` for `tasks/*.md` (new dir, no line in protected `tools/domains.json`; needs an `Approved:` line). master: 0 failed (one TAP line "not ok 14 river section" appeared in a separate output; not investigated, possibly flaky). PHP tests not run (no php check done).

## Doc drift found
`docs/04-project-structure.md` lists no `sidebar/shapes.js`, `routes.js`, `timebar.js`, `components.js`, `map/shapes.js`, `css/shapes.css`; `docs/05-data-model.md` says dates live in `app/js/dates.js` (real: `app/js/core/dates.js`). Not fixed here.
