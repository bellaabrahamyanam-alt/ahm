# 02 Shared components (v2: static HTML + daisyUI)

Replaces the v1 document. v1 (JS-string components, built 2026-11-23, 313 tests) stays working until v2 replaces it; it is listed at the end as "v1, to retire". Rules: `01-design-system.md` (The rule).

## How a component is made
- **Markup** = a `<template id="t-...">` (or a static element) in `app/index.html`, in the shared region `templates`, written with daisyUI classes. Binding points are `data-bind="name"` (text), `data-value="name"` (input value), `data-attr-...` is NOT used (set attributes in JS by name).
- **Binder** = `app/js/sidebar/kit.js` (new, foundation-owned), classic script, a few functions only:
  `kit.tpl(id)` clone; `kit.fill(el, { name: text, ... })` sets `[data-bind]` by `textContent` and `[data-value]` by `.value`; `kit.show(el, bool)` toggles `hidden`; `kit.on(root, event, selector, fn)` delegation; `kit.list(container, items, tplId, fn)` replaces children with clones (keyed by `data-id`, no re-creation of unchanged rows).
- **Behaviour** = one small script per component (`fields.js`, `footer.js`, `shell.js`, `dialogs.js`), each owned by the foundation.
- **Data** never enters markup except through `textContent`/`value`.

## Regions of `app/index.html` (each has one owner; edit only your own)
Markers: `<!-- ahm:region NAME -->` ... `<!-- /ahm:region NAME -->` (comments; the build and the PHP controller ignore them).
| Region | Owner | Holds |
|---|---|---|
| `head`, `shell`, `footer`, `dialogs`, `templates` | foundation | head links, header + tab bar + rail + sheet handle, Period/Moment footer, confirm modal, toast, shared templates |
| `tab-explore` + `tpl-explore` | explore | `<section id="tab-explore">` and its own templates (place card, note, filters, forms, point menu) |
| `tab-borders` + `tpl-borders` | borders | `#tab-shapes` (borders mode) |
| `tab-routes` + `tpl-routes` | routes | `#tab-routes` |
| `tab-rivers` + `tpl-rivers` | rivers | the rivers mode of `#tab-shapes` (own sub-section, no shared DOM with borders) |
| `tab-layers` + `tpl-layers` | layers | `#tab-layers` |
| `tab-more` + `tpl-more` | more | `#tab-more` |
Git merges workers' edits because the regions are far apart in the file. The foundation creates all markers first.

