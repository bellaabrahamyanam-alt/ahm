-- The tables of the extension for SQLite (T-096): the development and test board runs on it. `{p}` is the table prefix of the board.
-- The same tables and columns as schema.mysql.sql; `data` is TEXT that must be valid JSON. Statements end with a semicolon at the end of a line.
CREATE TABLE {p}ahm_objects (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  pos INTEGER NOT NULL DEFAULT 0,
  lon REAL NULL,
  lat REAL NULL,
  type TEXT NULL,
  topic_id INTEGER NULL,
  import_id INTEGER NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE INDEX {p}ahm_objects_kind_ll ON {p}ahm_objects (kind, lon, lat);
CREATE INDEX {p}ahm_objects_kind_type ON {p}ahm_objects (kind, type);
CREATE INDEX {p}ahm_objects_topic ON {p}ahm_objects (topic_id);
CREATE TABLE {p}ahm_lists (
  list TEXT NOT NULL,
  item_key TEXT NOT NULL,
  pos INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (list, item_key)
);
CREATE INDEX {p}ahm_lists_pos ON {p}ahm_lists (list, pos);
CREATE TABLE {p}ahm_note_meta (
  post_id INTEGER NOT NULL PRIMARY KEY,
  data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE TABLE {p}ahm_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  user_id INTEGER NULL,
  at INTEGER NOT NULL,
  places INTEGER NOT NULL DEFAULT 0,
  shapes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE {p}ahm_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  rev_no INTEGER NOT NULL,
  action TEXT NOT NULL,
  user_id INTEGER NULL,
  at INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  import_id INTEGER NULL,
  snapshot BLOB NOT NULL
);
CREATE UNIQUE INDEX {p}ahm_revisions_entity ON {p}ahm_revisions (entity_kind, entity_id, rev_no);
CREATE INDEX {p}ahm_revisions_at ON {p}ahm_revisions (at);
CREATE INDEX {p}ahm_revisions_user ON {p}ahm_revisions (user_id, at);
