# Change log of the map domain

## 1. 2026-11-08: map highlights the selected place (task 004)

- **What:** `AHM.on('state:selected', ({ value }) => ...)` draws a ring (circle layer `ahm-highlight`, own GeoJSON source of the same name, one Point with `properties.id`) around the place with that id; `value` null removes it. The selected id is remembered, so the ring is redrawn after every `setFeatures`, when the map has loaded, and stays through base-map switches (`applyVis` skips `ahm-` layers). An id that is not among the features draws nothing and does not throw.
- **Why:** the sidebar publishes the selection in `AHM.state` (tasks 001, 003); the map shows it.
- **Files:** `app/js/map/map.js`, `changes/map.md`, `todo/map.md`. Tests: `tests/js/map.test.js` (written by map-tdd).
- **No interface change:** no new `AHM.map` command, no new event; the map reads no `AHM.state` and calls no sidebar code.
- **How to verify:** `node tests/js/run.js --no-browser`. By hand (real MapLibre is not in the tests): open the app, click a place in the sidebar (needs task 003): an orange ring appears around its marker; click another: the ring moves; deselect: it disappears; switch Map/Satellite or edit a layer (setFeatures): the ring stays.
- **Follow-ups:** none.

## 2. 2026-11-08: map markers: selected look, hover, tooltip, double click, clusters (task 008)

- **What:** the selected place has a white outline, a thin dark outer ring, a soft shadow and its own type symbol about 30% larger (layers `ahm-highlight*`, drawn last so they are above all labels and symbols); the orange ring is gone. Hover lifts a place symbol (icon-opacity 0.85), shows a pointer and a tooltip with name and type above the bullet (below it when there is no room); one tooltip at a time, closed on leave and when the map moves. Double click on a place emits `place:dblclick` once, cancels the map zoom and no `place:click`; a single click waits 300 ms first. Places closer than 50 px form a round bubble with the count (clusters up to zoom 11; `ahm-clusters`, `ahm-cluster-count`); a bubble click or double click zooms to where it splits. The selected place is kept out of the clustered source.
- **Why:** clearer, better-looking markers (task 008 points 4-7, 21 and 5).
- **Files:** `app/js/map/map.js`, `changes/map.md`. Tests: `tests/js/map.test.js` (written by map-tdd).
- **No interface change:** no new `AHM.map` command, no new event. `place:click` and `place:dblclick` keep their payload.
- **How to verify:** `node tests/js/run.js --no-browser`. By hand: select a place (its symbol grows with a white outline, no orange ring); hover a place (it lightens, tooltip above it); double click a place (sidebar opens its focus, map does not zoom twice); zoom out on a dense area (round bubbles with counts); click a bubble (map zooms to where it splits).
- **Follow-ups:** `todo/map.md` not ticked in this change; the sidebar half of double click is task 012.

## 2026-11-12 — Place types are a dictionary (T-025, I-8)

- **What:** `AHM.map.setTypes(types)` rebuilds `TYPE_STYLE` from the dictionary and redraws; `AHM.map.getSymbols()`; new symbols `pentagon`, `tree`, `sword`, `pickaxe`, `flag`; images of a changed type are replaced; `typeIcon` also accepts a draft `{ symbol, color, size }` (preview).
- **Why:** administrators must be able to add markers (iron mine, cedar forest, sword artefact) without a code change.
- **Files:** `app/js/map/typeicons.js`, `app/js/map/map.js`, `tests/js/map.test.js`
- **How to verify:** `node tests/js/run.js`. By hand: add a type in More → Place types, give it to a place: the marker changes on the map without a reload.
- **Follow-ups:** none.

## 2026-11-14 — Custom symbols for place types (T-025)

- **What:** A type with a custom symbol is drawn from its path (`Path2D`, scaled to the marker size and centred); the same for the editor preview, the list and the hover look. Bad path or box = circle.
- **Why:** the list of 15 symbols is too small (iron mine, cedar forest, sword artefact, ...).
- **Files:** `app/js/map/typeicons.js`, `tests/js/map.test.js`, `tests/js/lint.test.js`, `app/dist/`
- **How to verify:** `node tests/js/run.js`.
- **Follow-ups:** `style.path` and `style.box` are an addition to `interfaces/I-8` (see `TODO.md` T-026).

