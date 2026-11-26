<?php
namespace ahm\map\service;

if (!interface_exists(__NAMESPACE__ . '\\repository', false)) {
    require __DIR__ . '/repository.php';
}
if (!class_exists(__NAMESPACE__ . '\\file_repository', false)) {
    require __DIR__ . '/file_repository.php';
}

/** All reading and writing of the map data (places.geojson + notes/<place>/<note-id>.md). Knows nothing about phpBB. */
class store
{
    /** The point types of a new store (seed of types.json); after that the dictionary in types.json is the only list. */
    const TYPES = [
        'settlement',
        'city',
        'town',
        'village',
        'fortress',
        'temple',
        'tomb',
        'inscription_site',
        'monument',
        'mountain',
        'lake',
        'river',
        'region'
    ];
    const UUID = '/^[0-9a-f-]{36}$/';
    const LANG = '/^[A-Za-z-]{2,8}$/';
    const MAX_HEIGHT_M = 9000;
    /** Names for language codes found in older data when the dictionary (languages.json) is first created. */
    const KNOWN_LANGS = [
        'en' => ['English', 'English'],
        'hy' => ['Armenian', 'Հայերեն'],
        'ru' => ['Russian', 'Русский'],
        'tr' => ['Turkish', 'Türkçe'],
        'la' => ['Latin', 'Latina'],
        'xur' => ['Urartian', '']
    ];
    /** The folder of the store: the data files with the file repository, only the pictures of overlays with the SQL repository. */
    private $base;
    private $repo;

    /** $repo: where the data lives (T-104); without one the data is in files in $dir. */
    public function __construct($dir, repository $repo = null)
    {
        $this->base = rtrim($dir, '/') . '/';
        $this->repo = $repo ?: new file_repository($dir);
    }

    public static function uuid4()
    {
        $d = random_bytes(16);
        $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
        $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
    }

    private static function write_atomic($path, $s)
    {
        $t = $path . '.tmp';
        file_put_contents($t, $s);
        rename($t, $path);
    }

    private static function bad($m)
    {
        return new \InvalidArgumentException($m);
    }

    private static function meta($head)
    {
        $meta = [];
        foreach (explode("\n", trim($head)) as $ln) {
            $kv = explode(': ', $ln, 2);
            if (count($kv) == 2) {
                $meta[$kv[0]] = $kv[1];
            }
        }
        return $meta;
    }

    public function save(array $in)
    {
        return $this->repo->transaction(function () use ($in) {
            $this->migrate();
            $codes = array_column($this->lang_load(), 'code'); // the only languages a name or note may use
            $types = array_column(array_filter($this->type_load(), function ($t) {
                return ($t['geometry'] ?? 'point') === 'point';
            }), 'code'); // the only place types a place may use
            // a new place may join layers at once: "layer_ids" (a list) and/or "layer_id" (one); checked before anything is written
            $joins = [];
            if (isset($in['place'])) {
                $want = $in['layer_ids'] ?? [];
                if (!is_array($want)) {
                    throw self::bad('layer_ids must be a list');
                }
                if (($in['layer_id'] ?? '') !== '') {
                    $want[] = (string) $in['layer_id'];
                }
                $ld = $this->layers_data();
                foreach ($want as $x) {
                    if (!is_string($x) || !preg_match(self::UUID, $x) || $this->layer_index($ld, $x) === null) {
                        throw self::bad('unknown layer');
                    }
                    if (!in_array($x, $joins, true)) {
                        $joins[] = $x;
                    }
                }
            }
            // the layers a note is tied to (when the request says so): the place must be a member, or join in this request
            $tags = null;
            if (isset($in['note']) && is_array($in['note']) && array_key_exists('layers', $in['note'])) {
                $tags = $this->clean_note_layers($in['note']['layers'], $in['place_id'] ?? ($in['place_update']['id'] ?? null), $joins);
            }
            $fc = $this->places_doc();
            $pid = $in['place_id'] ?? null;
            if (isset($in['place'])) {
                $c = self::clean_place($in['place'], $codes, $types);
                list($ev) = self::clean_evidence($in['place'], array_column($this->sources_data()['sources'], 'id'), true);
                $c['props'] += $ev;
                $pid = self::uuid4();
                $fc['features'][] = [
                    'type' => 'Feature',
                    'geometry' => ['type' => 'Point', 'coordinates' => [$c['lon'], $c['lat']]],
                    'properties' => ['id' => $pid] + $c['props']
                ];
                $this->repo->put_doc('places', $fc);
                foreach ($joins as $lid) {
                    $this->change_members($lid, [$pid], []); // the place stays in the general layer as well
                }
            } elseif (isset($in['place_update'])) {
                // change an existing place: position, names, type, dates (its id never changes)
                $u = $in['place_update'];
                $pid = (string) ($u['id'] ?? '');
                $c = self::clean_place($u, $codes, $types);
                list($ev, $clear) = self::clean_evidence($u, array_column($this->sources_data()['sources'], 'id'), true);
                $c['props'] += $ev;
                $found = false;
                foreach ($fc['features'] as $k => $f) {
                    if (($f['properties']['id'] ?? '') === $pid) {
                        $fc['features'][$k]['geometry'] = ['type' => 'Point', 'coordinates' => [$c['lon'], $c['lat']]];
                        $fc['features'][$k]['properties'] = array_diff_key(array_merge($f['properties'], $c['props']), array_flip($clear));
                        $found = true;
                    }
                }
                if (!$found) {
                    throw self::bad('unknown place');
                }
                $this->repo->put_doc('places', $fc);
            } else {
                $ok = false;
                foreach ($fc['features'] as $f) {
                    if (($f['properties']['id'] ?? '') === $pid) {
                        $ok = true;
                    }
                }
                if (!$ok) {
                    throw self::bad('unknown place');
                }
            }
            if (isset($in['note'])) {
                $n = $in['note'];
                list($lang, $title, $text, $date) = self::clean_note($n, $codes);
                $nid = (string) ($n['id'] ?? '');
                $kept = [];
                if ($nid !== '') {
                    // edit an existing note
                    $old = preg_match(self::UUID, $nid) ? $this->repo->note($pid, $nid) : null;
                    if ($old === null || $old['kind'] !== 'place') {
                        throw self::bad('unknown note');
                    }
                    $kept = $old['layers'];
                } else {
                    $nid = self::uuid4();
                } // new note: any number per place and language
                // layers: a note may be tied to the layers its place belongs to (it stays visible in the general layer)
                $this->repo->put_note(['owner' => $pid, 'kind' => 'place', 'id' => $nid, 'lang' => $lang, 'title' => $title, 'date' => $date, 'layers' => $tags ?? $kept, 'text' => $text]);
            }
            return $pid;
        });
    }

    /** The places as a document; an empty one when there are none yet. */
    private function places_doc()
    {
        $d = $this->repo->doc('places');
        return is_array($d) && isset($d['features']) && is_array($d['features']) ? $d : ['type' => 'FeatureCollection', 'version' => 3, 'features' => []];
    }

    private static function one_line($v, $max)
    {
        $v = trim(preg_replace('/\s+/', ' ', (string) $v));
        return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
    }

    /** Text of a note file: a small header, then the text. The date (if any) is one line of JSON. */
    private static function note_file($id, $lang, $title, $date, $text, array $layers = [])
    {
        return "---\nid: $id\nlang: $lang\ntitle: $title\n" .
            ($layers ? 'layers: ' . implode(',', $layers) . "\n" : '') .
            ($date !== null ? 'date: ' . json_encode($date) . "\n" : '') .
            "---\n$text\n";
    }

    /** Checks the language, title, text and date of a note (place note or layer note). Returns [lang, title, text, date]. */
    private static function clean_note(array $n, array $codes)
    {
        $lang = (string) ($n['lang'] ?? '');
        $text = trim((string) ($n['text'] ?? ''));
        $title = trim(preg_replace('/\s+/', ' ', (string) ($n['title'] ?? '')));
        if (!preg_match(self::LANG, $lang) || $title === '' || $text === '') {
            throw self::bad('a note needs a language, a title and a text');
        }
        if (!in_array($lang, $codes, true)) {
            throw self::bad("language \"$lang\" is not in the list; ask an administrator to add it");
        }
        return [$lang, $title, $text, dates::clean($n['date'] ?? null, 'note date')]; // the date is optional: null = unknown
    }

    /** The header lines of a note file as an array (empty when the file is not a note). */
    private static function note_meta($file)
    {
        $parts = explode("---\n", (string) @file_get_contents($file), 3);
        return count($parts) < 3 ? [] : self::meta($parts[1]);
    }

    /** "id1,id2" (a note's layers: header) -> the valid ids. */
    private static function layer_ids($csv)
    {
        $out = [];
        foreach (explode(',', (string) $csv) as $x) {
            $x = trim($x);
            if (preg_match(self::UUID, $x) && !in_array($x, $out, true)) {
                $out[] = $x;
            }
        }
        return $out;
    }

