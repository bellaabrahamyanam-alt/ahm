# 02 Shared components

Contract in `tasks/foundation.md` (F3). All live in `app/js/sidebar/components.js`; each returns `{ el, get(), set(v), validate() }`, takes `onChange`, escapes through `esc()`. Stored values never change (`AGENTS.md`).

## Inventory
| Component | Prototype helper | Frames | Today in the app (reuse, do not duplicate) | Status | Users |
|---|---|---|---|---|---|
| App shell + tabs | header, tabs | s1 | `index.html`, `layout.js` | built (F2 partly) | all |
| `dateEditor` | `dateF` | s2 s7 s28 s33 s34 s46 s47 s48 | `datefield.js` (`dfHTML`, `dfRead`, `dfSafe`, `dfWire`) via `uiDateEditor` | built; format menu is a native select | explore, borders, routes, layers, notes |
| Date format menu | menu | s47 | native grouped `<select>` | NOT built (custom popup) | dateEditor |
| `periodField` (filter) | `pfoot`, Filters From/To | s1 s2 s45 s49 | `period.js` (13 lines), `fFrom`/`fTo` | NOT built | explore, footer |
| Period footer + histogram | `pfoot` | s1 s2 s3 s45 | none (histogram is new) | NOT built | every tab |
| `momentField` + footer | `mfoot` | s22 s49 | `timebar.js`, `#tbOpen`, `#timebar` | NOT built | every tab, notes, layers |
| `nameList` (+ name period) | `nameRow` | s7 s28 s33 s34 s41 s43 s44 s20 | name list in `placeform.js`, cards in `shapes.js` | NOT built | places, borders, routes, rivers, layers, categories, languages types |
| `languageSelect` (pills) | pills | all name frames, s46 | `<select>` in several places | NOT built | nameList, notes, filters (select stays) |
| `typeSelect` | `typePills`, `shapePills` | s7 s20 s33 s34 s2 | `PLACE_TYPES`, `RIVER_TYPE_LIST`, `BORDER_TYPES`, route chips | NOT built | places, borders, routes, rivers |
| `styleEditor` | `colr`, `symT`, `patT`, sliders | s20 s43 s44 | `admin.js` type admin, `shapes.js` card | NOT built | types admin, borders, routes, rivers, layers (colour) |
| Form frame (`fld`, `ffoot`) | `fld`, `ffoot` | s7 s20 s33 s34 s41 s43 s44 s46 | per-screen markup | NOT built | all forms |
| Accordion card (`sel`/fold) | accordion | s19 s21 s41 | `<details class=fold>` | NOT built | more, filters, finder |
| Chips / filter bar | chips | s2 | `.chips` | NOT built | explore, borders, routes, rivers, layers |
| Add-another dashed button | add | s3 s7 s19 s21 | `button.wide`, plain buttons | NOT built | many |
| Note timeline card | note | s3 s45 s46 | `places.js` | NOT built | places, borders, routes, layers |
| Search field | search | s1 | `searchfield.js` | exists, restyle | explore, borders, routes, layers |
| List row | row | s1 s22 | `places.js`, `shapes.js`, `routes.js`, `layers.js` | NOT built (4 copies) | list tabs |
| Empty / loading / error / read-only state | none | none | ad hoc | NOT built, no frame | all |
| Confirm dialog, toast | none | none | `confirm()` / inline | NOT built, no frame | all destructive actions |

## Rules for the skill's coordinated parts
- **Date editor**: BCE/CE, Exact/Approx/Range/Unknown, formats, validation, preview. Never a bare `<input type=date>`.
- **Period and Moment**: Period = range, Moment = one date + play; one footer slot; Period is paused, not lost, while Moment is on; ✕ on Moment restores the previous Period.
- **Language and name editors**, **type and style selectors**: one implementation, read the dictionaries (`languages.json`, `types.json`); no free-text language; the place-type list stays in 3 places (`PLACE_TYPES`, `TYPE_STYLE`, `store.php`/`save-handler.js`).

## Dependency order
`tokens (F1)` -> `shell (F2)` -> `form frame + chips + add button + accordion` -> `dateEditor menu` -> `periodField/footer/histogram` -> `momentField/footer` -> `languageSelect + nameList` -> `typeSelect + styleEditor` -> screens.

## Ownership
`components.js` single owner during F-work: the foundation agent. Screen agents only read it; a change request goes to the main agent. `sidebar.css` and `base.css`: foundation agent only. New per-screen css files need a line in protected `tools/domains.json` (needs `Approved:`).
