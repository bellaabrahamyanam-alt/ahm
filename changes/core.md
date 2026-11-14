# Change log of the core domain

## 2026-11-12 — Place types are a dictionary (T-025, I-8)

- **What:** `loadTypes()`, global `types`, `typeLabel(code, lang)` (moved from the sidebar), `url.types|typeSave|typeDelete`, `canTypeAdmin`.
- **Why:** administrators must be able to add markers (iron mine, cedar forest, sword artefact) without a code change.
- **Files:** `app/js/core/data.js`, `app/js/config.js`, `tests/js/data.test.js`
- **How to verify:** `node tests/js/run.js`.
- **Follow-ups:** none.

## 2026-11-14 — River line type and a width per line (T-036)

- **What:** type `river` in `SHAPE_TYPES` (`app/js/core/shapes.js`); not a route, so it is not used by path finding.
- **Why:** owner, in the chat: draw rivers and set their style. A river is a line of the new border type `river` (blue, solid, 3 px); the width of any line can be changed per shape.
- **Files:** `app/js/core/shapes.js`
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js` (parity rows `shape: ...` in `tests/fixtures/rules.json`).
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
