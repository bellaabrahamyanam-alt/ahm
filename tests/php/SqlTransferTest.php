<?php
namespace ahm\map\tests;

use ahm\map\service\sql_transfer;

require_once dirname(__DIR__, 2) . '/service/sql_transfer.php';

/** A database to try on: SQLite in memory, or MySQL when AHM_TEST_MYSQL_DSN (and _USER, _PASS) are set. */
function sql_db($mysql = false)
{
    if ($mysql) {
        $db = new \PDO(getenv('AHM_TEST_MYSQL_DSN'), (string) getenv('AHM_TEST_MYSQL_USER'), (string) getenv('AHM_TEST_MYSQL_PASS'));
        $t = new sql_transfer($db, 'tst_');
        $t->drop_schema();
    } else {
        need_pdo('sqlite');
        $t = new sql_transfer(new \PDO('sqlite::memory:'));
    }
    $t->create_schema();
    return $t;
}

function canon($v)
{
    if (!is_array($v)) {
        return $v;
    }
    if ($v === [] || array_keys($v) === range(0, count($v) - 1)) {
        return array_map(__NAMESPACE__ . '\canon', $v);
    }
    ksort($v);
    return array_map(__NAMESPACE__ . '\canon', $v);
}

/** The files of a store that the tables hold must come back as the same data (JSON compared as data, floats as floats). */
function files_equal($a, $b)
{
    foreach (['languages', 'categories', 'types', 'overlays', 'sources', 'layers'] as $f) {
        same(json_encode(canon(json_file("$a/$f.json"))), json_encode(canon(json_file("$b/$f.json"))), "$f.json");
    }
    foreach (['places', 'shapes'] as $f) {
        same(json_encode(canon(json_file("$a/$f.geojson")), JSON_PRESERVE_ZERO_FRACTION), json_encode(canon(json_file("$b/$f.geojson")), JSON_PRESERVE_ZERO_FRACTION), "$f.geojson");
    }
}

function round_trip($mysql)
{
    $s = fresh_store($dir);
    $t = sql_db($mysql);
    $n = $t->import($dir, 'sample');
    same(count(json_file("$dir/places.geojson")['features']), $n['places']);
    same(count(json_file("$dir/shapes.geojson")['features']), $n['shapes']);
    same(count(json_file("$dir/layers.json")['layers']), $n['layers']);
    $out = sandbox(false);
    $t->export($out);
    files_equal($dir, $out);
    return [$t, $dir, $n];
}

test('sql: the sample store goes into the tables and comes back as the same data', function () {
    list($t, $dir, $n) = round_trip(false);
    ok($n['places'] >= 10 && $n['lists'] > 20, json_encode($n));
});

test('sql: the order of places, shapes and layers is the order of the files', function () {
    list($t, $dir) = round_trip(false);
    $ids = [];
    foreach ($t->objects('place') as $o) {
        $ids[] = $o['id'];
    }
    same(place_ids($dir), $ids);
});

test('sql: a place with two names of one language keeps both, in the order of the file', function () {
    list($t) = round_trip(false);
    $found = 0;
    foreach ($t->objects('place') as $o) {
        $langs = array_count_values(array_column($o['data']['names'], 'lang'));
        if (max($langs) > 1) {
            $found++;
        }
    }
    ok($found >= 2, 'the sample has places with two names in a language');
});

test('sql: every thing loaded gets one `import` revision and the load is written down in ahm_imports', function () {
    $s = fresh_store($dir);
    $t = sql_db(false);
    $n = $t->import($dir, 'sample.zip', 7);
    $db = (new \ReflectionProperty($t, 'db'));
    $db->setAccessible(true);
    $pdo = $db->getValue($t);
    $things = $n['lists'] + $n['places'] + $n['shapes'] + $n['layers'];
    same($things, (int) $pdo->query("SELECT COUNT(*) FROM ahm_revisions WHERE action = 'import' AND rev_no = 1")->fetchColumn());
    $row = $pdo->query('SELECT file_name, user_id, places, shapes FROM ahm_imports')->fetch(\PDO::FETCH_NUM);
    same(['sample.zip', 7, $n['places'], $n['shapes']], [$row[0], (int) $row[1], (int) $row[2], (int) $row[3]]);
    $snap = $pdo->query("SELECT snapshot FROM ahm_revisions WHERE entity_kind = 'place' LIMIT 1")->fetchColumn();
    ok(is_array(json_decode(gzdecode($snap), true)), 'a snapshot is gzip JSON');
});

test('sql: a field that the tables do not know stops the whole load and nothing stays in the tables', function () {
    $s = fresh_store($dir);
    $f = json_file("$dir/languages.json");
    $f['wikidata'] = 'Q1';
    file_put_contents("$dir/languages.json", json_encode($f));
    $t = sql_db(false);
    throws('/languages.json has fields/', function () use ($t, $dir) {
        $t->import($dir);
    });
    same([], $t->objects('place'));
    same([], $t->lists());
});

