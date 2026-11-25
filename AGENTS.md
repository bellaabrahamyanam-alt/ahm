# Instructions for any AI agent working on this extension (`ahm/map`)

The owner's standing requirements. They apply to **every** answer and **every** change. There are two agents: **`builder`** (does one item of `TODO.md` from spec to pull request) and **`critic`** (verifies the pull request and merges, or reports to the owner). Their rules: `.claude/agents/builder.md`, `.claude/agents/critic.md`; the working method and git workflow: `DOMAINS.md`. A session without a named role (the owner talks to you directly) follows sections 2 to 5 and puts any larger piece of work into `TODO.md` first.

## 1. Start here (read nothing else first)

1. Your role and item come from the owner's command: `builder: T-012` (or `next`, or a free description), `critic: PR #<n>`. Open your role file in `.claude/agents/`, then the item in `TODO.md`.
2. For each domain the item touches open `context/<domain>.md` (what to read first, the code of the domain). Find the part to open in `graph/<domain>.md` and read it with offset and limit. Do not browse the rest of the project.
3. Work. Before delivering run the checks of section 5.

Other documents, only when the item needs them: `DOMAINS.md` (domains, working method), `INTERFACES.md` and `interfaces/` (contracts), `docs/` (the project description, one file per section, index in `README.md`). Never read `changes/archive/` whole (old task specs, proposals, logs).

## 2. Owner's working requirements (always follow)

1. **English only.** Talk to the owner in English, and write all code, comments, commit labels, documentation, test names and messages in English, even if the owner writes in another language.
2. **Record every change for other agents.** An entry in `changes/<domain>.md` of each domain you changed (date, what, why, files, how to verify, follow-ups), in the same pull request. Another agent must be able to continue from that file alone. When a log grows past about 10 entries, move the oldest to `changes/archive/<domain>-NNN-NNN.md`.
3. **Deliver by pull request** (`DOMAINS.md`, "Git workflow"): the pull request is the diff and the repository is the archive. Only the `critic` merges. The old diff-file and archive rules: `docs/legacy-chat-workflow.md`.
4. **Keep these requirements.** This file stores them; changing it needs an item with an `Approved:` line (protected file). If the owner adds, changes or removes a requirement, the builder updates this file in an approved item.
5. **`TODO.md` is the only list of work.** No proposals, requests or task-spec files. Do only what the item says, nothing outside it. A follow-up you find becomes a new item, not a comment. What only the owner can decide goes under "Needs you" with 2 or 3 options and your recommendation; you stop that item.
6. **Domains and interfaces.** Domains (sidebar, map, data, core, state, campaigns, shared; `tools/domains.json`) are areas of the code, not walls: one item may touch several. The sidebar and the map talk only through `window.AHM`; you add no cross-domain call beyond `INTERFACES.md` ("Known violations" lists the existing ones). **Protected files** (`protected` in `tools/domains.json`: these rules, contracts, CI, ownership) change only in an item with an `Approved:` line of the owner; the PR description then holds `Owner-approved: T-NNN`.

## 3. Token rules (they save the owner's tokens)

- Read `context/<domain>.md` and only what it lists; open a file once, and only the part you need.
- Change files with small edits, never by rewriting a whole file. Do not re-read a file you just wrote.
- Cut test and tool output: `| tail -15`, and `| cut -c1-300` when a line can be long.
- Do not paste files or test output into answers. Say what changed and the result in a few lines.
- One item per session; the next item starts a new session.
- Never open `changes/archive/`, `app/bun.lock`, `tests/fixtures/dates-vectors.json` or `node_modules` (denied in `.claude/settings.json`).
- When a domain's files change a lot, update `tools/context.json` and run `node tools/make-context.js` (`tests/js/context.test.js` fails if `context/` is stale). `node tools/make-context.js --cost` shows the bytes a starter makes an agent read.

## 4. Project rules (details: `docs/09-code-style.md`)

