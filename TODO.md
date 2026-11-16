# TODO: the only list of work

The single place for what is to be done. It replaces task specs, proposals and requests (they are history in `changes/archive/`).

**How it works**
- The owner adds items and decides. The `builder` agent takes an item (`builder: T-003`, or `builder: next`), does it all (spec, tests, design, code, docs) and opens a pull request. The `critic` agent checks the pull request and merges it, or reports to the owner.
- One item = one pull request. Item ids `T-NNN` are never reused.
- **Needs you** holds what only the owner can decide. The builder writes the question there with 2 or 3 options and a recommendation, and stops that item. The owner answers by adding a line `Approved: <date> <decision>` to the item.
- **Protected files** (list `protected` in `tools/domains.json`: agent rules, CI, contracts `INTERFACES.md` and `interfaces/`, ownership) change only in an item that has an `Approved:` line. The pull request description then has `Owner-approved: T-NNN`, and the critic checks it against this file on `master`.
- When an item is finished the builder moves it to **Done** with the date and the pull request number. Keep the last 15 in Done; older ones go to `changes/archive/`.

Item format: `- [ ] T-NNN Title` then indented lines: `Done when:` (what can be checked), `Contract:` yes or no (does it change `INTERFACES.md`).

## Map of the list

**Needs you (owner)**
- History and time: T-049, T-050, T-051, T-052
- Place and line types, interfaces: T-026, T-002
- Campaigns: T-003, T-001
- Project and CI: T-054, T-004

**Next (builder)**, in this order (`builder: next` takes the first open item of the first group)
- 1. Rivers and 3D: T-055, T-056, T-057, T-058, T-059
- 2. History and time: T-041, T-043, T-046, T-042
- 3. Analysis and sharing: T-044, T-045, T-047
- 4. Data checks and server rules: T-037, T-031, T-032
- 5. Tests and code health: T-029, T-030, T-033, T-012, T-011, T-028
- 6. Campaigns: T-013

**Done**: the last 15 below.

## Needs you (owner)

### History and time

Decisions for the time and history block (T-040 to T-047).

- [ ] T-049 Decide: objects with no dates when the time slider is on (T-040)
  1. always shown; 2. always hidden; 3. shown faded, with a switch "Show undated" in the slider bar. Recommendation: 3 (nothing disappears by surprise, and you can still clear the map).
  Done when: you write `Approved: <date> 1`, `2` or `3`.
  Assumed: 2026-11-16 option 3 (the recommendation) is built in T-040, because the owner asked in the chat to build T-040 and did not answer here; say `Approved: <date> 1` or `2` to change it (one default and one test).
  Contract: no.
- [ ] T-050 Decide: swipe compare of historical map pictures (overlays)
  What it is: a vertical curtain you drag over the map: on one side the old picture, on the other the modern map, plus a fade slider. It shows at once where the old picture matches (rivers, coasts, towns) and where it does not. It builds on the overlays you already have (`overlays.json`, a picture fitted by four corners). 1. build it after T-040; 2. skip. Recommendation: 1, it is small. True georeferencing with control points is a separate, bigger item.
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.
- [ ] T-051 Decide: marking "fact" or "hypothesis" (instead of drawn annotations)
  What: no drawing tools. Each note gets an optional status `fact` (from a source) or `hypothesis` (your interpretation), shown as a small badge and usable in search filters. It is a new header line `status:` in the note file and one field in the note form. 1. build it; 2. no. Recommendation: 1 only if you want to separate sources from your own readings; otherwise 2.
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.
- [ ] T-052 Decide: how to compute the border change (T-042)
  1. add the MIT library `polygon-clipping`, vendored and pinned (exact, about 40 KB); 2. compare on a grid of cells (no library, approximate). Recommendation: 1.
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.

### Place and line types, interfaces

