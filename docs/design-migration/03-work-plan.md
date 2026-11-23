# 03 Work plan (awaiting approval)

Stack stays: classic scripts, daisyUI CDN, no framework change. Branch `feat/shared-foundation-tasks`. Task contracts already exist in `tasks/*.md`; this plan fixes what is left and the order.

## Decisions needed from the owner (blocking marked)
1. **D2 protected `tools/domains.json`** (blocking, 1 test red now): add owners for `tasks/` (and later `app/css/{explore,routes,layers,more}.css`, `tests/js/ui-*.test.js` if used). Needs an `Approved:` line. Smaller option: delete `tasks/` after the work and put per-screen CSS in `sidebar.css`/`shapes.css` (no new files).
2. **D3 Categories** in More (default 1): confirm. D4 Period/Moment footer replaces the Time button (default 1): confirm.
3. **T-049** undated objects under Moment: default option 3 stays unless answered.
4. Prototype has no desktop frame, no hover/focus, no empty/loading/error/read-only: OK to extend in the same style (assumed yes).
5. Not in the prototype and no design: Layers, Rivers, Borders list/card, Routes list/card, map popup/point card, overlay editor, 3D/terrain/relief, Directions, finder. Plan: extend the system, ask for no review before build.

## Phase 0: finish the foundation (one agent, sequential, owns `components.js`, `sidebar.css`, `base.css`, `period.js`, `timebar.js`, `layout.js`, `ui.js`, `index.html` shell)
- 0a F2 rest: daisyUI classes on buttons, sheet header, sticky action bar, inputs, chips; loading, error+Retry, read-only, offline states.
- 0b Shared building blocks: form frame, chips, add-dashed, accordion card, list row, note card, empty/error state, confirm.
- 0c F4 rest: custom grouped format menu (s47) replacing the native select; keep `dfRead` value contract.
- 0d F5: `periodField`, histogram (pure function), Period footer on every tab, `momentField` footer, remove `#tbOpen`/`#timebar` over the map (D4=1); `state.time` unchanged; no edit of `map/map.js`.
- 0e F6: `languageSelect`, `nameList` (+name period), `typeSelect`, `styleEditor`; move name list out of `placeform.js`.
- Tests in `tests/js/sidebar.test.js` per component. `bun tools/build.js`, commit `app/dist/`.
Gate: `node tests/js/run.js`, `ci-check-pr`, owner sees s1/s2/s7/s22/s28/s47/s48 matched.

## Phase 1: screens (parallel after phase 0 merges; one worker + one task file each)
| Worker | Task file | Owns | Prototype refs | Depends |
|---|---|---|---|---|
| explore | `tasks/explore.md` | `places.js`, `placeform.js`, `searchfield.js`, `actions.js` (point card), `css/explore.css` | s1 s2 s3 s7 s28 s45 s46 s22 s49 | phase 0 |
| routes | `tasks/routes.md` | `sidebar/routes.js`, `core/routes.js` | s34 s43 | phase 0 |
| layers | `tasks/layers.md` | `layers.js`, `core/layer-rules.js` | none | phase 0 |
| borders | `tasks/borders.md` | `sidebar/shapes.js`, `map/shapes.js`, `core/shapes.js`, `css/shapes.css` | s33 s44 | phase 0 |
| rivers | `tasks/rivers.md` | same files as borders | s43 | borders merged |
| more | `tasks/more.md` | `admin.js`, `map/overlays.js`, `actions.js` (Directions) | s19 s20 s21 s41 s43 s44 | layers merged (moves category admin out of `layers.js`) |
Conflicts: `actions.js` is split by function between explore and more; `changes/*.md` and `tests/js/sidebar.test.js` are append-only per section (merge by section name).

## Phase 2: integration (main agent)
Run build and all tests (JS, PHP, data); click every tab and sheet; compare against the 19 PNGs; narrow screen (<=700px); collapsed/resized panel; update `docs/02-implemented-features.md`, `04-project-structure.md` (drift), `09-code-style.md`.

## Verification limits
No browser or CDN in the sandbox: visual match, daisyUI classes and responsive layout cannot be verified here. Visual checks left to the owner or a machine with a browser (Playwright could be installed if the owner allows network).

## Mapping: prototype frame -> screen
s1 Explore list + Period footer | s2 Filters | s3 place card | s7 place form | s28 name period | s45 notes list | s46 note form | s22 Moment | s49 Period vs Moment | s47 s48 date editor | s19 s21 s41 More accordion, Languages, Categories, Historical maps | s20 place type editor | s43 route/river type editor | s44 area type editor | s33 border new version | s34 route save form.
## No prototype coverage
Layers (list, sheet, Choose places, Only/Hide); Rivers (list, card, selection); Borders list/card/drawing; Routes list/card/drawing/finder; point card, hover popup, geocoder results; Directions; Maps & base map controls (3D, terrain, relief, height profile); overlay corner editor; every empty/loading/error/read-only/offline state; confirm dialogs; desktop width.

## Open facts not verified
Whether category admin already left `layers.js`; the "river section" test line on master; PHP and data tests; whether `tools/check-domain.js` accepts `docs/design-migration/*` (`docs/` is owned in `domains.json:61`, so expected yes).
