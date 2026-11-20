<?php
namespace ahm\map\service;

/**
 * The SQL side of the data (T-076): the tables of service/sql/schema.<driver>.sql and the transfer between the files of the store and
 * these tables. It works on PDO (SQLite or MySQL/MariaDB) and knows nothing about phpBB. A note is not kept here: it is a phpBB post
 * (title and text) plus a row of ahm_note_meta (language, date, layers); read_notes(), note_meta() and write_notes() convert the note files
 * for that. The order of places, shapes and layers is the order of the files (column pos).
 */
class sql_transfer
{
    const TABLES = ['ahm_objects', 'ahm_lists', 'ahm_note_meta', 'ahm_imports', 'ahm_revisions'];
    /** list => [name of the array in its file, key field of an entry] */
    const LISTS = [
        'languages' => ['languages', 'code'],
        'categories' => ['categories', 'id'],
        'types' => ['types', 'code'],
        'overlays' => ['overlays', 'id'],
        'sources' => ['sources', 'id'],
    ];
    const FILE_VERSION = 1;
    const PLACES_VERSION = 3;
    const JSON = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION;

    private $db;
    private $p;

    public function __construct(\PDO $db, $prefix = '')
    {
        $this->db = $db;
        $this->p = $prefix;
        $db->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(\PDO::ATTR_EMULATE_PREPARES, false);
        $db->setAttribute(\PDO::ATTR_STRINGIFY_FETCHES, false);
    }

    // ---- schema ----

    /** The schema file of a database layer: phpBB's name (sqlite3, mysqli) or PDO's (sqlite, mysql). */
    public static function schema_file($layer)
    {
        if ($layer === 'sqlite' || $layer === 'sqlite3') {
            return __DIR__ . '/sql/schema.sqlite.sql';
        }
        if ($layer === 'mysql' || $layer === 'mysqli' || $layer === 'mysql4') {
            return __DIR__ . '/sql/schema.mysql.sql';
        }
        throw new \InvalidArgumentException("ahm/map keeps its data in SQLite or MySQL/MariaDB, not in '$layer'");
    }

    /** The statements of a schema file, with the table prefix put in. */
    public static function statements($file, $prefix)
    {
        $sql = '';
        foreach (file($file, FILE_IGNORE_NEW_LINES) as $line) {
            if (!preg_match('/^\s*--/', $line)) {
                $sql .= $line . "\n";
            }
        }
        $sql = str_replace('{p}', $prefix, $sql);
        return array_values(array_filter(array_map('trim', explode(";\n", $sql)), 'strlen'));
    }

    public function create_schema()
    {
        foreach (self::statements(self::schema_file($this->db->getAttribute(\PDO::ATTR_DRIVER_NAME)), $this->p) as $sql) {
            $this->db->exec($sql);
        }
    }

    public function drop_schema()
    {
        foreach (array_reverse(self::TABLES) as $t) {
            $this->db->exec('DROP TABLE IF EXISTS ' . $this->p . $t);
        }
    }

    // ---- small helpers ----

    private function t($name)
    {
        return $this->p . $name;
    }

    /** Runs a prepared statement. A float goes in as its shortest exact text, so that no digit of a coordinate is lost. */
    private function run($sql, array $params = [])
    {
        $st = $this->db->prepare($sql);
        $i = 0;
        foreach ($params as $v) {
            $i++;
            if (is_float($v)) {
                $v = json_encode($v);
            }
            $st->bindValue($i, $v, $v === null ? \PDO::PARAM_NULL : (is_int($v) ? \PDO::PARAM_INT : \PDO::PARAM_STR));
        }
        $st->execute();
        return $st;
    }

    private static function read_json($file)
    {
        $d = is_file($file) ? json_decode(file_get_contents($file), true) : null;
        if (!is_array($d)) {
            throw new \InvalidArgumentException("cannot read $file");
        }
        return $d;
    }

    private static function only_keys(array $a, array $keys, $what)
    {
        if ($x = array_diff(array_keys($a), $keys)) {
            throw new \InvalidArgumentException("$what has fields that the tables do not know: " . implode(', ', $x));
        }
    }

    private static function json($v)
    {
        return json_encode($v, self::JSON);
    }

    /** The first English name, else the first name (the rule of `label`). */
    public static function label(array $names)
    {
        foreach ($names as $n) {
            if (($n['lang'] ?? '') === 'en') {
                return (string) $n['name'];
            }
        }
        return $names ? (string) ($names[0]['name'] ?? '') : '';
    }