- [ ] T-026 Decide: amend `interfaces/I-8` / `I-4` for the place types dictionary (T-025 deviates in 4 points)
  1. optional `style.size` 4–14 (without it city, town and village look alike); 2. codes may contain `_` (`inscription_site` already exists); 3. `typeIcon` also accepts a draft `{ symbol, color, size }` (editor preview). Recommendation: yes to all three.
  4. custom symbols: `style.symbol = "custom"` with `style.path` (SVG path data) and `style.box`. Recommendation: yes.
  Also: line and area types (and the seed `border`, `route`, `territory`) are not built yet; separate item.
  Done when: you write `Approved: <date> yes` or the points you refuse.
  Contract: yes.
- [ ] T-002 Decide: Known violation 4 in `INTERFACES.md` (`drawShape`, `showMenu`, `map:menu` differ from the contract rows)
  Done when: you choose for each row: change the code to the contract, or change the contract to the code. Recommendation: change the contract to the code (the code works and is tested; 3 rows).
  Contract: yes.

### Campaigns

Nothing for campaigns is built until T-003 is answered.

- [ ] T-003 Describe the requirements of the campaigns feature
  Done when: a few lines of what a campaign is and what it must do. Until then nothing is built (`app/features/campaigns/`).
  Contract: no.
- [ ] T-001 Decide: map extension points for the campaigns feature (old proposal 002, `changes/archive/proposals/002-map-extension-points.md`)
  Done when: you write `Approved: <date> yes` or `no`. Yes means the builder adds the extension points to the map and the contract (I-5).
  Contract: yes.

### Project and CI

Settings and files no agent can change.

- [ ] T-054 Decide: run the terrain tool tests in CI (`tools/ci.sh` is protected)
  `tools/terrain/test_terrain.py` needs numpy and Pillow; without them `tests/js/build.test.js` prints "NOT RUN" and passes. Option 1: add `pip install numpy pillow` before the tests in `tools/ci.sh` (recommended). Option 2: leave it (the tests then run only on a developer machine).
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.
- [ ] T-004 GitHub settings no agent can change
  Done when: (1) Settings > Branches: protect `master`, require pull request and the check `ci`; (2) Settings > General: squash merge on, "Automatically delete head branches" on; (3) secret `GRAPH_PUSH_TOKEN` (fine-grained token, repository `ahm`, Contents: read and write) in Settings > Secrets and variables > Actions; (4) delete the old branches `ci-github`, `fix-github-ci-owner`, `shared/fix-github-ci-owner`, `shared/agent-efficiency`, and decide about `feature/routes`.
  Contract: no.

## Next (builder)

### 1. Rivers and 3D

View and selection tools for rivers, and the 3D map. Rivers are shapes of geometry `river` (Rivers tab: own list, filters, types, a card with a width slider per river); areas (Lori, Syunik, Turkey ...) are shapes of geometry `area`. Nothing here changes saved data. T-055 and T-056 are independent and small; T-057 before T-058. T-059 is answered.

- [ ] T-055 Bolder rivers: one slider, for all rivers or only for the selected or filtered ones
  What: a slider "River size" (0.5x to 4x, default 1x) that makes rivers thicker or thinner, to see them better. A choice "Applies to": all rivers, only the selected rivers (T-057), or only the rivers that pass the filters (T-058); the other rivers keep their normal width (or are faded, see T-058). So you can select the rivers of Lori and Syunik and make only those bold. Not saved in the data: it is a view setting.
  Logic: the control sits in More > Maps & base map (the map-owned region, like the relief controls). First version (before T-057 and T-058): all rivers. Rivers of the data: the width of every river layer is multiplied (`line-width` = the card width x the slider; the width of a single river on its card stays the base). With the scope: the width expression gets a test on the river id (`["case", ["in", ["get","id"], ["literal", ids]], width x slider, width]`), where the ids are the selected or the matching rivers; the map already receives both sets for the highlight and the filter, so the scope adds no new data flow, but the scope choice needs T-057 and T-058 first. Base-map waterways (the rivers of the OpenFreeMap style): one extra line layer `ahm-waterway-boost` on the style's `waterway` source layer, drawn only while the slider is above 1x, width by zoom times the slider. Base-map waterways are not your river objects: they have no id, so they cannot be selected or filtered and the scope does not apply to them (they are thickened all together or not at all); see T-059 a. The value is saved with the browser settings (`localStorage`, as the relief settings are).
  Done when: tests (MapLibre stand-in) show the multiplied width follows the slider, 1x gives the old widths, the boost layer appears only above 1x and is removed at 1x, the value is saved and read again. After T-057 and T-058: tests show that with the scope "selected" only the selected ids get the multiplied width, and the same for "filtered".
  Contract: no (the scope reads the selection and the filter result that T-057 and T-058 already send to the map).
