<!-- Section 5 of the project description; index: README.md -->

## 5. Data model

All data is plain files. There is no database.

### Identifiers

Every place, note and overlay has a **UUID** (version 4, or a fixed-seed version 5 for the sample data). It never changes and is the only thing that links records.

### Dates

One date model is used for places, notes and filters. It lives in `app/js/dates.js` (browser and dev server) and `service/dates.php` (forum server), which must stay in step.

A date is either **`null` (unknown)** or an object:

```json
{ "fmt": "dmy", "ts": "1500-03-21T00:00:00Z", "mode": "exact", "ts_to": null }
```

- **`mode`** says how sure the date is: `exact`, `approx` ("c. 800 BCE") or `range` (from `ts` to `ts_to`, both in the same format).
- **`fmt`** is the format the person chose. It is stored so the date is shown back exactly as it was entered: `ymd` (1500-03-21), `dmy` (21.03.1500), `mdy` (03/21/1500), `dmony` (21 March 1500), `mony` (March 1500), `y` (year), `c` (century), `m` (millennium).
- **`ts`** (and `ts_to`) is a **UTC time stamp in ISO 8601 / RFC 3339 text**, always ending in `Z`: the start of the period that was entered. A day is `T00:00:00Z` of that day, a month its 1st, a year 1 January, a century its first year (12th century BCE starts at 1200 BCE), a millennium likewise. With `fmt` and `ts` the original entry can always be rebuilt.
  - Years 0000 to 9999 are written with four digits, exactly as RFC 3339 requires (`1500-03-21T00:00:00Z`).
  - Outside that range the ISO 8601 **expanded year** is used: a sign and six digits. This covers every BCE date, because ISO 8601 numbers years astronomically (year `0000` is 1 BCE, so 1200 BCE is `-001199-01-01T00:00:00Z`, 782 BCE is `-000781-…`) and everything after 9999 CE (`+010000-01-01T00:00:00Z`). RFC 3339 itself has no such years, so these values are ISO 8601 only; JavaScript's `Date.parse` and most ISO 8601 libraries read them.
  - Only this one spelling is accepted: UTC `Z`, whole seconds, midnight for a period start, no offsets (`+00:00`), no lower-case `z`, no `+000500` for 500 CE. Anything else is refused by the server.
  - **Compare time stamps as instants, not as text.** Alphabetical order is wrong among BCE years (`-000781` sorts before `-001199`). The code converts to seconds first (`isoToSec` / `iso_to_sec`).
- A century or millennium covers its whole length: for filtering, "5th century" means 401 to 500 CE, and a range runs to the end of its last period.
- Calendar: proleptic Gregorian with year numbering 1 BCE, 1 CE (no year 0 for people; years 1 to 99999 either side). Julian dates are not converted: enter them as written.
- The server checks that `ts` really is the start of a period of the chosen format, that a range ends after it starts, and that a place does not end before it begins.

### Types (places, lines and areas)

`types.json` is the dictionary every place, border and route type is chosen from, like languages and categories. Only administrators add, change or remove a type (More tab, "Types"). A place, border or route points to a type by its `code`.

```json
{
  "version": 1,
  "types": [
    { "code": "iron-mine", "geometry": "point",
      "names": [ { "lang": "en", "name": "Iron mine" } ],
      "color": "#a0522d", "style": { "symbol": "pickaxe", "size": 9 } }
  ]
}
```

