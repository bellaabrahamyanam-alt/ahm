# Task F0: shared foundation (must merge before every other task)

Source: the prototype in `docs/prototype/` (received 2026-11-23: `sidebar.html`, `sidebar.css`, `sidebar.js`, 19 screenshots in `png/`). `02-shared-components.md` was NOT received. The prototype is custom CSS (no daisyUI) with the same palette as `base.css`; its helpers in `sidebar.js` (`dateF`, `pfoot`, `mfoot`, `nameRow`, `typePills`, `shapePills`, `fld`, `ffoot`, `sel`, `pills`, `colr`, `symT`, `patT`) are the model of the shared components. Frames: `s47.png`, `s48.png` date formats, `s49.png` Period vs Moment, `s28.png` period of a name.

## Dependencies

```
F1 tokens + theme -> F2 app shell -> F3 component interfaces -> F4 HistDate editor
                                                              -> F5 Period / Moment
                                                              -> F6 Language / Name / Type / Style
F0 (F1..F6) -> explore, routes, layers, more   (parallel with each other)
F0 -> borders -> rivers                         (rivers reuses the Borders panel and its files)
```

Smaller option: one PR for F1+F2, one for F3..F6. Do not split further.

## Needs you (blocks F1)

- D1 daisyUI delivery: ANSWERED 2026-11-23 by the owner: CDN `<link>`. Built in F1 as `https://cdn.jsdelivr.net/npm/daisyui@5.8.2/daisyui.css` (exact version, no Tailwind script). The file is layered (`@layer`), so our unlayered css wins. Not verified in a browser: that component classes look right without Tailwind (two `--tw-` variables exist in the tab rules).
- D2 `tools/domains.json` is protected. New test files `tests/js/ui-*.test.js` need an entry in the `sidebar` domain. Needs an `Approved:` line. Not verified: how `tools/check-domain.js` treats an unlisted test file.

## F1 Design tokens and daisyUI theme

- Routes/views: none (CSS only).
- Do: move colours, spacing, radius, type scale, z-index and shadow to custom properties in the first `:root` block of `app/css/base.css`; add the daisyUI theme `paper-and-pencil` as a block in `app/css/base.css`, mapped to those tokens (a new css file needs an owner line in the protected `tools/domains.json`, so none is created); load daisyUI from the CDN before the `<!-- ahm:css -->` block of `app/index.html`.
- Never create or link `app/css/colours.css` (`AGENTS.md`, "Facts").
- Files owned: `app/css/base.css`, `app/index.html` (css block only).
- Must NOT modify: `app/css/sidebar.css`, `app/css/map.css`, `app/css/shapes.css`, any `app/js/`.
- Acceptance: no visual change on any screen except where a token replaces an equal value; one source for every colour.
- Tests: in `tests/js/sidebar.test.js` (a new test file needs an owner line in the protected `tools/domains.json`): the CDN link has an exact version, and every token used in the theme block is defined in `base.css`.

## F2 App shell integration

- Routes/views: sidebar tabs `explore`, `shapes` (Borders), `routes`, `rivers`, `layers`, `more` (`data-tab`, function `tab(n)` in `app/js/sidebar/layout.js`); sheets over lists; collapsed / resized / bottom-sheet states; hash `#place-<id>`.
- Do: apply daisyUI classes to the tab bar, buttons (`primary`, default, `.danger`, `back`), sheet header and sticky action bar, inputs, chips and tables without changing the contract in `INTERFACES.md`.
- ASSUMED missing states: loading (data not yet fetched), load error with Retry, read-only visitor (no edit buttons), offline.
- Files owned: `app/js/sidebar/layout.js`, `app/js/sidebar/ui.js`, `app/index.html` (tab bar and shell markup only, not the `<section id="tab-...">` bodies).
- Must NOT modify: the bodies of `#tab-*` sections, `app/js/map/`, `app/js/core/`, `service/`.
- Acceptance: all six tabs open and close sheets as before; keyboard and narrow-screen behaviour unchanged; `node tests/js/run.js 2>&1 | tail -15` passes.
- Tests: extend `tests/js/sidebar.test.js` only for what existed; new cases in `tests/js/sidebar.test.js`.