- [ ] T-056 3D map: tilt and rotate to any position
  What: controls for the view angle: a pitch slider (0 to 85 degrees), a rotation slider (0 to 359), buttons "Flat", "Tilt 60" and "North up", a checkbox "3D terrain" with a height exaggeration slider (0.5x to 4x). Dragging the map with the mouse (right button or Ctrl) and two-finger gestures keep working, and the sliders follow them.
  Logic: map domain only, in More > Maps & base map. MapLibre `pitch` and `bearing` (`maxPitch` raised to 85); 3D terrain = `map.setTerrain({ source, exaggeration })` with the raster-dem source of the relief (`ahm-terrain`; it is added when 3D is switched on even if the hillshade is off, so no second tile source). The values are saved with the browser settings. Markers, routes and borders are drawn on the terrain by MapLibre; check by eye that the place markers (HTML) stay at the right spot when tilted, and say in docs/14 what was not seen.
  Done when: tests show the sliders call `setPitch` and `setBearing`, the map events move the sliders, "Flat" and "North up" reset them, `setTerrain` gets the source and the exaggeration and is cleared when switched off, the settings are saved.
  Contract: no.
- [ ] T-057 Select rivers: by a rectangle on the map, and by area names (Lori, Syunik, Turkey ...)
  What: a set of selected rivers ("selection"), shown highlighted on the map and as a list in the Rivers tab with a count. Ways to add to it: (a) the button "Select by rectangle": drag a rectangle on the map, every river that touches or crosses it is added; (b) "Select by area": type an area name, choose it (several, one after another), every river that crosses it is added; the areas are the `area` shapes of the data, found by name in the chosen language, including old names (T-043 when it exists). Each addition keeps the earlier ones. Removing: a cross on a river in the list, "Clear". Actions on the selection: "Make bolder" (the River size slider of T-055 with the scope "selected"), "Show only these" (the others are hidden on the map), "Zoom to the selection", "Add to a layer" (an existing river layer).
  Logic: pure core functions `riversTouching(rivers, geometry, mode)` for a rectangle or a polygon (bounding box test first, then: a vertex inside, or a segment crossing an edge; mode `cross` = touches or crosses, mode `inside` = all vertices inside; see T-059 b) - testable without a map. The rectangle is drawn by the map (a mouse drag with the "Select by rectangle" tool on; Escape cancels) and reported as a box. The selection list lives in the state; the map draws the highlight (a line layer above the rivers, filter by id). Large areas (Turkey) are checked with the box test first so that hundreds of rivers stay fast.
  Done when: tests for `riversTouching` (river crossing, fully inside, fully outside, touching a corner, a river that goes through an area without a vertex in it), the selection adds and keeps earlier results, remove and clear work, "Show only" hides the others, the map highlight follows the selection, and the area search finds a shape by name.
  Contract: yes (a selection in `AHM.state`, a map command to start the rectangle tool and an event with the box; the builder writes the exact names in the item before the code). Needs `Approved:` before the interface files are edited.
- [ ] T-058 River filters: keep only the interesting rivers
  What: filters in the Rivers tab, on top of the ones it already has (name, type, period): minimum and maximum length in km; has notes; has a source; belongs to a layer; is in the selection (T-057); starred. Result: the list shows only matching rivers, and the map either hides the others or shows them faded (a switch). A river can be starred (a personal mark, kept in the browser, not in the data; see T-059 c). Filters can be combined and reset with one button.
  Logic: a pure function `riverMatches(river, filter)` in core; the length of a line is computed from its geometry on the sphere (haversine) and cached. The map applies the same predicate to the river layers (`filter` or opacity). Stars are a list of ids in `localStorage`.
  Done when: tests per filter and a combination, the length function against a known distance, the list and the map follow the filter, the star survives a reload.
  Contract: yes (the filter result must reach the map; the builder writes the proposal first). Needs T-057 for the "in the selection" filter.