## 2026-11-14 — More tests for the place types dictionary (T-025)

- **What:** Tests: custom symbol drawn as one scaled and centred `Path2D` (stroke twice, fill once); circle without `Path2D`; no path for a non-custom type; `typeIcon` cache and draft; `registerTypeIcons` replaces existing images; `setTypes` before and after the map is ready; `loadTypes` without a file.
- **Why:** the dictionary and custom symbols had tests for the main paths only; no code changed.
- **Files:** `tests/js/map.test.js`, `tests/js/data.test.js`
- **How to verify:** `node tests/js/run.js`.
- **Follow-ups:** the type editor of the sidebar (`ui.js`) and `dev/save-handler.js` have no new tests: the editor needs a browser run, the dev server was left out on purpose.

## 2026-11-15 — Rivers tab (T-038)

- **What:** `riverNameAt([lon, lat])`: the name of the base-map waterway under a point (I-2 [1.7]).
- **Why:** owner, in the chat: rivers as their own entity with a tab, notes, a name search that saves nothing, and a section of a river by two clicks.
- **Files:** `app/js/map/shapes.js`, `interfaces/I-2-sidebar-map.md`, `tests/js/contract.test.js`
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js` (browser test "the Rivers tab ...", `riverSection` tests, `shape:` and `type:` river rows of `tests/fixtures/rules.json`).
- **Follow-ups:** the OpenStreetMap search and a click on a river of the real base map were not tried with live data.

One entry per change, newest last: date, what, why, files, how to verify, open follow-ups. Only the map domain appends here (DOMAINS.md, rule 7). The history before 2026-11-06 is in the legacy `AGENT_CHANGES.md` (entries #1-#26), which is now read-only.

## 2026-11-14 — T-021: routes on the map (written afterwards; commits `b0b76d2`, `571630d`, `2f38036`)

- **What:** `app/js/map/shapes.js`: route lines with direction arrows (one-way routes), the path found by Find a path drawn as a bold line over the routes, and the drawing tool for lines `drawShape({ kind: 'line', coords, ids, snap, locate, expand, onNote })`: A and B labels, a click on a place marker makes it a stop, a handle in the middle of each segment inserts a point, undo takes a click and its road away together, optional roads between clicks through `expand`.
- **Why:** the Routes tab draws on the map first (T-021).
- **Files:** `app/js/map/shapes.js`.
- **How to verify:** the map library comes from a CDN, so only by eye: Routes tab, add a route, click place markers and free points, drag a handle, save.
- **Follow-ups:** the map canvas is not covered by any automatic test.

## 2026-11-15 — Relief (hillshade) base-map entry (T-053)

- **What:** `basemap.terrain` in `app/js/config.js` (tiles, encoding, tileSize, maxzoom, attribution, hillshade paint). With non-empty `tiles` the base-map list gets "Map + relief" (value `@relief`); choosing it adds, once, a `raster-dem` source `ahm-terrain` (Terrarium, `bounds` = `bbox`, attribution) and a `hillshade` layer `ahm-relief` below the first non-`ahm-` symbol layer. Map and satellite hide it. A tile error shows "Relief tiles failed to load: ..." in `#status`. Labels keep the dark text (`view.sat` is not used for relief).
- **Why:** shaded relief from tiles the owner hosts himself (no new outside service). Lazy add: no tile request until chosen. `bounds`: a missing file under phpBB's rewrite rules would reach PHP.
- **Files:** `app/js/map/map.js`, `app/js/config.js`, `app/dist/`, `tests/js/map.test.js` (stand-in: base symbol layer, `rec.before`, `rec.sources[id].def`).
- **How to verify:** `node tests/js/run.js map:`. By hand (not done: MapLibre is not reachable from the sandbox): build tiles (docs/10), set `tiles`, choose "Map + relief".
- **Follow-ups:** T-054 (CI needs numpy and Pillow for the terrain tests).

## 2026-11-15 — Relief default: free AWS terrain tiles

