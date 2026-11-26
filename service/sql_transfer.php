<?php
namespace ahm\map\service;

/**
 * The SQL side of the data (T-096): the tables of service/sql/schema.<driver>.sql and the transfer between the files of the store and
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

    public function __construct(sql_driver $db)
    {
        $this->db = $db;
        $this->p = $db->prefix();
    }

    // ---- schema ----

    /** The schema file of a database layer: phpBB's name (sqlite3, mysqli) or the driver's (sqlite, mysql). */
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
        foreach (self::statements(self::schema_file($this->db->name()), $this->p) as $sql) {
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

    private static function read_json($file, $default = null)
    {
        if ($default !== null && !is_file($file)) {
            return $default;   // an older store may not have this file (no sources yet, no layers)
        }
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

    public static function json($v)
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

    public static function iso($ts)
    {
        return $ts === null ? null : gmdate('Y-m-d\TH:i:s\Z', (int) $ts);
    }

    /** A snapshot for ahm_revisions: the state as gzip JSON, in base64 so that every database layer can keep it as text. */
    public static function snapshot(array $state)
    {
        return base64_encode(gzencode(self::json($state)));
    }

    public static function unsnapshot($s)
    {
        return json_decode((string) gzdecode(base64_decode($s)), true);
    }

    // ---- an entry of a file <-> a row

    /**
     * The columns of an entry of places (a Feature), shapes (a Feature) or layers (an array): id, type, lon, lat, created, updated (seconds
     * or null) and data (what the columns do not hold; a shape's geometry is data.geometry; `label` is derived, so it is not kept).
     */
    public static function object_from_entry($kind, array $e)
    {
        if ($kind === 'place') {
            $p = $e['properties'];
            if (($e['geometry']['type'] ?? '') !== 'Point') {
                throw new \InvalidArgumentException('place ' . ($p['id'] ?? '?') . ' is not a point');
            }
            list($lon, $lat) = $e['geometry']['coordinates'];
            $id = $p['id'];
            $type = $p['type'];
            unset($p['id'], $p['type'], $p['label']);
            return ['id' => $id, 'type' => $type, 'lon' => (float) $lon, 'lat' => (float) $lat, 'created' => null, 'updated' => null, 'data' => $p];
        }
        if ($kind === 'shape') {
            $p = $e['properties'];
            $o = ['id' => $p['id'], 'type' => $p['type'], 'lon' => null, 'lat' => null,
                'created' => isset($p['created']) ? strtotime($p['created']) : null, 'updated' => isset($p['updated']) ? strtotime($p['updated']) : null];
            unset($p['id'], $p['type'], $p['created'], $p['updated']);
            $p['geometry'] = $e['geometry'];
            return $o + ['data' => $p];
        }
        $o = ['id' => $e['id'], 'type' => null, 'lon' => null, 'lat' => null,
            'created' => isset($e['created']) ? strtotime($e['created']) : null, 'updated' => isset($e['updated']) ? strtotime($e['updated']) : null];
        unset($e['id'], $e['created'], $e['updated']);
        return $o + ['data' => $e];
    }

    /** The entry of a file from a row of ahm_objects (id, type, lon, lat, created_at, updated_at, data as an array). */
    public static function entry_from_object($kind, array $r)
    {
        $d = $r['data'];
        if ($kind === 'place') {
            return ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [(float) $r['lon'], (float) $r['lat']]],
                'properties' => ['id' => $r['id'], 'label' => self::label($d['names'] ?? []), 'type' => $r['type']] + $d];
        }
        if ($kind === 'shape') {
            $g = $d['geometry'];
            unset($d['geometry']);
            return ['type' => 'Feature', 'geometry' => $g,
                'properties' => ['id' => $r['id'], 'type' => $r['type']] + $d + ['created' => self::iso($r['created_at']), 'updated' => self::iso($r['updated_at'])]];
        }
        return ['id' => $r['id']] + $d + ['created' => self::iso($r['created_at']), 'updated' => self::iso($r['updated_at'])];
    }

    /** [key, data] of an entry of a list. */
    public static function list_parts($list, array $item)
    {
        $f = self::LISTS[$list][1];
        $key = (string) $item[$f];
        unset($item[$f]);
        return [$key, $item];
    }

    public static function list_entry($list, $key, array $data)
    {
        return [self::LISTS[$list][1] => $key] + $data;
    }

    private function revision($kind, $id, $label, array $snapshot, $import, $now)
    {
        $this->db->exec(
            'INSERT INTO ' . $this->t('ahm_revisions') . ' (entity_kind, entity_id, rev_no, action, user_id, at, label, import_id, snapshot) VALUES (?, ?, 1, ?, NULL, ?, ?, ?, ?)',
            [$kind, $id, 'import', $now, mb_substr($label, 0, 255), $import, self::snapshot($snapshot)]
        );
    }

    // ---- files -> tables

    /**
     * Loads the files of a store (current format, see store::migrate()) into the tables: lists, places, shapes, layers, and one `import`
     * revision for each. Notes are not loaded (see read_notes()). All or nothing. Returns the numbers and the id of the import.
     */
    public function import($dir, $file_name = 'files', $user_id = null)
    {
        $dir = rtrim($dir, '/') . '/';
        return $this->db->transaction(function () use ($dir, $file_name, $user_id) {
            $now = time();
            $n = ['lists' => 0, 'places' => 0, 'shapes' => 0, 'layers' => 0];
            $this->db->exec('INSERT INTO ' . $this->t('ahm_imports') . ' (file_name, user_id, at) VALUES (?, ?, ?)', [$file_name, $user_id, $now]);
            $import = $this->db->insert_id();
            foreach (self::LISTS as $list => $def) {
                $f = self::read_json($dir . $list . '.json', ['version' => self::FILE_VERSION, $def[0] => []]);
                self::only_keys($f, ['version', $def[0]], "$list.json");
                if ($f['version'] !== self::FILE_VERSION) {
                    throw new \InvalidArgumentException("$list.json is version " . json_encode($f['version']) . ', this code reads version ' . self::FILE_VERSION);
                }
                foreach ($f[$def[0]] as $pos => $item) {
                    list($key, $data) = self::list_parts($list, $item);
                    $this->db->exec('INSERT INTO ' . $this->t('ahm_lists') . ' (list, item_key, pos, updated_at, data) VALUES (?, ?, ?, ?, ?)', [$list, $key, $pos, $now, self::json($data)]);
                    $this->revision('list', $list . '/' . $key, self::label($data['names'] ?? []) ?: (string) ($data['title'] ?? $data['name'] ?? $key), [$def[1] => $key] + $data, $import, $now);
                    $n['lists']++;
                }
            }
            $f = self::read_json($dir . 'places.geojson');
            self::only_keys($f, ['type', 'version', 'features'], 'places.geojson');
            if ($f['version'] !== self::PLACES_VERSION) {
                throw new \InvalidArgumentException('places.geojson is version ' . json_encode($f['version']) . ', this code reads version ' . self::PLACES_VERSION);
            }
            $groups = ['place' => $f['features']];
            $f = self::read_json($dir . 'shapes.geojson', ['type' => 'FeatureCollection', 'features' => []]);
            self::only_keys($f, ['type', 'features'], 'shapes.geojson');
            $groups['shape'] = $f['features'];
            $f = self::read_json($dir . 'layers.json', ['version' => self::FILE_VERSION, 'layers' => []]);
            self::only_keys($f, ['version', 'layers'], 'layers.json');
            $groups['layer'] = $f['layers'];
            foreach ($groups as $kind => $entries) {
                foreach ($entries as $pos => $e) {
                    $o = self::object_from_entry($kind, $e);
                    $this->insert_object($kind, $pos, $o, $import, $now);
                    $this->revision($kind, $o['id'], self::label($o['data']['names'] ?? []), $o['data'] + ['type' => $o['type'], 'lon' => $o['lon'], 'lat' => $o['lat']], $import, $now);
                    $n[$kind . 's']++;
                }
            }
            $this->db->exec('UPDATE ' . $this->t('ahm_imports') . ' SET places = ?, shapes = ? WHERE id = ?', [$n['places'], $n['shapes'], $import]);
            return $n + ['import_id' => $import];
        });
    }

    private function insert_object($kind, $pos, array $o, $import, $now)
    {
        $this->db->exec(
            'INSERT INTO ' . $this->t('ahm_objects') . ' (id, kind, pos, lon, lat, type, import_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$o['id'], $kind, $pos, $o['lon'], $o['lat'], $o['type'], $import, $o['created'] ?? $now, $o['updated'] ?? $now, self::json($o['data'])]
        );
    }

    // ---- tables -> files

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
            foreach ($this->db->rows('SELECT item_key, data FROM ' . $this->t('ahm_lists') . ' WHERE list = ? ORDER BY pos, item_key', [$list]) as $r) {
                $items[] = self::list_entry($list, $r['item_key'], json_decode($r['data'], true));
            }
            file_put_contents($dir . $list . '.json', json_encode(['version' => self::FILE_VERSION, $def[0] => $items], $pretty));
        }
        $place = [];
        foreach ($this->objects('place') as $o) {
            $place[] = self::entry_from_object('place', $o);
        }
        file_put_contents($dir . 'places.geojson', json_encode(['type' => 'FeatureCollection', 'version' => self::PLACES_VERSION, 'features' => $place], $pretty));
        $shape = [];
        foreach ($this->objects('shape') as $o) {
            $shape[] = self::entry_from_object('shape', $o);
        }
        file_put_contents($dir . 'shapes.geojson', json_encode(['type' => 'FeatureCollection', 'features' => $shape], $pretty));
        $layers = [];
        foreach ($this->objects('layer') as $o) {
            $layers[] = self::entry_from_object('layer', $o);
        }
        file_put_contents($dir . 'layers.json', json_encode(['version' => self::FILE_VERSION, 'layers' => $layers], $pretty));
    }

    /** The rows of one kind, in file order: id, type, lon, lat, topic_id, version, created_at, updated_at, data (decoded). */
    public function objects($kind)
    {
        $out = [];
        foreach ($this->db->rows('SELECT id, lon, lat, type, topic_id, version, created_at, updated_at, data FROM ' . $this->t('ahm_objects') . ' WHERE kind = ? ORDER BY pos, id', [$kind]) as $r) {
            $r['data'] = json_decode($r['data'], true);
            $r['lon'] = $r['lon'] === null ? null : (float) $r['lon'];
            $r['lat'] = $r['lat'] === null ? null : (float) $r['lat'];
            $r['topic_id'] = $r['topic_id'] === null ? null : (int) $r['topic_id'];
            $r['version'] = (int) $r['version'];
            $r['created_at'] = (int) $r['created_at'];
            $r['updated_at'] = (int) $r['updated_at'];
            $out[] = $r;
        }
        return $out;
    }

    /** All lists as list => [key => entry] (for the text of a card). */
    public function lists()
    {
        $out = [];
        foreach ($this->db->rows('SELECT list, item_key, data FROM ' . $this->t('ahm_lists') . ' ORDER BY list, pos') as $r) {
            $out[$r['list']][$r['item_key']] = json_decode($r['data'], true);
        }
        return $out;
    }

    public function set_topic($object_id, $topic_id)
    {
        $this->db->exec('UPDATE ' . $this->t('ahm_objects') . ' SET topic_id = ? WHERE id = ?', [$topic_id, $object_id]);
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
        $this->db->exec('INSERT INTO ' . $this->t('ahm_note_meta') . ' (post_id, data) VALUES (?, ?)', [$post_id, self::json($meta)]);
    }

    /** post_id => meta */
    public function note_metas()
    {
        $out = [];
        foreach ($this->db->rows('SELECT post_id, data FROM ' . $this->t('ahm_note_meta') . ' ORDER BY post_id') as $r) {
            $out[(int) $r['post_id']] = json_decode($r['data'], true);
        }
        return $out;
    }
}
