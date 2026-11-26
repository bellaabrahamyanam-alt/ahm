<?php
namespace ahm\map\service;

/** The data in files: places.geojson, shapes.geojson, layers.json, ..., notes/<place>/<id>.md, layer-notes/<owner>/<id>.md, archive/. */
class file_repository implements repository
{
    const PRETTY = JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;
    const PRETTY_SLASHES = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT;
    const UUID = '/^[0-9a-f-]{36}$/';
    /** document => [file, json flags, name of the copies in archive/, extension of the copies] */
    const DOCS = [
        'places' => ['places.geojson', self::PRETTY, 'places', 'geojson'],
        'shapes' => ['shapes.geojson', null, 'shapes', 'geojson'],
        'layers' => ['layers.json', self::PRETTY_SLASHES, 'layers', 'json'],
        'categories' => ['categories.json', self::PRETTY_SLASHES, 'categories', 'json'],
        'sources' => ['sources.json', self::PRETTY_SLASHES, 'sources', 'json'],
        'languages' => ['languages.json', self::PRETTY, 'languages', 'json'],
        'types' => ['types.json', self::PRETTY, 'types', 'json'],
        'overlays' => ['overlays.json', self::PRETTY_SLASHES, null, null],
    ];

    private $base;

    public function __construct($dir)
    {
        $this->base = rtrim($dir, '/') . '/';
    }

    public function base()
    {
        return $this->base;
    }

    private static function write_atomic($path, $s)
    {
        $t = $path . '.tmp';
        file_put_contents($t, $s);
        rename($t, $path);
    }

    /** Unique file name in archive/ (a second change in the same second must not overwrite the first copy). */
    public function archive_path($stem, $ext)
    {
        @mkdir($this->base . 'archive/', 0775, true);
        $p = $this->base . 'archive/' . $stem . '-' . date('Ymd-His');
        $c = $p . '.' . $ext;
        for ($i = 1; file_exists($c); $i++) {
            $c = $p . '-' . $i . '.' . $ext;
        }
        return $c;
    }

    // ---- documents

    public function doc($name)
    {
        $f = $this->base . self::DOCS[$name][0];
        if (!is_file($f)) {
            return null;
        }
        $d = json_decode((string) file_get_contents($f), true);
        return is_array($d) ? $d : false;
    }

