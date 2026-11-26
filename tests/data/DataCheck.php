<?php
/**
 * Checks the DATA FILES of a store (data/ of the extension, or a live store/ahm_map/) against the rules in README section 5.
 * It reads files only; it never writes to the directory it checks. Returns a list of problems [code, message].
 */
namespace ahm\map\tests;

use ahm\map\service\dates;
use ahm\map\service\store;

class DataCheck
{
    private $dir;
    private $problems = [];

    public static function run($dir)
    {
        $c = new self();
        $c->dir = rtrim($dir, '/');
        $c->all();
        return $c->problems;
    }

    private function bad($code, $msg)
    {
        $this->problems[] = [$code, $msg];
    }

    /** decoded JSON file, or null (and a problem) when missing/invalid; $optional: missing is fine */
    private function json($name, $optional = false)
    {
        $f = "$this->dir/$name";
        if (!is_file($f)) {
            if (!$optional) {
                $this->bad('file-missing', "$name is missing");
            }
            return null;
        }
        $d = json_decode(file_get_contents($f), true);
        if (!is_array($d)) {
            $this->bad('json-invalid', "$name is not valid JSON");
            return null;
        }
        return $d;
    }

    private function all()
    {
        $places = $this->json('places.geojson');
        $langs = $this->json('languages.json');
        $cats = $this->json('categories.json', true);
        $layers = $this->json('layers.json', true);
        $over = $this->json('overlays.json', true);
        $types = $this->json('types.json', true);
        $src = $this->json('sources.json', true);
        $codes = $langs ? array_column($langs['languages'] ?? [], 'code') : [];
        $this->languages($langs);
        $typeCodes = $types ? $this->types($types, $codes) : store::TYPES; // no types.json yet: the seed list
        $srcIds = $src ? $this->sources($src) : [];
        $placeIds = $places ? $this->places($places, $codes, $typeCodes, $srcIds) : [];
        $this->shapeEvidence($srcIds);
        $shapeIds = $this->shapeIds();
        $notes = $this->notes($placeIds, $codes);
        $catIds = $cats ? $this->categories($cats, $codes) : [];
        $layerIds = $layers ? $this->layers($layers, $codes, $catIds, $placeIds, $shapeIds) : [];
        $this->tags($notes, $layerIds, $layers);
        $this->layerNotes($layerIds, $codes, $shapeIds);
        if ($over) {
            $this->overlays($over);
        }
        $this->indexes();
    }

    private function uuid($v)
    {
        return is_string($v) && preg_match(store::UUID, $v) === 1;
    }

    private function date($d, $where)
    {
        if ($d === null) {
            return;
        }
        if (!is_array($d) || !is_string($d['ts'] ?? null)) {
            $this->bad('date-format', "$where: date is not in the current format (ISO text)");
            return;
        }
        try {
            if (dates::clean($d) !== $d) {
                $this->bad('date-invalid', "$where: date is not normalised");
            }
        } catch (\InvalidArgumentException $e) {
            $this->bad('date-invalid', "$where: " . $e->getMessage());
        }
    }

    private function languages($l)
    {
        if (!$l) {
            return;
        }
        $seen = [];
        foreach ($l['languages'] ?? [] as $x) {
            $c = $x['code'] ?? '';
            if (!preg_match(store::LANG, $c) || $c !== strtolower($c)) {
                $this->bad('language-code', "language code \"$c\" is not 2-8 lower-case letters");
            }
            if (isset($seen[$c])) {
                $this->bad('language-duplicate', "language \"$c\" twice");
            }
            $seen[$c] = true;
            if (trim($x['name'] ?? '') === '') {
                $this->bad('language-name', "language \"$c\" has no name");
            }
        }
    }