/** SQLite reads a decimal text into a double with an error of one unit in the last place now and then (0.7 nm on a coordinate); MySQL reads it exactly. */
function near($v)
{
    if (is_array($v)) {
        return array_map(__NAMESPACE__ . '\near', $v);
    }
    return is_float($v) ? round($v, 12) : $v;
}

function precision_case($mysql)
{
    $s = fresh_store($dir);
    mt_srand(11);
    $features = [];
    for ($i = 0; $i < 3000; $i++) {
        $id = sprintf('%08x-%04x-4%03x-a%03x-%012x', mt_rand(), mt_rand(0, 65535), mt_rand(0, 4095), mt_rand(0, 4095), mt_rand());
        $features[] = ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [38 + mt_rand() / mt_getrandmax() * 10, 36 + mt_rand() / mt_getrandmax() * 6]],
            'properties' => ['id' => $id, 'label' => "P$i", 'type' => 'city', 'date_from' => null, 'date_to' => null, 'height_m' => $i % 7 ? null : $i, 'names' => [['lang' => 'en', 'name' => "P$i"], ['lang' => 'hy', 'name' => 'Գառնի ' . $i], ['lang' => 'hy', 'name' => 'Արին ' . $i]]]];
    }
    $p = json_file("$dir/places.geojson");
    $p['features'] = $features;
    file_put_contents("$dir/places.geojson", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
    $t = sql_db($mysql);
    $t->import($dir);
    $out = sandbox(false);
    $t->export($out);
    if ($mysql) {
        files_equal($dir, $out);
    } else {
        $a = json_file("$dir/places.geojson")['features'];
        $b = json_file("$out/places.geojson")['features'];
        same(count($a), count($b));
        foreach ($a as $i => $f) {
            same(json_encode(canon(near($f)), JSON_PRESERVE_ZERO_FRACTION), json_encode(canon(near($b[$i])), JSON_PRESERVE_ZERO_FRACTION), "place $i");
        }
    }
    if ($mysql) {
        $t->drop_schema();
    }
}

test('sql: 3000 places with coordinates of full precision come back (SQLite: to 1e-12 degree)', function () {
    precision_case(false);
});

function notes_case($mysql)
{
    $s = fresh_store($dir);
    $before = count(sql_transfer::read_notes($dir));
    $layer = json_file("$dir/layers.json")['layers'][0];
    $pid = $layer['members'][0]['place'];
    $sid = json_file("$dir/shapes.geojson")['features'][0]['properties']['id'];
    $date = ['fmt' => 'y', 'ts' => '-000799-01-01T00:00:00Z', 'mode' => 'approx', 'ts_to' => null];
    $s->save(['place_id' => $pid, 'note' => ['lang' => 'hy', 'title' => 'Ավերում 😀', 'text' => "Line one  \n\nLine ՝ two ✓\n- list", 'layers' => [$layer['id']], 'date' => $date]]);
    $s->save_layer_note(['layer_id' => $layer['id'], 'note' => ['lang' => 'en', 'title' => 'About the layer', 'text' => 'Text']]);
    $s->save_layer_note(['layer_id' => $sid, 'note' => ['lang' => 'en', 'title' => 'About the border', 'text' => 'Text']]);
    $notes = sql_transfer::read_notes($dir);
    same($before + 3, count($notes), 'the sample notes and the three new ones');
    $t = sql_db($mysql);
    $posts = [];   // what phpBB would keep: post id => owner, title, text
    foreach ($notes as $i => $n) {
        $post = 1001 + $i;
        $posts[$post] = [$n['kind'], $n['owner'], $n['title'], $n['text']];
        $t->add_note_meta($post, sql_transfer::note_meta($n));
    }
    $back = [];
    foreach ($t->note_metas() as $post => $meta) {
        $back[] = sql_transfer::note_from($posts[$post][0], $posts[$post][1], $posts[$post][2], $posts[$post][3], $meta);
    }
    $out = sandbox(false);
    sql_transfer::write_notes($out, $back);
    $count = 0;
    foreach (['notes', 'layer-notes'] as $sub) {
        foreach (glob("$dir/$sub/*/*.md") as $f) {
            $g = "$out/$sub/" . basename(dirname($f)) . '/' . basename($f);
            ok(is_file($g), "missing $g");
            same(file_get_contents($f), file_get_contents($g), $f);
            $count++;
        }
    }
    same(count($notes), $count);
    if ($mysql) {
        $t->drop_schema();
    }
}

test('sql: notes go to posts and ahm_note_meta and come back as the same files, byte for byte', function () {
    notes_case(false);
});

if (getenv('AHM_TEST_MYSQL_DSN')) {
    test('sql: the same round trip on MySQL (AHM_TEST_MYSQL_DSN)', function () {
        list($t, $dir, $n) = round_trip(true);
        ok($n['places'] >= 10);
        $t->drop_schema();
    });
    test('sql: 3000 places with coordinates of full precision come back exactly on MySQL', function () {
        precision_case(true);
    });
    test('sql: the notes round trip on MySQL', function () {
        notes_case(true);
    });
}
