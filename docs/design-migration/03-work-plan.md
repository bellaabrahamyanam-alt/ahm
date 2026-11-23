# 03 Work plan (for approval; no application code is edited by this document)

Inputs: `00-project-map.md` (what exists), `01-design-system.md` (tokens, daisyUI), `02-shared-components.md` (components C1–C18). Supersedes the first draft in `tasks/*.md`, which was written before this discovery and is wrong in places (see 6). After approval, `tasks/*.md` are regenerated from this plan.

## 1. Where the branch stands

Branch `feat/shared-foundation-tasks` (from `master` 53e2c44). Built and tested, no screen uses them yet except the shell:

| Done | What | Check |
|---|---|---|
| F1 / C1 | prototype tokens + daisyUI theme in `base.css`, daisyUI 5.8.2 from CDN | 4 tests |
| F2 / C2 | brand header, icon tabs, `closest('[data-tab]')` | 2 tests, screenshot vs s1 |
| F3 / C3 (part) | `components.js` interface, `uiDateEditor`, format groups | 3 tests |
| F4 / C3 | date field in the prototype layout | 5 tests, screenshot vs s48 |

Test state: 303 passed, 1 failed. Known failures not caused by this work: `river section` in `routes.test.js` (also fails on clean `master`), and `domains: every file has an owner` for `tasks/*.md` (needs a protected `tools/domains.json` line or moving the files; see D2).

## 2. Decisions needed before building (each blocks the packages named)

| # | Question | Default used if you do not answer | Blocks |
|---|---|---|---|
| D1b | daisyUI CDN collides with legacy class names `.tabs` `.tab` (verified) and by name `.label` `.badge` `.stack` `.btn` (not verified; only 100 000 of 1 182 278 characters of the CSS were read). Rename legacy classes per screen, self-build with a prefix, or use only the theme variables? | use only theme variables + custom CSS; no daisyUI component classes until verified in a browser | every screen package |
| D2 | `tools/domains.json` is protected. Add owner lines for new test or css files, or avoid new files (what F1–F4 did)? Also `tasks/*.md` fail the owner test. | no new files; tests go in `tests/js/sidebar.test.js`; `tasks/` stays failing until you decide | CI of every package |
| D4 | Period and Moment footer replaces the "Time" button and time bar over the map (s1, s22, s49). | follow the prototype | F5, explore, every tab |
| D5 | Forum parity (Verdana, white inputs, 4/7 px radii) or prototype look (system-ui + Georgia, beige inputs, 8/12 px)? | prototype look for the sidebar only; map popups keep forum look | every screen package |
| D6 | Place detail is an accordion row inside the list in the prototype (s3, s7) but a separate dock (`#dock`, resizable, with `ahm-dock-*` settings) in the app. Follow the prototype and remove the dock? | follow the prototype for places; keep the dock for layers, borders and routes until they are rebuilt | explore |
| D7 | Frames do not exist for: Layers tab (all), Rivers (all), Borders list and card, Routes list, card and drawing, map popups and point menu, overlay editor, Maps/3D/relief folds, Directions open, empty / loading / error / read-only states, delete confirmations, desktop width, collapsed sidebar, mobile bottom sheet. Who designs them? | builder derives them from the existing pattern (accordion, names block, form footer), marked "derived, not designed" in the PR | layers, rivers, more-A, parts of borders, routes, explore |
| D8 | Delete / discard confirmations are native `confirm()` today (8 places). Keep native or build C14? | keep native | none (leaf) |
| D9 | `AGENTS.md` says `TODO.md` is the only list of work; this plan and `tasks/` are extra files. Add `TODO.md` items per package? | not added | project hygiene |

Resolved by discovery: **D3 (categories)** is moot: the Categories fold is already in More (`#more-cat`); only its code is in `layers.js`. Package `more-B` owns that code and moves it to `admin.js`; `layers` must not edit it.

## 3. Packages

Legend: ◼ built, ◻ to build. All packages: rebuild the UI only; stored data, `INTERFACES.md`, `window.AHM` events and the DOM ids driven by `tests/js/browser.test.js` stay. Each ends with `bun tools/build.js`, `node tools/make-graph.js`, `node tests/js/run.js`, `node tools/ci-check-pr.js <branch> origin/master`, a `changes/` entry and the docs updated.

