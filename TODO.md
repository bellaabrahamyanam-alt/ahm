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
- Storage in SQL and notes in the forum: T-070, T-071, T-072, T-073, T-074

**Next (builder)**, in this order (`builder: next` takes the first open item of the first group)
- 1. Rivers and 3D: T-058, T-064, T-065, T-059, T-061, T-062
- 2. History and time: T-067, T-068, T-042
- 3. Analysis and sharing: T-044, T-045, T-047
- 4. Data checks and server rules: T-037, T-031, T-032
- 5. Tests and code health: T-029, T-030, T-033, T-012, T-011, T-028
- 6. Campaigns: T-013
- 7. SQL storage and notes in the forum (after T-070 and T-071): T-077, T-078, T-079, T-080, T-081, T-082, T-083, T-084

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

### Storage in SQL and notes in the forum

- [ ] T-070 Decide: keep the data in SQL and make a note a phpBB post
  Owner, in the chat, 2026-11-19: the data of the extension leaves the files and goes to the database. A note is a post in a topic of a forum "Map" (forums Places, Layers, Shapes). One topic per object; all versions of a border (a `series`, T-041) share one topic. The first post of a topic is a card the extension writes; it is not a note. The topic is made together with the object. Forum permissions decide who may write notes. GeoJSON stays as download and upload; export of notes to Markdown comes later. The history of every object and note is kept (T-078) and only an admin may delete for good.
  1. As above: own tables `ahm_objects`, `ahm_lists`, `ahm_note_meta`, `ahm_imports`, `ahm_revisions` (columns in T-076 and T-078) and notes as posts. 2. The same tables, but notes in an own table (no forum search, quotes, attachments or moderation for free). 3. Keep the files. Recommendation: 1.
  Measured on phpBB 3.3.19 with SQLite (PHP 8.3), a script run as admin: forums made from code; a topic with its card and a note took 16 ms and 4 ms; 50 such topics 0.4 s; editing the first post renames the topic (so the card is the first post); `core.delete_post_after` gives `is_soft` true or false; deleting the last post of a topic deletes the topic. Not measured: MySQL, the posting form over HTTP, attachments, notifications, search.
  Assumed: 2026-11-19 option 1, because the owner asked in the chat for a PR with a phpBB board with the forum, the database, the SQL schema, the tests and the sample data (T-075, T-076 are built on it). Write `Approved: <date> 2` or `3` to change it.
  Done when: you write `Approved: <date> 1`, `2` or `3`.
  Contract: no.
- [ ] T-071 Decide: the type of the column `data`
  1. `MEDIUMTEXT` holding JSON text (recommended): the same on SQLite and MySQL, made by phpBB's schema tool, the text is kept as written. Measured on MySQL 8.0.46: JSON functions work on it, `JSON_SET` works, an index on a field inside can be added later (generated column), and one `ALTER ... MODIFY ... JSON` turns it into the native type. 2. Native `JSON` on MySQL and text on SQLite: the migration needs raw SQL per driver (phpBB's schema tool has no JSON type); MySQL checks the text and changes key order and spacing (the same 30 000 places read back as 14.7 MB from JSON against 10.8 MB from text, on two servers); the tests on SQLite would not see these differences.
  Assumed: 2026-11-19 option 2 (native `JSON` on MySQL, text with a `json_valid` check on SQLite), because the owner asked in the chat why the column is not the JSON type. Measured by the tests of T-076 on MySQL 8.0.46: the native type changes the order of keys, so the date of a note is written in the order of `store.php`; nothing else was lost (3000 places with full-precision coordinates and every note file come back exactly). Write `Approved: <date> 1` to change it.
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.
- [ ] T-072 Decide: the topic of a deleted object
  1. Close it and leave it in its forum. 2. Close it and move it to a hidden forum "Archive" (recommended: deleted places stay out of the forum lists and out of search, and away from a new place with the same name). 3. Delete it. Restoring (T-083) opens it and moves it back. Owner, in the chat: "maybe close".
  Done when: you write `Approved: <date> 1`, `2` or `3`.
  Contract: no.
- [ ] T-073 Decide: the pictures of overlays
  1. They stay files in `store/ahm_map/overlays/` (recommended: served as plain files, up to 12 MB each, the rule "type from the first bytes" stays; back up the database and this folder). 2. They go into the database (one dump holds everything; every picture is served through PHP).
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.
- [ ] T-074 Decide: the first note typed in the "new place" dialog
  1. It stays a normal note with language, date and layers (post 2 of the topic; recommended). 2. It becomes the text of the card (it loses language, date and layers).
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.