- [ ] T-059 Decide: three details of the river items (ANSWERED, kept here for T-055, T-057 and T-058)
  a. Bolder rivers (T-055): the rivers you added as objects (the Rivers tab) can be made bold for all, for the selected or for the filtered ones. The rivers drawn by the background map (OpenFreeMap) are different: they are just pictures, so they can only be thickened all together. 1. the slider changes only your own rivers; 2. the slider also thickens the background rivers (all of them, not only the selected ones). Recommendation: 2, so the slider also helps where you have not added a river yet.
  b. Rivers of an area (T-057): 1. every river that touches or crosses the area (with a switch "only fully inside"); 2. only rivers fully inside. ANSWERED: 1 (owner, in the chat, 2026-11-16).
  c. Stars (T-058): to keep only the interesting rivers the site must know which ones you find interesting, so a river can get a star. 1. the star is private: it is kept only in your browser on this computer, other people do not see it, and it is lost if you clear the browser data or use another device; no change in the data. 2. the star is saved in the site data like a river name, so everyone sees it and it stays on every device; it needs a new field and server rules. Recommendation: 1 for now; you can change to 2 later (the stars can be moved).
  Done when: you write `Approved: <date> a<1|2> c<1|2>` (b is answered).
  Approved: 2026-11-16 a2 b1 c1 (owner, in the chat).
  Contract: no.

### 2. History and time

Owner, in the chat, 2026-11-15. The date model already exists (`core/dates.js`: exact, approximate, range; `date_from` / `date_to` on places, shapes and layers), so none of this needs old data to be changed. Order: T-040 -> T-041 -> T-043 -> T-046 -> T-042 (T-042 needs T-041 and the decision T-052). Decisions: T-049 to T-052.

- [ ] T-041 Versions of one border, route or river in time (same shape, different times)
  What: a shape can have several versions, each with its own geometry and dates. In the shape editor "Add version for another time" copies the shape, asks for its `date_from` and offers to close the previous version (`date_to`). The sheet lists "Other versions" with their dates.
  Logic: no nested geometry. A version is a normal feature of `shapes.geojson`; versions of one shape share a new optional property `series` (UUID). With T-040 the slider shows the version valid at the date by itself; without a date all versions show. Absent `series` = a single shape, so no old data changes. Notes and layer membership stay with the version they were made on. Server rules (`store.php`, `save-handler.js`, row in `tests/fixtures/rules.json`): `series` is a UUID or absent, all versions of a series are of the same kind (area or line), and two versions whose dates are both known must not overlap (error `versions of one series overlap`). docs/05 gets a section.
  Done when: tests (PHP, Node, `rules.json`) cover the three rules, the editor creates a version, the sheet lists the others, and a version can be edited and deleted alone.
  Contract: yes (I-9 property `series`, I-1).
- [ ] T-043 Names over time
  What: a place or shape can have names that are valid only in a period (a name per era and language). The map and the lists show the name of the chosen language that is valid at the slider date. Search finds every name, old ones too, and shows which name matched when it is not the shown one.
  Logic: `names[]` entries get optional `date_from` and `date_to` (date model); absent = always. Rule: with the slider off nothing changes (the first name of a language, as today). With it on: the first name of that language whose period contains `at`, else the first name of that language. Core function `nameAt(item, lang, at)`. Rules in `store.php` and `save-handler.js` (parity table rows). The place form (`placeform.js`) and the shape form get "from / to" per name row with `datefield.js`. Applies to places and shapes first.
  Done when: tests cover `nameAt` (period inside, outside, no period, unknown language), the server accepts and refuses the new fields, search finds an old name, the forms save and show them.
  Contract: yes (I-1 property, I-3 `nameAt`). Works without T-040 (shows the first name).