- No build step in development: classic scripts in the order listed in `app/index.html`, served as they are. Production serves the minified bundle `app/dist/` (JS and CSS; whitespace and syntax only, names are never renamed). After you change a file listed in the marked blocks of `app/index.html` (`<!-- ahm:js -->`, `<!-- ahm:css -->`), run `bun tools/build.js` and commit `app/dist/`; `tests/js/build.test.js` fails when it is stale. New browser code never builds markup from strings: static HTML with daisyUI classes in `app/index.html`, JavaScript clones `<template>` elements and fills them with `textContent`/`value`/attributes (see `docs/09-code-style.md`, `app/js/sidebar/kit.js`). `esc()` stays only in the v1 pieces that screens have not converted yet.
- All data rules live in `service/store.php` (no phpBB classes) and are mirrored in `dev/save-handler.js`. A rule changed in one must be changed in the other.
- The place-type list is kept in three places: `PLACE_TYPES` (`sidebar/placeform.js`), `TYPE_STYLE` (`map/typeicons.js`), `TYPES` (`store.php`, `save-handler.js`).
- Every write: lock, archive the old file, atomic write. Never delete data without an archived copy.
- Prettier settings: 120 columns, 2 spaces, single quotes. `app/css/*.css` are hand-formatted.
- Update the matching `docs/` section (index: `README.md`) when behaviour, structure, routes or data format change.

## 5. Checks before you deliver

- Branch `<type>/<task>` (feat, fix, docs, test, refactor, chore); never push to `master`. Changed `app/js` or `app/css`: `bun tools/build.js` first.
- `node tools/ci-check-pr.js <branch> origin/master`, then `node tests/js/run.js 2>&1 | tail -15`; add `php tests/php/run.php` and `php tests/data/run.php` for `service/`, `controller/` or the data format. 
- Add a test for every new rule. A validation rule lives in three places (PHP store, Node dev server, and the table `tests/fixtures/rules.json` that checks both): change all. When a PHP rule changes, change `dev/save-handler.js` too.
- Plans and status of the tests: `tests/README.md`.

## Facts about this project that must not be "fixed" again

- **There is NO `app/css/colours.css` and there must never be a link to it.** The owner confirmed it never existed.
  The palette is the first `:root` block of `app/css/base.css` (copied from the forum style `paper-and-pencil`,
  the forum style `paper-and-pencil` (no longer in the repository)). `app/index.html` links `css/base.css`, `css/sidebar.css`, `css/map.css` (the old single `style.css` was split in step 2). Do not recreate the file.
- `data/overlays.json` is `{ "version": 1, "overlays": [] }` (content given by the owner).
- Languages come from a dictionary (`data/languages.json`); only administrators add to it. No free-text language fields.
- Dates are optional everywhere and use one model (`app/js/core/dates.js` = `service/dates.php`): unknown (`null`), or
  `{ fmt, ts, mode: exact|approx|range, ts_to }`. A mountain has `height_m`, never dates.
- **Every stored timestamp is ISO 8601 / RFC 3339 text in UTC with `Z`** (owner's rule). Date `ts`/`ts_to`: four-digit years
  0000–9999, otherwise ISO 8601 expanded years `±YYYYYY` (year 0000 = 1 BCE, so 1200 BCE = `-001199-01-01T00:00:00Z`).
  Never store bare seconds. Never compare the text alphabetically (BCE sorts wrongly): use `isoToSec` / `iso_to_sec`.
  Overlay `created`/`updated` are `YYYY-MM-DDTHH:MM:SSZ`. Archive file names use the compact basic form (`Ymd-His`).
- **Layers:** the general layer is implicit (all places, all notes). Layers are subsets (`data/layers.json`, ordered `members`),
  categories are a dictionary (`data/categories.json`, admins add/rename, no delete). The period filter ignores layers (owner's
  decision). No box-select. The old "Layers" tab (base map, historical maps) is now **Maps**; "Layers" is the new feature.
  Removing a place from a layer never touches the general layer. Rules mirrored in `store.php` and `dev/save-handler.js`.
- **Sidebar structure (owner asked for a calmer, consistent UI):** tabs Explore / Layers / More; the details of a place or a
  layer open **inside the list, under that item** (no overlay, no Back button; a second click folds them; only a double click
  moves the map); tables without lines for languages and categories; every search field is the shared field with a ✕; primary
  action = `button.primary`, destructive = `.danger`. Keep new screens in this pattern.

