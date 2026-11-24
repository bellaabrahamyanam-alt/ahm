# 00 Project map (design migration)

Discovery of 2026-11-23, from the code on branch `feat/shared-foundation-tasks` (base `master` 53e2c44) and the owner's prototype (`docs/prototype/`, 19 PNG frames `s1…s49`). Read by file, not from tab names. Line numbers drift; function names are the stable reference.

**Update 2026-11-24.** The owner delivered the full design (68 frames, `docs/prototype/full/`, index in its README). Cells below that say "G" (gap) were true for the first 19 frames; the Layers rows are corrected here (L1 to L6), the other rows were not re-checked, use the frame index to find their frames. The "no framework, JS builds the HTML" description in section 1 is the current state; the owner changed the direction, see `03-work-plan.md` ("Direction").

How verified: `app/index.html` read section by section; every function list of `app/js/sidebar/*.js` and `app/js/map/*.js` extracted; routing, data-model and access docs read; all 19 PNGs opened. Not verified: no browser walk-through of every screen (the sandbox cannot load the map or the daisyUI CDN); role differences were not run per role.

## 1. Architecture in one page

- phpBB 3.3 extension `ahm/map`. Backend: `config/routing.yml` → `controller/` → `service/store.php` (writes JSON/GeoJSON/Markdown files, archives old versions). Dev mirror: `dev/save-handler.js` (Node). Both must give the same answers (`tests/fixtures/rules.json` parity table).
- Frontend: `app/` = one page, classic scripts (no modules, no framework). Source files in `app/js`, bundled to `app/dist/` by `bun tools/build.js` (committed). Map: MapLibre GL 5.24.1 from the jsDelivr CDN.
- Domains and files (owner list: `tools/domains.json`): `core` (data, dates, shapes, routes, layer-rules, search, providers), `map` (map.js, shapes.js, overlays.js, typeicons.js, map.css), `sidebar` (`app/js/sidebar/*`, sidebar.css, shapes.css), `state` (state.js), `shared` (index.html, base.css, config, ahm.js, icons, docs, tests). Cross-domain calls only through `window.AHM` (`INTERFACES.md` I-1…I-9).
- Shared state: `AHM.state` keys `selected`, `layers {only, hide, open, editing, staged, noteAll}`, `time {at, playing, speed, undated}`. Events: `place:click`, `place:dblclick`, `map:click`, `map:ready`, `map:menu`, `map:menu-close`, `map:show-controls`, `shape:click`, `draw:finish`, `draw:cancel`, `box:select`, `box:cancel`, `sidebar:resized`, `state:<key>`.
- Browser-kept settings (localStorage): `ahm-side-w`, `ahm-side-h` (sidebar size), `ahm-dock-h`, `ahm-dock-max` (details dock). Map settings (base map, relief, river size) go through `loadSettings`/`saveSettings` in map.js.

## 2. Routes

### 2.1 HTTP (`config/routing.yml`)

| Route | Method | Purpose |
|---|---|---|
| `/map` | GET | the page |
| `/map/data/{f}` | GET | `f` ∈ places, notes-index, overlays, languages, layers, layer-notes-index, categories, shapes, types, sources |
| `/map/note/{place}/{id}` | GET | one note (Markdown) |
| `/map/save` | POST | place + note save |
| `/map/language-save` | POST | add or rename a language (administrators) |
| `/map/type-save`, `/map/type-delete` | POST | types dictionary (administrators) |
| `/map/layer-save`, `/map/layer-delete` | POST | layers (delete: administrators) |
| `/map/shape-save`, `/map/shape-delete` | POST | borders, routes, rivers |
| `/map/category-save` | POST | add / rename a category (administrators) |
| `/map/source-save` | POST | sources |
| `/map/overlay/{id}` GET, `/map/overlay-save`, `/map/overlay-upload/{id}`, `/map/overlay-delete` | | historical map images (administrators write) |

Permissions (docs/07): guest = read only; member = add and edit places, notes, layers, layer notes (when `ahm.map.editors` = members); administrator (`a_`) = also overlays, languages, types, layer delete, categories. The server checks every write; the UI only hides buttons (`AHM_CONFIG.canEdit`, plus admin flags in config).

