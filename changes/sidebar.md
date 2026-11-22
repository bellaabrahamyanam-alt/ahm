# Change log of the sidebar domain

## 2026-11-22 — Prototype look, slice 10: note count on rows (T-070)

- **What:** each Explore row shows a document icon and the number of notes of the place at its right end (`span.nn` in `placeRowHTML`, no badge when there are no notes). Data: `by[place.id]`, already loaded.
- **Why:** prototype screen s3.
- **Files:** `app/js/sidebar/places.js`, `app/css/sidebar.css`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`; the Explore list.

## 2026-11-22 — Prototype look, slice 9: closed rail (T-070)

- **What:** on a desktop the closed sidebar is a 60px rail with the logo tile and the six tab icons (titles as tooltips) instead of sliding away. A click on a tab icon opens the panel on that tab; the logo tile (role=button, Enter/Space) and the chevron both toggle the panel; map controls move 60px right. Phones keep the bottom sheet.
- **Why:** prototype screens s50 to s52.
- **Files:** `app/index.html`, `app/css/sidebar.css`, `app/js/sidebar/layout.js`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`. By hand: click the logo, then a tab icon, then the chevron.
- **Follow-ups:** the hover popover and the "Time" dot (s51); the rail rule for map controls is written in `sidebar.css`, the map domain may want it in `map.css`.

## 2026-11-22 — Prototype look, slice 8: Period | Moment footer (T-070)

- **What:** a footer at the bottom of the panel. Segmented switch Period | Moment, a label ("Any", "200 BCE – 300"), a reset ✕ and a two-handle year slider (1200 BCE to 1500 CE, step 10) that fills the same From and To date fields of the Explore filters, so the list, chips and map follow as before. Moment mode shows the existing time bar (play, slider, speed, undated, Off) in the same slot. The floating "Time" button and bar over the map are gone; their ids are unchanged. New in `period.js`: `periodSync`, `pfSlide`, `periodLabel`; `tbOpen` does nothing when the moment is already on; `tbRender` also toggles the switch.
- **Why:** prototype screens s1, s2 and s22.
- **Files:** `app/index.html`, `app/js/sidebar/{period,timebar}.js`, `app/css/sidebar.css`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`. By hand: drag a handle, the list narrows and the chip "period" appears; ✕ resets; Moment shows the bar, Period hides it.
- **Follow-ups:** the histogram of places behind the slider; a slider step finer than 10 years; Moment controls restyled (the date field is still the old one).

## 2026-11-22 — Prototype look, slice 7: Rivers and Routes (T-070)

- **What:** Rivers find card and selection card, Routes path finder as an accordion card; the blue sticky footer only for the "Add border" button (not for the river panel).
- **Why:** these panels still looked like the old design.
- **Files:** `app/css/sidebar.css`, `app/dist/`
- **How to verify:** `node tests/js/run.js`; compare Routes and Rivers with prototype screens s80 and s78.
- **Follow-ups:** icon for the finder card, open layer/border/route cards (s74, s83, s86), Period footer, closed rail, phone sheet, forms.

## 2026-11-22 — Prototype look, slice 6: Layers (T-070)

- **What:** each layer is a card with a colour edge, serif name, category line and a three-state switch (show / only / hide) built from `btn join-item` buttons with CSS-mask icons. `lyRowHTML` in `layers.js` emits the new markup; a click on the new `show` button turns off whichever of `only` / `hide` is on. Intro and Add footer fixed (`#ly-add`).
- **Why:** Layers still showed the old Only/Hide text buttons.
- **Files:** `app/js/sidebar/layers.js`, `app/css/sidebar.css`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`; compare Layers with prototype screen s85.
- **Follow-ups:** open layer card (s86), Rivers panel, Routes finder, Period footer, closed rail, phone sheet, forms.

## 2026-11-22 — Prototype look, slice 5 (T-070)

- **What:** "Atlas look, part 3" in `app/css/sidebar.css`: intro paragraphs with an info icon, search fields with an icon on every tab (label for screen readers only), sticky blue "Add border/route/layer" footer, eye toggles for the visibility checkboxes, marker-tile rows in Borders and Routes, and More sections as accordion cards with an icon and a sub line (`<small>` added to the five `summary` elements in `app/index.html`).
- **Why:** the other tabs still looked like the old design.
- **Files:** `app/css/sidebar.css`, `app/index.html`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`; compare Borders and More with prototype screens s73 and s19.
- **Follow-ups:** Layers cards with the three-state Only/Hide switch, Rivers panel, Routes finder card, Period footer with histogram, closed rail, phone sheet.

