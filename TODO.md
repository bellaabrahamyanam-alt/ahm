# TODO: the only list of work

The single place for what is to be done. It replaces task specs, proposals and requests (they are history in `changes/archive/`).

**How it works**
- The owner adds items and decides. The `builder` agent takes an item (`builder: T-003`, or `builder: next`), does it all (spec, tests, design, code, docs) and opens a pull request. The `critic` agent checks the pull request and merges it, or reports to the owner.
- One item = one pull request. Item ids `T-NNN` are never reused.
- **Needs you** holds what only the owner can decide. The builder writes the question there with 2 or 3 options and a recommendation, and stops that item. The owner answers by adding a line `Approved: <date> <decision>` to the item.
- **Protected files** (list `protected` in `tools/domains.json`: agent rules, CI, contracts `INTERFACES.md` and `interfaces/`, ownership) change only in an item that has an `Approved:` line. The pull request description then has `Owner-approved: T-NNN`, and the critic checks it against this file on `master`.
- When an item is finished the builder moves it to **Done** with the date and the pull request number. Keep the last 15 in Done; older ones go to `changes/archive/`.

Item format: `- [ ] T-NNN Title` then indented lines: `Done when:` (what can be checked), `Contract:` yes or no (does it change `INTERFACES.md`).

## Needs you (owner)

- [ ] T-054 Decide: run the terrain tool tests in CI (`tools/ci.sh` is protected)
  `tools/terrain/test_terrain.py` needs numpy and Pillow; without them `tests/js/build.test.js` prints "NOT RUN" and passes. Option 1: add `pip install numpy pillow` before the tests in `tools/ci.sh` (recommended). Option 2: leave it (the tests then run only on a developer machine).
  Done when: you write `Approved: <date> 1` or `2`.
  Contract: no.
- [ ] T-026 Decide: amend `interfaces/I-8` / `I-4` for the place types dictionary (T-025 deviates in 4 points)
  1. optional `style.size` 4–14 (without it city, town and village look alike); 2. codes may contain `_` (`inscription_site` already exists); 3. `typeIcon` also accepts a draft `{ symbol, color, size }` (editor preview). Recommendation: yes to all three.
  4. custom symbols: `style.symbol = "custom"` with `style.path` (SVG path data) and `style.box`. Recommendation: yes.
  Also: line and area types (and the seed `border`, `route`, `territory`) are not built yet; separate item.
  Done when: you write `Approved: <date> yes` or the points you refuse.
  Contract: yes.

- [ ] T-001 Decide: map extension points for the campaigns feature (old proposal 002, `changes/archive/proposals/002-map-extension-points.md`)
  Done when: you write `Approved: <date> yes` or `no`. Yes means the builder adds the extension points to the map and the contract (I-5).
  Contract: yes.
- [ ] T-002 Decide: Known violation 4 in `INTERFACES.md` (`drawShape`, `showMenu`, `map:menu` differ from the contract rows)
  Done when: you choose for each row: change the code to the contract, or change the contract to the code. Recommendation: change the contract to the code (the code works and is tested; 3 rows).
  Contract: yes.
- [ ] T-003 Describe the requirements of the campaigns feature
  Done when: a few lines of what a campaign is and what it must do. Until then nothing is built (`app/features/campaigns/`).
  Contract: no.
- [ ] T-004 GitHub settings no agent can change
  Done when: (1) Settings > Branches: protect `master`, require pull request and the check `ci`; (2) Settings > General: squash merge on, "Automatically delete head branches" on; (3) secret `GRAPH_PUSH_TOKEN` (fine-grained token, repository `ahm`, Contents: read and write) in Settings > Secrets and variables > Actions; (4) delete the old branches `ci-github`, `fix-github-ci-owner`, `shared/fix-github-ci-owner`, `shared/agent-efficiency`, and decide about `feature/routes`.
  Contract: no.

## Next (builder)

- [ ] T-036 Line and area types in the types dictionary — branch `feat/line-area-types`
  Owner, in the chat: "build it" (decision of T-034: dictionary types, like point types). Done when: `type-save` takes `geometry` `point`, `line` or `area` with the styles of `interfaces/I-8-types-dictionary.md`; a shape's type must be a line or area type of the dictionary (no fixed lists in `store.php`, `save-handler.js`); a line type needs a line; a place takes point types only; `type-delete` counts places and shapes; the 11 built-in types are in `data/types.json`; the Types editor adds line and area types; the Borders and Routes tabs follow; PHP, Node and `rules.json` agree.
  Contract: no (no protected file changes).
