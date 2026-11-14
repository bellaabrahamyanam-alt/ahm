# TODO: the only list of work

The single place for what is to be done. It replaces task specs, proposals and requests (they are history in `changes/archive/`).

**How it works**
- The owner adds items and decides. The `builder` agent takes an item (`builder: T-003`, or `builder: next`), does it all (spec, tests, design, code, docs) and opens a pull request. The `critic` agent checks the pull request and merges it, or reports to the owner.
- One item = one pull request. Item ids `T-NNN` are never reused.
- **Needs you** holds what only the owner can decide. The builder writes the question there with 2 or 3 options and a recommendation, and stops that item. The owner answers by adding a line `Approved: <date> <decision>` to the item.
- **Protected files** (list `protected` in `tools/domains.json`: agent rules, CI, contracts `INTERFACES.md` and `interfaces/`, ownership) change only in an item that has an `Approved:` line. The pull request description then has `Owner-approved: T-NNN`, and the critic checks it against this file on `master`.
- When an item is finished the builder moves it to **Done** with the date and the pull request number. Keep the last 15 in Done; older ones go to `changes/archive/`.

Item format: `- [ ] T-NNN Title` then indented lines: `Done when:` (what can be checked), `Contract:` yes or no (does it change `INTERFACES.md`).

## Needs you (owner)

- [ ] T-026 Decide: amend `interfaces/I-8` / `I-4` for the place types dictionary (T-025 deviates in 4 points)
  1. optional `style.size` 4–14 (without it city, town and village look alike); 2. codes may contain `_` (`inscription_site` already exists); 3. `typeIcon` also accepts a draft `{ symbol, color, size }` (editor preview). Recommendation: yes to all three.
  4. custom symbols: `style.symbol = "custom"` with `style.path` (SVG path data) and `style.box`. Recommendation: yes.
  Also: line and area types (and the seed `border`, `route`, `territory`) are not built yet; separate item.
  Done when: you write `Approved: <date> yes` or the points you refuse.
  Contract: yes.

- [ ] T-001 Decide: map extension points for the campaigns feature (old proposal 002, `changes/archive/proposals/002-map-extension-points.md`)
  Done when: you write `Approved: <date> yes` or `no`. Yes means the builder adds the extension points to the map and the contract (I-5).
  Contract: yes.
- [ ] T-002 Decide: Known violation 4 in `INTERFACES.md` (`drawShape`, `showMenu`, `map:menu` differ from the contract rows)
  Done when: you choose for each row: change the code to the contract, or change the contract to the code. Recommendation: change the contract to the code (the code works and is tested; 3 rows).
  Contract: yes.
- [ ] T-003 Describe the requirements of the campaigns feature
  Done when: a few lines of what a campaign is and what it must do. Until then nothing is built (`app/features/campaigns/`).
  Contract: no.
- [ ] T-004 GitHub settings no agent can change
  Done when: (1) Settings > Branches: protect `master`, require pull request and the check `ci`; (2) Settings > General: squash merge on, "Automatically delete head branches" on; (3) secret `GRAPH_PUSH_TOKEN` (fine-grained token, repository `ahm`, Contents: read and write) in Settings > Secrets and variables > Actions; (4) delete the old branches `ci-github`, `fix-github-ci-owner`, `shared/fix-github-ci-owner`, `shared/agent-efficiency`, and decide about `feature/routes`.
  Contract: no.

## Next (builder)

- [ ] T-025 Place types dictionary (admins add markers such as iron mine, cedar forest, sword artefact) — this branch `feat/place-types-dictionary`
  Done when: PR merged; the 4 owner decisions below are answered.
  Contract: no (`interfaces/I-8` is not edited; the code follows it except the points below).

- [ ] T-029 Tests for the sidebar fixes and layout (audit of specs 007 and 012: the code exists, the tests the specs asked for do not; `tests/js/sidebar.test.js` has 4 tests, all about types)
  Done when: tests show a double click selects no text, no frame shows the previous place after a click, Save of the language and category forms is disabled until the input is valid and Rename opens at the bottom of the fold, the dock opens and closes without moving the list, and the point-menu actions run the old code.
  Contract: no.
- [ ] T-030 Tests for the map point menu (audit of spec 010: `showMenu`, `hideMenu`, `map:menu` exist in `app/js/map/map.js`; `tests/js/map.test.js` has no test of them)
  Done when: tests show the menu opens above the point and below when there is no room, a button emits `map:menu { id, lon, lat }` and closes it, Esc, a click elsewhere, a drag or zoom and another menu close it, and one menu at a time.
  Contract: no.
- [ ] T-031 Shapes as layer members (audit of specs 011 and 014: `add_shapes` and `remove_shapes` are in `service/store.php`; there is no `layerAllowsShape`, no test, no row in `tests/fixtures/rules.json`, no "Shapes (n)" or "Choose shapes" in the layer detail)
  Done when: `layerAllowsShape(id)` exists in core with the Only/Hide meaning of places; tests (PHP, Node, `rules.json`) cover `add_shapes`, `remove_shapes`, an unknown id (400) and the removal of a deleted shape from all layers; the layer detail shows "Shapes (n)" and lets an editor add and remove shapes.
  Contract: no.
- [ ] T-032 Route rules in the parity table (follow-up of T-021: `stops`, `twoway` and `a route must be a line` have no row in `tests/fixtures/rules.json` and no PHP test)
  Done when: `rules.json` has a row for each of the three errors and one for a route that saves, and `php tests/php/run.php` and `node tests/js/run.js` pass.
  Contract: no.
