# Change log of the data domain

## 2026-11-10 — #1 Two PHP tests follow the borders (shapes) work of commit 51e13445
**What:** `tests/php/RoutingTest.php`: the data route now offers `shapes` as well (the list the test expects). `tests/php/LayerTest.php`: the sample layer has 3 places and 1 border (`{ shape: id }`) as members, so the test expects 4 members and checks the border member's id. No code and no data file changed.
**Why:** commit `51e13445` (owner's hotfix, `[skip ci]`) added the borders to `service/store.php`, `controller/main.php` and `config/routing.yml`; the sample layer already held a border. Two tests were not updated, so job `tests` was red on `master` and every later merge request.
**Verify:** `php tests/php/run.php` (CI job `tests`).
**Follow-ups:** the data checker, see #2.

## 2026-11-10 — #2 The data checker accepts border members of a layer
**What:** `tests/data/DataCheck.php`: a layer member can be a border (`{ shape: id }`); it must exist in `shapes.geojson` when that file exists, otherwise [layer-member-missing]; a border twice in one layer is [layer-member-duplicate]. One new case in `tests/data/DataTest.php` (a border that does not exist). No code and no data file changed.
**Why:** the sample layer holds a border since the borders work; the checker only knew `{ place: id }` members, so 4 tests in `tests/data/` were red (job `tests`, after the PHP suite of #1 passed).
**Verify:** `php tests/data/run.php` (CI job `tests`).
**Follow-ups:** none.

## 2026-11-12 — #3 T-005: the page controller serves the minified bundle
**What:** `controller/main.php` (`page()`): when `app/dist/manifest.json` exists, the marked blocks of `app/index.html` are replaced by `dist/app.min.css?v=<hash>` and `dist/app.min.js?v=<hash>`; `window.AHM_BACKEND` is still written right before the first script. No manifest: the sources are served as before. `tests/php/ControllerTest.php`: new test.
**Why:** T-005 (see `changes/shared.md` #34). The hash in the address makes a new build load at once and lets the old one stay cached.
**Verify:** `php tests/php/run.php 2>&1 | tail -15` (94 passed).
**Follow-ups:** none.

## 2026-11-12 — #4 T-023: the controller serves the bundle only when its files exist
**What:** `controller/main.php` (`page()`): the bundle replaces the marked blocks only when `app/dist/app.min.js` and `app/dist/app.min.css` exist as well as a valid manifest; otherwise the sources are served. `tests/php/ControllerTest.php`: new test (each file hidden in turn).
**Why:** review of PR #8: a manifest without its files (partial copy of the extension) made the page link two dead files.
**Verify:** `php tests/php/run.php 2>&1 | tail -15` (95 passed).
**Follow-ups:** T-024.

## 2026-11-12 — Place types are a dictionary (T-025, I-8)

- **What:** `data/types.json` (seed of the 13 types), `store.php`: `types()`, `save_type()`, `delete_type()` (place type checked against the dictionary; a used type and `mountain` cannot be removed; old file archived), controller `type_save`/`type_delete` (admins only) and the `types` data route, page config `types`/`typeSave`/`typeDelete`/`canTypeAdmin`, the same in `dev/save-handler.js`; `DataCheck` checks `types.json`.
- **Why:** administrators must be able to add markers (iron mine, cedar forest, sword artefact) without a code change.
- **Files:** `data/types.json`, `service/store.php`, `controller/main.php`, `config/routing.yml`, `dev/save-handler.js`, `tests/php/TypeTest.php`, `tests/php/{ControllerTest,RoutingTest,ParityTest}.php`, `tests/data/DataCheck.php`, `tests/fixtures/rules.json`, `tests/js/parity.test.js`
- **How to verify:** `php tests/php/run.php`, `php tests/data/run.php`, `node tests/js/run.js`.
- **Follow-ups:** line and area types (`geometry` other than `point`); owner decisions in `TODO.md` T-026 (contract: `style.size`, `_` in codes, `typeIcon` with a draft).

## 2026-11-14 — Custom symbols for place types (T-025)

- **What:** `save_type` accepts `style.symbol = "custom"` with `style.path` (SVG path data, checked by a whitelist of characters, must start with M) and `style.box` (8–2048, default 24); dropped for other symbols. PHP and the dev server give the same verdicts (8 new parity cases).
- **Review fix (critic, PR #10):** a `types.json` that exists but cannot be read is never replaced by the seed (PHP and dev server answer 400 and change nothing); the seed is made only when the file does not exist.
- **Why:** the list of 15 symbols is too small (iron mine, cedar forest, sword artefact, ...).
- **Files:** `service/store.php`, `dev/save-handler.js`, `tests/php/TypeTest.php`, `tests/fixtures/rules.json`, `docs/05-data-model.md`
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js`.
- **Follow-ups:** `style.path` and `style.box` are an addition to `interfaces/I-8` (see `TODO.md` T-026).

## 2026-11-14 — More tests for the place types dictionary (T-025)

- **What:** Tests: place edits to and from added types, removing a type after its last place moved, every type usable by a place, several languages, the `types` data route; `DataCheck` also checks a custom symbol (`type-path`, `type-box`) and 12 defects of `types.json` are reported.
- **Why:** the dictionary and custom symbols had tests for the main paths only; no code changed.
- **Files:** `tests/php/TypeTest.php`, `tests/php/ControllerTest.php`, `tests/data/DataCheck.php`, `tests/data/DataTest.php`
- **How to verify:** `php tests/php/run.php`, `php tests/data/run.php`.
- **Follow-ups:** the type editor of the sidebar (`ui.js`) and `dev/save-handler.js` have no new tests: the editor needs a browser run, the dev server was left out on purpose.

## 2026-11-14 — River line type and a width per line (T-036)

- **What:** `river` in `SHAPE_TYPES`; optional `width` (0.5 to 12, absent = unchanged) in `clean_shape` and `cleanShape`; parity runners know `via: shape`.
- **Why:** owner, in the chat: draw rivers and set their style. A river is a line of the new border type `river` (blue, solid, 3 px); the width of any line can be changed per shape.
- **Files:** `service/store.php`, `dev/save-handler.js`, `tests/fixtures/rules.json`, `tests/php/ParityTest.php`, `tests/js/parity.test.js`
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js` (parity rows `shape: ...` in `tests/fixtures/rules.json`).
- **Follow-ups:** none.

One entry per change, newest last: date, what, why, files, how to verify, open follow-ups. Only the data domain appends here (DOMAINS.md, rule 7). The history before 2026-11-06 is in the legacy `AGENT_CHANGES.md` (entries #1-#26), which is now read-only.

## 2026-11-14 — #5 T-027: notes for borders and routes
**What:** `service/store.php` and `dev/save-handler.js`: `save_layer_note` / `saveLayerNote` accept a shape id as the owner (a layer or a border or route; error "unknown layer or border"); new `archive_layer_notes` / `archiveLayerNotes` (moves an owner's notes to the archive and rebuilds the index) is used by `delete_layer` and now also by `delete_shape`. `tests/data/DataCheck.php`: a note folder of an existing shape is no orphan. Tests: `tests/php/LayerTest.php` (2), a case in `tests/fixtures/rules.json`.
**Why:** the owner asked for notes on routes and borders. No new endpoint, config key or contract change: the notes use `layer-save` with `layer_note` and the `layer-notes/` folders, the owner id is a shape id. The store is the only code that touches these files, so a later move to MySQL replaces `save_layer_note`, the index and `archive_layer_notes` only.
**Verify:** `php tests/php/run.php | tail -15`, `php tests/data/run.php | tail -15`, `node tests/js/run.js parity`.
**Follow-ups:** none.

## 2026-11-14 — T-021: route types and fields in the shape store (written afterwards; commits `b0b76d2`, `571630d`)

- **What:** `service/store.php` and `dev/save-handler.js`: shape types `trade`, `military`, `migration`, `journey`, `road` (`ROUTE_TYPES`); a route has optional `stops` (ordered ids of existing places, at most 60; error `unknown place among the route stops`) and `twoway` (boolean; error `twoway must be true or false`); a route must be a line (`a route must be a line`); `clean_shape` and `cleanShape` take the places.
- **Why:** routes are stored with the borders, in `shapes.geojson`, with the same layers and period filter (T-021).
- **Files:** `service/store.php`, `dev/save-handler.js`, `docs/05-data-model.md`, `docs/06-http-interface.md`, `docs/02-implemented-features.md`.
- **How to verify:** `php tests/php/run.php`, `node tests/js/run.js` (parity table).
- **Follow-ups:** `tests/fixtures/rules.json` and `tests/php` have no test for the three errors (stops, twoway, line): T-032.