- [ ] T-046 Certainty and sources per object
  What: phase 1: a dictionary of sources (title, citation, link; like languages and categories, editors add). Places and shapes get an optional certainty (exact, approximate, disputed), an optional radius in metres (drawn as a faded circle around approximate and disputed points) and a list of sources. Filters by source and certainty. Phase 2: competing claims: the same object at two places or two shapes according to two sources, each with its sources; the sheet lists "Other claims" and a source toggle shows one author's version or all.
  Logic: every new property is optional and absent = unchanged, so adding this later changes no data; nothing needs migrating now. `shapes.geojson` already has a free-text `source`; it stays. New file `sources.json` (id, title, citation, url) with the usual store rules. Phase 2 uses the same link idea as `series` in T-041 (a `claim_of` id); the builder checks if one mechanism fits both.
  Done when (phase 1): server rules and parity rows, the forms save the new fields, the map draws the circle, the filters work. Phase 2 is its own item after the owner has seen phase 1.
  Contract: yes (I-1, I-9, new file in I-1).
- [ ] T-042 Border change between two dates: area gained and lost
  What: choose a border (a series from T-041) and two dates A and B. The map shows what was gained (green) and lost (red); a panel shows km2 and % of each. A note says that old borders are approximate.
  Logic: take the version valid at A and at B; gained = B minus A, lost = A minus B (polygon difference); area on the sphere (not on the flat map). For the difference use the MIT library `polygon-clipping`, vendored and pinned (exact result); the simpler option without a library is to compare the two polygons on a grid of cells (approximate to the cell size). Owner decides in T-052. Result is drawn as a temporary map layer, not saved.
  Done when: a test with two squares of known size gives the exact gained and lost area, the panel shows the numbers, the layer is removed when the panel is closed.
  Contract: maybe (a new `AHM.map` command in I-2); the builder says which in the item before the code.
  Needs: T-040, T-041, T-052.

### 3. Analysis and sharing

Owner, in the chat, 2026-11-15. T-044 can start now (the relief code is merged); T-045 needs the terrain reader that T-044 moves into `app/js/map/terrain.js`.

- [ ] T-044 Height profile for routes, rivers and borders (the relief code is merged: `sampleAt` and the profile are in `app/js/map/map.js`)
  What: the action "Height profile" in the sheet of a route, river or border. It uses the object's own line, not clicked points. A route marks its stops on the chart; a river shows start, end, total fall and mean slope; a border uses its outline or a section between two clicks (the Rivers tab already has "a section between two clicks"). Hover on the chart shows distance and height and moves a point on the map.
  Logic: the relief code (branch `feat/relief-aws`) already samples 120 points along a line from the Terrarium tiles (`sampleAt`) and draws a chart. Make that a function of any line (`profileOf(coordinates)`), move the tile reader (`locate`, `tileOf`, `sampleAt`, `decodeAt`) into its own file `app/js/map/terrain.js` (T-045 needs it too), and add the command `AHM.map.profile(shapeId, { from, to })`.
  Done when: tests (stand-in with a mocked tile) show a route, a river and a border section give the expected length, min, max, ascent and descent, the route stops are marked, and the sidebar action calls the command.
  Contract: yes (I-2 command).
- [ ] T-045 Travel time and least-cost path from the terrain
  What: (a) from a place or click: the area reachable in 1, 2, 3 ... days (rounded bands); (b) the least-cost path between two places with its time; (c) the places inside the one-day area, and "places within one day of this route" (a route as the start). A route can show its computed time next to the time a source gives.
  Logic: a cost grid from the Terrarium tiles (cell 250 m to 1 km by the size of the area); slope from the 8 neighbours; speed by Tobler's hiking function v = 6 * exp(-3.5 * |tan(slope) + 0.05|) km/h; a mode multiplier (foot 1.0, loaded animals, cart or army: values in `config.js`, editable, hours of walking per day default 8). Dijkstra with a binary heap in a Web Worker (so the page does not freeze); for a route as the start all its cells are sources at cost 0. Bands from the existing marching squares (`contourLines`) smoothed like the contour lines of T-048. Needs `terrain.js` from T-044.
  Limits (go to docs/14): modern terrain only; no rivers, lakes, snow, seasons, roads or borders as obstacles; the result is an estimate, and the panel says so.
  Done when: tests on a small synthetic grid (flat = distance / speed, a ridge is avoided, a steeper way costs more), the worker answers, the sidebar shows bands, path, time and the list of places.
  Contract: yes (I-2 commands and events).
