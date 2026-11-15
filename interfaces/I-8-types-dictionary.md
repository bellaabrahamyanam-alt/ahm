<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-8 Types dictionary **[1.5]**. Provider: **data** (files, endpoints), **core** (loading), **map** (drawing). Consumer: **sidebar**

One dictionary for points, lines and areas, managed like languages and categories. Built by tasks 011 (data, core), 013 (map) and 014 (sidebar).
- File `types.json`: `{ version: 1, types: [ { code, geometry, names: [{ lang, name }], color, style } ] }`.
  - `code`: stable id, `[a-z0-9-]{1,32}`, made from the English name when the type is created, never changes. Places already point to a type by this code; place files do not change.
  - `geometry`: `point` | `line` | `area` | `river`, fixed at creation. A `river` type is a line that is not a route: no stops, never used by path finding, listed in the Rivers tab (added 2026-11-15, T-038). `color`: `#rrggbb`.
  - `style` by geometry: point `{ symbol }` (a slug; an unknown slug is drawn as a circle); line `{ width 1..12, pattern solid|dashed|dotted|double|triple, opacity 0.1..1, arrow true|false }`; area `{ fill_opacity 0..0.8, outline: { width, pattern, opacity } }` (the fill uses `color`); river `{ width 1..12, pattern, opacity 0.1..1 }` (no arrow).
- Seed entries: one point type for each type that exists today (same colours and shapes as now), the line types `border` and `route`, and the area type `territory`.
- Endpoints: read `types`; write `typeSave` (`{ code?, geometry, names, color, style, edit? }`; `edit: true` changes an existing code, and geometry and code never change) and `typeDelete` (`{ code }`; 400 with the count of places and shapes that use it). Flag `canTypeAdmin` (the same people as `canLanguage` today; 403 otherwise).
- Core (I-3): `loadTypes()`, `typeLabel(type, lang)`.
- Map (I-2): `AHM.map.setTypes(types)` (the sidebar passes the loaded dictionary), `AHM.map.getSymbols()`. `typeIcon(type)` (I-4) draws from the dictionary.