- `code`: 1–32 characters `a-z 0-9 _ -`, unique, made by the server from the English name of a new type (`Iron mine` → `iron-mine`, `iron-mine-2` when taken) and never changed. (`_` is allowed only because `inscription_site` existed before.)
- `geometry`: `point` (a marker of a place), `line` (a route) or `area` (a border); fixed at creation. Only point types can be given to places; only line and area types to shapes.
- Line style: `{ width 1..12, pattern, opacity 0.1..1, arrow }` (`arrow: true` = a one-way route, drawn with arrows). Area style: `{ fill_opacity 0..0.8, outline: { width, pattern, opacity } }` (the fill uses `color`). `pattern`: `solid`, `dashed`, `dotted`, `dashdot`, `double` or `triple` (the map draws the first four; the others are drawn solid for now, T-033; the Types form offers the four).
- The 11 shape types that existed before are `country`, `kingdom`, `region`, `district`, `territory`, `disputed` (areas) and `trade`, `military`, `migration`, `journey`, `road` (lines). A `types.json` without any line or area type offers them (seed in `store.php` and `save-handler.js`) and writes them with its next change.
- `names`: one or more `{ lang, name }`, languages from the languages dictionary; a new type needs an English name.
- `color`: `#rrggbb`. `style.symbol`: a slug (`circle`, `ring`, `square`, `diamond`, `triangle`, `hexagon`, `pentagon`, `star`, `plus`, `drop`, `bar`, `tree`, `sword`, `pickaxe`, `flag`; an unknown slug is drawn as a circle). `style.size`: 4–14 (marker radius, default 8).
- **Custom symbol:** `style.symbol` = `custom` with `style.path` (SVG path data: drawing commands and numbers only, starts with `M`, 2–20000 characters) and `style.box` (side of the square the path is drawn in, 8–2048, default 24; 512 for game-icons.net). The map draws the path in the type's colour; a browser without `Path2D` draws a circle. No markup, no scripts and no images are ever stored. The `path` and `box` of a type whose symbol is not `custom` are dropped.
- The server refuses a place whose type is not a point type of the dictionary. A type that some place or shape uses cannot be removed (the answer says how many places and shapes use it), and `mountain` is never removed (a mountain has a height, not dates).
- If the file does not exist yet (an update), it is created with the 13 types that existed before: `settlement`, `city`, `town`, `village`, `fortress`, `temple`, `tomb`, `inscription_site`, `monument`, `mountain`, `lake`, `river`, `region` (seed `TYPES` in `store.php` and `save-handler.js`).
- The browser draws every marker from the dictionary (`AHM.map.setTypes`); no list of types is kept in the code any more.

### `places.geojson`

A GeoJSON `FeatureCollection` of points. It opens directly in QGIS or any GeoJSON tool.

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [44.7306, 40.1119] },
  "properties": {
    "id": "e7d52492-2313-5972-a766-3f1ef6a47a5d",
    "label": "Garni",
    "type": "temple",
    "date_from": { "fmt": "y", "ts": "-000799-01-01T00:00:00Z", "mode": "approx", "ts_to": null },
    "date_to": null,
    "height_m": null,
    "names": [
      { "lang": "hy", "name": "Գառնի" },
      { "lang": "en", "name": "Garni" },
      { "lang": "ru", "name": "Гарни" }
    ]
  }
}
```

- Coordinates are `[longitude, latitude]` (GeoJSON order).
- `names` may contain several names with the same `lang`. The first name of a language is the one shown. `lang` must be a code of the [language dictionary](#languages-1).
- `label` is derived (the first English name, or the first name). It exists only so GIS tools can label the points.
- `date_from` / `date_to` are [dates](#dates) or `null` (unknown). Both are optional. `date_to: null` means the end is not known (it no longer means "still exists").
- `height_m` is a whole number of metres (0 to 9000) or `null`, and only a **mountain** has one. A mountain never has dates; every other type never has a height.
- The file has `"version": 3`. Older files (version 1: dates as year numbers with `date_from_text` and `approx`; version 2: time stamps as whole seconds) are converted automatically, see [Updating](#updating).

### Notes

One Markdown file per note: `notes/<place-id>/<note-id>.md`, with a small header.

```
---
id: 76c418bc-e40a-5489-9457-ab0754a33b68
lang: ru
title: Разрушение
date: {"fmt":"c","ts":-37881820800,"mode":"exact","ts_to":null}
---
Text of the note, in Markdown or plain text.
```

The `date:` line is one line of JSON in the [date model](#dates) and is **left out when the date is unknown**. Notes are linked to a place by the folder name only; a place does not list its notes.

### `notes/index.json`

Generated from the note files after every save. It holds `id`, `place`, `lang`, `title`, `date` (or `null`) and the full `text` of every note. The browser loads it once to search inside notes. The `.md` files are the source of truth; the index can always be rebuilt (`dev/build_notes_index.py`, or any save).

### Layers and categories

`categories.json`: `{ "version": 1, "categories": [ { "id": "<uuid>", "names": [ { "lang", "name" } ] } ] }`.

`layers.json` (one file for all layers; chosen over one file per layer because the list is small and is read whole):

```json
{ "version": 1, "layers": [ {
  "id": "<uuid>", "names": [ { "lang": "en", "name": "Urartian fortresses" } ],
  "descriptions": [ { "lang": "en", "text": "…" } ],
  "category": "<category id>" , "color": "#9a3b2e",
  "date_from": null, "date_to": null,
  "members": [ { "place": "<place id>" } ],
  "created": "2026-11-04T10:00:00Z", "updated": "2026-11-04T10:00:00Z" } ] }