### 2.2 In-page routes (the app has no router)

| Mechanism | Values | Handler |
|---|---|---|
| Tab (`data-tab`, function `tab(n)` in `layout.js`) | `explore`, `shapes` (Borders), `routes`, `rivers`, `layers`, `more` | shows `#tab-<n>`; `rivers` reuses `#tab-shapes` in river mode (`shSetMode`) |
| More folds (`<details class="fold">`) | `more-maps`, `more-route` (Directions), `more-lang`, `more-types`, `more-cat` | `tab('maps'|'route'|'lang')` opens a fold; `AHM.on('map:show-controls')` → `tab('maps')` |
| URL hash (set with `history.replaceState`, read once at start in `ui.js`) | `#place-<id>`, `#layer-<id>`, `#border-<id>`, `#route-<id>` | `show`, `lyOpen`, `shOpen`, `rtOpen`. No hash for rivers, notes, types, languages, categories or More folds |
| Sidebar layout state | collapsed, resized (`#resizer`), mobile ≤700 px = bottom sheet with height, details dock height / max | `layout.js` (`toggleSide`, `setSize`, `setDock`) |

Corrects the earlier draft: **the Categories UI is already a fold of More (`#more-cat`, list `#catList`, admin `#catAdmin`)**; only its code lives in `layers.js` (`lyRenderCats`, `catFill`, `catClick`). Prototype s21 and s41 therefore match the page, not a change of place.

## 3. Screens, dialogs and interactions (all of them)

Legend: P = prototype frame exists; G = no frame (gap).

### 3.1 Shell and map overlay

| # | Screen / control | Where | Frame |
|---|---|---|---|
| S1 | Header (brand), six tabs, collapse `#collapse`, expand `#expand`, `#resizer`, `#pick` (point picker) | `index.html`, `layout.js` | P s1 (header, tabs, `<` collapse); G collapsed state, narrow bottom sheet, desktop width |
| S2 | Time button `#tbOpen` and time bar `#timebar` (play, slider, label, date field `#tbAt`, speed, Show undated, Off) | over the map, `timebar.js` | replaced by the Period / Moment footer: P s1, s22, s49 |
| S3 | Map popups: hover tip (`ahm-tip`), point menu (`ahm-menu`: add / route / layer buttons), vertex markers (`ahm-vtx`), overlay handles (`.ovh`), pins | `map.js`, `shapes.js`, `overlays.js`, `map.css` | G (none) |
| S4 | Controls over the map: attribution, relief legend, height readout, profile chart | `map.js`, `index.html` (`#relief-*`) | G |

### 3.2 Explore (`#tab-explore`)

| # | View | Code | Frame |
|---|---|---|---|
| E1 | Place list with count, Fit map, sort (A–Z / by date), search `#q`, Reset | `places.js` `update`, `placeRowHTML` | P s1 (icon buttons for sort and fit, search + filter button) |
| E2 | Filters (`<details class="filters">`): type chips with counts, certainty chips, source chips, language, Period From/To; active-filter bar `#activeBar`, layer chips | `places.js`, `period.js` | P s2 (filter button with badge, chips with ×, Clear all, panel) |
| E3 | Place detail in the **dock** (`#dock`, `#detail`): head, actions (edit, route, layers, locate), names, layers, notes list, fit | `places.js` `show`, `placeDetail`, `setDockFull` | P s3 (the detail is an expanded accordion row in the list, not a dock), s45 (notes view) |
| E4 | Place form (new and edit), names list with per-name period, type select, dates, evidence (sources, radius), height for mountains, pin | `placeform.js`, `actions.js` `editPlace` | P s7, s28 |
| E5 | Place dialog `<dialog id="dlg">` (new place + first note) and `lyDlg` (layer form) | `actions.js` `openDlg`, `layers.js` | P s7/s46 only for forms; G the dialog frame |
| E6 | Notes: list per language with timeline, Show more/less, sort, fold all, add, edit, delete | `places.js` `noteHTML`, `fitNotes`, `setNote` | P s3, s45, s46 |
| E7 | Search other places `#geo` (Nominatim) | `actions.js` `doGeo` | G |
| E8 | Point card after a map click, route A/B picker (`rt`, `renderRoute`) | `actions.js` `act`, `pickPoint` | G |
| E9 | Time bar / Moment | see S2 | P s22, s49 |

