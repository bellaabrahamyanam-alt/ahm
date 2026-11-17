<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-2 Sidebar ↔ map: the `window.AHM` namespace. Provider: **map** (commands) and **sidebar** (events)

The sidebar and the map talk only through this object. Neither side may touch the other's variables, DOM ids or library objects
(no `map.*`, no `maplibregl.*` in the sidebar; no `show()`, `lyState`, `cur`, `tab()` in the map).

### Commands, provided by the map (`AHM.map.*`), called by the sidebar
| Call | Meaning |
|---|---|
| `setFeatures(featureCollection)` | the places to draw now. Feature properties: `id, name, type, type_code, dates, halo`; **[1.10]** `faded` (boolean, optional: draw the symbol and its label at a lower opacity because the place is only possible at the moment of the time bar, T-040). Replaces everything. |
| `hidePlace(id \| null)` | hide one place's symbol while its pin is being edited (`null` shows all) |
| `focusPlace(id)` | move the map to the place (zoom at least 8; the place must be among the features last set). The only call that moves the map to a place. |
| `focusPoint({lon, lat}, zoom)` **[1.1]** | move the map to a point (a result of the place search) |
| `fitTo([[lon, lat], …])` | zoom the map to these points (the "Fit map" button) |
| `fitRoute(coords)` / `setRoute(geometry \| null)` | draw or clear the route line |
| `setRouteMarkers({ a, b })` | start and end markers (`{lon, lat}` or null) |
| `setPick({lon, lat} \| null)` | the grey "selected point" marker |
| `editPin({lon, lat}, onMove) → { getPosition(), setPosition({lon, lat}) [1.1], remove() }` | the draggable red pin used while editing a place |
| `resize()` | the panel changed size |
| `getZoom()` | current zoom (read only) |
| `setTypes(types)` **[1.5]** | the types dictionary (I-8) as the sidebar loaded it; the map draws points, lines and areas from it |
| `getSymbols()` **[1.5]** | `[{ name, label }]`: the point symbols the map can draw (the sidebar offers them in the type editor); read only |
| `setShapes(featureCollection)` **[1.5]** | the lines and areas to draw now. Feature properties: `id, name, type_code`. Replaces everything. |
| `hideShape(id \| null)` **[1.5]** | hide one shape while it is being edited (`null` shows all) |
| `highlightShape(id \| null)` **[1.5]** | draw one shape as selected; the sidebar holds the selection and tells the map (no new state key) |
| `drawShape({ geometry: 'line' \| 'area', type_code, coords? }, onChange) → { getGeometry(), setType(code), remove() }` **[1.5]** | the interactive editor for a line or an area; `coords` edits an existing shape; `onChange(geometry \| null)` |
| `showMenu({ lon, lat }, { title?, actions: [{ id, icon, label }] })` **[1.5]** | a small menu at a point; `icon` is a name of I-7, `label` is the tooltip and the `aria-label`; one menu at a time |
| `hideMenu()` **[1.5]** | close the menu |
| `previewShape(id, { color?, opacity? } \| null)` **[1.5]** | show a colour or an opacity of a shape before it is saved; `null` puts the saved look back |
| `showFound(geometry \| null)` **[1.6]** | draw the path found between two places (a MultiLineString) as a highlighted line; `null` clears it. Added after the fact: the Routes tab used it before it was in this file (2026-11-12, `TODO.md` T-020) |
| `showPreview(geometry \| null)` **[1.5]** | a blue draft outline of a search result, shown before it is added |
| `isDrawing()` **[1.5]** | `true` while the drawing tool is active; read only |
| `highlightRivers(ids)` **[1.11]** | draw the rivers with these ids as selected (a glow under their lines; an id `b:<name>` is the base-map river of that name); `[]` clears it. The sidebar holds the selection (T-057) |
| `baseRivers()` **[1.12]** | the named rivers, canals and streams of the base map in the tiles loaded now (the view), the pieces of one river together: `[{ id: 'b:<name>', name, geometry: MultiLineString }]`; `[]` without a base style. `highlightRivers` also takes these `b:` ids (T-057) |
| `selectBox(on)` **[1.11]** | `true`: the next drag on the map draws a rectangle instead of moving the map; mouse up sends `box:select`, Escape sends `box:cancel`. `false`: stop the tool with no event (T-057) |
| `riverNameAt([lon, lat])` **[1.7]** | the name of the river of the base map under a point (the nearest named waterway within 10 px), or `''`; read only. Added 2026-11-15 for the Rivers tab (T-038) |

### Events, emitted by the map (`AHM.on(name, handler)`), handled by the sidebar
| Event | Payload | When |
|---|---|---|
| `map:ready` | none | the map and its layers exist |
| `place:click` | `{ id }` | single click on a place symbol or label. The map never moves. |
| `place:dblclick` | `{ id }` | double click on a place; the map has cancelled its own zoom; the sidebar decides (it calls `AHM.map.focusPlace(id)`) |
| `map:click` | `{ lon, lat, name?, shapes? }` | click on the map that is not on a place (`name` = the base map's label under the cursor, if any; **[1.5]** `shapes: [{ id }]` = the shapes under the cursor, areas included) |
| `map:show-controls` **[1.1]** | none | the map asks the sidebar to open the Maps fold (when an historical map is edited) |
| `shape:click` **[1.5]** | `{ id }` | click on a line or on the outline of an area (6 px tolerance) |
| `box:select` **[1.11]** | `{ bbox: [west, south, east, north] }` | the rectangle tool (`selectBox`) finished a drag; the tool is off again |
| `box:cancel` **[1.11]** | none | Escape while the rectangle tool was on; the tool is off again |
| `map:menu` **[1.5]** | `{ id, lon, lat }` | a button of the point menu was used (`id` = the action's id, `lon`/`lat` = the point the menu was opened at); the menu closes |
| `map:menu-close` **[1.5]** | none | the point menu closed (a button, Esc, or another menu opened) |
| `draw:finish` **[1.5]** | none | Enter or a double click while a shape is being drawn |
| `draw:cancel` **[1.5]** | none | Esc while a shape is being drawn |

### Events handled by the map (from the sidebar and from the state manager)
| Event | Payload | When |
|---|---|---|
| `sidebar:resized` | none | emitted by the sidebar: the panel was resized or collapsed (the map calls its own `resize()`) |
| `state:selected` **(I-6)** | `{ value, old }` | emitted by `AHM.state`: the selected place changed (`value` = place id or `null`). The map handles it to highlight the place; it never writes `selected`. |

Rules: handlers are synchronous and must not throw; payloads are plain data (no DOM nodes, no library objects); an event is
never renamed, only added (by proposal).