## 2026-11-22 — Prototype look, slice 4 (T-070)

- **What:** "Atlas look, part 2" at the end of `app/css/sidebar.css`: small uppercase labels, Filters as a pill with an icon, flat chips, 8px buttons, place card with serif title and a timeline of notes.
- **Why:** the prototype design was only partly visible.
- **Files:** `app/css/sidebar.css`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`; compare the place card with prototype screen s3.
- **Follow-ups:** Period footer with histogram (new JS), Borders, Routes, Rivers, Layers, More tabs, closed rail, phone sheet.

## 2026-11-22 — Prototype look, slice 3 (T-070)

- **What:** new "Atlas look" block at the end of `app/css/sidebar.css`: header with logo tile, tabs with icons and a blue bar, search field with an icon, quiet count bar, list rows with a marker tile and a serif name. Header and tab icons are static inline SVG in `app/index.html`. It does not need daisyUI to draw.
- **Why:** slices 1 and 2 changed too little; the prototype design was not visible.
- **Files:** `app/css/sidebar.css`, `app/index.html`, `app/js/sidebar/layout.js` (a click on a tab icon now selects the tab), `app/dist/`
- **How to verify:** `node tests/js/run.js`. By hand: compare Explore with prototype screen s1.
- **Follow-ups:** period footer, filters panel, place card (accordion), other tabs.
## 2026-11-22 — daisyUI Explore, slice 2 (T-070)

- **What:** search field = daisyUI `input input-sm` wrapper with a bare `input.grow`; type, certainty and source chips are `btn btn-xs`; Reset and Fit map are `btn btn-sm`; sort and language are `select select-sm`. Legacy global `button`, `select`, `input` rules now skip `.btn`, `.select`, `.grow` so daisyUI styles them.
- **Why:** same item, next slice (Explore header and filters).
- **Files:** `app/index.html`, `app/css/sidebar.css`, `app/js/sidebar/{places,searchfield}.js`, `app/dist/`, `graph/`
- **How to verify:** `node tests/js/run.js`. By hand: Explore search, ✕, chips, sort.
- **Follow-ups:** list rows and the place card (slice 3); not seen in a browser.

## 2026-11-22 — daisyUI shell, slice 1 (T-070)

- **What:** `daisyui@5` CSS linked in `app/index.html` (CDN, before the `ahm:css` block); forum palette mapped to daisyUI variables in `base.css`; the six tabs use `tabs tabs-border` / `tab` / `tab-active` (`role=tablist`, `aria-selected`); old `.tabs button` rules replaced.
- **Why:** owner asked to replace the sidebar design with daisyUI step by step.
- **Files:** `app/index.html`, `app/css/{base,sidebar}.css`, `app/js/sidebar/layout.js`, `app/dist/`
- **How to verify:** `node tests/js/run.js`. By hand: switch tabs; the active one has the blue bar.
- **Follow-ups:** variable names are from daisyUI 5 docs, not checked against the CDN file (no network here).

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

## 2026-11-15 — Rivers tab (T-038)

- **What:** Rivers tab (same panel as Borders in a second mode: `shSetMode`), river search without records, "Follow a river" in the line tool, Width slider, river geometry in the Types admin.
- **Why:** owner, in the chat: rivers as their own entity with a tab, notes, a name search that saves nothing, and a section of a river by two clicks.
- **Files:** `app/js/sidebar/shapes.js`, `app/js/sidebar/layout.js`, `app/js/sidebar/admin.js`, `app/index.html`, `tests/js/browser.test.js`
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js` (browser test "the Rivers tab ...", `riverSection` tests, `shape:` and `type:` river rows of `tests/fixtures/rules.json`).
- **Follow-ups:** the OpenStreetMap search and a click on a river of the real base map were not tried with live data.