    /** The types dictionary (types.json): returns the codes of the point types. */
    private function types($d, $codes)
    {
        $seen = [];
        foreach ($d['types'] ?? [] as $i => $t) {
            $c = $t['code'] ?? '';
            $w = "type #$i \"$c\"";
            if (!is_string($c) || !preg_match(store::TYPE_CODE, $c)) {
                $this->bad('type-code', "$w: bad code");
            }
            if (isset($seen[$c])) {
                $this->bad('type-duplicate', "$w: code used twice");
            }
            if (!in_array($t['geometry'] ?? '', ['point', 'line', 'area', 'river'], true)) {
                $this->bad('type-geometry', "$w: geometry must be point, line, area or river");
            }
            if (!preg_match(store::COLOR, (string) ($t['color'] ?? ''))) {
                $this->bad('type-color', "$w: colour must look like #aabbcc");
            }
            if (($t['geometry'] ?? '') === 'point' && !preg_match(store::SYMBOL, (string) ($t['style']['symbol'] ?? ''))) {
                $this->bad('type-symbol', "$w: bad symbol");
            }
            if (($t['geometry'] ?? '') === 'point' && ($t['style']['symbol'] ?? '') === 'custom') {
                $path = $t['style']['path'] ?? null;
                if (!is_string($path) || !preg_match(store::PATH, $path) || !preg_match('/^[Mm]/', $path)) {
                    $this->bad('type-path', "$w: a custom symbol needs an SVG path");
                }
                $box = $t['style']['box'] ?? null;
                if (!(is_int($box) || is_float($box)) || $box < 8 || $box > 2048) {
                    $this->bad('type-box', "$w: the box of a custom symbol must be 8 to 2048");
                }
            }
            $this->names($t['names'] ?? [], $codes, $w, 'type');
            if (($t['geometry'] ?? '') === 'point') {
                $seen[$c] = true;
            }
        }
        return array_keys($seen);
    }

    private function places($fc, $codes, $typeCodes, $srcIds = [])
    {
        $ids = [];
        if (($fc['type'] ?? '') !== 'FeatureCollection') {
            $this->bad('places-type', 'places.geojson is not a FeatureCollection');
        }
        foreach ($fc['features'] ?? [] as $i => $f) {
            $p = $f['properties'] ?? [];
            $id = $p['id'] ?? null;
            $w = "place #$i" . ($id ? " $id" : '');
            if (!$this->uuid($id)) {
                $this->bad('place-id', "$w: id is not a UUID");
                continue;
            }
            $this->evidence($p, $srcIds, $w, 'place', true);
            if (isset($ids[$id])) {
                $this->bad('place-id-duplicate', "$w: id used twice");
            }
            $ids[$id] = true;
            $c = $f['geometry']['coordinates'] ?? null;
            if (!is_array($c) || count($c) !== 2 || abs($c[0]) > 180 || abs($c[1]) > 90) {
                $this->bad('place-coordinates', "$w: bad coordinates");
            }
            if (!in_array($p['type'] ?? '', $typeCodes, true)) {
                $this->bad('place-type', "$w: type \"" . ($p['type'] ?? '') . '" is not in the list');
            }
            if (empty($p['names'])) {
                $this->bad('place-names', "$w: no names");
            }
            foreach ($p['names'] ?? [] as $n) {
                if (trim($n['name'] ?? '') === '') {
                    $this->bad('place-names', "$w: empty name");
                }
                if (!in_array($n['lang'] ?? '', $codes, true)) {
                    $this->bad('place-language', "$w: name language \"" . ($n['lang'] ?? '') . '" is not in the dictionary');
                }
            }
            if (($p['type'] ?? '') === 'mountain') {
                if (($p['date_from'] ?? null) !== null || ($p['date_to'] ?? null) !== null) {
                    $this->bad('mountain-dates', "$w: a mountain has no dates");
                }
                $h = $p['height_m'] ?? null;
                if ($h !== null && (!is_int($h) || $h < 0 || $h > store::MAX_HEIGHT_M)) {
                    $this->bad('mountain-height', "$w: height must be a whole number 0.." . store::MAX_HEIGHT_M);
                }
            } else {
                if (($p['height_m'] ?? null) !== null) {
                    $this->bad('height-on-non-mountain', "$w: only a mountain has a height");
                }
                $this->date($p['date_from'] ?? null, "$w begin");
                $this->date($p['date_to'] ?? null, "$w end");
                if (is_array($p['date_from'] ?? null) && is_array($p['date_to'] ?? null) && is_string($p['date_from']['ts'] ?? null) && is_string($p['date_to']['ts'] ?? null)) {
                    try {
                        dates::order_check($p['date_from'], $p['date_to']);
                    } catch (\Throwable $e) {
                        $this->bad('date-order', "$w: begin is after end");
                    }
                }
            }
        }
        return $ids;
    }