## Component catalog (v2) and status
Status key: **TODO** = to build in Foundation v2 (see `tasks/foundation.md`); **KEEP** = exists and is reused; **v1** = exists as JS strings and is replaced.
| Component | Frames | Markup (daisyUI) | Binder / behaviour | Status |
|---|---|---|---|---|
| Theme `paper-and-pencil` | all | `base.css` variables per 01 | none | TODO (F1 had colours only) |
| Panel shell: header, tab bar | s001, s050 | static in `shell` region | `shell.js`: `tab(n)` (existing), open/close, rail | TODO (v1 partial) |
| Rail 60px + tooltips + Period dot | s050-s052 | `tooltip`, `indicator`, `status` | `shell.js` | TODO |
| Resize edge, dock grip, larger panel | s097, s098 | own CSS | existing `layout.js` logic, KEEP | KEEP (restyle) |
| Phone sheet + handle + Time button | s099, s100 | own CSS | `shell.js` | TODO |
| Period / Moment footer | s001, s022, s049 | static in `footer` region: `join` toggle, `btn`, `toggle`, 48 bar `<i>`s created once, two `range` inputs | `footer.js` (logic of `period.js`, `timebar.js` kept: `periodBounds`, `tb*`) | TODO (v1 string footer) |
| Histogram | s001, s022 | own CSS | `uiHistogram` pure function, KEEP | KEEP |
| Date field (mode, format, era, preview) | s007, s046-s048 | `<template id="t-date">`: `join` modes, format `dropdown`+`menu`, `input`, era `join` | `fields.js` using `dfRead` `dfSafe` `dateText` (KEEP) | TODO (v1 string + popup) |
| Language pills + "+N" picker | s056-s058 | pills + `dropdown` radios | `fields.js`: fits as many pills as the row allows (ResizeObserver), selected language replaces the last pill when narrow, no "+N" when all fit | TODO (v1 pills no picker) |
| Language filter (chips + checkbox picker with counts, Clear, Done) | s055 | chips + `dropdown` checkboxes | `fields.js` | TODO |
| Name editor (names list, name card, Period row Set/Edit/Done, add another) | s007, s028, s033, s041, s088 | `<template id="t-name">` | `fields.js` `nameList(root)`: read/write `[{lang,name,date_from,date_to}]` | TODO (v1 `pfRow`) |
| Type pills | s007, s033, s034 | chips with symbol `<img>`/svg | `fields.js` | TODO |
| Style editor (point / line / area / river) | s020, s042-s044 | `range`, `toggle`, swatches, symbol grid, pattern tiles, preview | `fields.js` `styleEditor` (reads/writes `{color, style}`) | TODO (v1 `uiStyleEditor`) |
| Form frame + sticky action bar | all forms | `<template id="t-form">` | `fields.js` | TODO |
| Validation (inline errors, disabled Save) | s042, s065-s067, s082 | `validator`, `input-error`, `text-error` | `kit.invalid(el, msg)`, `kit.clear(form)` | TODO |
| States (empty, loading skeleton, error, service down, read-only) | s060-s062, s093, s070 | `alert`, `skeleton`, empty block | `kit.state(container, kind, text, retry?)` | TODO (v1 `uiState`) |
| Confirm modal (6 texts) | s068, s069 | one `<dialog class="modal">` | `dialogs.js` `confirm(kind, vars) -> Promise<bool>` | TODO (v1 `uiConfirm`) |
| Toast | - | `toast` + `alert` | `dialogs.js` `toast(msg, kind)` | TODO (v1 `uiToast`) |
| List row | s001, s073, s080, s085, s061 | `list-row` template | `kit.list` | TODO (v1 `uiRow`) |
| Note (timeline item, Show more/less) + notes list (language chips, sort, collapse, pagination) | s003, s045, s046, s071, s086 | `<template id="t-note">` | `fields.js` | TODO (v1 `uiNote`) |
| Accordion card | s019, s021, s080, s078 | `collapse` | none (native) | TODO (v1 `uiAccordion`) |
| Search field, filter button + badge, chips row | s002, s073, s080 | `label.input`, `indicator` | none | TODO |
| Three-state button (show / only / hide) | s085 | `join` of 3 radio `btn`s | none | layers |
| Map point menu | s063 | `dropdown`/`menu` in a MapLibre popup (static template) | explore | explore |
| Colour swatches / symbol grid / pattern tiles | s020, s043, s044 | `btn` toggles | `fields.js` | with style editor |

## v1, to retire (JS strings; keep until no screen uses them)
`components.js` (`uiDateEditor`, `uiHistogram` KEEP, `uiStyleEditor`, `uiState`, `uiAdd`, `uiChip`, `uiAccordion`, `uiRow`, `uiNote`, `uiForm`, `uiConfirm`, `uiToast`), `placeform.js` (`pfRow`, `pfRowDated`, `uiLanguagePills`, `uiTypePills`), the string footer in `period.js`, `.ft-*`, `.ui-*`, `.st-*`, `.df-*`, `.lang-pill`, `.type-pill` CSS in `sidebar.css`. Every screen worker replaces its own use of them; the main agent deletes what is unused at integration.

## Rules for workers
Read, do not edit: `kit.js`, `fields.js`, `footer.js`, `shell.js`, `dialogs.js`, `base.css`, regions `head shell footer dialogs templates`. Need a change: say so in the report. Add your own templates to your own `tpl-X` region, not to `templates`. Test UI behaviour in a real browser (`05-browser-testing.md`).