## Next (builder)

### 1. Rivers and 3D

View and selection tools for rivers, and the 3D map. Rivers are shapes of geometry `river` (Rivers tab: own list, filters, types, a card with a width slider per river); areas (Lori, Syunik, Turkey ...) are shapes of geometry `area`. Nothing here changes saved data. T-055, T-056 and T-057 are done. T-058 comes next (it needs the selection of T-057). T-059 is answered.

- [ ] T-064 River size: the scope "Applies to" (all, selected, filtered) (follow-up of T-055)
  Done when: after T-057 and T-058 the choice exists; with "selected" only the selected ids get the multiplied width, the same for "filtered"; the width expression tests the river id (`["in", ["get","id"], ["literal", ids]]`) instead of `river: true`; the base-map waterways stay all-or-nothing.
  Contract: no.
- [ ] T-065 Select rivers: "Add to a layer" (an existing river layer) (follow-up of T-057)
  Done when: the Rivers tab can add the selected rivers to a layer; needs the shape members of layers of T-031 (`add_shapes` has no client code yet).
  Contract: no.
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

- [ ] T-061 Terrain: void parts of GLO-30 squares that straddle Armenia or Azerbaijan, and the 30/90 seam (follow-up of T-060)
  Done when: after the first real `terrain.py check` the owner knows whether such squares have void parts; if yes, `geotiff_source.py` fills the void from the GLO-90 square (downloaded as well) and the border seam is judged in `preview`. Needs real files, so it waits for the owner's first run.
  Contract: no.
- [ ] T-062 Relief colour ramps for the larger area (follow-up of T-060)
  Done when: the default ramp `armenia` (350-4100 m, white top) and the fixed range suit 0 m (Gulf, Mesopotamia) to 5,600 m (Elbrus); with "Adapt colours to the view" on nothing breaks, with it off the Caucasus peaks are not all white. The owner chooses the ramp stops.
  Contract: no.

### 2. History and time

Owner, in the chat, 2026-11-15. The date model already exists (`core/dates.js`: exact, approximate, range; `date_from` / `date_to` on places, shapes and layers), so none of this needs old data to be changed. Order: T-040 -> T-041 -> T-043 -> T-046 -> T-042 (T-042 needs T-041 and the decision T-052). Decisions: T-049 to T-052.

- [ ] T-042 Border change between two dates: area gained and lost
  What: choose a border (a series from T-041) and two dates A and B. The map shows what was gained (green) and lost (red); a panel shows km2 and % of each. A note says that old borders are approximate.
  Logic: take the version valid at A and at B; gained = B minus A, lost = A minus B (polygon difference); area on the sphere (not on the flat map). For the difference use the MIT library `polygon-clipping`, vendored and pinned (exact result); the simpler option without a library is to compare the two polygons on a grid of cells (approximate to the cell size). Owner decides in T-052. Result is drawn as a temporary map layer, not saved.
  Done when: a test with two squares of known size gives the exact gained and lost area, the panel shows the numbers, the layer is removed when the panel is closed.
  Contract: maybe (a new `AHM.map` command in I-2); the builder says which in the item before the code.
  Needs: T-040, T-041, T-052.

- [ ] T-067 Certainty and sources, phase 2: competing claims
  What: the same object at two places or as two shapes according to two sources, each with its own sources. The sheet lists "Other claims"; a source toggle shows one author's version or all.
  Logic: the same link idea as `series` (T-041): a `claim_of` id; the builder checks if one mechanism fits both. Phase 1 (T-046) gave the dictionary `sources.json` and `certainty` / `sources` / `radius_m`; use them. Do this after the owner has seen phase 1.
  Done when: server rules and parity rows, the sheet lists other claims, the source toggle works on the map, tests.
  Contract: yes (I-1, I-9).
- [ ] T-068 Certainty and sources on borders, rivers and routes in the UI
  What: T-046 put the fields in the place and border forms and the Certainty and Source chips on the places list. The route card has no fields, and the borders, rivers and routes lists are not filtered (`shapesRun` already takes `certainty` and `sources`).
  Done when: the route form saves `certainty` and `sources`; the shape tabs have the same chips (or the Places filters are explained there); a test per list.
  Contract: no.

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

### 7. SQL storage and notes in the forum

T-075 and T-076 (Done) were built on the assumed answers of T-070 and T-071; the rest waits for them. One item = one pull request, in this order.

