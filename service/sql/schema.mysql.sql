-- The tables of the extension for MySQL and MariaDB (T-076). `{p}` is the table prefix of the board (phpbb_). Types are the same as in
-- schema.sqlite.sql (tests/php/SqlSchemaTest.php compares the table and column names). Statements end with a semicolon at the end of a line.
-- ahm_objects: one row = one place, shape or layer (places.geojson, shapes.geojson, layers.json). `data` is the rest of the entry as JSON.
CREATE TABLE {p}ahm_objects (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind VARCHAR(8) CHARACTER SET ascii NOT NULL,
  pos INT UNSIGNED NOT NULL DEFAULT 0,
  lon DOUBLE NULL,
  lat DOUBLE NULL,
  type VARCHAR(40) CHARACTER SET ascii NULL,
  topic_id INT UNSIGNED NULL,
  import_id INT UNSIGNED NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at INT UNSIGNED NOT NULL,
  updated_at INT UNSIGNED NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (id),
  KEY {p}ahm_objects_kind_ll (kind, lon, lat),
  KEY {p}ahm_objects_kind_type (kind, type),
  KEY {p}ahm_objects_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ahm_lists: one row = one entry of languages, categories, types (with their SVG), overlays or sources.
CREATE TABLE {p}ahm_lists (
  list VARCHAR(20) CHARACTER SET ascii NOT NULL,
  item_key VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  pos INT UNSIGNED NOT NULL DEFAULT 0,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at INT UNSIGNED NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (list, item_key),
  KEY {p}ahm_lists_pos (list, pos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ahm_note_meta: what a phpBB post has no place for: language, date, layers (and the old note id of a note that came from a file).
CREATE TABLE {p}ahm_note_meta (
  post_id INT UNSIGNED NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ahm_imports: one row = one load of a set of files (seed or GeoJSON upload).
CREATE TABLE {p}ahm_imports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  user_id INT UNSIGNED NULL,
  at INT UNSIGNED NOT NULL,
  places INT UNSIGNED NOT NULL DEFAULT 0,
  shapes INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ahm_revisions: the history (T-078): the whole state after a change, gzip JSON.
CREATE TABLE {p}ahm_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_kind VARCHAR(8) CHARACTER SET ascii NOT NULL,
  entity_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  rev_no INT UNSIGNED NOT NULL,
  action VARCHAR(8) CHARACTER SET ascii NOT NULL,
  user_id INT UNSIGNED NULL,
  at INT UNSIGNED NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  label VARCHAR(255) NOT NULL DEFAULT '',
  import_id INT UNSIGNED NULL,
  snapshot MEDIUMBLOB NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY {p}ahm_revisions_entity (entity_kind, entity_id, rev_no),
  KEY {p}ahm_revisions_at (at),
  KEY {p}ahm_revisions_user (user_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