### 3.3 Borders (`#tab-shapes`) and Rivers (same section)

| # | View | Code | Frame |
|---|---|---|---|
| B1 | List with search, type chips, count, Fit map, add buttons, import | `shapes.js` `shRenderList`, `shRenderTypes`, `shRenderAdd`, `shImport` | G |
| B2 | Border card (style, names with periods, type, dates, certainty, sources, notes) | `shRenderView`, `shStyle` | G |
| B3 | Border form: new, edit, **new version in time** (`series`), versions chips | `shOpenForm`, `shStartVersion`, `shVersionChips` | P s33 (version form) |
| B4 | Draw area / line on the map, finish / cancel, vertex edit | `shStartDraw`, `shFinishDraw`, `map/shapes.js drawShape` | G |
| B5 | Search OSM boundary and add (`shSearch`, `shAddOsm`, `shOsmNames`), GeoJSON import (`shImport`) | `shapes.js` | G |
| R1 | Rivers list, river card, "Find the way along a river" between two clicks (`shRiverFind`, `shRiverLeg`) | `shRenderRivers` | G |
| R2 | Select rivers: rectangle `#rvBox`, by area `#rvArea`, inside checkbox, Only / Zoom / Clear, selected list | `rvFound`, `rvSync`, `rvAdd`, `map/shapes.js applyRiverSel`, `drawBox` | G |
| R3 | Border / river notes (shared notes store with layers) | `lyOpenNoteDlg(…, 'shape')` | P s45 pattern only |

### 3.4 Routes (`#tab-routes`)

| # | View | Code | Frame |
|---|---|---|---|
| T1 | "Find a path between places" (`#rtFinder`: from, to, swap, Find, result chain, error) | `routes.js` `rtFind`, `rtFindRender` | G |
| T2 | Routes list, type chips, Fit map, add | `rtRenderList`, `rtRenderAdd` | G |
| T3 | Route card (chain of stops, style, dates, two-way, notes) | `rtRenderView`, `rtChainHTML`, `rtStyle` | G |
| T4 | Route form after drawing (places on the way, names, type, usable both ways, began) | `rtOpenForm`, `rtReadForm`, `rtSaveForm` | P s34 |
| T5 | Draw route (click A, points, B; click on a place = stop), road routing between points (`rtRoad`), cancel / discard / back to the map | `rtStartDraw`, `rtFinishDraw`, `rtDrawInfo` | G (s34 is the form only) |

### 3.5 Layers (`#tab-layers`)

| # | View | Code | Frame |
|---|---|---|---|
| L1 | List, search, category select, count, `+ Add layer`, Only / Hide per row, scope note | `lyRenderList`, `lyRowHTML`, `lyScopeHTML` | P s85 |
| L2 | Layer detail (names, description, category, colour, dates, members, notes, quick actions) | `lyRenderDetail`, `lyEditPanel` | P s86 |
| L3 | Layer form dialog `lyDlg` (create / edit) | `lyOpenForm`, `lyReadForm` | P s88 |
| L4 | Choose places mode (map click or list ticks, ring on members, Save places) | `lyStartEdit`, `lyToggleMember`, `lySavePlaces`, `lyPickRows` | P s87 |
| L5 | Layer notes, note dialog | `lyOpenNoteDlg`, `lyDlgSave` | P s86, s88 (note), s45 |
| L6 | Place's layer list in the place detail and in the note dialog | `lyPlaceDetail`, `lyDlgLayers` | P s3, s65, s71 |

### 3.6 More (`#tab-more`, five folds)