- [ ] T-077 Remove the Node development server
  Needs: T-084.
  Done when: `dev/save-handler.js` and its parity tests are gone; `tests/fixtures/rules.json` is read by the PHP tests only; `AGENTS.md` ("a validation rule lives in three places") and `tools/ci.sh` are updated (both are protected: this item needs an `Approved:` line).
  Contract: no.
- [ ] T-078 History of changes
  What: table `ahm_revisions`: `id`, `entity_kind` (place, shape, layer, list, note), `entity_id` (a UUID, a list key or a `post_id`), `rev_no`, `action` (create, edit, delete, restore, import), `user_id`, `at`, `summary`, `label`, `import_id`, `snapshot`; unique on (`entity_kind`, `entity_id`, `rev_no`). A snapshot is the whole state after the change, as gzip JSON. It is written in the same transaction as the change. Deleting an object removes its row and keeps the last state as a `delete` revision. A note's snapshot holds the title, the text, the meta and the list of attachments (id, name, size, no file). The author is the poster; contributors are the `DISTINCT user_id` of the `edit` revisions. Nothing is shown to users yet.
  Done when: tests show a revision for every save and delete of objects and list entries; a deleted object can be rebuilt from its last revision.
  Contract: no.
- [ ] T-079 Forum "Map" and the card
  What: a migration makes a category with the forums Places, Layers, Shapes (the seed of T-075 makes them now, and `service/card.php` of T-076 writes the card text). One class (`PostGateway`) holds every call of phpBB's posting functions (make a topic with its first post, reply, edit, close, move, delete), so that only it depends on them. Making an object makes its topic with the card; a series shares the topic of its first version. The card text is made from the object: all names with languages and periods, dates, type, coordinates, height, certainty and sources; it is edit-locked (`post_edit_locked`) and rewritten when the object changes. The topic title is the object's `label`. A GeoJSON upload makes the topics in a background task; objects without `topic_id` work meanwhile.
  Done when: tests with a fake gateway and on SQLite show a topic and a card for a new place, shape and layer; renaming a place changes the topic title and the card; the card has no row in `ahm_note_meta`.
  Contract: no.
- [ ] T-080 Notes as posts: reading
  What: `ahm_note_meta`: `post_id`, `data` (`lang`, `date`, `layers`, `shape` only for a version of a series). The owner of a note is the topic of its post (no owner field). The notes of an object are the posts of its topic after the card; the server sends each post as HTML made by phpBB (BBCode, smilies, attachments) with its meta, in pages. A post without meta shows with the language "not set". The seed imports the files of `notes/` and `layer-notes/` as posts.
  Done when: the sidebar shows the notes of a place, a layer and a border from posts; the client Markdown render of notes is removed; `docs/` are updated.
  Contract: yes (the notes answers of `docs/06-http-interface.md`).
- [ ] T-081 Notes as posts: writing and the gate
  Needs: T-080.
  What: "Add note" and "Edit" open phpBB's own posting form (`posting.php`) with our fields (language, date, layers) added by events: `core.posting_modify_template_vars`, `core.posting_modify_submission_errors` (checks them with the same functions as `store.php`), `core.posting_modify_submit_post_after` (saves `ahm_note_meta`). Attachments are phpBB's own (`f_attach`, `u_attach`). `core.modify_posting_auth` refuses posting in the forums "Map" unless it comes from that entry. The permission that lets a user make a place, shape or layer (the forum permission of its forum is the condition) and the separate one for dictionaries are written in `docs/07-*`.
  Done when: a test posts through the form with a bad language and a bad date and gets the same errors as `store.php`; a plain reply in a topic is refused; a post with an attachment shows its file; the permission table is in `docs/07-*`.
  Contract: yes.
- [ ] T-082 Sources of a note
  Needs: T-080, T-081 (T-046 gave the dictionary `sources.json`).
  What: the note meta gets `sources: [{"source": "<id>", "locator": "p. 45"}]`; the form has a field for it; the server sends the sources expanded; the sidebar shows a block "Sources" with links only for `http` and `https` and `rel="noopener noreferrer nofollow"`; the sources are part of a note's snapshot (T-078).
  Done when: tests for an unknown id, a locator over the limit and a `javascript:` URL; the block shows in the sidebar.
  Contract: yes.