- [ ] T-033 Map: parts of spec 013 that are missing (audit): `hideShape(id | null)` and the line patterns `double` and `triple` (the code has solid, dashed, dotted, dashdot)
  Done when: each exists in `app/js/map/` with a test in `tests/js/map.test.js`, or the owner drops it.
  Contract: no.
- [ ] T-034 Owner decision: line and area types (specs 011 and 014 wanted `border`, `route` and `territory` in the types dictionary and a Types editor for lines and areas; built: the dictionary holds only point types, border and route types are fixed lists in `service/store.php`)
  Done when: the owner says keep the fixed lists or make them dictionary types; in the second case the builder gets an item.
  Contract: no.
- [ ] T-011 Make `graph/` cheaper to use: line ranges per definition
  Done when: `graph/<domain>.md` lists `name:line` for the definitions of each file, so an agent opens a part with offset and limit without a search; the size limits of `tests/js/graph.test.js` still hold or are changed with the reason. Measure before and after (bytes an agent reads for one change in `map.js`).
  Contract: no.
- [ ] T-012 CSS and HTML tests (part 4 of `tests/README.md`)
  Done when: the tests listed in part 4 exist and pass; no application change.
  Contract: no.
- [ ] T-013 Controller sends `features: ['campaigns']` when the owner switches the feature on (needs T-003)
  Done when: a data test shows the list in the page data; the forum setting is documented in `docs/10-*.md`.
  Contract: yes (I-1).

- [ ] T-028 Update the text that still tells agents to run `bun tools/build.js` before a PR (`AGENTS.md` section 4 and line 43, `.claude/agents/builder.md` step 4, `DOMAINS.md`): CI now rebuilds `app/dist/` (T-006)
  Done when: the texts say a PR need not commit `app/dist/` (a local build is still allowed); `tests/js/build.test.js` stays unchanged. Needs `Approved:` (protected: `AGENTS.md`, `.claude/`, `DOMAINS.md`).
  Contract: no.

## Done

- [x] T-029 Split `sidebar/ui.js` into five files, no change of behaviour (2026-11-14, branch `refactor/sidebar-ui`)
  Owner, in the chat: "Сделай рефакторинг sidebar/ui.js в отдельной PR"; scope chosen: 4–5 files. No protected file changed (`app/js/sidebar/` is one folder entry in `tools/domains.json`).
- [x] T-024 Harden the `app/dist` check (2026-11-14, branch `chore/records-ci-audit`)
  Approved: 2026-11-14 owner, in the chat. `build.js --check` also fails when a bundle differs in size from the manifest; the name test finds declarations (`hasDeclaration`); tests show each failure.
- [x] T-022 Block commits that skip CI (2026-11-14, same branch)
  Approved: 2026-11-14 owner, in the chat. `tools/ci-check-pr.js` refuses a commit with a skip marker that changes more than documents; critic rule A8. Not done: branch protection (T-004).
- [x] T-021 Log and document the Routes tab (2026-11-14, same branch). Entries in `changes/{sidebar,core,map,data}.md`; `docs/02`, `05`, `06` name the Routes tab and the shape format. The sidebar part has no test (the `rt*` functions need the page DOM); the entry says so.
- [x] T-010 Audit the old task specs 006 to 014 against the code (2026-11-14, same branch). Result: `changes/shared.md`, "T-010 audit"; the open parts are T-029 to T-034.
- [x] T-006 CI rebuilds `app/dist/` like `graph/` (2026-11-14, branch `chore/ci-dist`)
  Approved: 2026-11-14 owner, in the chat: yes. In a PR the job `ci` runs `bun tools/build.js` (Bun 1.4.4) only when `node tools/build.js --check` finds `app/dist/` stale, and commits `graph/` and `app/dist/` together.
- [x] T-027 Notes for borders and routes (2026-11-14, branch `feat/shape-notes`)
  Owner, in the chat: "let's add notes for routes and boards" (borders). No protected file changed. Notes are layer notes whose owner id is a shape id.
- [x] T-023 The page controller serves the bundle only when its files exist (2026-11-12, PR from branch `fix/dist-guard`)
  From the review of PR #8 (`critic`); no protected file changed.
- [x] T-005 Minify the JS and CSS with Bun (2026-11-12, PR from branch `feat/minify-bun`)
  Approved: 2026-11-12 owner, in the chat: "let's now just minify js and css only with bun. Do it and create PR" (covers `AGENTS.md`, `.claude/agents/builder.md`, `tools/domains.json`, both CODEOWNERS). Vite, webpack and HTML minify were left out on purpose.
- [x] T-020 Fix red CI on `master` after the `feature/routes` merge (2026-11-12, PR from branch `fix/master-ci`)
  Approved: 2026-11-12 owner, in the chat: "review master branch and fix red CI". Covers the protected files touched: `tools/domains.json` (owner of `tests/js/routes.test.js`: core), `interfaces/I-2-sidebar-map.md` and `tests/js/contract.test.js` (`showFound` added to the contract, because the Routes tab already used it). If you want `showFound` out of the contract, say so and it becomes an item.
- [x] T-000 Workflow: one `builder` and one `critic`, one `TODO.md`, no proposals (2026-11-12, PR from branch `chore/builder-critic`)
  Approved: 2026-11-12 owner, in the chat: one major agent, one critic/gatekeeper, only todos, no proposals.
