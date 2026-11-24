# 03 Work plan (updated 2026-11-24, awaiting approval)

Stack: classic scripts, daisyUI CDN, no framework. **Changed 2026-11-24 by the owner: daisyUI components are used widely and the markup is static HTML first (section "Direction").** Branch `feat/shared-foundation-tasks`. Task contracts already exist in `tasks/*.md`; this plan fixes what is left and the order.

## Direction (owner, 2026-11-24)
The owner delivered the full design (68 frames, `docs/prototype/full/`) and asked: use daisyUI widely, and do not generate HTML from JS wherever it can be avoided. Rules for every new or rebuilt screen:
1. **Static first.** Shell, forms, panels, confirm bars, empty / loading / error blocks are written once in `index.html` with daisyUI classes. JS shows and hides them (`hidden`) and fills values.
2. **Templates for repeats.** Rows, chips, notes, cards, checkbox rows are `<template id="tpl-...">` blocks in `index.html`. JS clones one and sets `textContent`, attributes and `dataset`. Nothing is concatenated, so these paths need no `esc()`.
3. **`innerHTML` strings only where the DOM cannot be a template**: map markers and popups, SVG icons, and old code until its screen is rebuilt. They keep `esc()`; the `typeLabel` scan in `tests/js/sidebar.test.js` stays.
4. **daisyUI first**: `btn`, `input`, `select`, `checkbox`, `toggle`, `join` (segmented and three-state controls), `tabs`, `collapse` (accordion), `modal`, `alert`, `badge`, `menu`, `loading`, `skeleton`, `tooltip`, `range`, `toast`. Own classes only for what daisyUI lacks. The look stays the tokens of `base.css` in the daisyUI theme (F1, built). Names daisyUI owns are used as daisyUI means them; the app's old uses were renamed (`.stack` to `.pane`).
5. **Screen by screen**, when its worker rebuilds it; no big-bang rewrite. `components.js` helpers stay for old screens, then shrink to template cloners.

Costs and risks, stated plainly: `index.html` grows a lot and is one file for several workers (merge conflicts; see D8); old tests assert HTML strings and must be rewritten per screen; the sandbox cannot load the daisyUI CDN, so the look is checked only by the owner or on a machine with network; production depends on the CDN (pin the version; vendoring is a separate decision). Smaller option: only new screens follow the rules, old ones stay as they are.

## Decisions needed from the owner (blocking marked)
1. **D2 protected `tools/domains.json`** (blocking, 1 test red now): add owners for `tasks/` (and later `app/css/{explore,routes,layers,more}.css`, `tests/js/ui-*.test.js` if used). Needs an `Approved:` line. Smaller option: delete `tasks/` after the work and put per-screen CSS in `sidebar.css`/`shapes.css` (no new files).
2. **D3 Categories** in More (default 1): confirm. D4 Period/Moment footer replaces the Time button (default 1): confirm.
3. **T-049** undated objects under Moment: default option 3 stays unless answered.
4. The full design has frames for most screens and many states (s60, s62, s91 to s93); what is still not drawn (hover/focus, desktop width beyond s97/s98, anything not checked) is extended in the same style (assumed yes).
5. **D5 daisyUI mapping** (new): the list in "Direction" rule 4 is the default; the foundation agent confirms which component each shared block uses.
6. **D6 static + templates** (new): "Direction" rules 1 to 3 apply from the next rebuilt screen. Needs the owner's yes because it changes how every worker writes code.
7. **D7 `AGENTS.md`** (new, protected file): add the rules of "Direction" to section 4. Needs a `TODO.md` item with an `Approved:` line; not edited here.
8. **D8 `index.html` ownership** (new): each screen worker owns its `<section id="tab-...">` block and its `<template id="tpl-<screen>-...">` blocks, between marker comments; the rest of `index.html` stays with the foundation agent. Without it every worker must ask the main agent for each markup change.

