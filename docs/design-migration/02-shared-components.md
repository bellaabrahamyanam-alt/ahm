# 02 Shared components

Status 2026-11-23, branch `feat/shared-foundation-tasks`. All JS tests pass (313), including 9 real-browser tests (headless Chromium, daisyUI and MapLibre served from npm copies; the map is the stand-in of `browser.test.js`, so map drawing is not exercised). Layout was checked by screenshots at 420 px and 1100 px against the prototype; no human has reviewed the look yet.

**Update 2026-11-24 (owner):** the direction changed to daisyUI components and static HTML first (`03-work-plan.md`, "Direction"). Everything below describes the foundation as built: components that return HTML strings. They stay while old screens use them and are replaced by `<template>` cloning and daisyUI classes as each screen is rebuilt. The paragraph "no daisyUI component classes are applied" below is the old state.

**daisyUI.** The CDN stylesheet is used for tokens and the theme only; no daisyUI component classes are applied to app controls. Reason (found in the browser, fixed): daisyUI owns the class names `stack`, `label`, `tabs`, `badge`, `sm`. `.stack` broke the whole panel layout (the list collapsed to 20 px), so the app's `.stack` is now `.pane`; `.label`, `.tabs`, `.badge` are reset at the end of `sidebar.css`. **New class names must not collide with daisyUI** (check: classes in `daisyui.css` vs yours); new shared blocks use prefixes `ui-`, `ft-`, `st-`, `df-`.
Stored data never changes. Deviation from `tasks/foundation.md` F3: it names the name value `{ lang, text, from, to }`; the real model, kept, is `{ lang, name, date_from, date_to }`. Components are plain functions that return HTML text and read from the DOM they made (the existing pattern), not `{el, get, set}` objects.

## Ready / not ready
| Component | File | Interface | Status |
|---|---|---|---|
| Tokens, daisyUI theme | `app/css/base.css`, `index.html:11` | CSS custom properties `--r-card --r-ctl --font-ui --font-serif --shadow-card --transition`; theme `paper-and-pencil` | READY (CDN look unverified) |
| App shell | `index.html`, `layout.js`, `sidebar.css` | brand header, icon tabs, `#foot` slot under every tab | READY; daisyUI classes on buttons, inputs, sheets NOT done |
| States | `components.js` | `uiState.html(kind, msg, retry)`; kind = loading, empty, error, readonly; `[data-retry]` reloads | READY; used for load and load error in `ui.js`; read-only state is a block only, no tab uses it yet |
| Date editor | `datefield.js`, `components.js` | `uiDateEditor.html(cls, date, opts)`, `.read(el, what)`, `.check(el, what)`, `.safe(el)`, `.wire(root)`, `.preview(date)`; `uiDateFormatGroups()` | READY: segmented mode, format chip with the grouped popup (s47; the hidden `select.df-fmt` still holds the value), era toggle, preview on the right; browser-tested |
| Period footer | `period.js`, `#foot` | `ftRender(force)`; Period reads/writes `#fFrom` `#fTo`; `periodBounds()`, `periodActive()` unchanged | READY, browser-tested (handle sets the filter, cross resets); hidden while a form with its own Save bar is open in the dock; last item of the panel (under the dock) |
| Moment footer | `period.js`, `timebar.js` | state `time` (`AHM.state`), `tbOpen()`, `tbOff()`, `tbPlay(on)`, `tbTick(ms)`, `tbPatch(p)`; old bar and "Time" button removed | READY, browser-tested. Known: `tbOpen()` starts at the first year of the data, so the list is empty at first (prototype starts mid-span, s22); explore decides |
| Histogram | `components.js` | `uiHistogram(items, lo, hi, n)` -> counts; undated not counted | READY, tested |
| Language pills | `placeform.js` | `uiLanguagePills(cur)`; value holder `select.nl` (visually hidden) | READY in every name row (places, borders, routes, rivers, layers, types, categories via `pfRow`); notes and filter language selects unchanged |
| Name list | `placeform.js` | `pfRow(n)`, `pfRowDated(n)`, `pfReadNames(root)`, `placeFormWire(root)` (add, up, remove), `pfPeriodText(a, b)`; `.pf-name .nl .nn .pf-add .pf-del .pf-up` classes kept | READY: pill card, Period row with clock, "Period: unknown / text" and Set / Edit / Done (s28; a `<details>` underneath) |
| Type pills | `placeform.js` | `uiTypePills(items, cur)` items `[{code,label,icon}]`; value holder `select.pf-type` or `select[data-type-select]`; `placeTypePills(cur, lang)` | READY for the place form; borders, routes, rivers, type admin still use their own chips/selects: the screen worker switches them to `uiTypePills` |
| Style editor | `components.js` | `uiStyleEditor.html(kind, color, style, symbols)`, `.read(root)` -> `{ color, style }`; kind = point, line, area, river | READY, unit tested; NOT wired into `admin.js` or the shape cards (workers `more`, `borders`, `routes`, `rivers`) |
| Chips, add button, accordion | `components.js` | `uiChip(text, {on,count,removable,icon,data})`, `uiAdd(label, cls)`, `uiAccordion(id, icon, title, sub, body, open)` | READY, tested for escaping; not used by any tab yet |
| List row, note, form frame | `components.js` | `uiRow({icon,title,sub,count,on,attrs})`, `uiNote(n, {id, actions})` (clamp + Show more), `uiForm(title, body, {save,cancel})` with sticky bar (`data-act="save"` / `"cancel"`) | READY; not used by any tab yet (workers replace their own copies) |
| Confirm, toast | `components.js` | `await uiConfirm(msg, {ok, danger})` -> boolean (Escape = false); `uiToast(msg, kind, ms)`; offline / online toasts in `ui.js` | READY, browser-tested |

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
1. The shell has no read-only banner of its own: each tab already hints from `AHM_CONFIG.canEdit` / `loggedIn` (places.js, shapes.js); `uiState.html('readonly', ...)` is there for a screen that wants a block.
2. Several places still use their own type chips or selects (borders, routes, rivers, type admin) and the style controls of `admin.js` / the shape cards: workers switch them to `uiTypePills` and `uiStyleEditor`.
3. Notes and filter language choices are still selects (only name rows have pills).
4. Rem units: new CSS uses rem; the older tokens are px.
5. Narrow screens and a collapsed panel with the footer were checked once at 420 px only.
6. Visual review by the owner of s1, s2, s7, s22, s28, s47 is still to do.