    /** the header of a Markdown note file as [meta, body] or null */
    private function noteFile($file)
    {
        $parts = explode("---\n", (string) file_get_contents($file), 3);
        if (count($parts) < 3 || $parts[0] !== '') {
            return null;
        }
        $meta = [];
        foreach (explode("\n", trim($parts[1])) as $line) {
            if (strpos($line, ': ') !== false) {
                [$k, $v] = explode(': ', $line, 2);
                $meta[$k] = $v;
            }
        }
        return [$meta, trim($parts[2])];
    }

    /** @return array note id => [place id, [layer ids]] */
    private function notes($placeIds, $codes)
    {
        $out = [];
        $root = "$this->dir/notes";
        if (!is_dir($root)) {
            return $out;
        }
        foreach (scandir($root) as $pid) {
            if ($pid[0] === '.' || !is_dir("$root/$pid")) {
                continue;
            }
            if (!isset($placeIds[$pid])) {
                $this->bad('note-orphan', "notes/$pid: folder of a place that does not exist");
            }
            foreach (scandir("$root/$pid") as $fn) {
                if (substr($fn, -3) !== '.md') {
                    continue;
                }
                $w = "notes/$pid/$fn";
                $r = $this->noteFile("$root/$pid/$fn");
                if (!$r) {
                    $this->bad('note-header', "$w: no valid header");
                    continue;
                }
                [$m, $body] = $r;
                $id = substr($fn, 0, -3);
                if (!$this->uuid($id) || ($m['id'] ?? $id) !== $id) {
                    $this->bad('note-id', "$w: header id differs from the file name");
                }
                if (!in_array($m['lang'] ?? '', $codes, true)) {
                    $this->bad('note-language', "$w: language \"" . ($m['lang'] ?? '') . '" is not in the dictionary');
                }
                if (trim($m['title'] ?? '') === '' || $body === '') {
                    $this->bad('note-empty', "$w: title or text is empty");
                }
                if (isset($m['date'])) {
                    $this->date(json_decode($m['date'], true), "$w date");
                }
                $tags = array_values(array_filter(array_map('trim', explode(',', $m['layers'] ?? ''))));
                foreach ($tags as $t) {
                    if (!$this->uuid($t)) {
                        $this->bad('note-layer-id', "$w: layers: has a bad id");
                    }
                }
                $out[$id] = [$pid, $tags];
            }
        }
        return $out;
    }

    private function names($list, $codes, $w, $what)
    {
        if (!is_array($list) || !$list) {
            $this->bad("$what-names", "$w: no names");
            return;
        }
        foreach ($list as $n) {
            if (trim($n['name'] ?? '') === '') {
                $this->bad("$what-names", "$w: empty name");
            }
            if (!in_array($n['lang'] ?? '', $codes, true)) {
                $this->bad("$what-language", "$w: language \"" . ($n['lang'] ?? '') . '" is not in the dictionary');
            }
        }
    }

    private function categories($d, $codes)
    {
        $ids = [];
        foreach ($d['categories'] ?? [] as $i => $c) {
            $w = "category #$i";
            if (!$this->uuid($c['id'] ?? null)) {
                $this->bad('category-id', "$w: id is not a UUID");
                continue;
            }
            if (isset($ids[$c['id']])) {
                $this->bad('category-id-duplicate', "$w: id used twice");
            }
            $ids[$c['id']] = true;
            $this->names($c['names'] ?? null, $codes, $w, 'category');
        }
        return $ids;
    }

    /** ids of the borders; shapes.geojson is optional (no file, no borders) */
    /** sources.json (T-046): ids are UUIDs and unique, every source has a title, a link starts with http(s). Returns the ids. */
    private function sources($d)
    {
        $ids = [];
        foreach ($d['sources'] ?? [] as $i => $s) {
            $w = "source #$i";
            if (!$this->uuid($s['id'] ?? null)) {
                $this->bad('source-id', "$w: id is not a UUID");
                continue;
            }
            if (isset($ids[$s['id']])) {
                $this->bad('source-id-duplicate', "$w: id used twice");
            }
            $ids[$s['id']] = true;
            if (!is_string($s['title'] ?? null) || trim($s['title']) === '') {
                $this->bad('source-title', "$w: a source needs a title");
            }
            if (isset($s['url']) && !preg_match('~^https?://[^\s<>"\']{1,490}$~i', (string) $s['url'])) {
                $this->bad('source-url', "$w: the link must start with http:// or https://");
            }
        }
        return $ids;
    }