- [ ] T-025 Place types dictionary (admins add markers such as iron mine, cedar forest, sword artefact) — this branch `feat/place-types-dictionary`
  Done when: PR merged; the 4 owner decisions below are answered.
  Contract: no (`interfaces/I-8` is not edited; the code follows it except the points below).

- [ ] T-029 Tests for the sidebar fixes and layout (audit of specs 007 and 012: the code exists, the tests the specs asked for do not; `tests/js/sidebar.test.js` has 4 tests, all about types)
  Done when: tests show a double click selects no text, no frame shows the previous place after a click, Save of the language and category forms is disabled until the input is valid and Rename opens at the bottom of the fold, the dock opens and closes without moving the list, and the point-menu actions run the old code.
  Contract: no.
- [ ] T-030 Tests for the map point menu (audit of spec 010: `showMenu`, `hideMenu`, `map:menu` exist in `app/js/map/map.js`; `tests/js/map.test.js` has no test of them)
  Done when: tests show the menu opens above the point and below when there is no room, a button emits `map:menu { id, lon, lat }` and closes it, Esc, a click elsewhere, a drag or zoom and another menu close it, and one menu at a time.
  Contract: no.
- [ ] T-031 Shapes as layer members (audit of specs 011 and 014: `add_shapes` and `remove_shapes` are in `service/store.php`; there is no `layerAllowsShape`, no test, no row in `tests/fixtures/rules.json`, no "Shapes (n)" or "Choose shapes" in the layer detail)
  Done when: `layerAllowsShape(id)` exists in core with the Only/Hide meaning of places; tests (PHP, Node, `rules.json`) cover `add_shapes`, `remove_shapes`, an unknown id (400) and the removal of a deleted shape from all layers; the layer detail shows "Shapes (n)" and lets an editor add and remove shapes.
  Contract: no.
- [ ] T-032 Route rules in the parity table (follow-up of T-021: `stops`, `twoway` and `a route must be a line` have no row in `tests/fixtures/rules.json` and no PHP test)
  Done when: `rules.json` has a row for each of the three errors and one for a route that saves, and `php tests/php/run.php` and `node tests/js/run.js` pass.
  Contract: no.
- [ ] T-033 Map: parts of spec 013 that are missing (audit): `hideShape(id | null)` and the line patterns `double` and `triple` (the code has solid, dashed, dotted, dashdot)
  Done when: each exists in `app/js/map/` with a test in `tests/js/map.test.js`, or the owner drops it.
  Contract: no.
- [ ] T-037 `tests/data/DataCheck.php`: check that the `type` of every shape in `shapes.geojson` is a line or area type of `types.json` (follow-up of T-036)
  Done when: a shape of an unknown or point type fails the data check with its own error code, and a test shows it.
  Contract: no.
- [ ] T-011 Make `graph/` cheaper to use: line ranges per definition
  Done when: `graph/<domain>.md` lists `name:line` for the definitions of each file, so an agent opens a part with offset and limit without a search; the size limits of `tests/js/graph.test.js` still hold or are changed with the reason. Measure before and after (bytes an agent reads for one change in `map.js`).
  Contract: no.
- [ ] T-012 CSS and HTML tests (part 4 of `tests/README.md`)
  Done when: the tests listed in part 4 exist and pass; no application change.
  Contract: no.
- [ ] T-013 Controller sends `features: ['campaigns']` when the owner switches the feature on (needs T-003)
  Done when: a data test shows the list in the page data; the forum setting is documented in `docs/10-*.md`.
  Contract: yes (I-1).

- [ ] T-028 Update the text that still tells agents to run `bun tools/build.js` before a PR (`AGENTS.md` section 4 and line 43, `.claude/agents/builder.md` step 4, `DOMAINS.md`): CI now rebuilds `app/dist/` (T-006)
  Done when: the texts say a PR need not commit `app/dist/` (a local build is still allowed); `tests/js/build.test.js` stays unchanged. Needs `Approved:` (protected: `AGENTS.md`, `.claude/`, `DOMAINS.md`).
  Contract: no.