| # | Fold | Content | Code | Frame |
|---|---|---|---|---|
| M1 | Maps & base map `#more-maps` | base map select + credit, 3D view (tilt, rotation, Flat / Tilt 60 / North up), terrain + exaggeration, river size, **Relief** (colour ramp, shade, adaptive, smooth, blend, ramp editor with stops, opacity, strength, contours + interval, height profile with chart, legend, height readout), "Show on map" groups, Historical maps list (show, opacity, fit, edit) + add image + overlay editor (four corners, rotation, scale, zoom range) | `map.js` (`initViewControls`, `initReliefControls`, `initRiverSize`), `overlays.js` | P s19 (card header "Maps & base map · Terrain · 3D view · relief"), s21 ("Historical maps" with checkbox, opacity, fit, edit, Add image overlay); **G** everything inside Maps, 3D, relief, overlay editor |
| M2 | Directions `#more-route` | From / To (point or place), swap, clear, distance and time | `actions.js` `doRoute`, `renderRoute` | P s19, s21 (closed card only); G open state |
| M3 | Languages `#more-lang` | table (code, name, native), add (administrators) | `admin.js` `renderLangs`, `lgRenderAdmin`, `lgFill` | P s19 (table), s41 (new language form) |
| M4 | Types `#more-types` | list (grouped places / lines / areas, "+ N more"), type editor: names, symbol grid + uploaded SVG, colour, size, line / area style, preview, delete | `renderTypes`, `tyRenderAdmin`, `tyFill`, `tyUseSvg` | P s19, s20 (point type), s43 (line type), s44 (area type) |
| M5 | Categories `#more-cat` | list, add, rename (names per language) | `layers.js` `lyRenderCats`, `catFill`, `catClick` | P s21, s41 |

### 3.7 Interactions (every one found)

Drawing (border, route, river leg), vertex drag and insert (`ahm-vtx`, midpoints), rectangle select (`box:select` / Esc), choose-places, pick point on map (`#pick`), point menu on map click, hover tip, double-click place, drag the edit pin, resizer drag and double-click reset (`#resizer`, `#dockResizer`), collapse / expand, mobile bottom sheet, Esc to cancel modes, Enter in search fields (`searchfield.js`, Nominatim on Enter), keyboard focus on `#resizer`, `prefers-reduced-motion` handling for notes, deep links by hash, time play loop (`tbLoop`), file upload with browser-side shrinking (overlays), GeoJSON import, OSM lookup.

## 4. Data models (what the UI edits; stored data must not change)

Full text: `docs/05-data-model.md`. Summary for the UI:

- Date `{fmt, ts, mode: exact|approx|range, ts_to}`; `fmt` ∈ `ymd, dmy, mdy, dmony, mony, y, c, m` (the 8 prototype formats, 1:1); ISO 8601 `Z`, BCE and > 9999 as `±YYYYYY`; never compared as text.
- Place: GeoJSON Point, `id`, `type` (point type), `names[{lang,name,date_from?,date_to?}]` (several per language, first is shown), `date_from`, `date_to`, `height_m` (mountain only), evidence (sources, certainty, radius).
- Note: Markdown with header `id, lang, title, date?, layers?`; index `notes/index.json`.
- Layer: `id, names[], descriptions[], category, color, date_from, date_to, members[{place}] (ordered)`; categories `{id, names[]}`; layer-notes (also notes of shapes).
- Shape: area or line GeoJSON, `names[]`, `type`, `color`, `opacity`, style, `series` (versions in time), `river` flag (type geometry `river`), route `stops`, `twoway`; certainty and sources.
- Types dictionary: `code, geometry: point|line|area|river, names[], color, style {symbol|custom path+box, size | width, pattern, opacity, arrow | fill_opacity, outline}`; `mountain` never removed; a type in use cannot be deleted.
- Languages `{code, name, native}`; sources `{id, title, citation?, url?}`; overlays `{id, title, file, coordinates[4], minzoom, maxzoom, opacity}`.
- Validation parity: `tests/fixtures/rules.json` (UI must show the server messages unchanged).

### Data gaps the prototype needs (none exist yet)

1. Histogram of objects per date step for Period and Moment (computed in the browser from places, shapes; no stored data).
2. (Checked, not a gap) The Period filter already reaches borders, routes and rivers: `shapesRun({ period: periodBounds() })` in `sidebar/shapes.js` and `sidebar/routes.js`. s49 "Hides places, borders, routes" matches today's behaviour.
3. Symbol list with **uploaded SVG tiles** (s20): data model already has `custom` symbol + path; the "uploaded SVG ones" list is a UI over existing types, no new field.
4. Note "timeline" and language-count chips (s45): derived.
5. Counts per type / certainty chips (s2): derived (already partly present).