    /**
     * Checks the fields of a place (new or edited) and returns [lat, lon, props]. Several names per language are
     * allowed. $codes = the language dictionary, $types = the codes of the point types dictionary. A mountain has a height (optional) and no dates; every other type has
     * optional dates and no height.
     */
    private static function clean_place(array $p, array $codes, array $types)
    {
        $lat = (float) ($p['lat'] ?? 999);
        $lon = (float) ($p['lon'] ?? 999);
        if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
            throw self::bad('bad coordinates');
        }
        if (!in_array($p['type'] ?? '', $types, true)) {
            throw self::bad('bad type');
        }
        $names = [];
        foreach ($p['names'] ?? [] as $n) {
            $nm = self::one_line($n['name'] ?? '', 200);
            $lg = (string) ($n['lang'] ?? '');
            if ($nm === '') {
                continue;
            }
            if (!in_array($lg, $codes, true)) {
                throw self::bad("language \"$lg\" is not in the list; ask an administrator to add it");
            }
            $names[] = ['lang' => $lg, 'name' => $nm] + self::name_period($n);
        }
        if (!$names) {
            throw self::bad('at least one name is required');
        }
        $label = $names[0]['name'];
        foreach ($names as $n) {
            if ($n['lang'] === 'en') {
                $label = $n['name'];
                break;
            }
        }
        $from = null;
        $to = null;
        $height = null;
        if ($p['type'] === 'mountain') {
            $h = $p['height_m'] ?? null;
            if ($h !== null && $h !== '') {
                if (is_bool($h) || !is_numeric($h) || (float) $h != floor((float) $h) || $h < 0 || $h > self::MAX_HEIGHT_M) {
                    throw self::bad('height must be a whole number of metres from 0 to ' . self::MAX_HEIGHT_M);
                }
                $height = (int) $h;
            }
        } else {
            $from = dates::clean($p['date_from'] ?? null, 'begin date');
            $to = dates::clean($p['date_to'] ?? null, 'end date');
            dates::order_check($from, $to);
        }
        return [
            'lat' => $lat,
            'lon' => $lon,
            'props' => [
                'label' => $label,
                'type' => $p['type'],
                'date_from' => $from,
                'date_to' => $to,
                'height_m' => $height,
                'names' => $names
            ]
        ];
    }

    /** notes/index.json is generated from the note files and is only used for searching. */
    public function rebuild_index()
    {
        if ($this->repo instanceof file_repository) {
            $this->repo->rebuild_indexes();
        }
    }

    /** The places as a GeoJSON FeatureCollection (what places.geojson held). */
    public function places()
    {
        return $this->locked(function () {
            return $this->places_doc();
        });
    }

    /** One note as the browser reads it (a note file: header, then the text), null when there is no such note. */
    public function note_raw($owner, $id)
    {
        if (!preg_match(self::UUID, (string) $owner) || !preg_match(self::UUID, (string) $id)) {
            return null;
        }
        $n = $this->repo->note($owner, $id);
        return $n === null ? null : file_repository::note_file($n);
    }

    /** The notes of places as the browser searches them (what notes/index.json held): id, place, lang, title, layers, date, text. */
    public function notes_index()
    {
        return $this->locked(function () {
            return $this->index_of('place');
        });
    }

    private function index_of($kind)
    {
        $out = [];
        foreach ($this->repo->notes() as $n) {
            if ($n['kind'] !== $kind) {
                continue;
            }
            $out[] = $kind === 'place'
                ? ['id' => $n['id'], 'place' => $n['owner'], 'lang' => $n['lang'], 'title' => $n['title'], 'layers' => $n['layers'], 'date' => $n['date'], 'text' => $n['text']]
                : ['id' => $n['id'], 'layer' => $n['owner'], 'lang' => $n['lang'], 'title' => $n['title'], 'date' => $n['date'], 'text' => $n['text']];
        }
        return ['version' => 1, 'notes' => $out];
    }

    /** The date of a note from its header: the "date:" JSON, or (older files) "year:" + "when:" converted. null = unknown. */
    private static function note_date(array $meta)
    {
        if (isset($meta['date'])) {
            $d = json_decode($meta['date'], true);
            return is_array($d) ? dates::upgrade($d) : null;
        }
        return isset($meta['year']) ? dates::from_legacy($meta['year'], $meta['when'] ?? '', false) : null;
    }

    /**
     * Brings the data up to date; safe to repeat. Returns how many things were converted.
     *  1. old notes <place>/<lang>.md  ->  <place>/<note-id>.md
     *  2. old dates (a year number + wording + "approximate" flag, or time stamps in seconds)  ->  the date model of service/dates.php
     *  3. the language dictionary (languages.json) is created from the languages already in use
     *  4. borders of the old type "region" become "province" (the code "region" is a place type now)
     * Every file that is replaced is copied to archive/ first.
     */
    public function migrate()
    {
        // the older file formats exist only in files; the SQL repository starts in the current format
        $count = $this->repo instanceof file_repository
            ? $this->migrate_note_files() + $this->migrate_place_dates() + $this->migrate_note_dates() + $this->migrate_shape_types()
            : 0;
        $this->lang_load();
        if ($count) {
            $this->rebuild_index();
        }
        return $count;
    }

    /** Before the dictionary held line and area types a border could have the type "region"; that code belongs to a place type now (codes are unique), so such borders become "province", the built-in area type "Region or province". Archived first. */
    private function migrate_shape_types()
    {
        $d = $this->read_shapes();
        $n = 0;
        foreach ($d['features'] as $k => $ft) {
            if (($ft['properties']['type'] ?? '') === 'region') {
                $d['features'][$k]['properties']['type'] = 'province';
                $n++;
            }
        }
        if ($n) {
            $this->put_shapes($d);
        }
        return $n;
    }

    /** Places: date_from/date_to numbers + *_text + approx  ->  date objects (or null); a mountain gets a height, no dates. */
    private function migrate_place_dates()
    {
        $geo = $this->base . 'places.geojson';
        if (!is_file($geo)) {
            return 0;
        }
        $fc = json_decode(file_get_contents($geo), true);
        if (!is_array($fc) || !isset($fc['features'])) {
            return 0;
        }
        $drop = ['id', 'label', 'type', 'date_from', 'date_to', 'height_m', 'names', 'approx', 'date_from_text', 'date_to_text'];
        $n = 0;
        foreach ($fc['features'] as $k => $f) {
            $p = $f['properties'];
            $legacy =
                array_key_exists('approx', $p) ||
                array_key_exists('date_from_text', $p) ||
                array_key_exists('date_to_text', $p) ||
                !array_key_exists('height_m', $p) ||
                (isset($p['date_from']) && !is_array($p['date_from'])) ||
                (isset($p['date_to']) && !is_array($p['date_to'])) ||
                is_int($p['date_from']['ts'] ?? null) || // time stamps as seconds -> ISO 8601 text
                is_int($p['date_to']['ts'] ?? null);
            if (!$legacy) {
                continue;
            }
            $mountain = ($p['type'] ?? '') === 'mountain';
            $conv = function ($v, $text) use ($p) {
                return is_array($v) ? dates::upgrade($v) : dates::from_legacy($v, $text, !empty($p['approx']));
            };
            $props = [
                'id' => $p['id'],
                'label' => $p['label'] ?? '',
                'type' => $p['type'],
                'date_from' => $mountain ? null : $conv($p['date_from'] ?? null, $p['date_from_text'] ?? ''),
                'date_to' => $mountain ? null : $conv($p['date_to'] ?? null, $p['date_to_text'] ?? ''),
                'height_m' => $mountain && isset($p['height_m']) ? $p['height_m'] : null,
                'names' => $p['names'] ?? []
            ];
            $fc['features'][$k]['properties'] = $props + array_diff_key($p, array_flip($drop));
            $n++;
        }
        if ($n) {
            $fc['version'] = 3; // 3 = dates with ISO 8601 time stamps
            @mkdir($this->base . 'archive/', 0775, true);
            copy($geo, $this->base . 'archive/places-' . date('Ymd-His') . '-before-dates.geojson');
            self::write_atomic($geo, json_encode($fc, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }
        return $n;
    }

    /** Notes: "year:" + "when:" header lines  ->  one "date:" line (or none when no date can be read). */
    private function migrate_note_dates()
    {
        $root = $this->base . 'notes/';
        if (!is_dir($root)) {
            return 0;
        }
        $count = 0;
        foreach (scandir($root) as $pl) {
            if (!preg_match(self::UUID, $pl) || !is_dir($root . $pl)) {
                continue;
            }
            foreach (scandir($root . $pl) as $fn) {
                $stem = substr($fn, 0, -3);
                if (substr($fn, -3) !== '.md' || !preg_match(self::UUID, $stem)) {
                    continue;
                }
                $parts = explode("---\n", file_get_contents("$root$pl/$fn"), 3);
                if (count($parts) < 3) {
                    continue;
                }
                $meta = self::meta($parts[1]);
                $dj = isset($meta['date']) ? json_decode($meta['date'], true) : null;
                if (!(isset($meta['year']) && !isset($meta['date'])) && !(is_array($dj) && is_int($dj['ts'] ?? null))) {
                    continue; // neither "year:" lines nor a date with a time stamp in seconds
                }
                @mkdir($this->base . 'archive/', 0775, true);
                copy("$root$pl/$fn", $this->base . "archive/legacy-dates-$pl-$fn");
                self::write_atomic(
                    "$root$pl/$fn",
                    "---\nid: " .
                        ($meta['id'] ?? $stem) .
                        "\nlang: " .
                        ($meta['lang'] ?? '') .
                        "\ntitle: " .
                        ($meta['title'] ?? '') .
                        "\n" .
                        (isset($meta['layers']) ? 'layers: ' . $meta['layers'] . "\n" : '') .
                        (($d = self::note_date($meta)) !== null ? 'date: ' . json_encode($d) . "\n" : '') .
                        "---\n" .
                        $parts[2]
                );
                $count++;
            }
        }
        return $count;
    }

    // ------------------------------------------------------------------ languages (the dictionary)
    /** The dictionary as the browser gets it. Only administrators add to it (see save_language). */
    public function languages()
    {
        return $this->locked(function () {
            return ['version' => 1, 'languages' => $this->lang_load()];
        });
    }

    /** Reads languages.json; when it does not exist yet, creates it from the languages already used. Caller holds the lock. */
    private function lang_load()
    {
        $d = $this->repo->doc('languages');
        if (is_array($d) && isset($d['languages']) && is_array($d['languages'])) {
            return $d['languages'];
        }
        $codes = ['en', 'hy', 'ru', 'tr'];
        $used = $this->used_lang_codes();
        sort($used);
        foreach ($used as $c) {
            if (!in_array($c, $codes, true)) {
                $codes[] = $c;
            }
        }
        $list = [];
        foreach ($codes as $c) {
            $k = self::KNOWN_LANGS[$c] ?? [$c, ''];
            $list[] = ['code' => $c, 'name' => $k[0], 'native' => $k[1]];
        }
        $this->repo->put_doc('languages', ['version' => 1, 'languages' => $list]);
        return $list;
    }

    /** Language codes found in places (names) and notes (header). */
    private function used_lang_codes()
    {
        $used = [];
        $fc = $this->repo->doc('places');
        foreach (is_array($fc) ? $fc['features'] ?? [] : [] as $f) {
            foreach ($f['properties']['names'] ?? [] as $n) {
                if (!empty($n['lang'])) {
                    $used[$n['lang']] = true;
                }
            }
        }
        foreach ($this->repo->notes() as $n) {
            if ($n['lang'] !== '') {
                $used[$n['lang']] = true;
            }
        }
        return array_keys($used);
    }

    /** Administrators only (checked by the controller): adds one language to the dictionary. Returns its code. */
    public function save_language(array $in)
    {
        return $this->locked(function () use ($in) {
            $code = strtolower(trim((string) ($in['code'] ?? '')));
            $name = self::one_line($in['name'] ?? '', 80);
            $native = self::one_line($in['native'] ?? '', 80);
            if (!preg_match(self::LANG, $code)) {
                throw self::bad('the language code must be 2-8 letters (for example en, hy, xur)');
            }
            if ($name === '') {
                throw self::bad('the language needs a name');
            }
            $list = $this->lang_load();
            $edit = !empty($in['edit']); // true = change the names of an existing language (the code never changes)
            $at = null;
            foreach ($list as $i => $l) {
                if ($l['code'] === $code) {
                    $at = $i;
                }
            }
            if ($edit && $at === null) {
                throw self::bad("language \"$code\" is not in the list");
            }
            if (!$edit && $at !== null) {
                throw self::bad("language \"$code\" is already in the list");
            }
            $entry = ['code' => $code, 'name' => $name, 'native' => $native];
            if ($edit) {
                $list[$at] = $entry;
            } else {
                $list[] = $entry;
            }
            $this->repo->put_doc('languages', ['version' => 1, 'languages' => $list]);
            return $code;
        });
    }

    // ------------------------------------------------------------------ place types (the dictionary)
    // One dictionary of types, managed like languages and categories: only administrators add to it. A place points
    // to a type by its code. Today only point types (the markers of places) can be added; lines and areas follow.
    const TYPE_CODE = '/^[a-z0-9][a-z0-9_-]{0,31}$/';
    const SYMBOL = '/^[a-z0-9-]{1,24}$/';
    const PATH = '/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]{2,20000}$/'; // SVG path data of a custom symbol: drawing commands and numbers only
    const SEED_STYLE = [
        'settlement' => ['circle', '#8D6E63', 7.5],
        'city' => ['circle', '#B3261E', 10],
        'town' => ['circle', '#E07B39', 8],
        'village' => ['circle', '#C9A227', 6.5],
        'fortress' => ['square', '#455A64', 8.5],
        'temple' => ['diamond', '#7B1FA2', 9],
        'tomb' => ['plus', '#5D4037', 9],
        'inscription_site' => ['star', '#F9A825', 10],
        'monument' => ['hexagon', '#00796B', 9],
        'mountain' => ['triangle', '#2E7D32', 10],
        'lake' => ['drop', '#1976D2', 9],
        'river' => ['bar', '#0288D1', 9],
        'region' => ['ring', '#6A1B9A', 10]
    ];

    /** The dictionary as the browser gets it. */
    public function types()
    {
        return $this->locked(function () {
            return ['version' => 1, 'types' => $this->type_load()];
        });
    }

    /** Reads types.json; when it does not exist yet, creates it from the seed (the types that existed before). Caller holds the lock. */
    private function type_load()
    {
        $d = $this->repo->doc('types');
        if ($d !== null) {
            // Never replace a document that exists: a damaged one must not silently drop the types an administrator added.
            if (!is_array($d) || !isset($d['types']) || !is_array($d['types'])) {
                throw self::bad('types.json cannot be read; restore it from the archive folder or fix it, nothing was changed');
            }
            return self::with_shape_types($d['types']);
        }
        $list = [];
        foreach (self::SEED_STYLE as $code => $s) {
            $list[] = [
                'code' => $code,
                'geometry' => 'point',
                'names' => [['lang' => 'en', 'name' => ucfirst(str_replace('_', ' ', $code))]],
                'color' => $s[1],
                'style' => ['symbol' => $s[0], 'size' => $s[2]]
            ];
        }
        $list = array_merge($list, self::builtin_shape_types());
        $this->repo->put_doc('types', ['version' => 1, 'types' => $list]);
        return $list;
    }

    private function put_types(array $list)
    {
        $this->repo->put_doc('types', ['version' => 1, 'types' => array_values($list)]);
    }

    /** Code of a new type: its English name in lower case, letters and digits joined by "-"; "-2", "-3" ... when taken. */
    private static function type_code_from($name, array $taken)
    {
        // Accents become plain letters where the server's iconv can do it; any other character is dropped below. Some servers refuse
        // the //IGNORE flag, so it is not used, and a failing iconv never breaks the code.
        $ascii = function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT', $name) : false;
        $c = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $ascii === false ? (string) $name : $ascii), '-'));
        $c = rtrim(substr($c, 0, 28), '-');
        if ($c === '') {
            throw self::bad('the English name must have letters or digits (the code of the type is made from it)');
        }
        $code = $c;
        for ($i = 2; in_array($code, $taken, true); $i++) {
            $code = $c . '-' . $i;
        }
        return $code;
    }

    private static function style_number($v, $lo, $hi, $what)
    {
        if (is_bool($v) || !(is_int($v) || is_float($v)) || $v < $lo || $v > $hi) {
            throw self::bad("the $what must be a number from $lo to $hi");
        }
        return $v + 0;
    }

    private static function clean_stroke($o)
    {
        $pattern = $o['pattern'] ?? 'solid';
        if (!in_array($pattern, self::SHAPE_PATTERNS, true)) {
            throw self::bad('the pattern must be one of ' . implode(', ', self::SHAPE_PATTERNS));
        }
        return [
            'width' => self::style_number($o['width'] ?? 2, 1, 12, 'width'),
            'pattern' => $pattern,
            'opacity' => self::style_number($o['opacity'] ?? 1, 0.1, 1, 'opacity')
        ];
    }

    /** The style of a line type { width 1..12, pattern, opacity 0.1..1, arrow } or of an area type { fill_opacity 0..0.8, outline: { width, pattern, opacity } }. */
    private static function clean_shape_style($geometry, array $st)
    {
        if ($geometry === 'area') {
            $o = is_array($st['outline'] ?? null) ? $st['outline'] : [];
            return ['fill_opacity' => self::style_number($st['fill_opacity'] ?? 0.15, 0, 0.8, 'fill opacity'), 'outline' => self::clean_stroke($o)];
        }
        if ($geometry === 'river') {
            return self::clean_stroke($st); // a river has no direction: width, pattern, opacity only
        }
        if (isset($st['arrow']) && !is_bool($st['arrow'])) {
            throw self::bad('arrow must be true or false');
        }
        return self::clean_stroke($st) + ['arrow' => ($st['arrow'] ?? false) === true];
    }

    /** Administrators only (checked by the controller): adds a type, or with edit:true changes one (code and geometry never change). Returns its code. */
    public function save_type(array $in)
    {
        return $this->locked(function () use ($in) {
            $geometry = $in['geometry'] ?? '';
            if (!in_array($geometry, ['point', 'line', 'area', 'river'], true)) {
                throw self::bad('the geometry must be "point", "line", "area" or "river"');
            }
            $names = self::clean_names($in['names'] ?? [], array_column($this->lang_load(), 'code'), 'a type needs at least one name');
            $color = (string) ($in['color'] ?? '');
            if (!preg_match(self::COLOR, $color)) {
                throw self::bad('the colour must look like #1a2b3c');
            }
            $st = is_array($in['style'] ?? null) ? $in['style'] : [];
            if ($geometry === 'point') {
                $symbol = (string) ($st['symbol'] ?? 'circle');
                if (!preg_match(self::SYMBOL, $symbol)) {
                    throw self::bad('the symbol must be a slug of letters, digits and "-" (for example circle, tree)');
                }
                $size = $st['size'] ?? 8;
                if (!(is_int($size) || is_float($size)) || $size < 4 || $size > 14) {
                    throw self::bad('the size must be a number from 4 to 14');
                }
            }
            $list = $this->type_load();
            $edit = !empty($in['edit']);
            $at = null;
            foreach ($list as $i => $t) {
                if ($t['code'] === ($in['code'] ?? null)) {
                    $at = $i;
                }
            }
            if ($edit) {
                if ($at === null) {
                    throw self::bad('unknown type');
                }
                if (($list[$at]['geometry'] ?? 'point') !== $geometry) {
                    throw self::bad('the geometry of a type never changes');
                }
                $code = $list[$at]['code'];
            } else {
                $en = '';
                foreach ($names as $n) {
                    if ($n['lang'] === 'en' && $en === '') {
                        $en = $n['name'];
                    }
                }
                if ($en === '') {
                    throw self::bad('give the type a name in English (its code is made from it)');
                }
                $code = self::type_code_from($en, array_column($list, 'code'));
            }
            $style = $geometry === 'point' ? ['symbol' => $symbol, 'size' => $size + 0] : self::clean_shape_style($geometry, $st);
            if ($geometry === 'point' && $symbol === 'custom') {
                // A custom symbol: an SVG path drawn in a square box (default 24) whose corner is 0,0.
                $path = is_string($st['path'] ?? null) ? trim($st['path']) : '';
                if (!preg_match(self::PATH, $path) || !preg_match('/^[Mm]/', $path)) {
                    throw self::bad('a custom symbol needs an SVG path (the d value, 2 to 20000 characters of drawing commands and numbers, starting with M)');
                }
                $box = $st['box'] ?? 24;
                if (!(is_int($box) || is_float($box)) || $box < 8 || $box > 2048) {
                    throw self::bad('the box of a custom symbol must be a number from 8 to 2048');
                }
                $style['path'] = $path;
                $style['box'] = $box + 0;
            }
            $entry = [
                'code' => $code,
                'geometry' => $geometry,
                'names' => $names,
                'color' => strtolower($color),
                'style' => $style
            ];
            if ($edit) {
                $list[$at] = $entry;
            } else {
                $list[] = $entry;
            }
            $this->put_types($list);
            return $code;
        });
    }

    /** Administrators only: removes a type nobody uses. 400 with the number of places when some place still has it. */
    public function delete_type($code)
    {
        return $this->locked(function () use ($code) {
            $list = $this->type_load();
            $at = null;
            foreach ($list as $i => $t) {
                if ($t['code'] === $code) {
                    $at = $i;
                }
            }
            if ($at === null) {
                throw self::bad('unknown type');
            }
            if ($code === 'mountain') {
                throw self::bad('the type "mountain" cannot be removed (a mountain has a height instead of dates)');
            }
            $fc = $this->repo->doc('places');
            $used = 0;
            foreach ($fc['features'] ?? [] as $f) {
                if (($f['properties']['type'] ?? '') === $code) {
                    $used++;
                }
            }
            $sfc = $this->repo->doc('shapes');
            $shapes = 0;
            foreach ($sfc['features'] ?? [] as $f) {
                if (($f['properties']['type'] ?? '') === $code) {
                    $shapes++;
                }
            }
            if ($used > 0 || $shapes > 0) {
                $what = array_filter([$used ? "$used place" . ($used === 1 ? '' : 's') : '', $shapes ? "$shapes shape" . ($shapes === 1 ? '' : 's') : '']);
                throw self::bad(implode(' and ', $what) . " use the type \"$code\"; change their type first");
            }
            unset($list[$at]);
            $this->put_types($list);
            return true;
        });
    }

    /** Old notes were stored as <place>/<lang>.md. They become <place>/<note-id>.md with a "lang:" header. */
    private function migrate_note_files()
    {
        $root = $this->base . 'notes/';
        if (!is_dir($root)) {
            return 0;
        }
        $arch = $this->base . 'archive/';
        $count = 0;
        foreach (scandir($root) as $pl) {
            if (!preg_match(self::UUID, $pl) || !is_dir($root . $pl)) {
                continue;
            }
            foreach (scandir($root . $pl) as $fn) {
                $stem = substr($fn, 0, -3);
                if (substr($fn, -3) !== '.md' || preg_match(self::UUID, $stem) || !preg_match(self::LANG, $stem)) {
                    continue;
                }
                $parts = explode("---\n", file_get_contents("$root$pl/$fn"), 3);
                if (count($parts) < 3) {
                    continue;
                }
                $meta = self::meta($parts[1]);
                $id = isset($meta['id']) && preg_match(self::UUID, $meta['id']) ? $meta['id'] : self::uuid4();
                self::write_atomic(
                    "$root$pl/$id.md",
                    "---\nid: $id\nlang: $stem\ntitle: " .
                        ($meta['title'] ?? '') .
                        "\nyear: " .
                        (int) ($meta['year'] ?? 0) .
                        "\n---\n" .
                        $parts[2]
                );
                @mkdir($arch, 0775, true);
                rename("$root$pl/$fn", $arch . "legacy-$pl-$fn");
                $count++;
            }
        }
        return $count;
    }

    // ------------------------------------------------------------------ categories and layers
    // A layer is a named SUBSET of the general layer (= all places and all notes, which is not stored). It has names and
    // descriptions in dictionary languages, one optional category, an optional colour, optional dates, its own notes
    // and an ORDERED list of member places (the order is kept for later: routes of a campaign). Adding a place to a
    // layer never removes it from anything else. A place note can be tied to layers (header "layers:") when its place
    // is a member; such a note is shown in the general layer and in those layers only.
    const COLOR = '/^#[0-9a-fA-F]{6}$/';
    const MAX_DESC = 5000;

    /** Unique file name in archive/ (a second change in the same second must not overwrite the first copy). */
    private function archive_path($stem, $ext)
    {
        @mkdir($this->base . 'archive/', 0775, true);
        $p = $this->base . 'archive/' . $stem . '-' . date('Ymd-His');
        $c = $p . '.' . $ext;
        for ($i = 1; file_exists($c); $i++) {
            $c = $p . '-' . $i . '.' . $ext;
        }
        return $c;
    }

    private function list_data($file, $key)
    {
        $d = $this->repo->doc(substr($file, 0, -5));
        return is_array($d) && isset($d[$key]) && is_array($d[$key]) ? $d : ['version' => 1, $key => []];
    }

    /** Writes categories.json / layers.json; the old file is copied to archive/ first. */
    private function put_list($file, $stem, array $d)
    {
        $this->repo->put_doc(substr($file, 0, -5), $d);
    }

    private function categories_data()
    {
        return $this->list_data('categories.json', 'categories');
    }

    private function layers_data()
    {
        return $this->list_data('layers.json', 'layers');
    }

    private function layer_index(array $d, $id)
    {
        foreach ($d['layers'] as $i => $l) {
            if ($l['id'] === $id) {
                return $i;
            }
        }
        return null;
    }

    public function categories()
    {
        return $this->locked(function () {
            return $this->categories_data();
        });
    }

    public function layers()
    {
        return $this->locked(function () {
            return $this->layers_data();
        });
    }

    public function layer_notes_index()
    {
        return $this->locked(function () {
            return $this->index_of('layer');
        });
    }

    /** A list of {lang, name} (several per language allowed); every language must be in the dictionary. */
    /** The optional period of one name (T-043): date_from / date_to of the date model, stored only when set (absent = always). */
    private static function name_period($n)
    {
        $from = dates::clean($n['date_from'] ?? null, 'name begin date');
        $to = dates::clean($n['date_to'] ?? null, 'name end date');
        dates::order_check($from, $to);
        return array_filter(['date_from' => $from, 'date_to' => $to], function ($d) {
            return $d !== null;
        });
    }

    private static function clean_names($list, array $codes, $none_msg, $dated = false)
    {
        $out = [];
        foreach (is_array($list) ? $list : [] as $n) {
            $nm = is_array($n) ? self::one_line($n['name'] ?? '', 200) : '';
            $lg = is_array($n) ? (string) ($n['lang'] ?? '') : '';
            if ($nm === '') {
                continue;
            }
            if (!in_array($lg, $codes, true)) {
                throw self::bad("language \"$lg\" is not in the list; ask an administrator to add it");
            }
            $out[] = ['lang' => $lg, 'name' => $nm] + ($dated ? self::name_period($n) : []);
        }
        if (!$out) {
            throw self::bad($none_msg);
        }
        return $out;
    }

    /** Administrators only (checked by the controller): adds a category, or changes the names of one. Returns its id. */
    public function save_category(array $in)
    {
        return $this->locked(function () use ($in) {
            $codes = array_column($this->lang_load(), 'code');
            $names = self::clean_names($in['names'] ?? [], $codes, 'a category needs at least one name');
            $d = $this->categories_data();
            $id = (string) ($in['id'] ?? '');
            if ($id !== '') {
                $found = false;
                foreach ($d['categories'] as $i => $c) {
                    if ($c['id'] === $id) {
                        $d['categories'][$i]['names'] = $names;
                        $found = true;
                    }
                }
                if (!preg_match(self::UUID, $id) || !$found) {
                    throw self::bad('unknown category');
                }
            } else {
                $id = self::uuid4();
                $d['categories'][] = ['id' => $id, 'names' => $names];
            }
            $this->put_list('categories.json', 'categories', $d);
            return $id;
        });
    }

    // ------------------------------------------------------------------ sources, certainty (T-046 phase 1)
    // sources.json is a dictionary like categories: { id, title, citation?, url? }. Editors add and change entries; none is deleted (places
    // point to them by id). A place or a border may have a certainty, a list of sources and (places only) a radius in metres.
    const MAX_RADIUS_M = 1000000;
    const MAX_SOURCES = 20;
    const CERTAINTY = ['exact', 'approximate', 'disputed'];

    private function sources_data()
    {
        return $this->list_data('sources.json', 'sources');
    }

    public function sources()
    {
        return $this->locked(function () {
            return $this->sources_data();
        });
    }

    /** Editors (checked by the controller): adds a source, or changes one (all three fields are replaced; a missing citation or link is removed). Returns its id. */
    public function save_source(array $in)
    {
        return $this->locked(function () use ($in) {
            $title = self::one_line($in['title'] ?? '', 200);
            if ($title === '') {
                throw self::bad('a source needs a title');
            }
            $src = ['title' => $title];
            $cit = self::one_line($in['citation'] ?? '', 1000);
            if ($cit !== '') {
                $src['citation'] = $cit;
            }
            $url = trim((string) ($in['url'] ?? ''));
            if ($url !== '') {
                if (!preg_match('~^https?://[^\s<>"\']{1,490}$~i', $url)) {
                    throw self::bad('the link must start with http:// or https:// and have no spaces');
                }
                $src['url'] = $url;
            }
            $d = $this->sources_data();
            $id = (string) ($in['id'] ?? '');
            if ($id !== '') {
                $found = false;
                foreach ($d['sources'] as $i => $x) {
                    if ($x['id'] === $id) {
                        $d['sources'][$i] = ['id' => $id] + $src;
                        $found = true;
                    }
                }
                if (!preg_match(self::UUID, $id) || !$found) {
                    throw self::bad('unknown source');
                }
            } else {
                $id = self::uuid4();
                $d['sources'][] = ['id' => $id] + $src;
            }
            $this->put_list('sources.json', 'sources', $d);
            return $id;
        });
    }

    /**
     * certainty, radius_m and sources of a place or a border. Returns [properties to set, keys to remove]: a key that is not sent is left alone
     * (absent = unchanged); null, '' or [] removes it. $radius_ok is false for borders (a radius is drawn around a point).
     */
    private static function clean_evidence(array $in, array $known, $radius_ok)
    {
        $set = [];
        $clear = [];
        if (array_key_exists('certainty', $in)) {
            $c = $in['certainty'];
            if ($c === null || $c === '') {
                $clear[] = 'certainty';
            } elseif (!in_array($c, self::CERTAINTY, true)) {
                throw self::bad('certainty must be exact, approximate or disputed');
            } else {
                $set['certainty'] = $c;
            }
        }
        if (array_key_exists('radius_m', $in)) {
            $r = $in['radius_m'];
            if ($r === null || $r === '') {
                $clear[] = 'radius_m';
            } else {
                if (!$radius_ok) {
                    throw self::bad('only a place has a radius');
                }
                if (is_bool($r) || !is_numeric($r) || (float) $r != floor((float) $r) || $r < 1 || $r > self::MAX_RADIUS_M) {
                    throw self::bad('radius must be a whole number of metres from 1 to ' . self::MAX_RADIUS_M);
                }
                $set['radius_m'] = (int) $r;
            }
        }
        if (array_key_exists('sources', $in)) {
            $s = $in['sources'] === null ? [] : $in['sources'];
            if (!is_array($s) || count($s) > self::MAX_SOURCES) {
                throw self::bad('sources must be a list of at most ' . self::MAX_SOURCES . ' source ids');
            }
            $out = [];
            foreach ($s as $x) {
                if (!is_string($x) || !in_array($x, $known, true)) {
                    throw self::bad('unknown source');
                }
                if (!in_array($x, $out, true)) {
                    $out[] = $x;
                }
            }
            if ($out) {
                $set['sources'] = $out;
            } else {
                $clear[] = 'sources';
            }
        }
        return [$set, $clear];
    }

    private function clean_layer(array $in, array $codes)
    {
        $names = self::clean_names($in['names'] ?? [], $codes, 'a layer needs at least one name');
        $desc = [];
        $seen = [];
        foreach (is_array($in['descriptions'] ?? null) ? $in['descriptions'] : [] as $x) {
            $t = is_array($x) ? trim(str_replace("\r\n", "\n", (string) ($x['text'] ?? ''))) : '';
            $lg = is_array($x) ? (string) ($x['lang'] ?? '') : '';
            if ($t === '') {
                continue;
            }
            if (!in_array($lg, $codes, true)) {
                throw self::bad("language \"$lg\" is not in the list; ask an administrator to add it");
            }
            if (isset($seen[$lg])) {
                throw self::bad("a layer has one description per language (\"$lg\" appears twice)");
            }
            if ((function_exists('mb_strlen') ? mb_strlen($t) : strlen($t)) > self::MAX_DESC) {
                throw self::bad('a description can have at most ' . self::MAX_DESC . ' characters');
            }
            $seen[$lg] = true;
            $desc[] = ['lang' => $lg, 'text' => $t];
        }
        $cat = $in['category'] ?? null;
        if ($cat === '') {
            $cat = null;
        }
        if ($cat !== null) {
            $ok = false;
            foreach ($this->categories_data()['categories'] as $c) {
                $ok = $ok || $c['id'] === $cat;
            }
            if (!is_string($cat) || !$ok) {
                throw self::bad('unknown category');
            }
        }
        $color = $in['color'] ?? null;
        if ($color === '') {
            $color = null;
        }
        if ($color !== null && (!is_string($color) || !preg_match(self::COLOR, $color))) {
            throw self::bad('the colour must look like #aa3344');
        }
        $from = dates::clean($in['date_from'] ?? null, 'begin date');
        $to = dates::clean($in['date_to'] ?? null, 'end date');
        dates::order_check($from, $to);
        return [
            'names' => $names,
            'descriptions' => $desc,
            'category' => $cat,
            'color' => $color === null ? null : strtolower($color),
            'date_from' => $from,
            'date_to' => $to
        ];
    }

    private static function now_utc()
    {
        return gmdate('Y-m-d\TH:i:s\Z');
    }

    /** Creates a layer (no id; it starts with no places) or changes the fields of one (its places stay). Returns the id. */
    public function save_layer(array $in)
    {
        return $this->locked(function () use ($in) {
            $codes = array_column($this->lang_load(), 'code');
            $c = $this->clean_layer($in, $codes);
            $d = $this->layers_data();
            $id = (string) ($in['id'] ?? '');
            $now = self::now_utc();
            if ($id !== '') {
                $i = preg_match(self::UUID, $id) ? $this->layer_index($d, $id) : null;
                if ($i === null) {
                    throw self::bad('unknown layer');
                }
                $d['layers'][$i] = array_merge($d['layers'][$i], $c, ['updated' => $now]);
            } else {
                $id = self::uuid4();
                $d['layers'][] = ['id' => $id] + $c + ['members' => [], 'created' => $now, 'updated' => $now];
            }
            $this->put_list('layers.json', 'layers', $d);
            return $id;
        });
    }

    /** [place id => true] of every place. */
    private function place_ids()
    {
        $fc = $this->repo->doc('places');
        $out = [];
        foreach (is_array($fc) ? $fc['features'] ?? [] : [] as $f) {
            $out[$f['properties']['id'] ?? ''] = true;
        }
        return $out;
    }

    /** Adds and/or removes places of one layer. The caller holds the lock. Returns the new number of members. */
    private function change_members($lid, array $add, array $remove)
    {
        $d = $this->layers_data();
        $i = preg_match(self::UUID, (string) $lid) ? $this->layer_index($d, $lid) : null;
        if ($i === null) {
            throw self::bad('unknown layer');
        }
        $places = $this->place_ids();
        $shapes = $this->shape_ids();
        $members = [];
        $kind = []; // id => 'place' | 'shape'
        foreach ($d['layers'][$i]['members'] as $m) {
            $mid = $m['place'] ?? ($m['shape'] ?? null);
            if ($mid !== null) {
                $members[] = $mid;
                $kind[$mid] = isset($m['shape']) ? 'shape' : 'place';
            }
        }
        $changed = false;
        foreach ($add as $p) {
            if (!is_string($p) || !(isset($places[$p]) || isset($shapes[$p]))) {
                throw self::bad('unknown place or border');
            }
            if (!in_array($p, $members, true)) {
                $members[] = $p; // appended: the order of the list is the order of adding
                $kind[$p] = isset($places[$p]) ? 'place' : 'shape';
                $changed = true;
            }
        }
        $removed = [];
        foreach ($remove as $p) {
            $k = array_search($p, $members, true);
            if ($k !== false) {
                unset($members[$k]);
                $removed[] = $p;
                $changed = true;
            }
        }
        if ($changed) {
            $list = [];
            foreach ($members as $mid) {
                $list[] = [$kind[$mid] => $mid];
            }
            $d['layers'][$i]['members'] = $list;
            $d['layers'][$i]['updated'] = self::now_utc();
            $this->put_list('layers.json', 'layers', $d);
            $gone = false;
            foreach ($removed as $p) {
                if (($kind[$p] ?? '') === 'place') {
                    $this->untag_notes($lid, $p); // a place that left the layer keeps its notes, but they are no longer tied to it
                    $gone = true;
                }
            }
            if ($gone) {
                $this->rebuild_index();
            }
        }
        return count($members);
    }

    /** Takes the layer id out of the "layers:" header of the notes of one place (or of all places when $pid is null). */
    private function untag_notes($lid, $pid = null)
    {
        foreach ($this->repo->notes($pid) as $n) {
            if ($n['kind'] !== 'place' || !in_array($lid, $n['layers'], true)) {
                continue;
            }
            $n['layers'] = array_values(array_diff($n['layers'], [$lid]));
            $this->repo->put_note($n, 'untag');
        }
    }

    /** Checks the layers of a place note: they must exist and the place must be a member of each (or join it in the same request). Returns the ids. */
    private function clean_note_layers($ids, $pid, array $joining = [])
    {
        if (!is_array($ids)) {
            throw self::bad('layers must be a list');
        }
        $d = $this->layers_data();
        $out = [];
        foreach ($ids as $id) {
            $i = is_string($id) && preg_match(self::UUID, $id) ? $this->layer_index($d, $id) : null;
            if ($i === null) {
                throw self::bad('unknown layer');
            }
            if (!in_array($id, $joining, true) && ($pid === null || !in_array($pid, array_column($d['layers'][$i]['members'], 'place'), true))) {
                throw self::bad('the place is not in the layer "' . $d['layers'][$i]['names'][0]['name'] . '"; add it to the layer first');
            }
            if (!in_array($id, $out, true)) {
                $out[] = $id;
            }
        }
        return $out;
    }

    /** POST /map/layer-save, members: {id, add: [place ids], remove: [place ids]}. Returns the number of members. */
    public function save_members(array $in)
    {
        return $this->locked(function () use ($in) {
            foreach (['add', 'remove', 'add_shapes', 'remove_shapes'] as $k) {
                if (isset($in[$k]) && !is_array($in[$k])) {
                    throw self::bad("\"$k\" must be a list of ids");
                }
            }
            // places and borders are both given as ids (add_shapes / remove_shapes are the same lists, as INTERFACES I-9 names them)
            return $this->change_members(
                (string) ($in['id'] ?? ''),
                array_merge($in['add'] ?? [], $in['add_shapes'] ?? []),
                array_merge($in['remove'] ?? [], $in['remove_shapes'] ?? [])
            );
        });
    }

    /** Adds or edits a note of a layer itself (not of a place): {layer_id, note: {id?, lang, title, date, text}}. Returns its id. */
    public function save_layer_note(array $in)
    {
        return $this->locked(function () use ($in) {
            $codes = array_column($this->lang_load(), 'code');
            $lid = (string) ($in['layer_id'] ?? '');
            // the owner of a layer note is a layer or a shape (a border or a route); both ids are UUIDs, so they never clash
            if (!preg_match(self::UUID, $lid) || ($this->layer_index($this->layers_data(), $lid) === null && !isset($this->shape_ids()[$lid]))) {
                throw self::bad('unknown layer or border');
            }
            $n = $in['note'] ?? null;
            if (!is_array($n)) {
                throw self::bad('a note is required');
            }
            list($lang, $title, $text, $date) = self::clean_note($n, $codes);
            $nid = (string) ($n['id'] ?? '');
            if ($nid !== '') {
                $old = preg_match(self::UUID, $nid) ? $this->repo->note($lid, $nid) : null;
                if ($old === null || $old['kind'] !== 'layer') {
                    throw self::bad('unknown note');
                }
            } else {
                $nid = self::uuid4();
            }
            $this->repo->put_note(['owner' => $lid, 'kind' => 'layer', 'id' => $nid, 'lang' => $lang, 'title' => $title, 'date' => $date, 'layers' => [], 'text' => $text]);
            return $nid;
        });
    }

    /** Moves every note of an owner (a layer or a shape) to archive/ and rebuilds the index. Nothing happens when it has no notes. */
    private function archive_layer_notes($id)
    {
        $this->repo->remove_notes($id);
    }


    /** Administrators only (checked by the controller). Removes a layer; its places and their notes stay in the general layer. */
    public function delete_layer($id)
    {
        return $this->locked(function () use ($id) {
            $d = $this->layers_data();
            $i = preg_match(self::UUID, (string) $id) ? $this->layer_index($d, $id) : null;
            if ($i === null) {
                throw self::bad('unknown layer');
            }
            array_splice($d['layers'], $i, 1);
            $this->put_list('layers.json', 'layers', $d); // the copy in archive/ still has the layer and its members
            $this->archive_layer_notes($id);
            $this->untag_notes($id);
            $this->rebuild_index();
            return true;
        });
    }

    /** POST /map/layer-save: one of {layer}, {layer_members}, {layer_note}. Returns what the browser needs. */
    public function layer_save(array $in)
    {
        if (isset($in['layer']) && is_array($in['layer'])) {
            return ['id' => $this->save_layer($in['layer'])];
        }
        if (isset($in['layer_members']) && is_array($in['layer_members'])) {
            return ['members' => $this->save_members($in['layer_members'])];
        }
        if (isset($in['layer_note']) && is_array($in['layer_note'])) {
            return ['id' => $this->save_layer_note($in['layer_note'])];
        }
        throw self::bad('nothing to save');
    }

    // ------------------------------------------------------------------ shapes: borders (areas) and lines
    // shapes.geojson: one feature per shape. Geometry: Polygon, MultiPolygon, LineString or MultiLineString. Properties: id, names, type,
    // color, opacity (the fill of an area, the line of a line), label (draw the name on the map), date_from, date_to, source, created,
    // updated. Same rules as dev/save-handler.js (the browser-sync handler).
    // Shape types are the line and area types of the types dictionary (data/types.json). The built-in ones below existed before the dictionary
    // held lines and areas: [code, English name, geometry, colour, pattern, width, fill opacity (area) | one way (line)]. They are offered while a
    // types.json has no line or area type, and written with the next change of the dictionary.
    const SHAPE_PATTERNS = ['solid', 'dashed', 'dotted', 'dashdot', 'double', 'triple'];
    const BUILTIN_SHAPE_TYPES = [
        ['country', 'Country', 'area', '#b3261e', 'solid', 2.6, 0.1],
        ['kingdom', 'Kingdom or empire', 'area', '#7b1fa2', 'solid', 2.2, 0.18],
        ['province', 'Region or province', 'area', '#0b6e8a', 'dashed', 2, 0.12],
        ['district', 'District', 'area', '#8d6e63', 'dotted', 2, 0.1],
        ['territory', 'Territory or area', 'area', '#2e7d32', 'solid', 1.4, 0.2],
        ['disputed', 'Disputed area', 'area', '#e07b39', 'dashdot', 2.2, 0.12],
        ['trade', 'Trade route', 'line', '#b7791f', 'dashed', 2.4, false],
        ['military', 'Military march', 'line', '#c62828', 'solid', 3, true],
        ['migration', 'Migration', 'line', '#6a1b9a', 'dotted', 2.8, true],
        ['journey', 'Journey or embassy', 'line', '#00796b', 'dashdot', 2.4, true],
        ['road', 'Road', 'line', '#5d4037', 'solid', 2, false],
        ['waterway', 'River', 'river', '#1e88e5', 'solid', 3, false]
    ];
    private static function builtin_shape_types()
    {
        $out = [];
        foreach (self::BUILTIN_SHAPE_TYPES as $b) {
            list($code, $name, $geometry, $color, $pattern, $width, $x) = $b;
            $out[] = [
                'code' => $code,
                'geometry' => $geometry,
                'names' => [['lang' => 'en', 'name' => $name]],
                'color' => $color,
                'style' => $geometry === 'area'
                    ? ['fill_opacity' => $x, 'outline' => ['width' => $width, 'pattern' => $pattern, 'opacity' => 1]]
                    : ($geometry === 'river'
                        ? ['width' => $width, 'pattern' => $pattern, 'opacity' => 1]
                        : ['width' => $width, 'pattern' => $pattern, 'opacity' => 1, 'arrow' => $x])
            ];
        }
        return $out;
    }
    private static function with_shape_types(array $list)
    {
        $has = [];
        foreach ($list as $t) {
            $has[$t['geometry'] ?? 'point'] = true;
        }
        if (!isset($has['line']) && !isset($has['area']) && !isset($has['river'])) {
            return array_merge($list, self::builtin_shape_types());
        }
        if (!isset($has['river'])) {
            // a dictionary made before rivers existed: the built-in river type is offered, so the Rivers tab works at once
            return array_merge($list, array_values(array_filter(self::builtin_shape_types(), function ($t) {
                return $t['geometry'] === 'river';
            })));
        }
        return $list;
    }
    /** { code => 'line' | 'area' | 'river' } of the shape types. Caller holds the lock. */
    private function shape_kinds()
    {
        $k = [];
        foreach ($this->type_load() as $t) {
            if (($t['geometry'] ?? 'point') !== 'point') {
                $k[$t['code']] = $t['geometry'];
            }
        }
        return $k;
    }
    const SHAPE_GEOMS = ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'];
    const MAX_SHAPE_POINTS = 20000;
    const SHAPE_SOURCE = '/^[A-Za-z0-9:_.\/ -]{0,100}$/';

    /** The shapes as the browser gets them: a GeoJSON collection (empty when there is no file yet). */
    public function shapes()
    {
        return $this->locked(function () {
            return $this->read_shapes();
        });
    }

    private function read_shapes()
    {
        $d = $this->repo->doc('shapes');
        return is_array($d) && isset($d['features']) && is_array($d['features']) ? $d : ['type' => 'FeatureCollection', 'features' => []];
    }

    /** One feature per line: a change shows in git as a change of one line, not of thousands of numbers. The old file is archived first. */
    private function put_shapes(array $d)
    {
        $this->repo->put_doc('shapes', $d);
    }

    /** [shape id => true] of every shape. */
    private function shape_ids()
    {
        $out = [];
        foreach ($this->read_shapes()['features'] as $f) {
            $out[$f['properties']['id'] ?? ''] = true;
        }
        return $out;
    }

    /** Checks a geometry and returns it with coordinates rounded to 6 decimals (about 10 cm). */
    private static function clean_geometry($g)
    {
        if (!is_array($g) || !in_array($g['type'] ?? '', self::SHAPE_GEOMS, true) || !isset($g['coordinates']) || !is_array($g['coordinates'])) {
            throw self::bad('a border needs a Polygon, MultiPolygon, LineString or MultiLineString geometry');
        }
        $n = 0;
        $num = function ($v) {
            return is_int($v) || is_float($v);
        };
        $pt = function ($c) use (&$n, $num) {
            if (!is_array($c) || !isset($c[0], $c[1]) || !$num($c[0]) || !$num($c[1]) || abs($c[0]) > 180 || abs($c[1]) > 90) {
                throw self::bad('a coordinate is out of range (longitude -180..180, latitude -90..90)');
            }
            $n++;
            return [round($c[0], 6), round($c[1], 6)];
        };
        $line = function ($l, $min) use ($pt) {
            if (!is_array($l) || count($l) < $min) {
                throw self::bad("a line needs at least $min points");
            }
            return array_map($pt, array_values($l));
        };
        $ring = function ($r) use ($line) {
            $q = $line($r, 4);
            $last = $q[count($q) - 1];
            if ($q[0][0] !== $last[0] || $q[0][1] !== $last[1]) {
                throw self::bad('an area outline must be closed');
            }
            return $q;
        };
        $poly = function ($p) use ($ring) {
            if (!is_array($p) || !$p) {
                throw self::bad('an area needs an outline');
            }
            return array_map($ring, array_values($p));
        };
        $many = function ($a, $f) {
            if (!is_array($a) || !$a) {
                throw self::bad('the geometry is empty');
            }
            return array_map($f, array_values($a));
        };
        $c = $g['coordinates'];
        switch ($g['type']) {
            case 'Polygon':
                $co = $poly($c);
                break;
            case 'MultiPolygon':
                $co = $many($c, $poly);
                break;
            case 'LineString':
                $co = $line($c, 2);
                break;
            default:
                $co = $many($c, function ($l) use ($line) {
                    return $line($l, 2);
                });
        }
        if ($n > self::MAX_SHAPE_POINTS) {
            throw self::bad('a border can have at most ' . self::MAX_SHAPE_POINTS . " points (it has $n); simplify it");
        }
        return ['type' => $g['type'], 'coordinates' => $co];
    }

    /** Checks the fields of a shape (not the geometry) and returns them ready to store. */
    private static function clean_shape(array $in, array $codes, array $places, array $kinds)
    {
        $names = self::clean_names($in['names'] ?? [], $codes, 'a border needs at least one name', true);
        if (!is_string($in['type'] ?? null) || !isset($kinds[$in['type']])) {
            throw self::bad('unknown border type' . (is_string($in['type'] ?? null) ? ' “' . $in['type'] . '” (it is not a line, area or river type in the types dictionary)' : ''));
        }
        $color = $in['color'] ?? null;
        if (!is_string($color) || !preg_match(self::COLOR, $color)) {
            throw self::bad('the colour must look like #aa3344');
        }
        $op = $in['opacity'] ?? null;
        if (is_bool($op) || !is_numeric($op) || (float) $op < 0 || (float) $op > 1) {
            throw self::bad('the opacity must be between 0 and 1');
        }
        if (!is_bool($in['label'] ?? null)) {
            throw self::bad('"label" must be true or false');
        }
        $source = (string) ($in['source'] ?? '');
        if (!preg_match(self::SHAPE_SOURCE, $source)) {
            throw self::bad('the source is too long or has unusual characters');
        }
        $from = dates::clean($in['date_from'] ?? null, 'begin date');
        $to = dates::clean($in['date_to'] ?? null, 'end date');
        dates::order_check($from, $to);
        $out = [
            'names' => $names,
            'type' => $in['type'],
            'color' => strtolower($color),
            'opacity' => round((float) $op, 2),
            'label' => $in['label'],
            'date_from' => $from,
            'date_to' => $to,
            'source' => $source
        ];
        // width: the line width in pixels, 0.5 to 12. Absent = unchanged (a new shape then uses the width of its type).
        if (array_key_exists('width', $in)) {
            if (is_bool($in['width']) || !is_numeric($in['width']) || (float) $in['width'] < 0.5 || (float) $in['width'] > 12) {
                throw self::bad('the width must be between 0.5 and 12');
            }
            $out['width'] = round((float) $in['width'], 1);
        }
        // series: versions of one border, route or river in time share one UUID (T-041). Absent = unchanged, a single shape has none.
        if (array_key_exists('series', $in)) {
            if (!is_string($in['series']) || !preg_match(self::UUID, $in['series'])) {
                throw self::bad('the series must be a UUID');
            }
            $out['series'] = $in['series'];
        }
        if ($kinds[$in['type']] === 'line') {
            // stops: the places the route passes, in order (ids of existing places; at most 60). twoway: usable both ways. Absent = unchanged.
            if (array_key_exists('stops', $in)) {
                $st = $in['stops'];
                if (!is_array($st) || count($st) > 60) {
                    throw self::bad('unknown place among the route stops');
                }
                foreach ($st as $id) {
                    if (!is_string($id) || !isset($places[$id])) {
                        throw self::bad('unknown place among the route stops');
                    }
                }
                $out['stops'] = array_values($st);
            }
            if (array_key_exists('twoway', $in)) {
                if (!is_bool($in['twoway'])) {
                    throw self::bad('twoway must be true or false');
                }
                $out['twoway'] = $in['twoway'];
            }
        }
        return $out;
    }

    /** T-041: the versions of one series are all areas or all lines, and two versions whose dates are all known do not overlap. */
    private static function series_check(array $props, array $features, array $kinds)
    {
        $series = $props['series'] ?? null;
        if ($series === null) {
            return;
        }
        $group = function ($type) use ($kinds) {
            return ($kinds[$type] ?? 'area') === 'area' ? 'area' : 'line';
        };
        $span = function ($p) {
            return !empty($p['date_from']) && !empty($p['date_to']) ? [dates::bounds($p['date_from'])[0], dates::bounds($p['date_to'])[1]] : null;
        };
        foreach ($features as $f) {
            $o = $f['properties'];
            if (($o['series'] ?? null) !== $series || $o['id'] === $props['id']) {
                continue;
            }
            if ($group($o['type']) !== $group($props['type'])) {
                throw self::bad('all versions of a series must be of the same kind (area or line)');
            }
            $a = $span($props);
            $b = $span($o);
            if ($a !== null && $b !== null && $a[0] < $b[1] && $b[0] < $a[1]) {
                throw self::bad('versions of one series overlap');
            }
        }
    }

    /** A route or a river is a line: refuses an area for such a type. */
    private static function route_geometry_check($type, array $g, array $kinds)
    {
        if (in_array($kinds[$type] ?? '', ['line', 'river'], true) && !in_array($g['type'], ['LineString', 'MultiLineString'], true)) {
            throw self::bad(($kinds[$type] ?? '') === 'river' ? 'a river must be a line' : 'a route must be a line');
        }
    }

    /** Editors (checked by the controller): creates a shape (no id; geometry required) or changes one (geometry only when given). Returns the id. */
    public function save_shape(array $in)
    {
        return $this->locked(function () use ($in) {
            $codes = array_column($this->lang_load(), 'code');
            $kinds = $this->shape_kinds();
            $c = self::clean_shape($in, $codes, $this->place_ids(), $kinds);
            list($ev, $clear) = self::clean_evidence($in, array_column($this->sources_data()['sources'], 'id'), false);
            $c += $ev;
            $d = $this->read_shapes();
            $now = self::now_utc();
            $id = (string) ($in['id'] ?? '');
            if ($id !== '') {
                $at = null;
                if (preg_match(self::UUID, $id)) {
                    foreach ($d['features'] as $k => $f) {
                        if (($f['properties']['id'] ?? '') === $id) {
                            $at = $k;
                        }
                    }
                }
                if ($at === null) {
                    throw self::bad('unknown border');
                }
                if (array_key_exists('geometry', $in)) {
                    $d['features'][$at]['geometry'] = self::clean_geometry($in['geometry']);
                }
                self::route_geometry_check($c['type'], $d['features'][$at]['geometry'], $kinds);
                $d['features'][$at]['properties'] = array_diff_key(array_merge($d['features'][$at]['properties'], $c, ['updated' => $now]), array_flip($clear));
                self::series_check($d['features'][$at]['properties'], $d['features'], $kinds);
            } else {
                $id = self::uuid4();
                $geom = self::clean_geometry($in['geometry'] ?? null);
                self::route_geometry_check($c['type'], $geom, $kinds);
                self::series_check(['id' => $id] + $c, $d['features'], $kinds);
                $d['features'][] = [
                    'type' => 'Feature',
                    'geometry' => $geom,
                    'properties' => ['id' => $id] + $c + ['created' => $now, 'updated' => $now]
                ];
            }
            $this->put_shapes($d);
            return $id;
        });
    }

    /** Editors (checked by the controller): deletes a shape; the old file stays in archive/. The shape leaves every layer. */
    public function delete_shape($id)
    {
        return $this->locked(function () use ($id) {
            $d = $this->read_shapes();
            $at = null;
            if (preg_match(self::UUID, (string) $id)) {
                foreach ($d['features'] as $k => $f) {
                    if (($f['properties']['id'] ?? '') === $id) {
                        $at = $k;
                    }
                }
            }
            if ($at === null) {
                throw self::bad('unknown border');
            }
            array_splice($d['features'], $at, 1);
            $this->put_shapes($d);
            $ls = $this->layers_data();
            $changed = false;
            foreach ($ls['layers'] as $i => $l) {
                $keep = array_values(
                    array_filter($l['members'], function ($m) use ($id) {
                        return ($m['shape'] ?? null) !== $id;
                    })
                );
                if (count($keep) !== count($l['members'])) {
                    $ls['layers'][$i]['members'] = $keep;
                    $ls['layers'][$i]['updated'] = self::now_utc();
                    $changed = true;
                }
            }
            if ($changed) {
                $this->put_list('layers.json', 'layers', $ls);
            }
            $this->archive_layer_notes($id); // the notes of the shape go to archive/ with it
            return true;
        });
    }

    // ------------------------------------------------------------------ historical map images (overlays)
    const IMG_MAX = 12582912; // 12 MB

    private static function sniff($b)
    {
        if (strncmp($b, "\x89PNG\r\n\x1a\n", 8) === 0) {
            return ['image/png', 'png'];
        }
        if (strncmp($b, "\xFF\xD8\xFF", 3) === 0) {
            return ['image/jpeg', 'jpg'];
        }
        if (strlen($b) > 12 && substr($b, 0, 4) === 'RIFF' && substr($b, 8, 4) === 'WEBP') {
            return ['image/webp', 'webp'];
        }
        return null;
    }

    public static function mime_of($file)
    {
        $e = pathinfo($file, PATHINFO_EXTENSION);
        return $e === 'png' ? 'image/png' : ($e === 'webp' ? 'image/webp' : 'image/jpeg');
    }

    private function locked(callable $fn)
    {
        return $this->repo->transaction($fn);
    }

    public function overlays()
    {
        $d = $this->repo->doc('overlays');
        return is_array($d) && isset($d['overlays']) ? $d : ['version' => 1, 'overlays' => []];
    }

    private function write_overlays(array $d)
    {
        $this->repo->put_doc('overlays', $d);
    }

    /** [absolute path, mime] of an overlay's image, or null. */
    public function overlay_file($id)
    {
        if (!preg_match(self::UUID, $id)) {
            return null;
        }
        foreach ($this->overlays()['overlays'] as $o) {
            if ($o['id'] === $id && $o['file'] !== '' && is_file($this->base . 'overlays/' . $o['file'])) {
                return [$this->base . 'overlays/' . $o['file'], self::mime_of($o['file'])];
            }
        }
        return null;
    }

    private static function clean_overlay(array $in)
    {
        $title = trim(preg_replace('/\s+/', ' ', (string) ($in['title'] ?? '')));
        if ($title === '') {
            throw self::bad('a title is required');
        }
        $title = function_exists('mb_substr') ? mb_substr($title, 0, 120) : substr($title, 0, 120);
        $co = $in['coordinates'] ?? null;
        if (!is_array($co) || count($co) !== 4) {
            throw self::bad('four corner coordinates are required');
        }
        $coords = [];
        foreach ($co as $c) {
            if (!is_array($c) || count($c) < 2 || !is_numeric($c[0]) || !is_numeric($c[1])) {
                throw self::bad('bad coordinates');
            }
            $lon = (float) $c[0];
            $lat = (float) $c[1];
            if ($lon < -180 || $lon > 180 || $lat < -85.06 || $lat > 85.06) {
                throw self::bad('coordinates out of range');
            }
            $coords[] = [$lon, $lat];
        }
        $min = (float) ($in['minzoom'] ?? 0);
        $max = (float) ($in['maxzoom'] ?? 24);
        $op = (float) ($in['opacity'] ?? 0.6);
        if ($min < 0 || $max > 24 || $min >= $max) {
            throw self::bad('zoom range must satisfy 0 <= from < to <= 24');
        }
        if ($op < 0 || $op > 1) {
            throw self::bad('opacity must be between 0 and 1');
        }
        return ['title' => $title, 'coordinates' => $coords, 'minzoom' => $min, 'maxzoom' => $max, 'opacity' => $op];
    }

    /** Create (no id) or update (id) an overlay's settings. The image itself is uploaded separately. Returns the id. */
    public function save_overlay(array $in)
    {
        return $this->locked(function () use ($in) {
            $d = $this->overlays();
            $c = self::clean_overlay($in);
            $id = (string) ($in['id'] ?? '');
            $now = gmdate('Y-m-d\TH:i:s\Z');
            if ($id !== '') {
                if (!preg_match(self::UUID, $id)) {
                    throw self::bad('bad id');
                }
                $found = false;
                foreach ($d['overlays'] as $i => $o) {
                    if ($o['id'] === $id) {
                        $d['overlays'][$i] = array_merge($o, $c, ['updated' => $now]);
                        $found = true;
                    }
                }
                if (!$found) {
                    throw self::bad('unknown overlay');
                }
            } else {
                $id = self::uuid4();
                $d['overlays'][] = array_merge(['id' => $id, 'file' => '', 'created' => $now], $c, ['updated' => $now]);
            }
            $this->write_overlays($d);
            return $id;
        });
    }

    public function save_overlay_image($id, $bytes)
    {
        return $this->locked(function () use ($id, $bytes) {
            if (!preg_match(self::UUID, $id)) {
                throw self::bad('bad id');
            }
            if ($bytes === '' || strlen($bytes) > self::IMG_MAX) {
                throw self::bad('image missing or larger than 12 MB');
            }
            $t = self::sniff($bytes);
            if (!$t) {
                throw self::bad('only PNG, JPEG or WebP images are accepted');
            }
            $d = $this->overlays();
            $idx = null;
            foreach ($d['overlays'] as $i => $o) {
                if ($o['id'] === $id) {
                    $idx = $i;
                }
            }
            if ($idx === null) {
                throw self::bad('unknown overlay');
            }
            $dir = $this->base . 'overlays/';
            @mkdir($dir, 0775, true);
            $file = $id . '.' . $t[1];
            $old = $d['overlays'][$idx]['file'];
            self::write_atomic($dir . $file, $bytes);
            if ($old !== '' && $old !== $file && is_file($dir . $old)) {
                @mkdir($this->base . 'archive/', 0775, true);
                rename($dir . $old, $this->base . 'archive/overlay-' . date('Ymd-His') . '-' . $old);
            }
            $d['overlays'][$idx]['file'] = $file;
            $d['overlays'][$idx]['updated'] = gmdate('Y-m-d\TH:i:s\Z');
            $this->write_overlays($d);
            return $file;
        });
    }

    public function delete_overlay($id)
    {
        return $this->locked(function () use ($id) {
            if (!preg_match(self::UUID, $id)) {
                throw self::bad('bad id');
            }
            $d = $this->overlays();
            $keep = [];
            $found = false;
            $arch = $this->base . 'archive/';
            @mkdir($arch, 0775, true);
            foreach ($d['overlays'] as $o) {
                if ($o['id'] !== $id) {
                    $keep[] = $o;
                    continue;
                }
                $found = true;
                if ($o['file'] !== '' && is_file($this->base . 'overlays/' . $o['file'])) {
                    rename(
                        $this->base . 'overlays/' . $o['file'],
                        $arch . 'overlay-' . date('Ymd-His') . '-' . $o['file']
                    );
                }
            }
            if (!$found) {
                throw self::bad('unknown overlay');
            }
            $d['overlays'] = $keep;
            $this->write_overlays($d);
            return true;
        });
    }
}