- [ ] T-047 Share and export (no image export)
  What: (a) a link that reopens the same view: position, zoom, base map and relief settings, active layers and filters, the slider date, the opened place or shape. A "Copy link" button. (b) Export to GeoJSON and KML of what is shown (the filtered result, one layer, or everything).
  Logic: (a) a versioned URL hash (`#v1/...`), written when something changes (debounced) and read at the start; unknown keys are ignored; nothing private is put in the link. (b) done in the browser (a download from a Blob), no server change. GeoJSON keeps the date objects of the date model. KML: names in the chosen language, description from the place notes, line and fill colours from the types; a `<TimeSpan>` only for years 0001 to 9999 (KML has no BCE years), other dates are written into the description.
  Done when: tests show the hash round trip (encode, decode, ignore unknown keys), the exported GeoJSON opens as valid GeoJSON with the same features, the KML has the expected elements and escapes text.
  Contract: no (the builder confirms; if a new `AHM` function is needed it says so first).

### 4. Data checks and server rules

Tests and checks of the data and the server rules (PHP, Node and `tests/fixtures/rules.json`).

- [ ] T-037 `tests/data/DataCheck.php`: check that the `type` of every shape in `shapes.geojson` is a line or area type of `types.json` (follow-up of T-036)
  Done when: a shape of an unknown or point type fails the data check with its own error code, and a test shows it.
  Contract: no.
- [ ] T-031 Shapes as layer members (audit of specs 011 and 014: `add_shapes` and `remove_shapes` are in `service/store.php`; there is no `layerAllowsShape`, no test, no row in `tests/fixtures/rules.json`, no "Shapes (n)" or "Choose shapes" in the layer detail)
  Done when: `layerAllowsShape(id)` exists in core with the Only/Hide meaning of places; tests (PHP, Node, `rules.json`) cover `add_shapes`, `remove_shapes`, an unknown id (400) and the removal of a deleted shape from all layers; the layer detail shows "Shapes (n)" and lets an editor add and remove shapes.
  Contract: no.
- [ ] T-032 Route rules in the parity table (follow-up of T-021: `stops`, `twoway` and `a route must be a line` have no row in `tests/fixtures/rules.json` and no PHP test)
  Done when: `rules.json` has a row for each of the three errors and one for a route that saves, and `php tests/php/run.php` and `node tests/js/run.js` pass.
  Contract: no.

### 5. Tests and code health

Audit follow-ups, test gaps and agent texts.

- [ ] T-029 Tests for the sidebar fixes and layout (audit of specs 007 and 012: the code exists, the tests the specs asked for do not; `tests/js/sidebar.test.js` has 4 tests, all about types)
  Done when: tests show a double click selects no text, no frame shows the previous place after a click, Save of the language and category forms is disabled until the input is valid and Rename opens at the bottom of the fold, the dock opens and closes without moving the list, and the point-menu actions run the old code.
  Contract: no.
- [ ] T-030 Tests for the map point menu (audit of spec 010: `showMenu`, `hideMenu`, `map:menu` exist in `app/js/map/map.js`; `tests/js/map.test.js` has no test of them)
  Done when: tests show the menu opens above the point and below when there is no room, a button emits `map:menu { id, lon, lat }` and closes it, Esc, a click elsewhere, a drag or zoom and another menu close it, and one menu at a time.
  Contract: no.
- [ ] T-033 Map: parts of spec 013 that are missing (audit): `hideShape(id | null)` and the line patterns `double` and `triple` (the code has solid, dashed, dotted, dashdot)
  Done when: each exists in `app/js/map/` with a test in `tests/js/map.test.js`, or the owner drops it.
  Contract: no.