- [ ] T-083 Deleting and restoring
  Needs: T-072, T-078, T-079.
  What: deleting an object closes its topic and moves it as T-072 says, and takes the object out of the `members` of layers (a revision on each layer); restoring undoes it from the last revision. "Delete for good" is for admins only (moderators get no `m_delete` in the forums "Map") and removes the object, its revisions, its topic, posts, `ahm_note_meta` and note revisions. `core.delete_post_after` with `is_soft = false` removes the `ahm_note_meta` and the revisions of that note; a soft delete keeps them. A nightly task removes what the events missed (meta and revisions whose post is gone, a `topic_id` whose topic is gone) and stops without deleting when phpBB's tables cannot be read.
  Done when: tests for soft and hard delete of a note, for deleting the last note (the topic stays), for delete and restore of an object, for delete for good, and for the nightly task including the "cannot read" stop.
  Contract: no.
- [ ] T-084 The map reads and writes the SQL tables
  Needs: T-076 (Done).
  What: the file reading and writing of `service/store.php` (66 of its 1534 lines touch files) moves behind an interface; the rules (`clean_*`, dates, languages) stay. The SQL version uses the tables of T-076 through phpBB's database layer. A save with an old `version` is refused. GeoJSON download and upload and the seed use `service/sql_transfer.php`.
  Done when: all PHP tests pass on SQLite with the SQL store; the download and the upload of GeoJSON give the same `places.geojson` and `shapes.geojson`; `docs/05-data-model.md` and `docs/06-http-interface.md` are updated.
  Contract: no (the answers of the HTTP interface do not change).

## Done

