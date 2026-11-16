<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-3 Core functions. Provider: **core**. Consumers: **sidebar**, **map**, **data's** dev tools

The names and argument lists below are stable. Core never reads the DOM or the map.

- **Dates** (`dates.js`): `isoToSec`, `secToIso`, `dateToTs`, `dateFromTs`, `dateClean`, `dateUpgrade`, `dateBounds`, `spanBounds`,
  `dateKey`, `dateOrderCheck`, `dateText`, `spanText`, `periodEndSec`, `datePeriodEnd`, `legacyToDate`, `DATE_FORMATS`; **[1.10]** the time slider (T-040): `visibleAt(item, at)` (`at` in seconds; `'yes'`, `'faded'`, `'no'` or `'undated'`), `timeSpan(items)` (`[start, end]` in seconds or `null`), `timeAdvance(at, speed, dtMs, end)` (`{ at, done }`).
  Same results as `service/dates.php` (tests: `tests/fixtures/dates-vectors.json`).
- **Loading and naming** (`data.js`): `getJSON`, `loadPlaces`, `loadNotesIndex`, `loadNoteBody`, `loadLayers`, `loadLayerNotes`,
  `loadCategories`, `loadLanguages`, `esc`, `norm`, `label(place, lang)`, `langName(code)`; **[1.5]** `loadTypes`, `typeLabel(type, lang)` (I-8), `loadShapes` (I-9). Everything printed into HTML goes
  through `esc`.
- **Filtering** (`search.js` and the filter rules of `layers.js`): `run(options)` (the filtered, sorted places; `options = { q, lang, sort, period }`: `q` search text, `lang` language code or `''`, `sort` `'name' | 'date'`, `period` = `[start, end)` in seconds or nulls; types and layer filters stay in `state` and `lyState`), `byDateKey`,
  `periodBounds`, `periodActive`, and the layer rules (`layerAllows`, `lyScope`, `lyHalo`, `lyNoteVisible`; **[1.10]** `timeLook(item)` (`'yes'`, `'faded'` or `'no'` at the moment of the time bar, `'yes'` while it is off) and `timeActive()`; **[1.5]** `layerAllowsShape(id)`, I-9).