- [ ] T-012 CSS and HTML tests (part 4 of `tests/README.md`)
  Done when: the tests listed in part 4 exist and pass; no application change.
  Contract: no.
- [ ] T-011 Make `graph/` cheaper to use: line ranges per definition
  Done when: `graph/<domain>.md` lists `name:line` for the definitions of each file, so an agent opens a part with offset and limit without a search; the size limits of `tests/js/graph.test.js` still hold or are changed with the reason. Measure before and after (bytes an agent reads for one change in `map.js`).
  Contract: no.
- [ ] T-028 Update the text that still tells agents to run `bun tools/build.js` before a PR (`AGENTS.md` section 4 and line 43, `.claude/agents/builder.md` step 4, `DOMAINS.md`): CI now rebuilds `app/dist/` (T-006)
  Done when: the texts say a PR need not commit `app/dist/` (a local build is still allowed); `tests/js/build.test.js` stays unchanged. Needs `Approved:` (protected: `AGENTS.md`, `.claude/`, `DOMAINS.md`).
  Contract: no.

### 6. Campaigns

Waits for T-003 and T-001.

- [ ] T-013 Controller sends `features: ['campaigns']` when the owner switches the feature on (needs T-003)
  Done when: a data test shows the list in the page data; the forum setting is documented in `docs/10-*.md`.
  Contract: yes (I-1).

## Done

