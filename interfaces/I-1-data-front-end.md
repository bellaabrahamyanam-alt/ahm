<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-1 Data ↔ front end (HTTP and files). Provider: **data**. Consumers: **core** (loading), **sidebar**, **map** (overlays only)

### Endpoints
The front end never builds URLs by itself; it reads them from `AHM_CONFIG.url` (set by `config.js` for the dev server, by the
forum controller through `window.AHM_BACKEND` in production). Names are fixed:

- Read (GET): `places`, `notesIndex`, `note(place, id)`, `languages`, `overlays`, `overlayImage(o)`, `layers`,
  `layerNotesIndex`, `categories`; **[1.5]** `types`, `shapes`.
- Write (POST, JSON unless noted): `save`, `languageSave`, `overlaySave`, `overlayUpload(id)` (multipart), `overlayDelete`,
  `layerSave`, `layerDelete`, `categorySave`; **[1.5]** `typeSave`, `typeDelete`, `shapeSave`, `shapeDelete` (`{ id }`; the sidebar deletes a border with it).
- Permission flags in config: `canEdit`, `loggedIn`, `loginUrl`, `canOverlay`, `canLanguage`, `canLayerAdmin`; **[1.5]** `canTypeAdmin`.
- Errors: HTTP 4xx with `{ "error": "<message>" }`; 400 for invalid input, 403 for no permission.

### Request bodies (the keys the front end may send)
- `save`: one of `place_add`, `place_update`, `note_add`, `note_update`, as implemented in `service/store.php`.
- **[1.10]** `names[]` entries of places and shapes (`placeSave`, `shapeSave`, and what the files hold) may carry `date_from` and `date_to` (date model objects, stored only when set; `date_to` before `date_from` is refused). Layers, categories and types do not take them (T-043).
- `languageSave`: `{ code, name, native, edit? }` (`edit: true` changes the names of an existing code; the code never changes).
- `layerSave`: `layer_add`, `layer_update`, `layer_members` (`{ id, add?, remove?, order? }`), `layer_note_add`,
  `layer_note_update`. `categorySave`: `{ id?, names: [{ lang, name }] }`. **[1.5]** `layer_members` also accepts `add_shapes` and `remove_shapes` (I-9); `typeSave` and `typeDelete` are described in I-8, `shapeSave` (`shape_add`, `shape_update`, `shape_delete`) in I-9.
- Exact validation rules: `service/store.php` = `dev/save-handler.js` = `tests/fixtures/rules.json` (one table, checked by tests).

### File formats (owned by **data**; the front end only reads them through `core`)
- `places.geojson`, `notes/index.json` + `notes/<place>/<id>.md`, `languages.json`, `categories.json`, `layers.json`,
  `layer-notes/index.json`, `overlays.json`; **[1.5]** `types.json` (I-8), `shapes.geojson` (I-9).
- Dates: `null` or `{ fmt, ts, mode: exact|approx|range, ts_to }`; every `ts` is ISO 8601 / RFC 3339 text in UTC with `Z`.
- Ids are UUID text. Names and descriptions are lists of `{ lang, name|text }`; `lang` comes from `languages.json`.