## F3 Shared component interfaces

One file `app/js/sidebar/components.js`, registered in the `<!-- ahm:js -->` block before `js/sidebar/layers.js`. Same export pattern as `app/js/sidebar/ui.js` (builder confirms). No new `window.AHM` member. Each component returns `{ el, get(), set(v), validate() }` and takes `onChange`. All output goes through `esc()`.

| Component | Call | Value |
|---|---|---|
| HistDate editor | `dateEditor({ value, label })` | `null` or `{ fmt, ts, mode: exact\|approx\|range, ts_to }` (`app/js/core/dates.js`) |
| Period | `periodField({ from, to })` | two date values, `from <= to` |
| Moment | `momentField({ value })` | one date value or `null` |
| Language | `languageSelect({ value, exclude })` | code from `data/languages.json`, no free text |
| Names | `nameList({ names })` | `[{ lang, text, from, to }]`, several per language, reorder, remove |
| Type | `typeSelect({ kind, value })` | `kind`: `point`, `line` or `area`; code from `data/types.json` |
| Style | `styleEditor({ kind, style })` | colour, opacity, width, pattern, symbol, size |

- Acceptance: every component has an empty, filled and invalid state; interface comments written once at the top of `components.js`.
- Tests: `tests/js/sidebar.test.js`, one block per component (shape of the value, invalid input, `set`/`get` round trip).

## F4 Historical date editor

- Base: `app/js/sidebar/datefield.js` (115 lines). Extend, do not duplicate.
- Must handle: unknown (`null`), exact, approx, range; BCE and years beyond 9999 as `±YYYYYY`; ISO 8601 `Z` timestamps only; never compare dates as text (use `isoToSec`).
- Files owned: `app/js/sidebar/datefield.js`, `app/js/sidebar/components.js`.
- Must NOT modify: `app/js/core/dates.js`, `service/dates.php` (the model is fixed).
- Acceptance: 1200 BCE round trips to `-001199-01-01T00:00:00Z`; a range with `ts_to` before `ts` shows an error and does not save.
- Tests: in `tests/js/sidebar.test.js`, using `tests/fixtures/dates-vectors.json` indirectly through `dates.js` (never open that fixture).

## F5 Period and Moment components

- Base: `app/js/sidebar/period.js` (13 lines) and `app/js/sidebar/timebar.js` (80 lines). The Period replaces the Explore From/To fields; the Moment is used by the time bar and by the note date.
- Files owned: `app/js/sidebar/period.js`, `app/js/sidebar/components.js`.
- Must NOT modify: `app/js/map/map.js` (time filtering stays as is).
- Acceptance: Explore, layers date range and name periods can use the same component; the "period filter ignores layers" rule is untouched.
- Tests: Period rejects `from > to`; Moment clears to `null`.

## F6 Language, name, type and style components

- Base: name list in `app/js/sidebar/placeform.js`, `PLACE_TYPES` there, `TYPE_STYLE` in `app/js/map/typeicons.js`, card styling in `app/js/sidebar/shapes.js`.
- The place-type list stays in the three places named in `AGENTS.md` section 4; the components only read it.
- Files owned: `app/js/sidebar/components.js`, `app/js/sidebar/placeform.js` (move the name list out; same behaviour).
- Must NOT modify: `store.php`, `dev/save-handler.js`, `app/js/map/typeicons.js`.
- Acceptance: the place form renders identically through the shared `nameList` and `typeSelect`; several names in one language still work; the first name of a language stays the map name.
- Tests: `nameList` keeps order after remove and reorder; `languageSelect` offers only dictionary codes.

## Finish (every F-part)

`bun tools/build.js`, commit `app/dist/`; `node tools/ci-check-pr.js <branch> origin/master`; `node tests/js/run.js 2>&1 | tail -15`; entry in `changes/shared.md` and `changes/sidebar.md`; update `docs/02-implemented-features.md` and `docs/09-code-style.md` for the new components.