- [x] T-040 Time slider: the map at one moment, with play (2026-11-16, branch `feat/time-slider`). Approved: 2026-11-16 owner, in the chat: "start to build 040, 041, 043, 046 and 042, all in it's PR" (covers `interfaces/I-2`, `I-3`, `I-6` and `tests/js/contract.test.js`). `AHM.state` key `time`, core `visibleAt`/`timeLook`, bar in `sidebar/timebar.js`, `faded` property for the map. Undated objects: option 3 of T-049 assumed. Not seen in a browser.
- [x] T-058 Relief fixes (bounds, visible credit, flat bands) and a GLO-90-only option for the terrain tool (2026-11-16, branch `feat/relief-fixes-glo90`; owner, in the chat). (A1) `bounds` only when `terrain.bounds` is set; docs/10 and the tool printout tell the owner to set it for own tiles. (A2, withdrawn by the owner: `adapt` stays true by default; nothing changed there) (C) new option `color.blend` (default true = smooth blend; false = flat colour bands with sharp edges), checkbox "Smooth colour transitions", saved with the other relief settings. (A3) the terrain credit is plain text under the base-map list while relief is on. (B) `terrain.py --dataset auto|glo30|glo90`, credit per dataset (GLO-30, GLO-90, both), config block printed by `build` and `pack`, docs/10 "Which dataset" with the size table (synthetic, unmeasured).
- [x] T-048 Relief polish: rounder contour lines, "Smooth colours" checkbox, controls back in the sidebar (2026-11-15, branch `feat/relief-aws`; owner, in the chat).
- [x] T-039 Relief colours by height, controls and height readout (2026-11-15, branch `feat/relief-aws`; owner, in the chat: "elevation styles, customize, see meters and colour difference"). MapLibre 4.7.1 -> 5.24.1 (needed for `color-relief`, since 5.6.0). `basemap.terrain.color` (ramps in metres), controls under the base-map list, legend, height readout from the Terrarium tile. Colours adapt to the view (`color.adapt`, checkbox "Adapt colours to the view"). Relief panel on the map, ramp editor, contour lines, height profile, saved settings (owner, in the chat). Not verified: the real map (no browser here), the MapLibre 5 upgrade against the other map code, AWS CORS.
- [x] T-053 Relief (hillshade) base-map entry from self-hosted Copernicus GLO-30 terrain tiles (2026-11-15, branch `feat/relief-layer`). `basemap.terrain`, "Map + relief", `tools/terrain/`, docs/10 guide. Real GeoTIFF reading, AWS names, Apache, Cloudflare, real tile sizes and the look on a real map are unverified.
- [x] T-036 Line and area types in the types dictionary (2026-11-14, branch `feat/line-area-types`). Decision of T-034 (owner, in the chat: "build it"): dictionary types, not fixed lists. Server rules in `store.php` and `save-handler.js`, registry in `core/shapes.js`, editor in More → Types.
- [x] T-025 Place types dictionary: admins add markers such as iron mine, cedar forest, sword artefact (2026-11-14, PR #10, branch `feat/place-types-dictionary`). The 4 owner decisions about `interfaces/I-8` and `I-4` are the open item T-026.
- [x] T-034 Owner decision on line and area types: dictionary types (2026-11-14).
- [x] T-035 Split `sidebar/ui.js` into five files, no change of behaviour (2026-11-14, branch `refactor/sidebar-ui`)
  Owner, in the chat: "Сделай рефакторинг sidebar/ui.js в отдельной PR"; scope chosen: 4–5 files. No protected file changed (`app/js/sidebar/` is one folder entry in `tools/domains.json`).
- [x] T-024 Harden the `app/dist` check (2026-11-14, branch `chore/records-ci-audit`)
  Approved: 2026-11-14 owner, in the chat. `build.js --check` also fails when a bundle differs in size from the manifest; the name test finds declarations (`hasDeclaration`); tests show each failure.
- [x] T-022 Block commits that skip CI (2026-11-14, same branch)
  Approved: 2026-11-14 owner, in the chat. `tools/ci-check-pr.js` refuses a commit with a skip marker that changes more than documents; critic rule A8. Not done: branch protection (T-004).
- [x] T-021 Log and document the Routes tab (2026-11-14, same branch). Entries in `changes/{sidebar,core,map,data}.md`; `docs/02`, `05`, `06` name the Routes tab and the shape format. The sidebar part has no test (the `rt*` functions need the page DOM); the entry says so.
- [x] T-010 Audit the old task specs 006 to 014 against the code (2026-11-14, same branch). Result: `changes/shared.md`, "T-010 audit"; the open parts are T-029 to T-034.
- [x] T-006 CI rebuilds `app/dist/` like `graph/` (2026-11-14, branch `chore/ci-dist`)
  Approved: 2026-11-14 owner, in the chat: yes. In a PR the job `ci` runs `bun tools/build.js` (Bun 1.4.4) only when `node tools/build.js --check` finds `app/dist/` stale, and commits `graph/` and `app/dist/` together.
- [x] T-027 Notes for borders and routes (2026-11-14, branch `feat/shape-notes`)
  Owner, in the chat: "let's add notes for routes and boards" (borders). No protected file changed. Notes are layer notes whose owner id is a shape id.
- [x] T-023 The page controller serves the bundle only when its files exist (2026-11-12, PR from branch `fix/dist-guard`)
  From the review of PR #8 (`critic`); no protected file changed.
- [x] T-005 Minify the JS and CSS with Bun (2026-11-12, PR from branch `feat/minify-bun`)
  Approved: 2026-11-12 owner, in the chat: "let's now just minify js and css only with bun. Do it and create PR" (covers `AGENTS.md`, `.claude/agents/builder.md`, `tools/domains.json`, both CODEOWNERS). Vite, webpack and HTML minify were left out on purpose.
- [x] T-020 Fix red CI on `master` after the `feature/routes` merge (2026-11-12, PR from branch `fix/master-ci`)
  Approved: 2026-11-12 owner, in the chat: "review master branch and fix red CI". Covers the protected files touched: `tools/domains.json` (owner of `tests/js/routes.test.js`: core), `interfaces/I-2-sidebar-map.md` and `tests/js/contract.test.js` (`showFound` added to the contract, because the Routes tab already used it). If you want `showFound` out of the contract, say so and it becomes an item.
- [x] T-000 Workflow: one `builder` and one `critic`, one `TODO.md`, no proposals (2026-11-12, PR from branch `chore/builder-critic`)
  Approved: 2026-11-12 owner, in the chat: one major agent, one critic/gatekeeper, only todos, no proposals.
