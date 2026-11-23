# 02 Shared components

Status 2026-11-23, branch `feat/shared-foundation-tasks`. JS tests pass (310). NOT seen in a browser (CDN and browser blocked in the sandbox): look and layout are unchecked; behaviour is covered only by unit tests of the pure parts.
Stored data never changes. Deviation from `tasks/foundation.md` F3: it names the name value `{ lang, text, from, to }`; the real model, kept, is `{ lang, name, date_from, date_to }`. Components are plain functions that return HTML text and read from the DOM they made (the existing pattern), not `{el, get, set}` objects.

## Ready / not ready
| Component | File | Interface | Status |
|---|---|---|---|
| Tokens, daisyUI theme | `app/css/base.css`, `index.html:11` | CSS custom properties `--r-card --r-ctl --font-ui --font-serif --shadow-card --transition`; theme `paper-and-pencil` | READY (CDN look unverified) |
| App shell | `index.html`, `layout.js`, `sidebar.css` | brand header, icon tabs, `#foot` slot under every tab | READY; daisyUI classes on buttons, inputs, sheets NOT done |
| States | `components.js` | `uiState.html(kind, msg, retry)`; kind = loading, empty, error, readonly; `[data-retry]` reloads | READY; used for load and load error in `ui.js`; read-only state is a block only, no tab uses it yet |
| Date editor | `datefield.js`, `components.js` | `uiDateEditor.html(cls, date, opts)`, `.read(el, what)`, `.check(el, what)`, `.safe(el)`, `.wire(root)`, `.preview(date)`; `uiDateFormatGroups()` | READY except the format menu is a native grouped select, NOT the popup of s47 |
| Period footer | `period.js`, `#foot` | `ftRender()`; Period reads/writes `#fFrom` `#fTo`; `periodBounds()`, `periodActive()` unchanged | READY (drag and look unverified) |
| Moment footer | `period.js`, `timebar.js` | state `time` (`AHM.state`), `tbOpen()`, `tbOff()`, `tbPlay(on)`, `tbTick(ms)`, `tbPatch(p)`; old bar and "Time" button removed | READY |
| Histogram | `components.js` | `uiHistogram(items, lo, hi, n)` -> counts; undated not counted | READY, tested |
| Language pills | `placeform.js` | `uiLanguagePills(cur)`; value holder `select.nl` (visually hidden) | READY in every name row (places, borders, routes, rivers, layers, types, categories via `pfRow`); notes and filter language selects unchanged |
| Name list | `placeform.js` | `pfRow(n)`, `pfRowDated(n)`, `pfReadNames(root)`, `placeFormWire(root)` (add, up, remove); `.pf-name .nl .nn .pf-add .pf-del .pf-up` classes kept | READY (pill card look); name Period row is still a `<details>` "Period of this name", NOT the Set / Edit / Done row of s28 |
| Type pills | `placeform.js` | `uiTypePills(items, cur)` items `[{code,label,icon}]`; value holder `select.pf-type` or `select[data-type-select]`; `placeTypePills(cur, lang)` | READY for the place form; borders, routes, rivers, type admin still use their own chips/selects: the screen worker switches them to `uiTypePills` |
| Style editor | `components.js` | `uiStyleEditor.html(kind, color, style, symbols)`, `.read(root)` -> `{ color, style }`; kind = point, line, area, river | READY, unit tested; NOT wired into `admin.js` or the shape cards (workers `more`, `borders`, `routes`, `rivers`) |
| Chips, add button, accordion | `components.js` | `uiChip(text, {on,count,removable,icon,data})`, `uiAdd(label, cls)`, `uiAccordion(id, icon, title, sub, body, open)` | READY, tested for escaping; not used by any tab yet |
| List row, note card, form frame (sticky action bar), confirm dialog, toast | none | none | NOT BUILT; each is built once by the first worker that needs it and put in `components.js` after asking the main agent |

## Usage
```js
// date
$('#x').innerHTML = uiDateEditor.html('my-date', place.date_from, { names: { none: 'Unknown' } });
uiDateEditor.wire($('#x'));
const d = uiDateEditor.read($('#x .df'), 'Began');          // null or { fmt, ts, mode, ts_to }
// names (place, border, route, river, layer, type, category)
box.innerHTML = names.map(pfRowDated).join('');             // pfRow for rows without a period
const list = pfReadNames(box);                              // [{ lang, name, date_from?, date_to? }]
// type pills with a value holder
el.innerHTML = uiTypePills(items, cur) + '<select class="pf-type sr"></select>';
// style
el.innerHTML = uiStyleEditor.html('line', type.color, type.style);
const { color, style } = uiStyleEditor.read(el);
// states and blocks
list.innerHTML = uiState.html('empty', 'No places for this period.');
```
Period footer: nothing to call; it redraws on `state:time`, on changes of the Filters fields and after the data loads (`ui.js`). Do not add a second period or moment control.

## Rules for workers
- Read, do not edit: `components.js`, `base.css`, `sidebar.css`, `period.js`, `timebar.js`, `layout.js`, `ui.js`, the shell part of `index.html`. A needed change goes to the main agent.
- Language and type values always come from the dictionaries; the place-type list stays in three places (`AGENTS.md`).
- Period is paused, not lost, while Moment is on: the Filters fields are untouched; the existing filter code still applies a set Period while a Moment is on (behaviour as before F5; not changed here).

## Known gaps (not blocking the screen tasks)
1. Format menu popup (s47). 2. Name Period row Set / Edit / Done (s28). 3. daisyUI classes on buttons, inputs, sheets. 4. Read-only and offline states in the shell. 5. List row, note card, form frame, confirm, toast. 6. Rem units: new CSS uses rem; older tokens are px. 7. Footer on narrow screens and when the panel is collapsed: unchecked.