## 2026-11-15 — Rivers tab fix: a dictionary without a river type (T-038)

- **What:** the shape form says "Choose a type" instead of failing when no type chip is selected; river search keeps only waterway results (not villages or boundaries with the same name).
- **Why:** owner's screenshot: "can't access property dataset" on Save in the Rivers tab, because the live types.json had no river type and the type chips were empty.
- **Files:** `app/js/sidebar/shapes.js`
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js`.
- **Follow-ups:** none.

## 2026-11-15 — Rivers tab: critic fixes (T-038)

- **What:** a click is recorded as dropped from the line only when it got a river section; the section message names the river; leaving the tab while drawing cancels the drawing; the follow option defaults on only the first time.
- **Why:** critic review of the PR: the fallback straight line lost the clicks; a near river could be taken for the wrong one; the tab could show the wrong list while drawing.
- **Files:** `app/js/sidebar/shapes.js`, `tests/js/browser.test.js`
- **How to verify:** `node tests/js/run.js` (browser test: a leg with no river keeps its clicks).
- **Follow-ups:** none.

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


## 2026-11-14 — T-036: the Types editor adds line and area types

- **What:** `app/js/sidebar/admin.js`, `app/js/sidebar/ui.js`, `app/index.html`: More → "Types" lists all types (place, line, area, with the number of places or shapes that use each) and has three add buttons; the form of a line type has pattern, width, opacity and "One way"; of an area type pattern, width, opacity and fill; `tySet` and the start call `setShapeTypes`, so the Borders and Routes tabs follow at once.
- **Why:** T-036; the owner decided in the chat (T-034) that line and area types are dictionary types.
- **Files:** `app/js/sidebar/admin.js`, `app/js/sidebar/ui.js`, `app/index.html`.
- **How to verify:** More → Types as an administrator: add a line type, then add a route of that type in the Routes tab. Not verified: the page in a browser; no test covers the editor form (T-029).
- **Follow-ups:** none.

## 2026-11-16 — T-040: the time bar

- **What:** a "Time" button and a bar over the map (play / pause, slider over the earliest and latest date of the places and shapes, date field, speed 1 to 500 years per second, "Show undated", "Off"), `app/js/sidebar/timebar.js`. A chip "Time: <year>" among the active filters. Places and shapes outside their life are not listed or drawn; the "only possible" ones get `faded`.
- **Why:** T-040. **Files:** `timebar.js`, `places.js`, `shapes.js` (opacity x 0.35 when faded), `app/index.html`, `app/css/sidebar.css`, `tests/js/sidebar.test.js`.
- **Verify:** `node tests/js/run.js "time bar" --no-browser`. NOT seen in a browser (see docs/14).

## 2026-11-17 — T-057: select rivers
- **What:** Rivers tab: "Select rivers" block (rectangle, area name, only fully inside, list with remove, Clear, Show only these, Zoom to the selection); `sh.rsel` holds the selection; `shPush` hides the others while "Show only these" is on.
- **Why:** T-057. **Files:** see `changes/map.md` (same item). **Verify:** `node tests/js/run.js river --no-browser`. **Follow-ups:** T-064, T-065.
## 2026-11-16 — T-041: versions of a border or river in the sheet

- **What:** the sheet lists "Other versions" (chips, click opens that version) and has the button "Add version for another time": the form (names, type, dates) opens with a copy of the shape; Save creates it with the same `series` (the original joins the series first when it had none) and, when ticked, ends the previous version the day before. Each version can be edited and deleted alone (the normal buttons). Routes have their own card (`routes.js`): NOT done there yet.
- **Files:** `app/js/sidebar/shapes.js`. NOT seen in a browser.

## 2026-11-16 — Fix: "Add version for another time" failed with `crypto.randomUUID is not a function`

- **What:** `app/js/sidebar/shapes.js`: new `shNewUuid()` (v4 UUID from `crypto.getRandomValues` when `crypto.randomUUID` is missing); the `addversion` action uses it for a shape without a series.
- **Why:** `crypto.randomUUID` exists only in a secure context (https or localhost). On a plain-http forum the button threw and the form did not open.
- **Files:** `app/js/sidebar/shapes.js`, `tests/js/layers.test.js` (1 test), `app/dist/`.
- **How to verify:** `node tests/js/run.js "shNewUuid"`. Chromium, `randomUUID` removed: the button opens the "New version" form without a page error.

## 2026-11-17 — A new version of a border in one go (T-041 simplified)

- **What:** `app/js/sidebar/shapes.js`. The button "Add version for another time" is now "New version…". It opens the outline of the open shape in the drawing tool at once (mode `version`, banner "New version: move the points", button "Next: dates"); Next opens the form (titled "New version of “name”", names, type, look taken over, only the dates are new); Save creates the second version and joins the first to the series. The first version is not changed. Cancel in either step returns to the first version. An outline the tool cannot edit (several parts) skips the drawing step. The sheet now lists ALL versions in time ("Versions in time (n)") with the open one marked. New: `shStartVersion`, `shVersionChips`, `shVersionHint`; `shStartDraw(kind, existing, version)`.
- **Also:** the server error `unknown border type` now names the type (`service/store.php`, `dev/save-handler.js`); parity case in `tests/fixtures/rules.json` tightened.
- **Why:** the old way needed five steps (add, copy saved with the same outline, find it in the list, edit, save) and did not show that the copy is a version.
- **Files:** `app/js/sidebar/shapes.js`, `service/store.php`, `dev/save-handler.js`, `tests/js/browser.test.js` (2 scenarios), `tests/fixtures/rules.json`, `app/dist/`.
- **How to verify:** `node tests/js/run.js browser`. NOT verified: the real drawing tool on the real map (MapLibre is a stand-in in tests): moving points with the mouse.

## 2026-11-17 — T-063: a new version of a route in one go

- **What:** `app/js/sidebar/routes.js`. The route card has "New version…" (next to "Edit path"): it opens the path in the drawing tool (mode `version`, banner "New version: move the points", button "Next: dates"); Next opens the route form titled "New version of “name”" (names, type, direction and look taken over, only the dates are new; "End the previous version the day before" is ticked when the first has no end); Save creates the second version and joins the first to the series (`series` made now when it has none). Back to the map returns to the drawing step with the path kept. Cancel returns to the first version, which is never changed. The card lists "Versions in time (n)" with the open one marked: `shVersionChips(s, act)` of `shapes.js` is shared with borders. `rtCreate(body, close)`; `rtStartDraw` takes the pending points before the route's own line.
- **Why:** owner: the same simple flow as for borders (T-041 simplified).
- **Files:** `app/js/sidebar/routes.js`, `app/js/sidebar/shapes.js`, `tests/js/browser.test.js` (1 scenario), `TODO.md`, `app/dist/`.
- **How to verify:** `node tests/js/run.js browser`. NOT verified: the real drawing tool (stops, "follow roads") on the real map; the stand-in hands back a moved path.

## 2026-11-17 — T-046: certainty and sources in forms, sheets and filters

- **What:** `placeform.js` (`evidenceHTML`, `evidenceFormHTML`, `evidenceRead`, `evidenceAddSource`, "New source" inside the form); the place and border sheets show certainty, radius and sources (links only for http(s)); the place and border forms save them; Filters has Certainty and Source chips (places list and map). Features sent to the map carry `certainty` and `radius_m`.
- **Not done:** borders, rivers and routes lists are not filtered; the route card has no fields (T-068). NOT seen in a browser.

- T-046 merge with master (2026-11-17): the certainty and sources fields of the border form are now inside `#shForm` in the version form too (T-041 had closed it early, so Save failed with "Cannot read properties of null"); the existing browser test of a new border version covers it.

## 2026-11-17 — T-043: names over time in the forms and lists

- **What:** `pfRowDated` / `pfReadNames` (`placeform.js`): each name row of the place, border and route forms has "Period of this name" (from, to); list rows of places and borders say "also called …" when an old name matched the search.
- **Files:** `placeform.js`, `shapes.js`, `routes.js`, `places.js`, `tests/js/browser.test.js` (1 scenario: the place form). Seen in headless Chromium: the place form only; NOT seen: border and route forms, the map label with the slider.