- [x] T-076 SQL schema, migration and the transfer between the files and the tables (2026-11-19, branch `feat/sql-storage-env`). Approved: 2026-11-19 owner, in the chat, 2026-11-19: asked for a PR with a phpBB board with the forum and a database for test runs, with the tests, the SQL schema and the sample data (covers `tools/domains.json`: the new folder `migrations/` in the data domain; `tools/ci.sh`: the folder in `CODE` and `php-sqlite3` for the tests; `.github/CODEOWNERS` and `.gitlab/CODEOWNERS`, made from `tools/domains.json`). `service/sql/schema.mysql.sql` (native `JSON`) and `schema.sqlite.sql` (text with `json_valid`): `ahm_objects`, `ahm_lists`, `ahm_note_meta`, `ahm_imports`, `ahm_revisions`; `migrations/m001_storage.php` makes them when the extension is enabled; `service/sql_transfer.php` loads the files of a store into them (one `import` revision for each thing) and writes them back; `service/card.php` writes the text of a card. 14 new PHP tests on SQLite, the same on MySQL 8.0.46 with `AHM_TEST_MYSQL_DSN` (3000 places with full-precision coordinates and every note file come back exactly). SQLite reads a decimal text with an error of one unit in the last place now and then (0.7 nm), the tests allow 1e-12 degree there. The map still reads the files (T-084).
- [x] T-075 Development board on phpBB and SQLite (2026-11-19, branch `feat/sql-storage-env`). Approved: 2026-11-19 owner, in the chat, 2026-11-19: asked for a PR with a phpBB board with the forum and a database for test runs, with the tests, the SQL schema and the sample data. `tools/dev/phpbb-up.sh` (`setup`, `serve`, `check`, `reset`) installs phpBB 3.3.19 on SQLite, enables the extension and runs `tools/dev/seed.php`: the forum Map with Places, Layers and Shapes, the tables from `store/ahm_map/`, a topic with a card for every place, shape and layer and the notes as posts with `ahm_note_meta`. `check` found 13 objects, 13 topics, 20 notes as posts, 51 revisions and answers 200 from the map routes. `dev/save-handler.js` stays until T-077. The board is not run in CI yet.
- [x] T-069 One asset builder for extensions and styles (2026-11-18, branch `feat/asset-builder`; owner, in the chat). `tools/assets/build.js`: one copyable file + `assets.config.json` (bundles, ordered file lists); terser (no top-level renaming) and lightningcss when installed, else Bun; `--check` for CI; CSS `url()` rewritten, `@import` refused. `tools/build.js` of this repository is NOT changed (the map bundle is unchanged, byte for byte equal to the new tool with Bun).
- [x] T-043 Names over time (2026-11-17, PR #41, branch `feat/names-over-time`). Approved: 2026-11-16 owner, in the chat: "start to build 040, 041, 043, 046 and 042" (covers `interfaces/I-1`, `I-3`, `tests/js/contract.test.js`). Optional `date_from` / `date_to` on names of places and borders, core `nameAt`, forms and \"also called\" rows. Not seen in a browser.
- [x] T-046 Certainty and sources per object, phase 1 (2026-11-17, PR #38, branch `feat/certainty-sources`). Approved: 2026-11-16 owner, in the chat: "start to build 040, 041, 043, 046 and 042" (covers `interfaces/I-1`, `I-2`, `I-3`, `I-9`, `tests/js/contract.test.js`). `sources.json` dictionary, `certainty` / `sources` on places and borders, `radius_m` on places with a circle on the map, forms, sheets, filters for the places list. Phase 2 is T-065; the rest of the UI is T-066. Not seen in a browser.
- [x] T-057 Select rivers by a rectangle and by area names (2026-11-17, PR #39, branch `feat/river-select`). Approved: 2026-11-17 owner, in the chat: "Also do t-057 and push on seperate branch" (covers `interfaces/I-2-sidebar-map.md` and `tests/js/contract.test.js`). Contract I-2 1.11: `highlightRivers(ids)`, `selectBox(on)`, events `box:select { bbox }` and `box:cancel`. Approved: 2026-11-17 owner, in the chat: "I wanted to select all known and unknown rivers ... cannot select also those rivers which weren't added to map manually" (covers I-2 1.12: `baseRivers()`, `b:<name>` ids in `highlightRivers`). The selection also takes the named rivers, canals and streams of the base map, but only those loaded in the view (`querySourceFeatures`), grouped by name; unnamed ones and ditches are left out; "Show only these" cannot hide base-map rivers. The selection lives in the sidebar, not in `AHM.state` (no new state key: only the sidebar reads it, and the map gets the ids). Not built: "Make bolder" (scope of T-055, now T-064) and "Add to a layer" (T-065, needs T-031). Not seen in a browser; the rectangle uses the mouse only (no touch).
- [x] T-056 3D map: tilt, rotation and 3D terrain (2026-11-17, PR #37, branch `feat/t-056-3d-tilt`). Tilt 0 to 85, rotation 0 to 359, Flat, Tilt 60, North up, 3D terrain with a height slider; saved in the browser. Not seen on a real map.
- [x] T-063 A new version of a ROUTE in one go, like T-041 + the simplification for borders and rivers (2026-11-17, PR #35, branch `feat/route-versions`; owner, in the chat). "New version…" on the route card opens the path for editing, Next asks the dates (names, type, direction, look taken over), Save adds the second version of the series, the first stays and may end the day before; the card lists all versions.
- [x] T-041 Versions of one border, route or river in time (2026-11-16, PR #35, branch `feat/shape-versions`, stacked on `feat/time-slider`). Approved: 2026-11-16 owner, in the chat: "start to build 040, 041, 043, 046 and 042, all in it's PR" (covers `interfaces/I-9`). Property `series`, 3 server rules, rows in `rules.json`; the sheet lists other versions and adds one. Not done: the \"Add version\" button on the routes card (new item T-063). Not seen in a browser.
- [x] T-055 Bolder rivers: slider "River size" 0.5x to 4x for all rivers (2026-11-17, PR #37, branch `feat/river-size`). More > Maps & base map > Rivers; river shapes get `river: true` and every width layer multiplies it; base-map waterways get one extra layer `ahm-waterway-boost` above 1x (fixed colour `#4f8fd6`, hidden on satellite); saved in `localStorage` key `ahm-river-size`. The scope (selected, filtered) is T-064. Not seen in a browser.
- [x] T-040 Time slider: the map at one moment, with play (2026-11-16, branch `feat/time-slider`). Approved: 2026-11-16 owner, in the chat: "start to build 040, 041, 043, 046 and 042, all in it's PR" (covers `interfaces/I-2`, `I-3`, `I-6` and `tests/js/contract.test.js`). `AHM.state` key `time`, core `visibleAt`/`timeLook`, bar in `sidebar/timebar.js`, `faded` property for the map. Undated objects: option 3 of T-049 assumed. Not seen in a browser.
- [x] T-060 Map area enlarged to Mesopotamia + Anatolia edge + Caucasus, relief tool and guide made correct for it (2026-11-15, branch `feat/bbox-mesopotamia-caucasus`; owner, in the chat). `bbox` [32, 29, 51, 44]; 285 squares, 15,812 tiles at zoom 0-11; only HTTP 404 means "no tile"; `check` shows void shares and 30/90 borders; `preview --at`; at most 64 open files; docs/10 numbers and the Armenia/Azerbaijan 90 m caveat.
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
