<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-9 Shapes **[1.5]**. Provider: **data** (files, endpoints), **core** (loading, layer rules), **map** (drawing). Consumer: **sidebar**

Lines and areas on the map (borders, routes, territories). Built by tasks 011 (data, core), 013 (map) and 014 (sidebar).
- File `shapes.geojson`: a FeatureCollection. `geometry` is `LineString` or `Polygon`; `properties`: `{ id (UUID), type_code, names: [{ lang, name }], created, updated }`. Shapes have no dates.
- The type of a shape must have the matching geometry (`line` and `river` with `LineString`, `area` with `Polygon`). A shape can carry an optional `width` (0.5..12 pixels, lines and rivers): absent on a new shape = the width of its type, absent on a change = unchanged. A shape of a `river` type has no `stops` and no `twoway` (added 2026-11-15, T-038). Limits: at most 2000 points; a polygon ring is closed and has at least 4 coordinates; lon -180..180, lat -90..90.
- Layers: `members` in `layers.json` may hold `{ "shape": id }` besides `{ "place": id }`. `layer_members` accepts `add_shapes` and `remove_shapes` (lists of ids; an unknown id is 400). Deleting a shape removes it from every layer. The formats of places and notes do not change.
- Endpoints: read `shapes`; write `shapeSave` with `shape_add`, `shape_update`, `shape_delete` (permission `canEdit`, like places).
- Core (I-3): `loadShapes()`, `layerAllowsShape(id)` (the same Only/Hide rules as `layerAllows`).
- Map (I-2): `setShapes`, `hideShape`, `highlightShape`, `drawShape`; events `shape:click` and `map:click` with `shapes`. The selected shape is held by the sidebar and passed to the map with `highlightShape`; there is no new state key.
