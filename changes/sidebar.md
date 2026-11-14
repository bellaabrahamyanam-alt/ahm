# Change log of the sidebar domain

## 2026-11-12 — Place types are a dictionary (T-025, I-8)

- **What:** More tab → "Place types" (list with markers and counts; admins: add, edit, remove, live preview); the place form and the filter chips use the dictionary; the old `PLACE_TYPES` list is gone.
- **Why:** administrators must be able to add markers (iron mine, cedar forest, sword artefact) without a code change.
- **Files:** `app/js/sidebar/{ui,placeform,layers,routes}.js`, `app/index.html`, `app/css/sidebar.css`, `tests/js/sidebar.test.js`, `tests/js/lib/ctx.js`
- **How to verify:** `node tests/js/run.js`. By hand: as an administrator add "Iron mine" (pickaxe), then pick it in a place.
- **Follow-ups:** none.

## 2026-11-14 — Custom symbols for place types (T-025)

- **What:** Place types editor: symbol list ends with "Custom (SVG path)…"; the admin chooses an SVG file (button) and the paths, rectangles, circles, ellipses and polygons of it become the symbol (`svgToPath` in `placeform.js`); the path and box can still be edited under "Advanced" or a whole `<svg>` pasted there; Save stays off until the path is valid; live preview. The path limit is 20000 characters (real icons are long).
- **Review fixes (critic, PR #10):** type names (typed by administrators) are escaped with `esc()` everywhere they are printed (`layers.js` had two places without it; one also lacked the language); `svgToPath` refuses an SVG with a viewBox that does not start at 0 0 or with any `transform` and the form says why; a test keeps `typeLabel` out of HTML unescaped.
- **Why:** the list of 15 symbols is too small (iron mine, cedar forest, sword artefact, ...).
- **Files:** `app/js/sidebar/ui.js`
- **How to verify:** By hand (not checked in a browser here): add a type, pick Custom, paste an icon path, check the preview and the marker on the map.
- **Follow-ups:** `style.path` and `style.box` are an addition to `interfaces/I-8` (see `TODO.md` T-026).

One entry per change, newest last: date, what, why, files, how to verify, open follow-ups. Only the sidebar domain appends here (DOMAINS.md, rule 7). The history before 2026-11-06 is in the legacy `AGENT_CHANGES.md` (entries #1-#26), which is now read-only.

---

## 2026-11-06 — #1 The sidebar passes the search options to `run()`; fix: details clicks in the layer list

### What
- `sidebar/ui.js`: `searchOptions()` builds `{ q, lang, sort, period }` from the sidebar fields; `update()` and "Fit map" call `run(searchOptions())` (proposal 001).
- Bug fix `sidebar/layers.js`: a click on a button inside the open layer's details (for example "Choose places") also reached the layer list's own click handler after the details had been re-rendered; the handler no longer found `#lyDetail` among the ancestors of the detached button and called `lyToggleFilter("editplaces")`, which threw a TypeError (visible only in the console). The handler now asks `event.composedPath()`. It was found by the updated browser test.

### Verify
`node tests/js/run.js`.

---

## 2026-11-07 — #2 Sidebar publishes selected place and layer changes to AHM.state (task 003)

### What
- `sidebar/ui.js`: wherever `cur` is set (show, closeDetail, editPlace), also `AHM.state.set('selected', cur ? cur.id : null)`. The sidebar never reads `selected` back.
- `sidebar/layers.js`: after in-place changes to the `lyState` sets or staged members (`lyToggleFilter`, `lyClearFilters`, `lySet` cleanup of deleted layers, `lyStartEdit`, `lyStopEdit`, `lyToggleMember`), call `AHM.state.patch('layers', {})` so listeners see `state:layers`.

### Why
Task 003 / I-6: the map (and others) read shared selection and layer filter state from `AHM.state`, not from sidebar internals.

### Files
- `app/js/sidebar/ui.js`
- `app/js/sidebar/layers.js`
- `changes/sidebar.md`

### Verify
`node tests/js/run.js` (includes the gated "sidebar publishes: …" tests in `tests/js/layers.test.js`).

### Open follow-ups
None for this task. Known violation 1 in INTERFACES.md closes when task 002 is also merged.

## 2026-11-14 — #3 T-027: notes in the cards of borders and routes
**What:** `sidebar/layers.js`: new `lyOwnerNotesHTML(id, lang, attr)` (the notes block of a card, edit buttons for editors); `lyOpenNoteDlg(owner, note, what)` takes any object with `id` and `names` and names what the note is about; after saving, the border and route cards are drawn again. `sidebar/shapes.js` and `sidebar/routes.js`: the card shows the block and handles `addnote` and `editnote`. Tests: `tests/js/layers.test.js` (2, "shape notes").
**Why:** the owner asked for notes on routes and borders (T-027). The note dialog and the data are those of layer notes.
**Verify:** `node tests/js/run.js "shape notes"`, then the whole run.
**Follow-ups:** the search field of the Borders and Routes lists does not look into notes; the Explore view does not show them.

## 2026-11-14 — T-021: the Routes tab (written afterwards; the work is of 2026-11-11, commits `b0b76d2`, `571630d`, `2f38036`)

- **What:** new `app/js/sidebar/routes.js` (the Routes tab: list with type filter, card, "Find a path" between two places, add and edit form, drawing on the map first, optional roads by OSRM); `app/index.html` (tab button, `#tab-routes`), `app/css/shapes.css`, `app/css/sidebar.css`, `sidebar/ui.js`, `sidebar/shapes.js`, `sidebar/layers.js` (small changes so borders and routes share the form and the layers).
- **Why:** the owner wanted historical routes between places; it was merged without a change-log entry (T-021).
- **Files:** `app/js/sidebar/routes.js`, `app/js/sidebar/{ui,shapes,layers}.js`, `app/index.html`, `app/css/{shapes,sidebar}.css`.
- **How to verify:** `node tests/js/run.js`; in the app open the Routes tab, draw a route on the map, save it, then use Find a path.
- **Follow-ups:** no test covers the sidebar part (the `rt*` functions need the page DOM and the map); only the pure rules behind it are tested (`tests/js/routes.test.js`). Not verified now: the map canvas.

## 2026-11-14 — #4 T-035: `sidebar/ui.js` split into five files
**What:** `app/js/sidebar/ui.js` (1152 lines) is now `layout.js` (shared sidebar state, tabs, collapse, the details dock, resizing), `places.js` (filters, result list, selected point, place details, long notes), `actions.js` (directions, point-card actions, geocoder search, add / edit a place or a note), `admin.js` (dictionaries of languages and of place types) and `ui.js` (events from the map, start-up). The lines are moved as they were: no function, name or behaviour changed (the multiset of lines is the same, apart from five header comments). `app/index.html`: the five files load in this order, where `ui.js` was; `ui.js` stays last because it starts the app. `tests/js/layers.test.js` loads the five files where it loaded `ui.js`. `tools/context.json` and `docs/04-project-structure.md` list the files.
**Why:** the owner asked for a refactoring of `ui.js` in its own PR and chose 4–5 files. All files are classic scripts in one global scope, so a name keeps working across files as long as the file that runs code at load time loads after what that code uses.
**Verify:** `node tests/js/run.js 2>&1 | tail -15`; `node tools/build.js --check`; the page loaded in Chromium from `app/js` and from `app/dist` shows no new console errors.
**Follow-ups:** `places.js` (430 lines) and `actions.js` (255 lines) can still be cut by topic (long notes; add / edit dialogs); `layers.js` (691 lines), `shapes.js` and `routes.js` are the next largest. Not changed on purpose: names, duplicated code between `shapes.js` and `routes.js`.