- **What:** `basemap.terrain` in `app/js/config.js` now points at the AWS Terrain Tiles (`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, Terrarium, 256 px, maxzoom 15, Mapzen/Tilezen attribution). "Map + relief" is shown by default. No code change in `map.js`.
- **Why:** nothing to build or host: the tools/terrain route (own GLO-30 tiles) stays as an alternative, described in a comment in `config.js`.
- **Files:** `app/js/config.js`, `app/dist/`, `tests/js/map.test.js` (one test: the shipped config).
- **How to verify:** `node tests/js/run.js "shipped config"`. By eye (not done: no browser in the sandbox): choose "Map + relief".
- **Follow-ups:** the AWS endpoint, its CORS headers, the attribution wording and the licence were not checked from the sandbox (S3 is blocked).

## 2026-11-15 — Relief colours by height, controls, legend, height readout (T-039)

- **What:** MapLibre 4.7.1 -> 5.24.1 in `app/index.html` (the `color-relief` layer exists from 5.6.0; checked in the npm package). `basemap.terrain.color` in `config.js`: `ramp` (first one), `opacity`, `ramps` (id -> label + [metres, colour] stops). With it, "Map + relief" adds layer `ahm-relief-color` (type `color-relief`, elevation expression) under the hillshade. Controls in `#relief-opts` (index.html, filled by `map.js`): colour on/off, shading on/off, ramp list, two strength sliders, legend in metres, and `#relief-height` ("Height: 1,234 m" under the mouse, decoded from the Terrarium tile with fetch + OffscreenCanvas, no 3D terrain). Without `color` in the config nothing of this exists.
- **Why:** the plain hillshade shows neither heights nor the difference between low and high places (owner).
- **Files:** `app/js/map/map.js`, `app/js/config.js`, `app/index.html`, `app/css/map.css`, `app/dist/`, `tests/js/map.test.js` (7 tests, mocks for fetch/createImageBitmap/OffscreenCanvas).
- **How to verify:** `node tests/js/run.js "relief colours"`. By eye (not done: no browser in the sandbox): choose "Map + relief"; move the mouse (metres), change ramp and strengths; check that markers, routes, borders and satellite still work with MapLibre 5.
- **Follow-ups:** the MapLibre upgrade is only tested against the stand-in; the height readout needs CORS headers from the tile server.

## 2026-11-15 — Relief colours adapt to the view (T-039, addition)

- **What:** `basemap.terrain.color.adapt` (default true) and the checkbox `#relief-adapt` ("Adapt colours to the view"). After the map stops moving (`moveend`, 250 ms debounce) `map.js` reads a 16 x 16 grid of heights in view from the Terrarium tiles (same tile cache as the height readout, now a cache of promises: one fetch per tile), takes the 2nd and 98th percentile (at least 20 m apart) and stretches the chosen ramp so its first stop is the lowest and its last stop the highest height in view. The legend shows the stretched metres. Off = the fixed metres of the ramp.
- **Why:** the owner wanted the colours to change with zooming, as on topographic-map.com. Assumption: that site rescales the colours to the visible heights; its page text does not say so and its map is script-drawn, so this was not checked.
- **Files:** `app/js/map/map.js`, `app/js/config.js`, `app/index.html`, `app/dist/`, `tests/js/map.test.js` (3 tests; the stand-in got `getBounds`).
- **How to verify:** `node tests/js/run.js "relief colours"`. By eye (not done): zoom into a valley and onto a peak; the colours should use the full ramp each time.
- **Follow-ups:** none known; a view over the sea reads the sea level of the tiles as 0 m.

## 2026-11-15 — Relief panel on the map, ramp editor, contour lines, height profile (T-039, addition)

- **What:** the relief controls moved from the sidebar to a panel on the map (`#relief-opts`, right side, in `region:map` of `index.html`; collapsible). New: **ramp editor** (edit heights and colours, add and remove stops, "Custom (edited)" entry, Reset); **contour lines** (checkbox, step automatic from the zoom or 10-1000 m; lines and labels of every 5th line from a 96 x 72 grid of heights in view, marching squares in `contourLines`, layers `ahm-contour` and `ahm-contour-label`, source `ahm-contours`); **height profile** (button "Draw height profile": clicks on the map add points, a chart with length, min, max, ascent and descent; source `ahm-profile`; the map click and double-click handlers step aside while drawing); **saved settings** (localStorage `ahm-relief`: ramp, custom stops, strengths, switches, contour step). The adaptive range now reads the same grid as the contours; tile reading is `locate`/`tileOf`/`sampleAt` (one fetch per tile).
- **Why:** the owner: "everything sits in the sidebar, no ramp editor; missing contour lines and a height profile".
- **Files:** `app/js/map/map.js`, `app/index.html`, `app/css/map.css`, `app/dist/`, `tests/js/map.test.js` (stand-in got `getBounds`).
- **How to verify:** `node tests/js/run.js "map"`. By eye (not done: no browser here): panel position on desktop and phone, editing colours, contour lines and their labels at several zooms, drawing a profile across a mountain.
- **Follow-ups:** contour lines come from the tile heights (smooth at low zoom, blocky at the highest zoom); the ascent/descent of the profile is the raw sum of height steps (a rough figure); profile hover and drag-to-edit are not there.

## 2026-11-15 — Relief polish: rounder contours, smooth colours, panel back in the sidebar (T-048)

- **What:** (1) contour lines: the 128 x 96 grid is blurred (`smoothGrid`, 1 2 1 / 2 4 2 / 1 2 1) before the marching squares and every line gets two rounds of corner cutting (`chaikin`; closed lines stay closed, open lines keep their ends). (2) The relief controls are back in the sidebar: More > Maps & base map, under the base-map list (`#relief-opts`, same ids; the floating panel and its CSS are gone). (3) Checkbox "Smooth colours" (`basemap.terrain.color.smooth`, default true, saved with the other settings): when the range changes (`setRange`) the colours slide to it in 400 ms with `requestAnimationFrame` (ease out); the first range, "off" and an unchanged range apply at once; a new range cancels the running one.
- **Why:** owner: contour lines not round enough, the panel should be in the sidebar, colours jumped after 250 ms.
- **Files:** `app/js/map/map.js`, `app/js/config.js`, `app/index.html`, `app/css/map.css`, `app/dist/`, `tests/js/map.test.js` (3 tests).
- **How to verify:** `node tests/js/run.js "map"`. By eye: contour lines at several zooms; zoom in and out and watch the colours slide; open More > Maps & base map and choose "Map + relief".
- **Follow-ups:** the grid is 12288 heights per move end; on a slow phone this may need a coarser grid (not measured).

## 2026-11-15 — T-060: the larger `bbox` and the relief

- **What:** no code change in `map.js`. `AHM_CONFIG.bbox` is now `[32, 29, 51, 44]` (was `[37, 37, 49, 42.5]`). Since T-058 the raster-dem source has no `bounds` unless `basemap.terrain.bounds` is set, so the relief does not depend on `bbox` any more. `tests/js/map.test.js`: the stand-in config uses the new box; new test "config: bbox is [32, 29, 51, 44] ..." evaluates the real `config.js` and `providers.js`.
- **Why:** owner enlarged the area (see `changes/shared.md`, T-060).
- **How to verify:** `node tests/js/run.js map`. NOT verified: relief over the real canvas (MapLibre cannot be loaded in the sandbox).
- **Follow-ups:** T-062 (colour ramps 350-4100 m vs the new height range).

## 2026-11-16 — Relief: bounds only for own tiles, visible credit, flat colour bands (T-058)

- **What:** (A1) `ensureRelief()` passes `bounds` to the raster-dem source only when `basemap.terrain.bounds` is set (it used `bbox` before, which cut the worldwide AWS relief at the box). (A2, withdrawn by the owner, who wants the colours to follow the view: `adapt` stays true by default, saved settings are read as before.) (C) new option `terrain.color.blend` (default true = the smooth blend as before; false = flat colour bands: [stop i, stop i+1) has the colour of stop i, below the first stop the first colour, above the last the last). Checkbox `#relief-blend`, label "Smooth colour transitions" (checked = smooth), saved with the other settings, applied live by `setPaintProperty`; the legend strip shows hard bands when off. Banding is done in `rampExpression` after the `adapt` remap. Form: the existing `interpolate` with a pair of stops per boundary, [m - 0.01, colour below] and [m, colour above] (`BAND_EDGE`; the Terrarium step is 1/256 m); a MapLibre `step` was not chosen because its acceptance by `color-relief-color` in 5.24.1 could not be checked here. Not the same as `smooth` (only the 0.4 s slide to a new range). UNVERIFIED on a real map: flat colour inside a band, sharp edge, no stripes at the edges, any limit on the number of stops (paired stops double it), with adapt on and off. (A3) new `#base-credit` under `#basemap` (`index.html`, `map.css`): `applyVis()` writes `AHM_CONFIG.basemap.terrain.attribution` into it as text while relief is chosen, hides it otherwise; it wraps (`overflow-wrap: anywhere`). The MapLibre source keeps its `attribution`.
- **Why:** the owner saw relief only inside `bbox`, did not see the credit of the AWS tiles, and wanted flat colour bands as an option.
- **Cause of A3 (what is verified):** `map.js` creates `new maplibregl.Map({container, style, center, zoom})` with no `attributionControl` option, so MapLibre 5.24.1 adds its default control (bottom right, and it is collapsed to an "(i)" button when the map is narrow, which includes a phone). No CSS of ours hides it (`map.css` only moves `.maplibregl-ctrl-bottom-right` up on phones). The source `attribution` is passed correctly. NOT verified: whether the control lists the attribution of a source whose layers are hidden, and what it showed for the owner (the library cannot be loaded here: no CDN, npm registry blocked). So the cause is probably the collapsed "(i)" button; this is a guess, not a finding. The in-page text does not depend on it. The satellite sources (`attribution` is HTML with links, EOX) use the same MapLibre mechanism and may have the same problem; not changed (plain text would lose the required links).
- **Files:** `app/js/map/map.js`, `app/js/config.js`, `app/index.html`, `app/css/map.css`, `app/dist/`, `tests/js/map.test.js`, `docs/10`, `docs/02`.
- **How to verify:** `node tests/js/run.js "map"` (bounds with and without config, credit shown/hidden and its source, adapt default and old saves). By eye (not done: no map here): relief outside the box (around Ankara), constant colours when zooming, the credit text under the base-map list at 390 px.
- **Follow-ups:** none new.

## 2026-11-16 — T-040: faded places

- **What:** the symbols (`ahm-places`) and the labels (`ahm-labels`) are drawn at opacity 0.35 and 0.45 when the feature property `faded` is `true` (I-2 [1.10]). Shapes need no change: the sidebar lowers their `opacity`.
- **Files:** `app/js/map/map.js`, `tests/js/map.test.js`. **Verify:** `node tests/js/run.js faded --no-browser`. Not seen on a real map.

## 2026-11-17 — T-055: River size slider
- **What:** slider "River size" (0.5x to 4x, step 0.1, default 1x) in More > Maps & base map > Rivers. River features (`river: true`, sent by `sidebar/shapes.js`) are drawn with width x factor in every width layer (halo, shadow, casing, line); other shapes unchanged. Above 1x one extra line layer `ahm-waterway-boost` on the `waterway` source layer of the base style (width by zoom 0.5 / 1.5 / 4 x factor at zoom 6 / 10 / 14, colour `#4f8fd6`, below the first base symbol layer, hidden under a satellite map); removed at 1x. Saved in `localStorage` `ahm-river-size`; bad values are ignored.
- **Why:** T-055 (owner, answer a2 of T-059: the slider also thickens the background rivers, all together).
- **Files:** `app/js/map/map.js`, `app/js/map/shapes.js`, `app/js/sidebar/shapes.js`, `app/index.html`, `app/dist/`, `graph/`, `tests/js/map.test.js`, `docs/02`, `TODO.md`.
- **Contract:** no change to a contract file. The optional feature property `river` is new next to the ones `sidebar/shapes.js` already sends (comment of `map/shapes.js` updated).
- **Verify:** `node tests/js/run.js river --no-browser`. By eye (not done here): slide to 3x, rivers and base-map rivers get thicker; 1x restores them.
- **Follow-ups:** T-064 (scope selected or filtered).
