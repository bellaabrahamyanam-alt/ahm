# Change log of the core domain

## 2026-11-12 — Place types are a dictionary (T-025, I-8)

- **What:** `loadTypes()`, global `types`, `typeLabel(code, lang)` (moved from the sidebar), `url.types|typeSave|typeDelete`, `canTypeAdmin`.
- **Why:** administrators must be able to add markers (iron mine, cedar forest, sword artefact) without a code change.
- **Files:** `app/js/core/data.js`, `app/js/config.js`, `tests/js/data.test.js`
- **How to verify:** `node tests/js/run.js`.
- **Follow-ups:** none.

One entry per change, newest last: date, what, why, files, how to verify, open follow-ups. Only the core domain appends here (DOMAINS.md, rule 7). The history before 2026-11-06 is in the legacy `AGENT_CHANGES.md` (entries #1-#26), which is now read-only.

---

## 2026-11-06 — #1 `run(options)` instead of reading sidebar fields (proposal 001, approved by the owner)

### What
- `core/search.js`: `run({ q, lang, sort, period })` with defaults; it no longer touches the DOM or calls `periodBounds()`. Behaviour is unchanged. INTERFACES.md I-3 (version 1.2) describes it; Known violation 1 is closed.
- `tests/js/search.test.js`: the stand-in form fields and the `periodBounds` stub are replaced by an options object passed to `run` (the same assertions).

### Verify
`node tests/js/run.js` (all green); `boundaries.test.js` now also forbids `$` and DOM names in core.

---

## 2026-11-08 — #2 layer rules use the shared state (task 002)

### What
- `core/layer-rules.js`: `lyState` is now `AHM.state.get('layers')` instead of an object literal. It keeps the fields `only, hide, open, editing, staged, noteAll`; all names are unchanged (I-3 unchanged).

### Why
The layer state is shared between domains and lives in `AHM.state` (task 001, INTERFACES.md I-6).

### Files
`app/js/core/layer-rules.js`, `changes/core.md`.

### Verify
`node tests/js/run.js` (all green, no test changed); `node tools/check-domain.js core <diff>` passes.

### Follow-ups
None. `search.js` and the sidebar code are out of scope.

## 2026-11-14 — T-021: route rules in core (written afterwards; commits `b0b76d2`, `571630d`)

- **What:** new `app/js/core/routes.js` (pure rules: `routeSegments`, `findRoutePaths`, `routesThrough`, one-way and two-way use, a change of route costs `ROUTE_TRANSFER_KM`); `core/shapes.js`: route types, `lineKm`, `geomLines`, `twoway` and `stops` in the shape object, `shapesRun` also filters routes.
- **Why:** routes that share a place chain into journeys; the rules need no DOM and no map, so they are testable.
- **Files:** `app/js/core/routes.js`, `app/js/core/shapes.js`, `tests/js/routes.test.js` (9 tests).
- **How to verify:** `node tests/js/run.js` (routes tests).
- **Follow-ups:** none.

## 2026-11-14 — T-036: shape types from the dictionary (core)

- **What:** `app/js/core/shapes.js`: `setShapeTypes(list)` fills the shape type registry (`SHAPE_TYPES`, `BORDER_TYPES`, `ROUTE_TYPE_LIST`) from the line and area types of the dictionary (line `arrow: true` = one way = `twoway: false`; patterns the map cannot draw are drawn solid); a dictionary without line or area types keeps the built-in ones; a stored shape of a removed type is drawn like the first area type; `guessShapeType` names a type that exists. `tests/js/routes.test.js` (4 tests).
- **Why:** T-036.
- **Files:** `app/js/core/shapes.js`, `tests/js/routes.test.js`.
- **How to verify:** `node tests/js/run.js`.
- **Follow-ups:** the label of a shape type in the lists is its English name (or the first one), not the language of the page.
