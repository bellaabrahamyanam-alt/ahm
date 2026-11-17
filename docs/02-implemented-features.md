<!-- Section 2 of the project description; index: README.md -->

## 2. Implemented features

### Map

- Vector base map (OpenFreeMap "Liberty", data from OpenStreetMap) and a Sentinel-2 satellite option.
- **Certainty and sources (phase 1):** a place or a border can say how sure we are (exact, approximate, disputed) and cite sources from a shared list of sources (title, citation, link; editors add them in the form with "New source"). A place can also have a radius: the map draws a faded circle of that size around approximate and disputed places (dashed when disputed). The place and border sheets show them; Filters has Certainty and Source chips for the places list and the map. The borders, rivers and routes lists are not filtered yet (T-066); competing claims are phase 2 (T-065).
- **Names over time:** in the place and border forms every name has a "Period of this name" (from, to). With the time bar on, the map and the lists show the name valid at that moment; search finds old names too and the row says "also called …".
- **Time bar** (button "Time" over the map): shows the map at one moment of history with a slider, a date field and play (1 to 500 years per second). Places, borders, routes and rivers outside their life are hidden; those that are only possible at that moment (approximate or range dates) are drawn faded; objects with no date at all are shown faded while "Show undated" is on. "Off" brings everything back. The moment is not saved.
- **3D view** (More > Maps & base map): tilt (0 to 85 degrees) and rotation (0 to 359) sliders that follow a mouse drag (right button or Ctrl) or two-finger gesture; buttons Flat, Tilt 60 and North up; with terrain tiles configured, a **3D terrain** checkbox and a height slider (0.5x to 4x). Saved in the browser (`ahm-view3d`).
- **River size** slider (More > Maps & base map > Rivers, 0.5x to 4x, saved in the browser): widens the rivers you added (`river: true` shapes) and, above 1x, the rivers of the base map (one extra line layer; they cannot be selected or filtered). Scope "selected / filtered" is T-064.
- Optional **Map + relief** entry: hillshade from elevation tiles the owner builds and hosts (Copernicus DEM; docs/10 "Relief layer"). Hidden until `basemap.terrain.tiles` is set. The credit of the terrain data is shown as plain text under the base-map list while relief is on. `basemap.terrain.bounds` (own tiles only) limits tile requests to the built area; the AWS default has none. The ramp follows the heights in view (`color.adapt`, default on); `color.blend: false` (checkbox "Smooth colour transitions") draws flat colour bands with sharp edges instead of the gradient. With `basemap.terrain.color` (default in `config.js`) the relief is also **coloured by height** (ramps in metres: Armenia, classic, rainbow, viridis, grayscale; own ramps in the config), with controls under the base-map list (colour and shading on/off, ramp, two strength sliders), a legend in metres and the **height in metres under the mouse**; the colours **adapt to the heights in view** when you zoom or move (switch "Adapt colours to the view" off for fixed metres; "Smooth colours" makes them slide instead of jump). The controls are in the sidebar (More > Maps & base map), with a **ramp editor**, **contour lines** (automatic or fixed step, labelled every 5th line) and a **height profile** (click points on the map; length, min, max, ascent, descent and a chart). Settings are kept in the browser (localStorage `ahm-relief`). Needs MapLibre 5.6 or newer (5.24.1 is loaded).
- Layer toggles for **Water, Roads, Places, Boundaries** of the base map.
- **One symbol per place type**, different in shape and colour, also shown in the list and on the filter chips. The types are a dictionary (13 at the start): administrators add markers such as iron mine, cedar forest or sword artefact in More → Types (names, colour, symbol, size, live preview); see [Types](#types-places-lines-and-areas). The same dictionary holds the **line types** (routes) and **area types** (borders): pattern, width, opacity, one-way arrows, fill.
- Permanent **name labels** next to the symbols. They use a font the base map already provides and have their own data source, so a font problem can never hide the symbols.
- Hover popup with the name, type and dates. Click a symbol to open the place.
- Click anywhere on the map to get a point card with its coordinates and the name of the base-map feature under it, with the actions **Add place here**, **Directions from here** and **Directions to here**.
- Satellite imagery and labels switch to light text with a dark outline when the satellite layer is active.

### Search, filters and lists

- One search box over **all names** of every place (any language, any script, accent-insensitive) and the **full text of the notes**, with the matching part highlighted. A ✕ button (and Esc) clears it.
- Filters: place **type** (chips with counts), **language**, and a **period** (From / To, each a date field as described under [Dates](#dates)). Places that existed in the period are shown; places with no known dates are hidden while a period is set. A counter shows how many filters are active, and **Reset** clears them all.
- Sorting A–Z or by date, and **Fit map** to the current results.
- Search for **other places** (towns, villages and so on that are not in our data) through Nominatim. It runs only on Enter or a button, never while typing, and results are cached and throttled (see [Licences](12-licences-of-the-data-and-services.md)). The search is limited to the map area `bbox` (Mesopotamia from the Persian Gulf to the Caucasus, Ankara to Baku: west 32, south 29, east 51, north 44); places outside it are not found. The relief tiles are requested only inside the same box.
- Permanent link to a place: `#place-<id>` in the address.

### Places

- **Several names per place, also several in one language.** The first name of each language is the one shown on the map. Names can be reordered and removed.
- Place **type** and two optional dates (**began** and **ended**). A **mountain** has an optional **height in metres** instead of dates.
- Every date is **optional** and is entered the same way everywhere (see [Dates](#dates)): unknown, exact, approximate or a range, in a format the person chooses.
- **Edit a place:** drag a red pin on the map (or type coordinates) to move it, and change names, type and dates. The old symbol is hidden while editing, and each save keeps a copy of the previous file.
- Add a place by clicking the map.

### Notes

- Any number of notes per place, **also several in one language** (for example one English note per century).
- Each note has a language (chosen from the dictionary), title, an optional date and text. Notes are sorted by date (undated last) and can be edited.
- Notes are stored one per file and loaded only when a place is opened.

### Historical map images (overlays)

- Administrators add an image (PNG, JPEG, WebP, up to 12 MB). Large scans are shrunk to 4096 px in the browser first.
- The image is pinned to the map by **four corners**: drag the red squares to stretch or fit it, the blue dot to move it, and use the sliders to rotate and scale it.
- Per image: title, default **opacity**, and a **zoom range** (shown from one zoom level up to another, with "= now" buttons).
- Every visitor can hide an overlay and change its opacity for themselves. Overlays can be edited and deleted (a copy is archived).

### Directions

- Car directions between any two points or places, with distance and time, swap and clear. The route is drawn on the map.

### Sidebar and page

- Five tabs: **Explore**, **Borders**, **Routes**, **Layers**, **More**. More holds three folds: **Maps & base map** (base map toggles, historical map images), **Directions**, **Languages**. Calling `tab('route')` (etc.) opens the right fold.
- **Sheets, not view swaps:** a place or a layer opens as a *sheet* over the list (back button on top, actions in a sticky bar at the bottom). The list underneath keeps its scroll position and filters. A place opened from a layer sheet lies on top of it, so Back returns to the layer. Clicking a tab or typing in the search box leaves the sheet.
- **Filters:** closed by default; whatever is active (types, language, period, layers) is shown as removable chips under the Filters line.
- **Buttons:** one language everywhere: default (secondary), `primary` (the one main action of a view), `danger`, `back`.
- The sidebar can be **collapsed**, **resized** by dragging its edge (double-click resets, arrow keys nudge) and the size is remembered. On narrow screens it becomes a bottom sheet.
- Colours follow the forum style "paper-and-pencil".

### Layers (thematic subsets)

- The **general layer** is everything: every place with every note. It is not stored. A **layer** is a named subset of it, for example "Military campaigns of Hammurabi". A place is never removed from the general layer; it can be in many layers.
- A layer has names and descriptions in dictionary languages, **one optional category**, an optional **colour**, an optional **date range**, its own **notes** and an **ordered** list of places (the order is kept for future route lines; there is no ordering interface yet).
- **Routes tab:** historical routes (trade, military, migration, journey, road). A route is a line through places and free waypoints; a place is a *stop* when a point of the line sits on it. A person draws it on the map (click A, the points, B; a click on a place marker makes that place a stop; optionally the line follows modern roads between the clicks, OSRM), then gives names, type, direction (one-way routes are drawn with arrows) and dates. Routes that share a stop chain into journeys: **Find a path** between two places gives the shortest chain and alternatives. Same layers and period filter as borders.
- **Rivers tab:** rivers are shapes of a `river` type (a line without stops, not used by route path finding). The tab is the Borders panel in its own mode: its own list, filters and types, the same card (colour, opacity, width slider, label, dates, source, notes), layers and period filter. *Find rivers* searches OpenStreetMap by name and shows several rivers on the map without saving them (no Add button). *+ Draw a river* is the line tool with "Follow a river between the points I click": after the first click every click adds the points of the river between it and the previous one (like "follow modern roads" for routes). With no river found yet, the tool reads the name of the river under the clicks from the base map and finds it on OpenStreetMap. Finish keeps only the points of the river and opens the form with the first river type.
- **Select rivers** (Rivers tab, T-057): "Select by rectangle" (drag a box on the map; Esc cancels) and "Select by area" (type a name of an area shape, any language, old names too) add every river that touches or crosses it, the ones you added and the named rivers, canals and streams of the base map that are loaded in the view (zoom to the area first; unnamed ones are left out); the switch "only fully inside" takes only rivers wholly inside. Each addition keeps the earlier ones. The list has a cross per river and Clear; "Show only these" hides the other rivers on the map; "Zoom to the selection"; the selected rivers glow on the map. The selection is kept for the session only. Not yet: "Make bolder" (T-064), "Add to a layer" (T-065).
- **Borders and routes** have notes too (title, language, optional date, text), written and read in the card of the border (Borders tab) or route (Routes tab). They are stored with the layer notes. Editors add and edit them.
- **Layers tab:** search layers, filter by category, **Only** (show just the places of the layer; several layers = OR) and **Hide** (NOT IN). The active filters are chips in Explore → Filters and are cleared by Reset. A layer detail view shows its places, notes, **Fit map**, and for editors **Add note**, **Edit layer**, **Choose places**. The period filter does not look at layers.
- **Choose places:** click places on the map or tick them in a list; nothing is saved until **Save places** (one request). Members get a ring on the map. There is no box-select.
- **Place details** list the layers of the place (editors can add or remove). **Notes** can be tied to layers (tick boxes in the note dialog). In the general view all notes show; with a layer open, or an "Only" filter, only the notes tied to those layers show (link "Show all notes").
- A new place added while a layer is open joins General and that layer (ticked in the dialog).
- **Categories** are a dictionary like languages: administrators add and rename (names in several languages); none are deleted. Editors create layers, edit places and write layer notes; administrators delete layers.

### Languages

- Every name and every note uses a language chosen from a **dictionary of languages**. There is no free text.
- The **Languages** tab lists the dictionary. **Only administrators add a language** (code, name in English, optional native name). Everybody else sees a hint: if a language is missing, ask an administrator.
- Languages cannot be renamed or removed in the interface, so no name or note can lose its language.

### Access

- **Guests** can look at everything. **Members** (or only administrators, by setting) can add and edit places and notes. **Administrators** manage the historical map images.
- A "Map" entry is added to the forum's **Quick links** menu.

### Data safety

- Every change keeps the previous version in `archive/`; files are written atomically and under a lock; nothing is ever deleted without an archived copy.
- Notes saved by older versions of the extension are converted automatically.

---