    /** certainty, radius_m and sources of a place or a border (T-046): known values, sources that exist, a radius only on places. */
    private function evidence($p, $srcIds, $w, $kind, $radiusOk)
    {
        if (isset($p['certainty']) && !in_array($p['certainty'], store::CERTAINTY, true)) {
            $this->bad("$kind-certainty", "$w: certainty is not exact, approximate or disputed");
        }
        if (array_key_exists('radius_m', $p)) {
            $r = $p['radius_m'];
            if (!$radiusOk) {
                $this->bad("$kind-radius", "$w: only a place has a radius");
            } elseif (!is_int($r) || $r < 1 || $r > store::MAX_RADIUS_M) {
                $this->bad("$kind-radius", "$w: radius must be a whole number of metres from 1 to " . store::MAX_RADIUS_M);
            }
        }
        foreach ($p['sources'] ?? [] as $s) {
            if (!is_string($s) || !isset($srcIds[$s])) {
                $this->bad("$kind-source", "$w: a source does not exist in sources.json");
            }
        }
    }

    private function shapeEvidence($srcIds)
    {
        $fc = $this->json('shapes.geojson', true);
        foreach ($fc['features'] ?? [] as $i => $f) {
            $this->evidence($f['properties'] ?? [], $srcIds, "border #$i", 'shape', false);
        }
    }

    private function shapeIds()
    {
        $fc = $this->json('shapes.geojson', true);
        $ids = [];
        foreach ($fc['features'] ?? [] as $f) {
            $id = $f['properties']['id'] ?? null;
            if ($this->uuid($id)) {
                $ids[$id] = true;
            }
        }
        return $ids;
    }

    private function layers($d, $codes, $catIds, $placeIds, $shapeIds = [])
    {
        $ids = [];
        foreach ($d['layers'] ?? [] as $i => $l) {
            $id = $l['id'] ?? null;
            $w = "layer #$i" . ($id ? " $id" : '');
            if (!$this->uuid($id)) {
                $this->bad('layer-id', "$w: id is not a UUID");
                continue;
            }
            if (isset($ids[$id])) {
                $this->bad('layer-id-duplicate', "$w: id used twice");
            }
            $ids[$id] = true;
            $this->names($l['names'] ?? null, $codes, $w, 'layer');
            $dl = [];
            foreach ($l['descriptions'] ?? [] as $x) {
                if (!in_array($x['lang'] ?? '', $codes, true)) {
                    $this->bad('layer-language', "$w: description language \"" . ($x['lang'] ?? '') . '" is not in the dictionary');
                }
                if (isset($dl[$x['lang'] ?? ''])) {
                    $this->bad('layer-description-duplicate', "$w: two descriptions in one language");
                }
                $dl[$x['lang'] ?? ''] = true;
            }
            if (($l['category'] ?? null) !== null && !isset($catIds[$l['category']])) {
                $this->bad('layer-category', "$w: category does not exist");
            }
            if (($l['color'] ?? null) !== null && !preg_match('/^#[0-9a-f]{6}$/', (string) $l['color'])) {
                $this->bad('layer-color', "$w: colour must be #rrggbb in lower case");
            }
            $this->date($l['date_from'] ?? null, "$w from");
            $this->date($l['date_to'] ?? null, "$w to");
            $seen = [];
            foreach ($l['members'] ?? [] as $m) {
                if (isset($m['shape'])) {
                    $k = 'shape ' . $m['shape'];
                    if (!isset($shapeIds[$m['shape']])) {
                        $this->bad('layer-member-missing', "$w: member {$m['shape']} is not a border");
                    }
                } else {
                    $k = $m['place'] ?? null;
                    if (!isset($placeIds[$k])) {
                        $this->bad('layer-member-missing', "$w: member $k is not a place");
                    }
                }
                if (isset($seen[$k])) {
                    $this->bad('layer-member-duplicate', "$w: member $k twice");
                }
                $seen[$k] = true;
            }
            foreach (['created', 'updated'] as $k) {
                if (!preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', (string) ($l[$k] ?? ''))) {
                    $this->bad('layer-stamp', "$w: $k is not a UTC time stamp");
                }
            }
        }
        return $ids;
    }

