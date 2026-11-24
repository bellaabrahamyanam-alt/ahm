# 03 Work plan (v2, 2026-11-24)

What changed: (1) the owner supplied the complete design (68 frames, includes the Layers tab, rail, phone, all states): `04-design-v2-frame-map.md`; (2) the owner's rule: static HTML + daisyUI, JS does not generate markup, no framework: `01-design-system.md`. The v1 foundation (JS-string components) is therefore NOT the base for the screens; it is replaced by Foundation v2. Nothing of v1 is thrown away that is logic: dates, Period/Moment logic, histogram function, tests, CI fixes stay.

## Order
```
Foundation v2 (one agent, first)  ->  Phase 1 (parallel, 4 workers)  ->  Phase 1b (2 workers)  ->  Integration (main agent)
                                      explore | borders | routes | layers      rivers (after borders) | more (after layers)
```
Why sequential at the start: every screen needs the theme, the regions of `index.html`, the kit and the shared fields; two agents inventing them in parallel would diverge.

## Foundation v2 (`tasks/foundation.md`)
Theme complete; `index.html` restructured into regions with the static shell (header, tab bar, rail, phone sheet), static footer, dialogs, templates; `kit.js`; `fields.js` (date field, language pills + picker, name editor, type pills, style editor, form frame, validation, notes); `footer.js`; `shell.js`; `dialogs.js`; states; browser tests; `docs/09-code-style.md` rule text (owner approves). Exit gate: every shared frame (s001, s022, s028, s047, s048, s050-s052, s055-s058, s060, s068, s069, s097-s100 and the field parts of s007, s020, s033, s042-s044, s046) matches by eye in a 400x860 screenshot and the full suite incl. browser tests passes. Existing screens keep working on v1 until their worker converts them.

## Phase 1: four workers, in parallel (each: own tab region, own css, own test file; none edits another's)
| Task | Frames | Converts to templates |
|---|---|---|
| `tasks/explore.md` | s002 s003 s007 s028 s045 s046 s055 s060-s067 s070 s071 s098 (+ s001 s022 content) | `places.js`, `placeform.js`, `searchfield.js`, point menu in `map.js` |
| `tasks/borders.md` | s033 s073-s076 (+ s077) | `sidebar/shapes.js` (borders mode) |
| `tasks/routes.md` | s034 s080-s084 | `sidebar/routes.js` |
| `tasks/layers.md` | s085-s088 (+ s067 note part) | `layers.js` |
## Phase 1b
| `tasks/rivers.md` | s077-s079 | rivers mode of `shapes.js` (after borders, same file) |
| `tasks/more.md` | s019-s021 s037-s044 s090-s094 | `admin.js`, `map/overlays.js`, Directions in `actions.js` (after layers: category admin leaves `layers.js`) |

## Integration (main agent)
Merge branches, `bun tools/build.js`, regenerate `graph/` `context/`, full suite with browser, screenshots vs frames, delete v1 code that nothing uses, update `docs/02-implemented-features.md`, `04-project-structure.md` (drift), `09-code-style.md`; PR with `Owner-approved: T-NNN` for protected files.

## Decisions needed from the owner (defaults in brackets; none blocks Foundation v2)
1. daisyUI from the CDN (current) or a copy inside the repo (1.2 MB file, offline, pinned; the forum then makes no third-party request) [CDN, as built].
2. Font [system-ui until you name one; frames look like Inter].
3. Frame contradictions: border type names, delete layer inline vs modal, Period/Moment toggle vs time-travel icon, see `04` [defaults there].
4. UI tests in a real browser (needs Chromium in CI; the harness exists) [yes; pure logic stays in node tests].
5. T-049 undated objects under Moment [option 3 stays].
6. Appendix of the rule: `docs/09-code-style.md` and `AGENTS.md` still say that markup is built in JS; Foundation v2 changes them (protected docs? needs your `Approved:`) [approve].

## Not verified / risks
All 68 frames were viewed, but nothing in them was measured; "matches by eye" is the bar. Which design features already exist in the app was judged by keyword search only (see "Existing vs new" in each task); the workers confirm in code. Rewriting five big sidebar files from JS strings to templates is the biggest risk: each worker keeps behaviour by keeping its logic functions and rewriting only the rendering; stored data never changes. Tests that assert on HTML strings (`search.test.js` etc.) must be rewritten as browser tests; the owner of each file's tests does it.