    public function put_doc($name, array $d)
    {
        list($file, $flags, $stem, $ext) = self::DOCS[$name];
        $f = $this->base . $file;
        @mkdir($this->base, 0775, true);
        if ($stem !== null && is_file($f)) {
            copy($f, $this->archive_path($stem, $ext));
        }
        if ($name === 'shapes') {
            // one feature per line: a change shows in git as a change of one line, not of thousands of numbers
            $lines = [];
            foreach ($d['features'] as $ft) {
                $lines[] = json_encode($ft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            self::write_atomic($f, '{"type":"FeatureCollection","features":[' . "\n" . implode(",\n", $lines) . "\n]}\n");
            return;
        }
        self::write_atomic($f, json_encode($d, $flags));
    }

    // ---- notes

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

    private static function note_date(array $meta)
    {
        if (isset($meta['date'])) {
            $d = json_decode($meta['date'], true);
            return is_array($d) ? dates::upgrade($d) : null;
        }
        return isset($meta['year']) ? dates::from_legacy($meta['year'], $meta['when'] ?? '', false) : null;
    }

    public static function note_file(array $n)
    {
        return "---\nid: {$n['id']}\nlang: {$n['lang']}\ntitle: {$n['title']}\n" .
            ($n['layers'] ? 'layers: ' . implode(',', $n['layers']) . "\n" : '') .
            ($n['date'] !== null ? 'date: ' . json_encode($n['date']) . "\n" : '') .
            "---\n{$n['text']}\n";
    }

    private function dir($kind, $owner)
    {
        return $this->base . ($kind === 'place' ? 'notes/' : 'layer-notes/') . $owner;
    }

    private function read_note($kind, $owner, $fn)
    {
        $parts = substr($fn, -3) === '.md' ? explode("---\n", (string) @file_get_contents($this->dir($kind, $owner) . '/' . $fn), 3) : [];
        if (count($parts) < 3) {
            return null;
        }
        $meta = self::meta($parts[1]);
        $stem = substr($fn, 0, -3);
        return [
            'owner' => $owner, 'kind' => $kind,
            'id' => $meta['id'] ?? $stem,
            'lang' => $meta['lang'] ?? ($kind === 'place' ? $stem : ''),
            'title' => $meta['title'] ?? '',
            'date' => self::note_date($meta),
            'layers' => $kind === 'place' ? self::layer_ids($meta['layers'] ?? '') : [],
            'text' => trim($parts[2]),
        ];
    }

    public function notes($owner = null)
    {
        $out = [];
        foreach (['place' => 'notes/', 'layer' => 'layer-notes/'] as $kind => $sub) {
            $root = $this->base . $sub;
            if (!is_dir($root)) {
                continue;
            }
            foreach ($owner === null ? scandir($root) : [$owner] as $o) {
                if (!preg_match(self::UUID, $o) || !is_dir($root . $o)) {
                    continue;
                }
                foreach (scandir($root . $o) as $fn) {
                    if ($n = $this->read_note($kind, $o, $fn)) {
                        $out[] = $n;
                    }
                }
            }
        }
        return $out;
    }

    public function note($owner, $id)
    {
        foreach (['place', 'layer'] as $kind) {
            if (preg_match(self::UUID, $owner) && preg_match(self::UUID, $id) && is_file($this->dir($kind, $owner) . "/$id.md")) {
                return $this->read_note($kind, $owner, "$id.md");
            }
        }
        return null;
    }

    public function put_note(array $n, $reason = '')
    {
        $dir = $this->dir($n['kind'], $n['owner']);
        @mkdir($dir, 0775, true);
        $file = "$dir/{$n['id']}.md";
        if (is_file($file)) {
            $stem = ($n['kind'] === 'place' ? 'note-' : 'layer-note-') . "{$n['owner']}-{$n['id']}" . ($reason === 'untag' ? '-untag' : '');
            copy($file, $this->archive_path($stem, 'md'));
        }
        self::write_atomic($file, self::note_file($n));
        $this->rebuild_indexes();
    }

    public function remove_notes($owner)
    {
        $dir = $this->dir('layer', $owner);
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) as $fn) {
            if (substr($fn, -3) === '.md') {
                rename("$dir/$fn", $this->archive_path('layer-note-' . $owner . '-' . substr($fn, 0, -3), 'md'));
            }
        }
        @rmdir($dir);
        $this->rebuild_indexes();
    }

    /** notes/index.json and layer-notes/index.json: generated from the note files (the browser searches them). */
    public function rebuild_indexes()
    {
        $place = [];
        $layer = [];
        foreach ($this->notes() as $n) {
            if ($n['kind'] === 'place') {
                $place[] = ['id' => $n['id'], 'place' => $n['owner'], 'lang' => $n['lang'], 'title' => $n['title'], 'layers' => $n['layers'], 'date' => $n['date'], 'text' => $n['text']];
            } else {
                $layer[] = ['id' => $n['id'], 'layer' => $n['owner'], 'lang' => $n['lang'], 'title' => $n['title'], 'date' => $n['date'], 'text' => $n['text']];
            }
        }
        @mkdir($this->base . 'notes/', 0775, true);
        @mkdir($this->base . 'layer-notes/', 0775, true);
        self::write_atomic($this->base . 'notes/index.json', json_encode(['version' => 1, 'notes' => $place], self::PRETTY));
        self::write_atomic($this->base . 'layer-notes/index.json', json_encode(['version' => 1, 'notes' => $layer], self::PRETTY));
    }

    // ---- locking

    public function transaction(callable $fn)
    {
        @mkdir($this->base, 0775, true);
        $lock = fopen($this->base . '.lock', 'c');
        flock($lock, LOCK_EX);
        try {
            return $fn();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