### P0 Foundation (shared, sequential, one agent)

| Part | Content | Frames | Files owned |
|---|---|---|---|
| ◼ F1–F4 | tokens, theme, shell, date field | s48 | `base.css`, `index.html` (shell), `layout.js` (tabs), `datefield.js`, `components.js`, `sidebar.css` (tabs, date field) |
| ◻ F4b | date format **popup** of s47 (replaces the native select) | s47 | `datefield.js`, `sidebar.css` |
| ◻ F5 / C4 | Period footer + Moment footer + `uiHistogram`; mounted in the shell for every tab; time bar and "Time" button removed from the map overlay if D4 = follow | s1, s2, s22, s45, s49 | `period.js`, `timebar.js`, `components.js`, `index.html` (footer slot only), `sidebar.css` |
| ◻ F6 / C5–C7 | names block, type pills, style editor | s7, s20, s28, s33, s43, s44 | `components.js`, `placeform.js` (names block moved out), `sidebar.css` |
| ◻ F7 / C8–C12, C15 | accordion / fold card, chips, search row with filter button, form footer, notes timeline, switch and slider rows | s1–s3, s19, s21, s45, s46 | `components.js`, `sidebar.css` |
| ◻ F8 / C14, C16 | confirm, empty / loading / error states (only if D7/D8 say yes) | none | `components.js` |

Must not touch: `app/js/core/dates.js`, `service/`, `dev/`, `INTERFACES.md`, `tools/domains.json`, `app/js/map/` (except F5 removing the time bar markup/handlers: `timebar.js` is sidebar-owned; `map.js` only reads `AHM.state 'time'` and is not edited).

### P1 Screens (parallel after P0 is merged)

| Package | Screens (from 00) | Frames | Files owned | Shared comps | Depends |
|---|---|---|---|---|---|
| **explore** | E1 list + count + sort + fit, E2 filters panel behind the filter button with badge, chips + Clear all, E3 place accordion row (D6), E4 place form, E6 notes timeline, E5 dialog `#dlg`, E7 search other places, E8 point card | s1, s2, s3, s7, s28, s45, s46 | `places.js`, `placeform.js`, `searchfield.js`, `actions.js` (place and note parts), `index.html` (`#tab-explore`, `#dlg` only), `sidebar.css` (explore rules; split `explore.css` only if D2 allows) | C3–C12 | P0 |
| **borders** | B1 list, B2 card, B3 form + version, B4 draw, B5 OSM add + import, R3 notes | s33 (form); rest derived | `sidebar/shapes.js` (borders mode), `map/shapes.js` (draw UI only), `shapes.css`, `index.html` (`#tab-shapes` borders part) | C3, C5, C6, C7, C11, C12 | P0 |
| **rivers** | R1 list, card, river find, R2 selection by rectangle / area | s43 (type only); rest derived | rivers mode of `sidebar/shapes.js`, `map/shapes.js` (`applyRiverSel`, `drawBox`), `shapes.css` | C5–C7, C9, C11 | **borders** (same files) |
| **routes** | T1 finder, T2 list, T3 card, T4 form, T5 draw | s34 (form); rest derived | `sidebar/routes.js`, `core/routes.js` (no behaviour change), `index.html` (`#tab-routes`), `shapes.css` or `sidebar.css` | C3, C5, C6, C7, C11, C12 | P0 |
| **layers** | L1 list, L2 detail, L3 form, L4 choose places, L5 notes, L6 place layers chips | none (all derived); patterns from s3, s19, s45 | `sidebar/layers.js` (everything except the Categories code), `core/layer-rules.js`, `index.html` (`#tab-layers`, `#lyDlg`) | C5, C7 (colour), C8, C9, C12 | P0, D7 |
| **more-A** (maps) | M1 Maps & base map: base map, 3D, terrain, river size, **relief editor**, Show on map groups, Historical maps list + overlay editor, M2 Directions | s19, s21 (headers and Historical maps only); rest derived | `map/overlays.js` (UI parts), `sidebar/actions.js` (Directions), `index.html` (`#more-maps`, `#more-route`), `map.css`; **not** `map.js` | C8 (fold), C15 | P0, D7 |
| **more-B** (dictionaries) | M3 Languages, M4 Types (point, line, area editors, SVG upload), M5 Categories (moves code out of `layers.js`) | s19, s20, s21, s41, s43, s44 | `sidebar/admin.js`, `layers.js` (**only** `lyRenderCats`, `catFill`, `catClick`, moved), `index.html` (`#more-lang`, `#more-types`, `#more-cat`) | C5, C6, C7, C8, C11, C15 | P0, and **after layers** (same file `layers.js`) |