## Phase 0: finish the foundation (one agent, sequential, owns `components.js`, `sidebar.css`, `base.css`, `period.js`, `timebar.js`, `layout.js`, `ui.js`, `index.html` shell)
- 0a F2 rest: daisyUI classes on buttons, sheet header, sticky action bar, inputs, chips; loading, error+Retry, read-only, offline states.
- 0b Shared building blocks: form frame, chips, add-dashed, accordion card, list row, note card, empty/error state, confirm.
- 0c F4 rest: custom grouped format menu (s47) replacing the native select; keep `dfRead` value contract.
- 0d F5: `periodField`, histogram (pure function), Period footer on every tab, `momentField` footer, remove `#tbOpen`/`#timebar` over the map (D4=1); `state.time` unchanged; no edit of `map/map.js`.
- 0f (new, Direction): in `index.html` the shared blocks as daisyUI markup and templates: list row, chip, note, confirm bar, pinned action bar, banner, empty / loading / error blocks, accordion card, three-state toggle, language pills, segmented date control, checkbox row. `components.js` gets `uiClone(templateId, data)` (clone, fill by `textContent`, return the node) while the old string helpers stay. Gate: one screen (layers) rebuilt on it.
- 0e F6: `languageSelect`, `nameList` (+name period), `typeSelect`, `styleEditor`; move name list out of `placeform.js`.
- Tests in `tests/js/sidebar.test.js` per component. `bun tools/build.js`, commit `app/dist/`.
Gate: `node tests/js/run.js`, `ci-check-pr`, owner sees s1/s2/s7/s22/s28/s47/s48 matched.

## Phase 1: screens (parallel after phase 0 merges; one worker + one task file each)
| Worker | Task file | Owns | Prototype refs | Depends |
|---|---|---|---|---|
| explore | `tasks/explore.md` | `places.js`, `placeform.js`, `searchfield.js`, `actions.js` (point card), `css/explore.css` | s1 s2 s3 s7 s22 s28 s45 s46 s49 s55 to s58 s60 to s67 s70 s71 | phase 0 |
| routes | `tasks/routes.md` | `sidebar/routes.js`, `core/routes.js` | s34 s77 s80 to s84 | phase 0 |
| layers | `tasks/layers.md` | `layers.js`, `core/layer-rules.js` | s85 to s88 (+ s65 s67 s69 s71 s93) | phase 0 |
| borders | `tasks/borders.md` | `sidebar/shapes.js`, `map/shapes.js`, `core/shapes.js`, `css/shapes.css` | s33 s73 to s77 | phase 0 |
| rivers | `tasks/rivers.md` | same files as borders | s77 s78 s79 | borders merged |
| more | `tasks/more.md` | `admin.js`, `map/overlays.js`, `actions.js` (Directions) | s19 s20 s21 s37 to s44 s90 to s94 | layers merged (moves category admin out of `layers.js`) |
Conflicts: `actions.js` is split by function between explore and more; `changes/*.md` and `tests/js/sidebar.test.js` are append-only per section (merge by section name).

## Phase 2: integration (main agent)
Run build and all tests (JS, PHP, data); click every tab and sheet; compare against the 68 frames of `docs/prototype/full/`; narrow screen (<=700px); collapsed/resized panel; update `docs/02-implemented-features.md`, `04-project-structure.md` (drift), `09-code-style.md`.

## Verification limits
No browser or CDN in the sandbox: visual match, daisyUI classes and responsive layout cannot be verified here. Visual checks left to the owner or a machine with a browser (Playwright could be installed if the owner allows network).

## Mapping: prototype frame -> screen
Index of all 68 frames with their task: `docs/prototype/full/README.md` (mapped from titles; only s85 to s88 were opened one by one). Shell and shared frames (s22, s47 to s52, s68, s69, s97 to s100) belong to the foundation agent.

## Open facts not verified
Whether category admin already left `layers.js`; the "river section" test line on master; PHP and data tests; whether `tools/check-domain.js` accepts `docs/design-migration/*` (`docs/` is owned in `domains.json:61`, so expected yes).
