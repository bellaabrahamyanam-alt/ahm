<!-- Section 11 of the project description; index: README.md -->

## 11. Local development

You do not need phpBB. You need Node.js.

```sh
# from the repository root
npx browser-sync start --config dev/bs-config.js     # then open http://localhost:3000
```

- The page and its scripts are served from `app/`; `/data` is served from `data/`; `dev/save-handler.js` provides the `/api/…` endpoints. Changes to `app/` reload the page; changes to `data/` do not (saving a place must not reload it).
- In development **everyone may edit and manage overlays** (there is no login).
- Saving writes into `data/` itself, so the sample data changes as you work. Copies of replaced files go to `dev/archive/`.
- If you edit a note file by hand, rebuild the search index: `python3 dev/build_notes_index.py data/notes`.
- Format before committing: `npx prettier --write .` (uses `.prettierrc.json`; `data/`, `styles/` and `app/css/` are skipped by `.prettierignore`).

### A phpBB board on SQLite (T-095, T-096)

To run the extension inside a real phpBB, with the forum "Map", the SQL tables and the sample data, in one command:

```sh
tools/dev/phpbb-up.sh          # first time: clones phpBB 3.3.19, composer install, installs it on SQLite, enables ahm/map, fills it
tools/dev/phpbb-up.sh serve    # http://127.0.0.1:8080/app.php/map   (admin / adminadmin)
tools/dev/phpbb-up.sh check    # tables, forum, topics, posts, revisions and the answers of the map
tools/dev/phpbb-up.sh reset    # delete the board
```

- Needs git, composer and PHP with sqlite3, pdo_sqlite, mbstring, xml, zip, curl and gd. The board is in `.dev/` (ignored by git; change it with `AHM_DEV_DIR`, the tag of phpBB with `PHPBB_TAG`, the port with `PORT`). The extension is linked into `ext/ahm/map`, so edits show at once.
- Enabling the extension runs `migrations/m001_storage.php`, which makes `ahm_objects`, `ahm_lists`, `ahm_note_meta`, `ahm_imports` and `ahm_revisions` from `service/sql/schema.sqlite.sql` (or `schema.mysql.sql` on MySQL and MariaDB, where `data` is the native `JSON` type).
- `tools/dev/seed.php` then loads the files of `store/ahm_map/` into the tables, makes the forum Map with Places, Layers and Shapes, one topic with a card for every place, shape and layer (the text of `service/card.php`, edit-locked) and the notes as posts with their row in `ahm_note_meta`. Run again, it does nothing.
- The map still reads and writes the files; the SQL tables are what the next steps (T-104 on) will use.
- The PHP tests need `php-sqlite3` (`apt install php-sqlite3`). To run the SQL tests on MySQL too: `AHM_TEST_MYSQL_DSN='mysql:host=127.0.0.1;dbname=ahm_test;charset=utf8mb4' AHM_TEST_MYSQL_USER=… AHM_TEST_MYSQL_PASS=… php tests/php/run.php sql` (the database must exist; the tests make and drop their tables with the prefix `tst_`).

---
