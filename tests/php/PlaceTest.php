<?php
namespace ahm\map\tests;

use ahm\map\service\dates;
use ahm\map\service\store;

const BASE = ['lat' => 40.1, 'lon' => 44.5, 'type' => 'village', 'names' => [['lang' => 'en', 'name' => 'Testville']]];
const NIL = '11111111-1111-4111-8111-111111111111';

function place($dir, $id)
{
    foreach (json_file("$dir/places.geojson")['features'] as $f) {
        if ($f['properties']['id'] === $id) {
            return $f;
        }
    }
    return null;
}

function day($y, $m, $d, $fmt = 'ymd', $mode = 'exact')
{
    return dates::clean(['fmt' => $fmt, 'ts' => dates::sec_to_iso(dates::days_from_civil($y, $m, $d) * 86400), 'mode' => $mode, 'ts_to' => null]);
}

test('new place: id is generated, label is the English name, dates default to unknown', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'hy', 'name' => 'Թեստ'], ['lang' => 'en', 'name' => 'Testville']]])]);
    ok(preg_match(store::UUID, $id));
    $p = place($dir, $id);
    same('Testville', $p['properties']['label']);
    same(null, $p['properties']['date_from']);
    same(null, $p['properties']['date_to']);
    same(null, $p['properties']['height_m']);
    same([44.5, 40.1], $p['geometry']['coordinates'], 'GeoJSON order is lon, lat');
});

test('new place: with no English name the first name is the label', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'hy', 'name' => 'Թեստ']]])]);
    same('Թեստ', place($dir, $id)['properties']['label']);
});

test('place: names are trimmed, blank names dropped, at least one name is required', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'en', 'name' => "  Two\n  words "], ['lang' => 'en', 'name' => '   ']]])]);
    same([['lang' => 'en', 'name' => 'Two words']], place($dir, $id)['properties']['names']);
    throws('/at least one name/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'en', 'name' => ' ']]])]);
    });
});

test('place: several names in one language are allowed', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'en', 'name' => 'Ararat'], ['lang' => 'en', 'name' => 'Masis']]])]);
    same(2, count(place($dir, $id)['properties']['names']));
});

test('place: coordinates and type are validated', function () {
    $s = fresh_store($dir);
    foreach ([['lat' => 91], ['lat' => -91], ['lon' => 181], ['lon' => -181]] as $bad) {
        throws('/bad coordinates/', function () use ($s, $bad) {
            $s->save(['place' => array_merge(BASE, $bad)]);
        });
    }
    throws('/bad coordinates/', function () use ($s) {
        $s->save(['place' => ['type' => 'village', 'names' => BASE['names']]]);
    }, 'missing coordinates');
    throws('/bad type/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['type' => 'spaceport'])]);
    });
});

test('place: every type in the list is accepted', function () {
    $s = fresh_store($dir);
    foreach (store::TYPES as $t) {
        ok(preg_match(store::UUID, $s->save(['place' => array_merge(BASE, ['type' => $t])])), $t);
    }
});

test('place: a language outside the dictionary is refused and nothing is written', function () {
    $s = fresh_store($dir);
    $before = count(place_ids($dir));
    throws('/not in the list/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'zz', 'name' => 'X']]])]);
    });
    same($before, count(place_ids($dir)));
});

test('place: dates are optional, validated, and kept as ISO text', function () {
    $s = fresh_store($dir);
    $from = day(1500, 3, 21, 'dmy');
    $id = $s->save(['place' => array_merge(BASE, ['date_from' => $from])]);
    same('1500-03-21T00:00:00Z', place($dir, $id)['properties']['date_from']['ts']);
    same('dmy', place($dir, $id)['properties']['date_from']['fmt']);
    throws('/time stamp does not match/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['date_from' => ['fmt' => 'y', 'ts' => '1500-05-05T00:00:00Z', 'mode' => 'exact', 'ts_to' => null]])]);
    });
    throws('/after the "to" date/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['date_from' => day(1600, 1, 1), 'date_to' => day(1500, 1, 1)])]);
    });
});