    private static function iso($ts)
    {
        return $ts === null ? null : gmdate('Y-m-d\TH:i:s\Z', (int) $ts);
    }

    private function revision($kind, $id, $label, array $snapshot, $import, $now)
    {
        $this->run(
            'INSERT INTO ' . $this->t('ahm_revisions') . ' (entity_kind, entity_id, rev_no, action, user_id, at, label, import_id, snapshot) VALUES (?, ?, 1, ?, NULL, ?, ?, ?, ?)',
            [$kind, $id, 'import', $now, mb_substr($label, 0, 255), $import, gzencode(self::json($snapshot))]
        )->closeCursor();
    }

    // ---- files -> tables ----

    /**
     * Loads the files of a store (current format, see store::migrate()) into the tables: lists, places, shapes, layers, and one `import`
     * revision for each. Notes are not loaded (see read_notes()). All or nothing. Returns the numbers and the id of the import.
     */
    public function import($dir, $file_name = 'files', $user_id = null)
    {
        $dir = rtrim($dir, '/') . '/';
        $now = time();
        $n = ['lists' => 0, 'places' => 0, 'shapes' => 0, 'layers' => 0];
        $this->db->beginTransaction();
        try {
            $this->run('INSERT INTO ' . $this->t('ahm_imports') . ' (file_name, user_id, at) VALUES (?, ?, ?)', [$file_name, $user_id, $now])->closeCursor();
            $import = (int) $this->db->lastInsertId();
            foreach (self::LISTS as $list => $def) {
                $f = self::read_json($dir . $list . '.json');
                self::only_keys($f, ['version', $def[0]], "$list.json");
                if ($f['version'] !== self::FILE_VERSION) {
                    throw new \InvalidArgumentException("$list.json is version " . json_encode($f['version']) . ', this code reads version ' . self::FILE_VERSION);
                }
                foreach ($f[$def[0]] as $pos => $item) {
                    $key = (string) $item[$def[1]];
                    unset($item[$def[1]]);
                    $this->run('INSERT INTO ' . $this->t('ahm_lists') . ' (list, item_key, pos, updated_at, data) VALUES (?, ?, ?, ?, ?)', [$list, $key, $pos, $now, self::json($item)])->closeCursor();
                    $this->revision('list', $list . '/' . $key, self::label($item['names'] ?? []) ?: (string) ($item['title'] ?? $item['name'] ?? $key), [$def[1] => $key] + $item, $import, $now);
                    $n['lists']++;
                }
            }
            $f = self::read_json($dir . 'places.geojson');
            self::only_keys($f, ['type', 'version', 'features'], 'places.geojson');
            if ($f['version'] !== self::PLACES_VERSION) {
                throw new \InvalidArgumentException('places.geojson is version ' . json_encode($f['version']) . ', this code reads version ' . self::PLACES_VERSION);
            }
            foreach ($f['features'] as $pos => $feat) {
                $p = $feat['properties'];
                if (($feat['geometry']['type'] ?? '') !== 'Point') {
                    throw new \InvalidArgumentException('place ' . $p['id'] . ' is not a point');
                }
                list($lon, $lat) = $feat['geometry']['coordinates'];
                $id = $p['id'];
                $type = $p['type'];
                unset($p['id'], $p['type'], $p['label']);
                $this->insert_object($id, 'place', $pos, (float) $lon, (float) $lat, $type, $import, $now, $now, $p);
                $this->revision('place', $id, self::label($p['names']), ['type' => $type, 'lon' => $lon, 'lat' => $lat] + $p, $import, $now);
                $n['places']++;
            }
            $f = self::read_json($dir . 'shapes.geojson');
            self::only_keys($f, ['type', 'features'], 'shapes.geojson');
            foreach ($f['features'] as $pos => $feat) {
                $p = $feat['properties'];
                $id = $p['id'];
                $type = $p['type'];
                $c = isset($p['created']) ? strtotime($p['created']) : $now;
                $u = isset($p['updated']) ? strtotime($p['updated']) : $now;
                unset($p['id'], $p['type'], $p['created'], $p['updated']);
                $p['geometry'] = $feat['geometry'];
                $this->insert_object($id, 'shape', $pos, null, null, $type, $import, $c, $u, $p);
                $this->revision('shape', $id, self::label($p['names']), ['type' => $type] + $p, $import, $now);
                $n['shapes']++;
            }
            $f = self::read_json($dir . 'layers.json');
            self::only_keys($f, ['version', 'layers'], 'layers.json');
            foreach ($f['layers'] as $pos => $l) {
                $id = $l['id'];
                $c = isset($l['created']) ? strtotime($l['created']) : $now;
                $u = isset($l['updated']) ? strtotime($l['updated']) : $now;
                unset($l['id'], $l['created'], $l['updated']);
                $this->insert_object($id, 'layer', $pos, null, null, null, $import, $c, $u, $l);
                $this->revision('layer', $id, self::label($l['names']), $l, $import, $now);
                $n['layers']++;
            }
            $this->run('UPDATE ' . $this->t('ahm_imports') . ' SET places = ?, shapes = ? WHERE id = ?', [$n['places'], $n['shapes'], $import])->closeCursor();
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
        return $n + ['import_id' => $import];
    }

    private function insert_object($id, $kind, $pos, $lon, $lat, $type, $import, $created, $updated, array $data)
    {
        $this->run(
            'INSERT INTO ' . $this->t('ahm_objects') . ' (id, kind, pos, lon, lat, type, import_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $kind, $pos, $lon, $lat, $type, $import, $created, $updated, self::json($data)]
        )->closeCursor();
    }

    // ---- tables -> files ----

    /** Writes places.geojson, shapes.geojson, layers.json and the five lists as files of a store (notes are not written). */
    public function export($dir)
    {
        $dir = rtrim($dir, '/') . '/';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $pretty = self::JSON | JSON_PRETTY_PRINT;
        foreach (self::LISTS as $list => $def) {
            $items = [];
            $st = $this->run('SELECT item_key, data FROM ' . $this->t('ahm_lists') . ' WHERE list = ? ORDER BY pos, item_key', [$list]);
            foreach ($st->fetchAll(\PDO::FETCH_NUM) as $r) {
                $items[] = [$def[1] => $r[0]] + json_decode($r[1], true);
            }
            file_put_contents($dir . $list . '.json', json_encode(['version' => self::FILE_VERSION, $def[0] => $items], $pretty));
        }
        $features = [];
        foreach ($this->objects('place') as $o) {
            $names = $o['data']['names'];
            $props = ['id' => $o['id'], 'label' => self::label($names), 'type' => $o['type']] + $o['data'];
            $features[] = ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [$o['lon'], $o['lat']]], 'properties' => $props];
        }
        file_put_contents($dir . 'places.geojson', json_encode(['type' => 'FeatureCollection', 'version' => self::PLACES_VERSION, 'features' => $features], $pretty));
        $features = [];
        foreach ($this->objects('shape') as $o) {
            $geometry = $o['data']['geometry'];
            unset($o['data']['geometry']);
            $props = ['id' => $o['id'], 'type' => $o['type']] + $o['data'] + ['created' => self::iso($o['created_at']), 'updated' => self::iso($o['updated_at'])];
            $features[] = ['type' => 'Feature', 'geometry' => $geometry, 'properties' => $props];
        }
        file_put_contents($dir . 'shapes.geojson', json_encode(['type' => 'FeatureCollection', 'features' => $features], $pretty));
        $layers = [];
        foreach ($this->objects('layer') as $o) {
            $layers[] = ['id' => $o['id']] + $o['data'] + ['created' => self::iso($o['created_at']), 'updated' => self::iso($o['updated_at'])];
        }
        file_put_contents($dir . 'layers.json', json_encode(['version' => self::FILE_VERSION, 'layers' => $layers], $pretty));
    }

    /** The rows of one kind, in file order: id, lon, lat, type, topic_id, version, created_at, updated_at, data (decoded). */
    public function objects($kind)
    {
        $out = [];
        $st = $this->run('SELECT id, lon, lat, type, topic_id, version, created_at, updated_at, data FROM ' . $this->t('ahm_objects') . ' WHERE kind = ? ORDER BY pos, id', [$kind]);
        foreach ($st->fetchAll(\PDO::FETCH_ASSOC) as $r) {
            $r['data'] = json_decode($r['data'], true);
            $r['lon'] = $r['lon'] === null ? null : (float) $r['lon'];
            $r['lat'] = $r['lat'] === null ? null : (float) $r['lat'];
            $out[] = $r;
        }
        return $out;
    }

    /** All lists as list => [key => entry] (for the text of a card). */
    public function lists()
    {
        $out = [];
        foreach ($this->db->query('SELECT list, item_key, data FROM ' . $this->t('ahm_lists') . ' ORDER BY list, pos')->fetchAll(\PDO::FETCH_NUM) as $r) {
            $out[$r[0]][$r[1]] = json_decode($r[2], true);
        }
        return $out;
    }

    public function set_topic($object_id, $topic_id)
    {
        $this->run('UPDATE ' . $this->t('ahm_objects') . ' SET topic_id = ? WHERE id = ?', [$topic_id, $object_id])->closeCursor();
    }

    // ---- notes ----

    /**
     * The notes of a store as arrays: kind (place|layer: a layer note also holds the notes of shapes), owner (the UUID), uuid (the old note id),
     * lang, title, text, date (array or null), layers (list of UUIDs). Strict: a header field that is not known stops it.
     */
    public static function read_notes($dir)
    {
        $dir = rtrim($dir, '/') . '/';
        $out = [];
        foreach (['notes' => 'place', 'layer-notes' => 'layer'] as $sub => $kind) {
            $owners = is_dir($dir . $sub) ? glob($dir . $sub . '/*', GLOB_ONLYDIR) : [];
            sort($owners);
            foreach ($owners as $d) {
                $files = glob($d . '/*.md');
                sort($files);
                foreach ($files as $file) {
                    $parts = explode("---\n", file_get_contents($file), 3);
                    if (count($parts) < 3 || $parts[0] !== '' || substr($parts[2], -1) !== "\n") {
                        throw new \InvalidArgumentException("$file is not a note in the format of the store");
                    }
                    $h = [];
                    foreach (explode("\n", rtrim($parts[1], "\n")) as $line) {
                        $k = (string) strstr($line, ': ', true);
                        $h[$k] = substr($line, strlen($k) + 2);
                    }
                    self::only_keys($h, ['id', 'lang', 'title', 'layers', 'date'], $file);
                    $out[] = [
                        'kind' => $kind, 'owner' => basename($d), 'uuid' => $h['id'], 'lang' => $h['lang'], 'title' => $h['title'],
                        'text' => substr($parts[2], 0, -1),
                        'date' => isset($h['date']) ? json_decode($h['date'], true) : null,
                        'layers' => isset($h['layers']) && $h['layers'] !== '' ? explode(',', $h['layers']) : [],
                    ];
                }
            }
        }
        return $out;
    }

    /** The part of a note that goes to ahm_note_meta. */
    public static function note_meta(array $note)
    {
        return ['uuid' => $note['uuid'], 'lang' => $note['lang'], 'date' => $note['date'], 'layers' => $note['layers']];
    }

    /** A note again from the owner, the title and text of its post and its meta. */
    public static function note_from($kind, $owner, $title, $text, array $meta)
    {
        return ['kind' => $kind, 'owner' => $owner, 'uuid' => $meta['uuid'], 'lang' => $meta['lang'], 'title' => $title, 'text' => $text, 'date' => $meta['date'], 'layers' => $meta['layers']];
    }

    /** The keys of a date in the order store.php writes them (a JSON column of MySQL keeps its own key order). */
    private static function date_order($d)
    {
        $out = [];
        foreach (['fmt', 'ts', 'mode', 'ts_to'] as $k) {
            if (array_key_exists($k, $d)) {
                $out[$k] = $d[$k];
            }
        }
        return $out + $d;
    }

    /** Writes notes as the files of a store (the same bytes as store.php writes them). */
    public static function write_notes($dir, array $notes)
    {
        $dir = rtrim($dir, '/') . '/';
        foreach ($notes as $n) {
            $d = $dir . ($n['kind'] === 'place' ? 'notes' : 'layer-notes') . '/' . $n['owner'];
            if (!is_dir($d)) {
                mkdir($d, 0775, true);
            }
            file_put_contents(
                $d . '/' . $n['uuid'] . '.md',
                "---\nid: {$n['uuid']}\nlang: {$n['lang']}\ntitle: {$n['title']}\n" .
                ($n['layers'] ? 'layers: ' . implode(',', $n['layers']) . "\n" : '') .
                ($n['date'] !== null ? 'date: ' . json_encode(self::date_order($n['date'])) . "\n" : '') .
                "---\n{$n['text']}\n"
            );
        }
    }

    public function add_note_meta($post_id, array $meta)
    {
        $this->run('INSERT INTO ' . $this->t('ahm_note_meta') . ' (post_id, data) VALUES (?, ?)', [$post_id, self::json($meta)])->closeCursor();
    }

    /** post_id => meta */
    public function note_metas()
    {
        $out = [];
        foreach ($this->db->query('SELECT post_id, data FROM ' . $this->t('ahm_note_meta') . ' ORDER BY post_id')->fetchAll(\PDO::FETCH_NUM) as $r) {
            $out[(int) $r[0]] = json_decode($r[1], true);
        }
        return $out;
    }
}