```

`members` is **ordered**; keep that order. `category`, `color` and the dates may be `null`.

Layer notes are `layer-notes/<layer-id>/<note-id>.md`, same header as place notes (`id`, `lang`, `title`, `date`); `layer-notes/index.json` is generated (`id`, `layer`, `lang`, `title`, `date`, `text`).

The same folders and index also hold the notes of a **border or route** (a shape): the folder is named with the shape id and the `layer` field of its index entries holds that id (UUIDs never clash). Deleting the shape moves its notes to `archive/` (`layer-note-<shape-id>-<note-id>.md`) and out of the index.

A **place note** may carry an extra header line `layers: <id>,<id>` and its `notes/index.json` entry has `layers: []`. A note can only be tied to layers the place belongs to. Taking a place out of a layer, or deleting a layer, removes the tags from the notes (the changed notes are archived first). Every change archives the old file.

### `shapes.geojson` (borders and routes)

A GeoJSON `FeatureCollection`; every feature is one **border** (an area, `Polygon` or `MultiPolygon`) or one **route** (a line, `LineString` or `MultiLineString`). Properties: `id` (UUID), `names` (`[ { lang, name } ]`), `type`, `color` (`#rrggbb`), `opacity`, `label` (boolean), `date_from`, `date_to` (the [date model](#dates)), `source`, `created`, `updated`. `type` is the code of a **line or area type** of the types dictionary: a shape of a line type is a route and must be a line (`a route must be a line`), a shape of an area type is a border; a place (point) type is refused (`unknown border type`). Only routes have two more fields: `stops` (the ids of the places the line passes, in order, at most 60, every id an existing place: `unknown place among the route stops`) and `twoway` (boolean: usable both ways; a one-way route is drawn with arrows). Both are optional; absent means unchanged when saving. Routes that share a stop chain into journeys (`core/routes.js`). Layers list a shape in `members` (`shape` instead of `place`). The rules are in `service/store.php` and `dev/save-handler.js`.

### Languages

`languages.json` is the dictionary every name and note language is chosen from:

```json
{
  "version": 1,
  "languages": [
    { "code": "en", "name": "English", "native": "English" },
    { "code": "hy", "name": "Armenian", "native": "Հայերեն" }
  ]
}
```

- `code` is 2–8 letters, lower case, unique. It is the value stored in names and notes. `native` may be empty.
- The server refuses a place name or a note whose language is not in the file. Only administrators can add a language.
- If the file does not exist yet (an update from an older version), it is created from the languages already used in the data, with a short built-in list of names (`en`, `hy`, `ru`, `tr`, `la`, `xur`).

### Historical map images

`overlays.json`:

```json
{
  "version": 1,
  "overlays": [
    {
      "id": "…",
      "title": "Big Hayk regions",
      "file": "<id>.png",
      "coordinates": [
        [40, 41],
        [46, 41],
        [46, 37],
        [40, 37]
      ],
      "minzoom": 4,
      "maxzoom": 9,
      "opacity": 0.5,
      "created": "2026-11-04T08:13:00Z",
      "updated": "2026-11-04T08:13:00Z"
    }
  ]
}
```

- `coordinates` are the four corners **in this order: top-left, top-right, bottom-right, bottom-left**, as `[lon, lat]`.
- The image is visible from `minzoom` **up to but not including** `maxzoom`.
- The image files are in `overlays/<id>.<png|jpg|webp>`.

### `archive/`

Before any file is replaced or an image deleted, the old version is copied here with a time stamp in the compact ISO 8601 "basic" form, local server time, which is safe in file names (`places-20261103-101500.geojson`, `note-<place>-<note>-….md`, `overlay-…`, `languages-….json`, and `legacy-…` / `…-before-dates…` copies made by the migration). Nothing in `archive/` is ever read by the application. It is the undo history, to be restored by hand.

---