test('mountain: height is optional, a whole number 0..9000; dates are ignored', function () {
    $s = fresh_store($dir);
    $m = array_merge(BASE, ['type' => 'mountain']);
    $id = $s->save(['place' => array_merge($m, ['height_m' => 5137, 'date_from' => day(1500, 1, 1)])]);
    same(5137, place($dir, $id)['properties']['height_m']);
    same(null, place($dir, $id)['properties']['date_from'], 'a mountain never has dates');
    same(null, place($dir, $s->save(['place' => $m]))['properties']['height_m']);
    same(null, place($dir, $s->save(['place' => array_merge($m, ['height_m' => ''])]))['properties']['height_m']);
    same(0, place($dir, $s->save(['place' => array_merge($m, ['height_m' => 0])]))['properties']['height_m']);
    same(9000, place($dir, $s->save(['place' => array_merge($m, ['height_m' => '9000'])]))['properties']['height_m']);
    foreach ([9001, -1, 12.5, 'abc', true] as $bad) {
        throws('/height must be a whole number/', function () use ($s, $m, $bad) {
            $s->save(['place' => array_merge($m, ['height_m' => $bad])]);
        }, json_encode($bad));
    }
});

test('other types never keep a height', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => array_merge(BASE, ['height_m' => 100])]);
    same(null, place($dir, $id)['properties']['height_m']);
});

test('place_update: changes fields, keeps the id, archives the old file', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => BASE]);
    $s->save(['place_update' => array_merge(BASE, ['id' => $id, 'lat' => 41, 'lon' => 45, 'type' => 'town', 'names' => [['lang' => 'en', 'name' => 'Renamed']]])]);
    $p = place($dir, $id);
    same('Renamed', $p['properties']['label']);
    same('town', $p['properties']['type']);
    ok($p['geometry']['coordinates'] == [45, 41], 'moved');
    files_only(function () use ($dir) {
        ok(count(glob("$dir/archive/places-*.geojson")) >= 1, 'old places.geojson archived');
    });
});

test('place_update: unknown id is refused', function () {
    $s = fresh_store($dir);
    throws('/unknown place/', function () use ($s) {
        $s->save(['place_update' => array_merge(BASE, ['id' => NIL])]);
    });
});

test('place_update: a failed validation leaves the file untouched', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => BASE]);
    $before = file_get_contents("$dir/places.geojson");
    throws('/bad type/', function () use ($s, $id) {
        $s->save(['place_update' => array_merge(BASE, ['id' => $id, 'type' => 'nope'])]);
    });
    same($before, file_get_contents("$dir/places.geojson"));
});

test('every write archives the old file under a name that is never reused', function () {
    skip_unless_files();
    $s = fresh_store($dir);
    for ($i = 0; $i < 3; $i++) {
        $s->save(['place' => BASE]);
    }
    $files = glob("$dir/archive/places-*.geojson");
    ok(count($files) >= 3, 'three saves, three copies (even within one second): ' . count($files));
});

test('save: needs one of place / place_update / place_id', function () {
    $s = fresh_store($dir);
    throws('/unknown place/', function () use ($s) {
        $s->save([]);
    });
    throws('/unknown place/', function () use ($s) {
        $s->save(['place_id' => NIL, 'note' => ['lang' => 'en', 'title' => 't', 'text' => 'x']]);
    });
});

test('sample data: ids are unique UUIDs and every place has a valid type and a name', function () {
    $dir = sandbox();
    $ids = place_ids($dir);
    same(count($ids), count(array_unique($ids)));
    foreach (json_file("$dir/places.geojson")['features'] as $f) {
        ok(preg_match(store::UUID, $f['properties']['id']));
        ok(in_array($f['properties']['type'], store::TYPES, true), $f['properties']['type']);
        ok(count($f['properties']['names']) >= 1);
    }
});