Out of the packages (listed so nothing is lost): map popups and point menu restyle (`map.js` `showTip`, `showMenu`, `map.css`), vertex and handle markers: no frame, owner = `map` domain, one small package **map-skin** after P1 (D7); relief and overlay logic in `map.js` stays untouched.

## 4. File ownership (no file has two writers at the same time)

| File | Writer(s) | Order |
|---|---|---|
| `app/css/base.css`, `index.html` shell | P0 only | first |
| `app/css/sidebar.css` (1 421 lines, the one shared CSS) | **conflict risk**: P0, explore, layers, routes, more-A/B | rule: each package appends under its own marked section; merge order P0 → explore → layers → routes → borders → rivers → more-A → more-B. D2 would allow per-package CSS files and remove the risk |
| `sidebar/places.js`, `placeform.js`, `searchfield.js` | explore | |
| `sidebar/shapes.js`, `app/css/shapes.css` | borders, then rivers | borders first |
| `sidebar/routes.js` | routes | |
| `sidebar/layers.js` | layers, then more-B (categories only) | layers first |
| `sidebar/admin.js` | more-B | |
| `sidebar/actions.js` | explore (place / note), more-A (Directions) | different functions; merge explore first |
| `map/overlays.js` | more-A | |
| `map/map.js`, `map/shapes.js` (drawing) | not edited except `map/shapes.js` by borders/rivers for draw and select UI | |
| `tools/domains.json`, `INTERFACES.md`, `service/`, `dev/`, `core/dates.js` | nobody | protected |

## 5. Dependency graph

```
P0 (F1-F4 done) -> F4b, F5, F6, F7, (F8)        # F5, F6, F7 can be built by one agent in order
P0 complete ->  explore
            ->  borders -> rivers
            ->  routes
            ->  layers  -> more-B
            ->  more-A
all P1 -> map-skin
```
Why one P0 agent, not parallel: C4–C7 all write `components.js` and `sidebar.css`.

## 6. Corrections to the first draft (`tasks/*.md`)

1. Categories are already in More; the draft's D3 was wrong. 
2. The draft said "Period filter should reach shapes": it already does.
3. The draft missed: Relief editor and overlay editor (More), OSM search and GeoJSON import (Borders), river find, route finder (`#rtFinder`), route road routing, `#dlg` and `#lyDlg` dialogs, place layer chips, hash routes, the details dock and its sizing, the mobile bottom sheet.
4. The draft assigned Rivers states to a Rivers tab with its own section; Rivers reuse `#tab-shapes`.
5. The 19 frames cover little of the app: of the 37 screen rows in 00 §3, 14 have a frame (R3 and L5 only as a pattern), 5 are partly covered (S1, S2, E5, M1, M2) and 18 have none (S3, S4, E7, E8, B1, B2, B4, B5, R1, R2, T1, T2, T3, T5, L1–L4).

## 6b. What this discovery did not verify

- No walk-through of every screen in a browser (sandbox cannot load the map tiles or the daisyUI CDN); screens were read from code.
- Role differences (guest, member, administrator) were read from `docs/07` and `canEdit` flags, not run.
- `app/features/campaigns/` (optional feature) and `app/js/map/typeicons.js` internals were not read in detail.
- `docs/06-http-interface.md` request and response shapes not copied here; the UI keeps the same calls.

## 7. Acceptance for the whole migration

Every screen of 00 §3 either follows its frame or is marked "derived, not designed"; stored data identical before and after (round trip of the demo data); `tests/js/run.js` green apart from the failures that exist on `master`; browser tests unchanged; no new `window.AHM` call; `ci-check-pr` passes; each PR has screenshots at 400 px next to the frame.
