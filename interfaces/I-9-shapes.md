<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-9 Shapes **[1.5]**. Provider: **data** (files, endpoints), **core** (loading, layer rules), **map** (drawing). Consumer: **sidebar**

Lines and areas on the map (borders, routes, territories). Built by tasks 011 (data, core), 013 (map) and 014 (sidebar).
- File `shapes.geojson`: a FeatureCollection. `geometry` is `LineString` or `Polygon`; `properties`: `{ id (UUID), type_code, names: [{ lang, name }], created, updated }`. Shapes have no dates.
- The type of a shape must have the matching geometry (`line` and `river` with `LineString`, `area` with `Polygon`). A shape can carry an optional `width` (0.5..12 pixels; stored for any shape, drawn on lines: rivers, routes and borders drawn as lines, ignored for areas): absent on a new shape = the width of its type, absent on a change = unchanged. A shape of a `river` type has no `stops` and no `twoway` (added 2026-11-15, T-038). Limits: at most 2000 points; a polygon ring is closed and has at least 4 coordinates; lon -180..180, lat -90..90.
- **[1.10]** Optional `series` (UUID): versions of one shape in time share it (T-041). Absent = a single shape. All versions of a series are of the same kind (area, or line = route and river); two versions whose `date_from` and `date_to` are all known must not overlap (400 `versions of one series overlap`). A version is a normal feature; there is no nested geometry. Core: `shapeVersions(shape)` (the other versions, oldest first) and `versionEndBefore(prev, from)`.
- **[1.11]** Optional `certainty` and `sources` as for places (I-1); a border has no `radius_m` (400 `only a place has a radius`).
- Layers: `members` in `layers.json` may hold `{ "shape": id }` besides `{ "place": id }`. `layer_members` accepts `add_shapes` and `remove_shapes` (lists of ids; an unknown id is 400). Deleting a shape removes it from every layer. The formats of places and notes do not change.
- Endpoints: read `shapes`; write `shapeSave` with `shape_add`, `shape_update`, `shape_delete` (permission `canEdit`, like places).
- Core (I-3): `loadShapes()`, `layerAllowsShape(id)` (the same Only/Hide rules as `layerAllows`).
- Map (I-2): `setShapes`, `hideShape`, `highlightShape`, `drawShape`; events `shape:click` and `map:click` with `shapes`. The selected shape is held by the sidebar and passed to the map with `highlightShape`; there is no new state key.