**Map analysis block (owner, in the chat, 2026-11-15).** Order: T-040 -> T-041 -> T-043 -> T-045 -> T-042 -> T-046 -> T-047; T-044 can start now (the relief PRs are merged). The date model already exists (`core/dates.js`: exact, approximate, range; `date_from` / `date_to` on places, shapes and layers), so none of this needs old data to be changed. Decisions the owner still has to make: T-049 to T-052.
- [ ] T-040 Time slider: the map at one moment ("year X"), with play
  What: a bar on the map with a date field (the same `datefield.js` input), a slider over the earliest and latest date found in the data, play / pause, a speed (years per second) and "Off" (today's behaviour). Places, borders, routes and rivers outside their life are hidden, the others stay.
  Logic: `AHM.state` gets `time: { at: <ts text> | null, playing, speed }` and the event `time:changed`. A core function `visibleAt(item, at)` uses the existing `dateBounds(d)` = [from, to): hidden when `at` is before the start of `date_from` or at or after the end of `date_to`; in the part of an approximate or range date that is only possible (not certain) the object is drawn faded. `date_to: null` means the end is unknown, not "still exists" (docs/05), so it never hides. Objects with no dates at all: see T-049. The map filters its features with that function; the sidebar lists follow it and show a chip "Time: <date>". The period filter (From / To = existed in a period) stays and is a different thing: both can be on.
  Done when: tests show the rule for exact, approximate, range and unknown dates (table of cases, same in Node and PHP if the server needs it), the map hides and shows features when `at` changes, play moves `at` by the speed and stops at the end, "Off" brings back all objects, the chip shows and removes the filter.
  Contract: yes (I-6 `time`, I-2 event, I-3 `visibleAt`). Needs `Approved:` before the interface files are edited.
- [ ] T-041 Versions of one border, route or river in time (same shape, different times)
  What: a shape can have several versions, each with its own geometry and dates. In the shape editor "Add version for another time" copies the shape, asks for its `date_from` and offers to close the previous version (`date_to`). The sheet lists "Other versions" with their dates.
  Logic: no nested geometry. A version is a normal feature of `shapes.geojson`; versions of one shape share a new optional property `series` (UUID). With T-040 the slider shows the version valid at the date by itself; without a date all versions show. Absent `series` = a single shape, so no old data changes. Notes and layer membership stay with the version they were made on. Server rules (`store.php`, `save-handler.js`, row in `tests/fixtures/rules.json`): `series` is a UUID or absent, all versions of a series are of the same kind (area or line), and two versions whose dates are both known must not overlap (error `versions of one series overlap`). docs/05 gets a section.
  Done when: tests (PHP, Node, `rules.json`) cover the three rules, the editor creates a version, the sheet lists the others, and a version can be edited and deleted alone.
  Contract: yes (I-9 property `series`, I-1).
- [ ] T-042 Border change between two dates: area gained and lost
  What: choose a border (a series from T-041) and two dates A and B. The map shows what was gained (green) and lost (red); a panel shows km2 and % of each. A note says that old borders are approximate.
  Logic: take the version valid at A and at B; gained = B minus A, lost = A minus B (polygon difference); area on the sphere (not on the flat map). For the difference use the MIT library `polygon-clipping`, vendored and pinned (exact result); the simpler option without a library is to compare the two polygons on a grid of cells (approximate to the cell size). Owner decides in T-052. Result is drawn as a temporary map layer, not saved.
  Done when: a test with two squares of known size gives the exact gained and lost area, the panel shows the numbers, the layer is removed when the panel is closed.
  Contract: maybe (a new `AHM.map` command in I-2); the builder says which in the item before the code.
  Needs: T-040, T-041, T-052.
- [ ] T-043 Names over time
  What: a place or shape can have names that are valid only in a period (a name per era and language). The map and the lists show the name of the chosen language that is valid at the slider date. Search finds every name, old ones too, and shows which name matched when it is not the shown one.
  Logic: `names[]` entries get optional `date_from` and `date_to` (date model); absent = always. Rule: with the slider off nothing changes (the first name of a language, as today). With it on: the first name of that language whose period contains `at`, else the first name of that language. Core function `nameAt(item, lang, at)`. Rules in `store.php` and `save-handler.js` (parity table rows). The place form (`placeform.js`) and the shape form get "from / to" per name row with `datefield.js`. Applies to places and shapes first.
  Done when: tests cover `nameAt` (period inside, outside, no period, unknown language), the server accepts and refuses the new fields, search finds an old name, the forms save and show them.
  Contract: yes (I-1 property, I-3 `nameAt`). Works without T-040 (shows the first name).
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
- [ ] T-046 Certainty and sources per object
  What: phase 1: a dictionary of sources (title, citation, link; like languages and categories, editors add). Places and shapes get an optional certainty (exact, approximate, disputed), an optional radius in metres (drawn as a faded circle around approximate and disputed points) and a list of sources. Filters by source and certainty. Phase 2: competing claims: the same object at two places or two shapes according to two sources, each with its sources; the sheet lists "Other claims" and a source toggle shows one author's version or all.
  Logic: every new property is optional and absent = unchanged, so adding this later changes no data; nothing needs migrating now. `shapes.geojson` already has a free-text `source`; it stays. New file `sources.json` (id, title, citation, url) with the usual store rules. Phase 2 uses the same link idea as `series` in T-041 (a `claim_of` id); the builder checks if one mechanism fits both.
  Done when (phase 1): server rules and parity rows, the forms save the new fields, the map draws the circle, the filters work. Phase 2 is its own item after the owner has seen phase 1.
  Contract: yes (I-1, I-9, new file in I-1).
- [ ] T-047 Share and export (no image export)
  What: (a) a link that reopens the same view: position, zoom, base map and relief settings, active layers and filters, the slider date, the opened place or shape. A "Copy link" button. (b) Export to GeoJSON and KML of what is shown (the filtered result, one layer, or everything).
  Logic: (a) a versioned URL hash (`#v1/...`), written when something changes (debounced) and read at the start; unknown keys are ignored; nothing private is put in the link. (b) done in the browser (a download from a Blob), no server change. GeoJSON keeps the date objects of the date model. KML: names in the chosen language, description from the place notes, line and fill colours from the types; a `<TimeSpan>` only for years 0001 to 9999 (KML has no BCE years), other dates are written into the description.
  Done when: tests show the hash round trip (encode, decode, ignore unknown keys), the exported GeoJSON opens as valid GeoJSON with the same features, the KML has the expected elements and escapes text.
  Contract: no (the builder confirms; if a new `AHM` function is needed it says so first).
- [ ] T-049 Decide: objects with no dates when the time slider is on (T-040)
  1. always shown; 2. always hidden; 3. shown faded, with a switch "Show undated" in the slider bar. Recommendation: 3 (nothing disappears by surprise, and you can still clear the map).
  Done when: you write `Approved: <date> 1`, `2` or `3`.
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

## Done

- [x] T-048 Relief polish: rounder contour lines, "Smooth colours" checkbox, controls back in the sidebar (2026-11-15, branch `feat/relief-aws`; owner, in the chat).
- [x] T-039 Relief colours by height, controls and height readout (2026-11-15, branch `feat/relief-aws`; owner, in the chat: "elevation styles, customize, see meters and colour difference"). MapLibre 4.7.1 -> 5.24.1 (needed for `color-relief`, since 5.6.0). `basemap.terrain.color` (ramps in metres), controls under the base-map list, legend, height readout from the Terrarium tile. Colours adapt to the view (`color.adapt`, checkbox "Adapt colours to the view"). Relief panel on the map, ramp editor, contour lines, height profile, saved settings (owner, in the chat). Not verified: the real map (no browser here), the MapLibre 5 upgrade against the other map code, AWS CORS.
- [x] T-053 Relief (hillshade) base-map entry from self-hosted Copernicus GLO-30 terrain tiles (2026-11-15, branch `feat/relief-layer`). `basemap.terrain`, "Map + relief", `tools/terrain/`, docs/10 guide. Real GeoTIFF reading, AWS names, Apache, Cloudflare, real tile sizes and the look on a real map are unverified.
- [x] T-036 Line and area types in the types dictionary (2026-11-14, branch `feat/line-area-types`). Decision of T-034 (owner, in the chat: "build it"): dictionary types, not fixed lists. Server rules in `store.php` and `save-handler.js`, registry in `core/shapes.js`, editor in More → Types.
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
