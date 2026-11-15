<!-- Section 6 of the project description; index: README.md -->

## 6. HTTP interface

In the forum every address is below `…/app.php` (for example `https://forum.example/app.php/map`), or without `app.php` when URL rewriting is on.

| Address                    | Method | Who      | Purpose                                               |
| -------------------------- | ------ | -------- | ----------------------------------------------------- |
| `/map`                     | GET    | everyone | The page.                                             |
| `/map/data/places`         | GET    | everyone | `places.geojson`.                                     |
| `/map/data/notes-index`    | GET    | everyone | `notes/index.json`.                                   |
| `/map/data/overlays`       | GET    | everyone | The overlay list.                                     |
| `/map/data/languages`      | GET    | everyone | The language dictionary.                              |
| `/map/data/layers`, `/map/data/layer-notes-index`, `/map/data/categories`, `/map/data/types` | GET | everyone | Layers, layer notes index, categories, place types. |
| `/map/note/{place}/{id}`   | GET    | everyone | One note, as Markdown.                                |
| `/map/overlay/{id}`        | GET    | everyone | One overlay image.                                    |
| `/map/save`                | POST   | editors  | Add a place, edit a place, add or edit a note (JSON). |
| `/map/language-save`       | POST   | admins   | Add a language (JSON `{ code, name, native }`).       |
| `/map/layer-save`          | POST   | editors  | Create or change a layer; change its places; add or edit a layer note (see below). |
| `/map/layer-delete`        | POST   | admins   | Delete a layer (JSON `{ "id": … }`; archived first). |
| `/map/data/shapes`         | GET    | everyone | `shapes.geojson`: borders and routes.                 |
| `/map/shape-save`          | POST   | editors  | Add or change a border or a route (JSON; a route may have `stops` and `twoway`). |
| `/map/shape-delete`        | POST   | editors  | Delete a border or a route (JSON `{ "id": … }`; archived first; its notes are archived with it). |
| `/map/category-save`       | POST   | admins   | Add or rename a category (JSON `{ id?, names }`).     |
| `/map/type-save`           | POST   | admins   | Add a type, or with `edit: true` change one (JSON `{ code?, edit?, geometry: "point" \| "line" \| "area", names, color, style }`; the style depends on the geometry, see `docs/05`; answers `{ ok, code }`). |
| `/map/type-delete`         | POST   | admins   | Remove a type nobody uses (JSON `{ code }`; 400 with the number of places and shapes otherwise). |
| `/map/overlay-save`        | POST   | admins   | Create or update an overlay's settings (JSON).        |
| `/map/overlay-upload/{id}` | POST   | admins   | Send the image bytes (`Content-Type: image/*`).       |
| `/map/overlay-delete`      | POST   | admins   | Delete an overlay (JSON `{ "id": … }`).               |

Read routes answer with `Cache-Control: private, no-cache` and an `ETag`, so browsers always check but unchanged files cost only a short "not modified" reply.

**`/map/save` accepts one of three bodies:**

```jsonc
// new place (optionally with its first note)
{ "place": { "lat": 39.7, "lon": 44.3, "type": "mountain", "names": [{"lang":"en","name":"Ararat"}, {"lang":"en","name":"Masis"}],
             "height_m": 5137 },
  "note":  { "lang": "en", "title": "…", "date": { "fmt": "c", "ts": -37881820800, "mode": "exact", "ts_to": null }, "text": "…" } }
// (a place that is not a mountain sends "date_from" and "date_to" instead of "height_m"; each is a date object or null)

// change a place (its id never changes)
{ "place_update": { "id": "…", "lat": …, "lon": …, "type": "…", "names": […], "date_from": …, "date_to": …, "height_m": … } }

// add a note, or edit one (give "id" inside "note")
{ "place_id": "…", "note": { "id": "…", "lang": "…", "title": "…", "date": …, "text": "…" } }
```

`/map/save` also accepts `layer_ids: [...]` (or `layer_id`) next to a new `place` (the place joins those layers) and `note.layers: [...]` (omit on edit to keep the tags).

**`/map/layer-save` accepts one of:** `{ "layer": { "id"?, "names", "descriptions", "category", "date_from", "date_to", "color" } }`, `{ "layer_members": { "id", "add": [...], "remove": [...] } }`, `{ "layer_note": { "layer_id", "note": { "id"?, "lang", "title", "date", "text" } } }`. `layer_note.layer_id` may also be the id of a border or route; an id that is neither is 400 "unknown layer or border".

Answers are JSON: `{ "ok": true, "id": "<place id>" }` or `{ "error": "<readable message>" }` with status 400 (bad input), 401 (not logged in), 403 (not allowed), 415 (wrong content type) or 500.

**In development** the same operations are served by `dev/save-handler.js` at `/api/save`, `/api/language/save`, `/api/overlay/save`, `/api/overlay/upload/{id}` and `/api/overlay/delete`, `/api/layer/save`, `/api/layer/delete` and `/api/category/save`, with no login. The data and images are plain static files under `/data/`.

---
