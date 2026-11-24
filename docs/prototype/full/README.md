# Full design (owner, 2026-11-24)

68 frames, 400 px wide (1x), one PNG per frame: `sN.png`. N is the id in the file name of the owner's export; "Design no." is the number in the frame's own title (it differs after s64). Each export also had a 16 px caption strip per frame; those were dropped, the title is in the table.

This set is the visual reference for every task in `tasks/`. The 19 frames of the first set stay in `docs/prototype/png/` (2x, same ids for s1 to s49; some were redrawn here, so on a difference this set wins).

The "Task" column is mapped from the frame titles; frames other than s85 to s88 were not individually inspected when this index was written.

| Frame | Design no. | Shows | Task |
|---|---|---|---|
| s1 | 1 | Explore: Period footer with a Time-travel button | explore |
| s2 | 2 | Explore: filters (Period From/To use the same date field) | explore |
| s3 | 3 | Place details: header and body are one card, one continuous blue edge | explore |
| s7 | 7 | Edit a place: Add another name, compact Period row, new date field | explore |
| s19 | 19 | More: every section is the same accordion card | more |
| s20 | 20 | Place type editor: Add another name, symbol list, uploaded symbols | more |
| s21 | 21 | More: historical maps and categories (same accordion) | more |
| s22 | 22 | Moment (time travel): same footer slot, replaces Period while on | shell (main agent) |
| s28 | 28 | Period of a name: tap Edit, same date field, Done folds it back | explore |
| s33 | 33 | Border: new version in time (Add another name, new date field) | borders |
| s34 | 34 | Route form after drawing | routes |
| s37 | 37 | More: base map and 3D view (same accordion) | more |
| s38 | 38 | More: show on the map and relief options (icons for every option) | more |
| s39 | 39 | More: directions (same accordion) | more |
| s40 | 40 | Edit image overlay | more |
| s41 | 41 | More: add a language, rename a category (Add another name) | more |
| s42 | 42 | Symbol upload: error state, Save disabled | more |
| s43 | 43 | Route/river type editor: Add another name | more |
| s44 | 44 | Area type editor: Add another name | more |
| s45 | 45 | Notes (Period footer is the same component everywhere) | explore |
| s46 | 46 | Note edit: Date uses the new date field | explore |
| s47 | 47 | Date format menu: grouped by precision, current format ticked | shell (main agent) |
| s48 | 48 | Date formats: every layout, CE / BCE as a toggle | shell (main agent) |
| s49 | 49 | Period vs Moment: two entities, one footer slot | shell (main agent) |
| s50 | 50 | Closed sidebar: 60px rail. The logo tile is the one toggle (open and closed) | shell (main agent) |
| s51 | 51 | Closed: hover shows what a click does. Dot on the clock = Period filter active | shell (main agent) |
| s52 | 52 | Closed: tooltip on the toggle | shell (main agent) |
| s55 | 55 | Language filter: top languages as chips, the rest in a separate picker | explore |
| s56 | 56 | Name language: pills stay on one line, “+5” opens a picker | explore |
| s57 | 57 | Narrow sidebar (320px): selected language replaces the last pill, row never wraps | explore |
| s58 | 58 | Few languages: everything fits, no “+N” button | explore |
| s60 | 60 | Explore states: no results, loading, load error | explore |
| s61 | 61 | Search: places of the atlas, then “Other places (OpenStreetMap)” | explore |
| s62 | 62 | Other places: searching, nothing found, service down | explore |
| s63 | 63 | Map: menu of a clicked point (with and without edit rights) | explore |
| s64 | 64 | New place (1/3): position, names, type, dates | explore |
| s65 | 64b | New/edit place (2/3): certainty, radius, sources, position, layers | explore |
| s66 | 64c | Place form (3/3): mountain type and errors | explore |
| s67 | 65 | New note (place, layer or border): layers, date, errors | explore |
| s68 | 66 | Confirm: delete (border, route, layer, type) | shell (main agent) |
| s69 | 67 | Confirm: the other four (remove type, delete layer, import, discard) | shell (main agent) |
| s70 | 68 | Place card without edit rights (not logged in) | explore |
| s71 | 69 | Place card (editor): layers, routes, scoped notes | explore |
| s73 | 73 | Borders: list, hidden border, Add border pinned | borders |
| s74 | 74 | Border card: actions are icons on top of the card | borders |
| s75 | 75 | Add a border: search, results with +, draw or import | borders |
| s76 | 73 | Drawing a border area (also: editing the shape, new version) | borders |
| s77 | 74 | Drawing a line: follow a river | routes, borders, rivers |
| s78 | 75 | Rivers: select rivers (rectangle, area name, selection list) | rivers |
| s79 | 79 | Rivers: find and add | rivers |
| s80 | 80 | Routes: list and path finder, Add route pinned | routes |
| s81 | 78 | Path finder: ways found, shortest first | routes |
| s82 | 79 | Path finder: no path and input errors | routes |
| s83 | 83 | Route card: actions are icons on top of the card | routes |
| s84 | 81 | Drawing a route: start, next point, errors | routes |
| s85 | 85 | Layers: three-state buttons, colour edge, Add layer pinned | layers |
| s86 | 86 | Layer card: icons on top, places with ✕, borders and routes, Add note | layers |
| s87 | 84 | Layer: choose places and borders | layers |
| s88 | 85 | Layer form: add/edit | layers |
| s90 | 86 | Relief: edit colours, contour lines, height profile | more |
| s91 | 87 | Historical maps: empty, uploading, error | more |
| s92 | 88 | Directions: every state | more |
| s93 | 89 | Languages, Types, Categories: no admin rights and empty lists | more |
| s94 | 90 | Types: full list with usage and the four “Add” buttons | more |
| s97 | 91 | Panel and dock: drag the edge, drag the grip, larger panel | shell (main agent) |
| s98 | 92 | Larger panel: the card takes the whole panel | shell (main agent) |
| s99 | 93 | Phone (≤700px): panel is a bottom sheet, grab handle on top | shell (main agent) |
| s100 | 94 | Phone: panel hidden, only the handle tab and the Time button stay | shell (main agent) |