    private function tags($notes, $layerIds, $layers)
    {
        $members = [];
        foreach ($layers['layers'] ?? [] as $l) {
            foreach ($l['members'] ?? [] as $m) {
                $members[$l['id'] ?? ''][$m['place'] ?? ''] = true;
            }
        }
        foreach ($notes as $nid => [$pid, $tags]) {
            foreach ($tags as $t) {
                if (!isset($layerIds[$t])) {
                    $this->bad('note-tag-layer', "note $nid: tied to a layer that does not exist");
                } elseif (!isset($members[$t][$pid])) {
                    $this->bad('note-tag-member', "note $nid: tied to layer $t but its place is not a member");
                }
            }
        }
    }

    private function layerNotes($layerIds, $codes, $shapeIds = [])
    {
        $root = "$this->dir/layer-notes";
        if (!is_dir($root)) {
            return;
        }
        foreach (scandir($root) as $lid) {
            if ($lid[0] === '.' || !is_dir("$root/$lid")) {
                continue;
            }
            if (!isset($layerIds[$lid]) && !isset($shapeIds[$lid])) {
                $this->bad('layer-note-orphan', "layer-notes/$lid: folder of a layer or border that does not exist");
            }
            foreach (scandir("$root/$lid") as $fn) {
                if (substr($fn, -3) !== '.md') {
                    continue;
                }
                $r = $this->noteFile("$root/$lid/$fn");
                $w = "layer-notes/$lid/$fn";
                if (!$r) {
                    $this->bad('note-header', "$w: no valid header");
                    continue;
                }
                if (($r[0]['id'] ?? '') !== substr($fn, 0, -3)) {
                    $this->bad('note-id', "$w: header id differs from the file name");
                }
                if (!in_array($r[0]['lang'] ?? '', $codes, true)) {
                    $this->bad('note-language', "$w: language is not in the dictionary");
                }
                if (isset($r[0]['date'])) {
                    $this->date(json_decode($r[0]['date'], true), "$w date");
                }
            }
        }
    }

    private function overlays($d)
    {
        foreach ($d['overlays'] ?? [] as $i => $o) {
            $w = "overlay #$i";
            if (!$this->uuid($o['id'] ?? null)) {
                $this->bad('overlay-id', "$w: id is not a UUID");
            }
            if (($o['file'] ?? '') !== '' && !is_file("$this->dir/overlays/" . $o['file'])) {
                $this->bad('overlay-file', "$w: image file {$o['file']} is missing");
            }
            if (count($o['coordinates'] ?? []) !== 4) {
                $this->bad('overlay-corners', "$w: needs four corners");
            }
        }
    }

    /** the generated indexes must equal what a rebuild from the files gives (checked on a copy; nothing is written here) */
    private function indexes()
    {
        $tmp = sys_get_temp_dir() . '/ahm_idx_' . getmypid() . '_' . mt_rand();
        mkdir($tmp, 0775, true);
        exec('cp -r ' . escapeshellarg($this->dir) . '/. ' . escapeshellarg($tmp));
        try {
            $s = new store($tmp . '/');
            $s->rebuild_index();   // rewrites notes/index.json and layer-notes/index.json
            foreach (['notes/index.json', 'layer-notes/index.json'] as $file) {
                $have = is_file("$this->dir/$file") ? json_decode(file_get_contents("$this->dir/$file"), true) : null;
                $want = is_file("$tmp/$file") ? json_decode(file_get_contents("$tmp/$file"), true) : null;
                if ($have === null && $want === null) {
                    continue;
                }
                if ($have === null) {
                    $this->bad('index-missing', "$file is missing");
                    continue;
                }
                $norm = function ($x) {
                    $n = $x['notes'] ?? [];
                    usort($n, function ($a, $b) {
                        return strcmp($a['id'], $b['id']);
                    });
                    return $n;
                };
                if ($norm($have) != $norm($want)) {
                    $this->bad('index-drift', "$file differs from what the note files give; rebuild it");
                }
            }
        } finally {
            exec('rm -rf ' . escapeshellarg($tmp));
        }
    }
}
