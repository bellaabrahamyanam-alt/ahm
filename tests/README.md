# Tests for `ahm/map`

Four parts, built one at a time (owner's order). Each part has its own folder and runner and needs nothing installed beyond
the tool that runs the part.

| Part | Folder | Runs with | Status |
| --- | --- | --- | --- |
| 1. PHP | `tests/php/` | `php tests/php/run.php [filter]` | **done** (143 tests; `SqlSchemaTest`, `SqlTransferTest` and `CardTest` need `php-sqlite3`, and run on MySQL too when `AHM_TEST_MYSQL_DSN` is set) |
| 2. Data | `tests/data/` | `php tests/data/run.php [path]` | **done** (38 tests) |
| 3. JavaScript | `tests/js/` | `node tests/js/run.js [filter] [--no-browser]` | **done** (includes `features.test.js` and `campaigns.test.js`) |
| 4. CSS / HTML | `tests/web/` | `node tests/web/run.js` (headless Chromium) | planned, below |

`tests/fixtures/` holds data shared by several parts: `dates-vectors.json` (made by `app/js/core/dates.js`, must give identical answers in
`service/dates.php`; read by the PHP and the JS tests) and `rules.json` (58 validation cases that the PHP store **and** the Node dev
server must judge identically; read by `tests/php/ParityTest.php` and `tests/js/parity.test.js`).

## Part 1 — PHP (done)

No PHPUnit, no phpBB, no network. `run.php` loads `*Test.php`; each test works on a throw-away copy of `data/`
(`sandbox()` / `fresh_store()` in `harness.php`). Files:

| File | Covers |
| --- | --- |
| `DatesTest` | ISO 8601 text (canonical spelling only), alignment per format, period ends, `clean`, `bounds`, `order_check`, old-data conversion, **parity with the JS date model** (fixture) |
| `PlaceTest` | new place / `place_update`: names, coordinates, types, dates, mountain height, language dictionary, archive copies, sample-data sanity |
| `NoteTest` | notes: required fields, language, date, edit + archive, header-injection, search index |
| `LanguageTest` | dictionary: sample coverage, creation from data, add, bad codes, archive |
| `MigrationTest` | old formats to the current one (places, notes, `layers:` header kept), idempotent, sample data converted without loss |
| `OverlayTest` | historical map images: validation, UTC stamps, image sniffing, archive on delete |
| `LayerTest` | categories, layers, ordered members, note tags, layer notes, dispatcher, delete, unique archive names |
| `ControllerTest` | permissions (guest 401 / member / admin, editors=members|admins), 415/400 handling, data and page config — **with stand-ins for phpBB** |
| `RoutingTest` | `routing.yml` vs the controller (methods exist, POST for writes), data list names, `php -l` on every PHP file |

Not covered: behaviour inside a live phpBB (login, `a_` permission, route generation, Quick links event), concurrent writes
(lock is used but not stress-tested), the Node dev server (part 3).

## Part 2 — Data (done)

Checks the **data files**, not the code. `DataCheck::run($dir)` (read only, returns `[code, message]` problems) is used three ways:

- `php tests/data/run.php` — runs `DataTest`: the shipped `data/` as it is (old format: only the known old-format notices are allowed,
  nothing structural), the same data after `store::migrate()` (must give **zero** problems), a store built through the API (zero
  problems), a proof that the checker never writes, **33 deliberate defects** (each must be reported with its own code) and the CLI.
- `php tests/data/run.php /path/to/store/ahm_map` — read-only check of a live store; prints each problem; exit 1 if any.

What it checks: JSON validity and presence of every file; language / category / layer / place / note ids (UUID, unique, header id =
file name); languages used are in the dictionary (places, notes, layers, descriptions); place type, coordinates, names; mountain height
and "mountains have no dates, others no height"; every date normalised ISO text and begin ≤ end; layer members exist, no duplicates, colour
`#rrggbb` lower case, one description per language, category exists, UTC stamps; notes tied to layers that exist and contain the place;
orphan note folders (places and layers); overlay image files; the two generated indexes equal a rebuild from the files.

Not covered: archive contents, file permissions, sizes of images, data that lives only in phpBB (users, permissions).
**Open question for the owner:** the shipped sample is still in the old format (`<lang>.md` note files, year numbers). Converting it
would let the shipped data pass strictly; until then the test only allows the listed old-format notices.

## Part 3 — JavaScript (done)

`node tests/js/run.js [filter] [--no-browser] [--domain=<name>]` (`--domain` runs only the test files the domain owns in `tools/domains.json`; CI runs everything in ONE job, `tools/ci.sh`; Node 22; Playwright + Chromium and ESLint are used when installed, otherwise those
tests print "skipped"). No dependencies in the repository. `lib/ctx.js` loads the classic scripts into a `vm` context in `index.html` order
with a small DOM stand-in (so a name declared twice in two scripts fails here just like in a page); `lib/devserver.js` starts the Node dev
back-end plus static files on a free port, on a throw-away copy of the extension.

| File | Covers |
| --- | --- |
| `dates.test.js` | the date model: ISO spelling, 20 000 random days vs JavaScript's `Date`, every format CE/BCE round trip, alignment, period ends, `dateClean` refusals, upgrade, bounds, wording, old-data parser, **shared vectors** |
| `data.test.js` | `esc`, `norm`, `normPlace`/`normNote`/`normLayer` (old and new data), `label`, `langName`, `placeWhen`, optional layer files missing = no layers |
| `search.test.js` | `run()`: types, accents/case, note hits, language, period overlap, sort with unknown dates last, layer filters combined with text |
| `layers.test.js` | `layerAllows` (only = OR, hide = NOT IN, both, edit bypass), toggling, note scope, halo, deleted layers dropped from filters, **HTML escaping**, search by category, choosing places sends ONE request |
| `parity.test.js` | the Node dev server against `rules.json` (same table as PHP), broken / non-object JSON = 400, archive copies never overwritten |
| `lint.test.js` | ESLint over all browser scripts as one program (undefined and doubly declared names), the Node files, syntax, no modules |
| `browser.test.js` | two real-browser scenarios (map library stubbed): languages, dates in many formats, mountain height, notes, ISO on disk; tabs, sheets, filters, layers, categories |

Not covered: map drawing (MapLibre is a stand-in), `ui.js` internals beyond what the scenarios touch, mobile gestures, real phpBB.

## Part 4 — CSS / HTML (plan; nothing written yet)

Headless Chromium (Playwright), map library stubbed, runner `node tests/web/run.js`. It will reuse `tests/js/lib/devserver.js` and the
stand-in and page-error collection from `tests/js/browser.test.js`, so no new infrastructure is needed:

- **Structure of `index.html`:** every `id` unique; every `$('#…')` used by the scripts exists; no `colours.css` link; script order matches
  `AGENTS.md`; three tabs; sheets are siblings of `.body`; dialogs have a title and a Cancel; `lang`, viewport meta, title.
- **Accessibility basics:** every input/select has a label or `aria-label`; icon-only buttons have `title` or `aria-label`; tab order
  reaches search → tabs → list; Esc closes a sheet and a dialog; focus is not lost after Save.
- **Layout:** at 1280 px and 390 px no horizontal scroll; sheet action bar always visible; collapsed sidebar and resizer work; long names wrap.
- **CSS:** every `var(--x)` used is defined in the first `:root` block; no rule overrides a `[hidden]` element's display by accident
  (the `.sheet[hidden]` class of bug); colour contrast of text on `--base-bg` / `--bg2-bg-color` ≥ 4.5:1 for body text.
- **Visual:** screenshots of Explore, Layers, a place sheet, a layer sheet, a dialog at both widths are saved for a human to look at
  (not pass/fail), with a pixel-diff against the previous run reported as a notice.
