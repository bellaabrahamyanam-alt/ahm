<?php
namespace ahm\map\tests;

use ahm\map\service\store;

function iron($extra = [])
{
    return array_merge(['geometry' => 'point', 'names' => [['lang' => 'en', 'name' => 'Iron mine']], 'color' => '#A0522D', 'style' => ['symbol' => 'pickaxe', 'size' => 9]], $extra);
}

test('types: the sample dictionary has every type the sample places use (point types), and the 6 area and 5 line types of the shapes', function () {
    $s = fresh_store($dir);
    $list = $s->types()['types'];
    $points = array_column(array_filter($list, function ($t) {
        return $t['geometry'] === 'point';
    }), 'code');
    foreach (json_file("$dir/places.geojson")['features'] as $f) {
        ok(in_array($f['properties']['type'], $points, true), 'type ' . $f['properties']['type']);
    }
    foreach ($list as $t) {
        ok(in_array($t['geometry'], ['point', 'line', 'area'], true), $t['code'] . ' geometry');
        ok(preg_match(store::COLOR, $t['color']), $t['code'] . ' colour');
    }
    same(6, count(array_filter($list, function ($t) {
        return $t['geometry'] === 'area';
    })));
    same(5, count(array_filter($list, function ($t) {
        return $t['geometry'] === 'line';
    })));
    foreach (json_file("$dir/shapes.geojson")['features'] as $f) {
        ok(in_array($f['properties']['type'], array_column($list, 'code'), true), 'shape type ' . $f['properties']['type']);
    }
});

test('types: a dictionary file without line and area types still offers the 11 built-in ones, and keeps them when an administrator saves a type', function () {
    $s = fresh_store($dir);
    $f = json_file("$dir/types.json");
    $f['types'] = array_values(array_filter($f['types'], function ($t) {
        return $t['geometry'] === 'point';
    }));
    file_put_contents("$dir/types.json", json_encode($f));
    $codes = array_column($s->types()['types'], 'code');
    foreach (['country', 'kingdom', 'region', 'district', 'territory', 'disputed', 'trade', 'military', 'migration', 'journey', 'road'] as $c) {
        ok(in_array($c, $codes, true), "built-in $c");
    }
    $s->save_type(iron());
    $onDisk = array_column(json_file("$dir/types.json")['types'], 'code');
    ok(in_array('trade', $onDisk, true) && in_array('iron-mine', $onDisk, true), 'written together with the new type');
});

test('types: a missing file is created from the seed (every type that existed before)', function () {
    $dir = sandbox();
    unlink("$dir/types.json");
    $s = new store($dir);
    $all = $s->types()['types'];
    same(store::TYPES, array_column(array_filter($all, function ($t) {
        return $t['geometry'] === 'point';
    }), 'code'), 'the point types: same list, same order as the seed constant');
    same(11, count($all) - count(store::TYPES), 'and the 11 built-in line and area types after them');
    ok(is_file("$dir/types.json"));
    same('Inscription site', find_by($s->types()['types'], 'code', 'inscription_site')['names'][0]['name']);
});

test('save_type: adds a type, the code is made from the English name, the type can be used by a place', function () {
    $s = fresh_store($dir);
    throws('/bad type/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    }, 'unknown before it is added');
    same('iron-mine', $s->save_type(iron()));
    $t = find_by($s->types()['types'], 'code', 'iron-mine');
    same('point', $t['geometry']);
    same('#a0522d', $t['color'], 'colour is stored in lower case');
    same(['symbol' => 'pickaxe', 'size' => 9], $t['style']);
    $id = $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    same('iron-mine', place($dir, $id)['properties']['type']);
});

test('save_type: a second type with the same English name gets -2, accents and symbols are dropped', function () {
    $s = fresh_store($dir);
    same('cedar-forest', $s->save_type(iron(['names' => [['lang' => 'en', 'name' => 'Cedar  Forest!']]])));
    same('cedar-forest-2', $s->save_type(iron(['names' => [['lang' => 'en', 'name' => 'Cedar forest']]])));
    same('sword-artefact', $s->save_type(iron(['names' => [['lang' => 'ru', 'name' => 'Меч'], ['lang' => 'en', 'name' => 'Sword artefact']]])));
    $long = $s->save_type(iron(['names' => [['lang' => 'en', 'name' => str_repeat('abcdefghij ', 8)]]]));
    ok(preg_match(store::TYPE_CODE, $long) && strlen($long) <= 32, 'a long name still gives a valid code: ' . $long);
});

test('save_type: bad geometry, names, colour, symbol and size are refused and nothing is written', function () {
    $s = fresh_store($dir);
    $before = file_get_contents("$dir/types.json");
    throws('/geometry must be "point"/', function () use ($s) {
        $s->save_type(iron(['geometry' => 'area']));
    });
    throws('/at least one name/', function () use ($s) {
        $s->save_type(iron(['names' => [['lang' => 'en', 'name' => ' ']]]));
    });
    throws('/name in English/', function () use ($s) {
        $s->save_type(iron(['names' => [['lang' => 'ru', 'name' => 'Рудник']]]));
    });
    throws('/not in the list/', function () use ($s) {
        $s->save_type(iron(['names' => [['lang' => 'zz', 'name' => 'X'], ['lang' => 'en', 'name' => 'Y']]]));
    });
    throws('/must have letters or digits/', function () use ($s) {
        $s->save_type(iron(['names' => [['lang' => 'en', 'name' => '!!!']]]));
    });
    foreach (['red', '#12345', '#gggggg', '', null] as $c) {
        throws('/colour/', function () use ($s, $c) {
            $s->save_type(iron(['color' => $c]));
        }, json_encode($c));
    }
    foreach (['Tree', 'a b', '', str_repeat('a', 25), 'a/b'] as $sym) {
        throws('/symbol/', function () use ($s, $sym) {
            $s->save_type(iron(['style' => ['symbol' => $sym, 'size' => 8]]));
        }, $sym);
    }
    foreach ([3, 15, '8', 'big', [8]] as $size) {
        throws('/size/', function () use ($s, $size) {
            $s->save_type(iron(['style' => ['symbol' => 'circle', 'size' => $size]]));
        }, json_encode($size));
    }
    same($before, file_get_contents("$dir/types.json"), 'the file did not change');
});

test('save_type: an unknown symbol slug is allowed (the map draws a circle), style defaults to circle size 8', function () {
    $s = fresh_store($dir);
    $s->save_type(iron(['style' => ['symbol' => 'future-symbol', 'size' => 5.5]]));
    same(['symbol' => 'future-symbol', 'size' => 5.5], find_by($s->types()['types'], 'code', 'iron-mine')['style']);
    $s->save_type(iron(['names' => [['lang' => 'en', 'name' => 'Plain']], 'style' => []]));
    same(['symbol' => 'circle', 'size' => 8], find_by($s->types()['types'], 'code', 'plain')['style']);
});

test('save_type: edit changes names, colour and style but never the code or the geometry', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    $s->save_type(iron(['code' => 'iron-mine', 'edit' => true, 'names' => [['lang' => 'en', 'name' => 'Ore mine'], ['lang' => 'hy', 'name' => 'Հանք']], 'color' => '#112233', 'style' => ['symbol' => 'star', 'size' => 12]]));
    $t = find_by($s->types()['types'], 'code', 'iron-mine');
    same('Ore mine', $t['names'][0]['name']);
    same('#112233', $t['color']);
    same('star', $t['style']['symbol']);
    same(1, count(array_filter($s->types()['types'], function ($x) {
        return $x['code'] === 'iron-mine';
    })), 'edited in place, not added');
    throws('/unknown type/', function () use ($s) {
        $s->save_type(iron(['code' => 'nope', 'edit' => true]));
    });
    throws('/unknown type/', function () use ($s) {
        $s->save_type(iron(['edit' => true]));
    }, 'edit needs a code');
});

test('save_type: archives the old dictionary', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    ok(count(glob("$dir/archive/types-*.json")) >= 1);
});

test('delete_type: removes an unused type; a type that places use, "mountain" and an unknown code are refused', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    throws('/1 place use the type "iron-mine"/', function () use ($s) {
        $s->delete_type('iron-mine');
    });
    $s->save_type(iron(['names' => [['lang' => 'en', 'name' => 'Salt mine']]]));
    ok($s->delete_type('salt-mine'));
    ok(find_by($s->types()['types'], 'code', 'salt-mine') === null);
    throws('/mountain/', function () use ($s) {
        $s->delete_type('mountain');
    });
    throws('/unknown type/', function () use ($s) {
        $s->delete_type('salt-mine');
    });
    ok(count(glob("$dir/archive/types-*.json")) >= 1, 'the old dictionary is archived');
});

test('delete_type: the count in the message is the number of places', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    throws('/2 places use the type/', function () use ($s) {
        $s->delete_type('iron-mine');
    });
});

test('save_type: a custom symbol is an SVG path in a box; path and box are stored, only for symbol "custom"', function () {
    $s = fresh_store($dir);
    $s->save_type(iron(['style' => ['symbol' => 'custom', 'size' => 9, 'path' => " M256 10 L500 500 H10 z ", 'box' => 512]]));
    same(['symbol' => 'custom', 'size' => 9, 'path' => 'M256 10 L500 500 H10 z', 'box' => 512], find_by($s->types()['types'], 'code', 'iron-mine')['style']);
    $s->save_type(iron(['code' => 'iron-mine', 'edit' => true, 'style' => ['symbol' => 'custom', 'size' => 9, 'path' => 'M0 0 L5 5 Z']]));
    same(24, find_by($s->types()['types'], 'code', 'iron-mine')['style']['box'], 'box defaults to 24');
    $s->save_type(iron(['code' => 'iron-mine', 'edit' => true, 'style' => ['symbol' => 'star', 'size' => 9, 'path' => 'M0 0 L5 5 Z']]));
    same(['symbol' => 'star', 'size' => 9], find_by($s->types()['types'], 'code', 'iron-mine')['style'], 'a path is dropped when the symbol is not custom');
});

test('save_type: a custom symbol needs a clean path (only drawing commands and numbers, starting with M) and a box of 8 to 2048', function () {
    $s = fresh_store($dir);
    $before = file_get_contents("$dir/types.json");
    foreach ([null, '', 'M', 'L0 0 L5 5', 'M0 0 <script>', 'M0 0 url(x)', 'M0 0 ' . str_repeat('1 ', 11000), ['M0 0']] as $path) {
        throws('/SVG path/', function () use ($s, $path) {
            $s->save_type(iron(['style' => ['symbol' => 'custom', 'size' => 8, 'path' => $path]]));
        }, json_encode($path === null ? null : (is_string($path) ? substr($path, 0, 20) : $path)));
    }
    foreach ([2, 4000, '24', 'x'] as $box) {
        throws('/box/', function () use ($s, $box) {
            $s->save_type(iron(['style' => ['symbol' => 'custom', 'size' => 8, 'path' => 'M0 0 L5 5', 'box' => $box]]));
        }, json_encode($box));
    }
    same($before, file_get_contents("$dir/types.json"), 'nothing written');
});

test('types: a types.json that cannot be read is never replaced by the seed, and nothing is written', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    file_put_contents("$dir/types.json", '{"version":1,"types":[{"code":"iron-mi'); // cut in the middle
    $broken = file_get_contents("$dir/types.json");
    throws('/types.json cannot be read/', function () use ($s) {
        $s->types();
    });
    throws('/types.json cannot be read/', function () use ($s) {
        $s->save_type(iron(['names' => [['lang' => 'en', 'name' => 'Salt mine']]]));
    });
    throws('/types.json cannot be read/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['type' => 'city'])]);
    });
    same($broken, file_get_contents("$dir/types.json"), 'the damaged file is left as it is');
    file_put_contents("$dir/types.json", '{"version":1}');
    throws('/types.json cannot be read/', function () use ($s) {
        $s->types();
    }, 'valid JSON without types');
});

test('place_update: a place can change to a type an administrator added, and to nothing that is not in the dictionary', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    $id = $s->save(['place' => BASE]);
    $s->save(['place_update' => array_merge(BASE, ['id' => $id, 'type' => 'iron-mine'])]);
    same('iron-mine', place($dir, $id)['properties']['type']);
    $before = file_get_contents("$dir/places.geojson");
    throws('/bad type/', function () use ($s, $id) {
        $s->save(['place_update' => array_merge(BASE, ['id' => $id, 'type' => 'salt-mine'])]);
    });
    same($before, file_get_contents("$dir/places.geojson"), 'a refused edit changes nothing');
});

test('delete_type: after the last place changed its type, the type can be removed, and then no place can use it', function () {
    $s = fresh_store($dir);
    $s->save_type(iron());
    $id = $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    throws('/1 place use/', function () use ($s) {
        $s->delete_type('iron-mine');
    });
    $s->save(['place_update' => array_merge(BASE, ['id' => $id, 'type' => 'town'])]);
    ok($s->delete_type('iron-mine'));
    throws('/bad type/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['type' => 'iron-mine'])]);
    });
});

test('save_type: a place can use every type of the dictionary, the seed and the added ones', function () {
    $s = fresh_store($dir);
    $s->save_type(iron(['style' => ['symbol' => 'custom', 'size' => 9, 'path' => 'M0 0 L5 5 Z']]));
    foreach (array_column($s->types()['types'], 'code') as $code) {
        if ($code === 'mountain') {
            continue; // a mountain has a height instead of dates; covered in PlaceTest
        }
        $id = $s->save(['place' => array_merge(BASE, ['type' => $code])]);
        same($code, place($dir, $id)['properties']['type'], $code);
    }
});

test('types: the dictionary is read from the file on every call (a change made by another process is seen)', function () {
    $s = fresh_store($dir);
    $other = new store($dir);
    $other->save_type(iron());
    ok(find_by($s->types()['types'], 'code', 'iron-mine') !== null);
    $other->delete_type('iron-mine');
    ok(find_by($s->types()['types'], 'code', 'iron-mine') === null);
});

test('save_type: the names of a type may be in several languages (non-Latin text included)', function () {
    $s = fresh_store($dir);
    $s->save_type(iron(['names' => [['lang' => 'en', 'name' => 'Iron mine'], ['lang' => 'ru', 'name' => 'Рудник'], ['lang' => 'hy', 'name' => 'Երկաթի հանք']]]));
    same(3, count(find_by($s->types()['types'], 'code', 'iron-mine')['names']));
    $t = find_by($s->types()['types'], 'code', 'iron-mine');
    same('Երկաթի հանք', $t['names'][2]['name'], 'non-Latin text is kept as it is');
});

test('save_type: a line type and an area type keep their style; geometry and code never change', function () {
    $s = fresh_store($dir);
    $line = ['geometry' => 'line', 'names' => [['lang' => 'en', 'name' => 'Pilgrim path']], 'color' => '#336699', 'style' => ['width' => 2.5, 'pattern' => 'dashed', 'opacity' => 1, 'arrow' => true]];
    same('pilgrim-path', $s->save_type($line));
    same(['width' => 2.5, 'pattern' => 'dashed', 'opacity' => 1, 'arrow' => true], find_by($s->types()['types'], 'code', 'pilgrim-path')['style']);
    $area = ['geometry' => 'area', 'names' => [['lang' => 'en', 'name' => 'Fiefdom']], 'color' => '#339966', 'style' => ['fill_opacity' => 0.2, 'outline' => ['width' => 1.5, 'pattern' => 'solid', 'opacity' => 1]]];
    same('fiefdom', $s->save_type($area));
    same('area', find_by($s->types()['types'], 'code', 'fiefdom')['geometry']);
    throws('/geometry of a type never changes/', function () use ($s, $area) {
        $s->save_type(array_merge($area, ['code' => 'pilgrim-path', 'edit' => true]));
    });
    throws('/width must be/', function () use ($s, $line) {
        $s->save_type(array_merge($line, ['names' => [['lang' => 'en', 'name' => 'Wide']], 'style' => ['width' => 13, 'pattern' => 'solid', 'opacity' => 1, 'arrow' => false]]));
    });
    throws('/fill opacity must be/', function () use ($s, $area) {
        $s->save_type(array_merge($area, ['names' => [['lang' => 'en', 'name' => 'Dense']], 'style' => ['fill_opacity' => 0.9, 'outline' => ['width' => 1, 'pattern' => 'solid', 'opacity' => 1]]]));
    });
});

test('save_shape: the type must be a line or area type of the dictionary; a line type needs a line; a place type is refused', function () {
    $s = fresh_store($dir);
    $s->save_type(['geometry' => 'line', 'names' => [['lang' => 'en', 'name' => 'Pilgrim path']], 'color' => '#336699', 'style' => ['width' => 2.5, 'pattern' => 'dashed', 'opacity' => 1, 'arrow' => false]]);
    $shape = function ($type, $geom) {
        return ['names' => [['lang' => 'en', 'name' => 'S']], 'type' => $type, 'color' => '#336699', 'opacity' => 0.5, 'label' => false, 'source' => '', 'date_from' => null, 'date_to' => null, 'geometry' => $geom];
    };
    $line = ['type' => 'LineString', 'coordinates' => [[44.5, 40.2], [45.0, 40.5]]];
    $poly = ['type' => 'Polygon', 'coordinates' => [[[44.0, 40.0], [44.5, 40.0], [44.5, 40.5], [44.0, 40.0]]]];
    ok(is_string($s->save_shape($shape('pilgrim-path', $line))));
    throws('/a route must be a line/', function () use ($s, $shape, $poly) {
        $s->save_shape($shape('pilgrim-path', $poly));
    });
    throws('/unknown border type/', function () use ($s, $shape, $poly) {
        $s->save_shape($shape('settlement', $poly));
    });
});

test('delete_type: a line or area type that shapes use is refused with the count; a place cannot take a line type', function () {
    $s = fresh_store($dir);
    $s->save_type(['geometry' => 'area', 'names' => [['lang' => 'en', 'name' => 'Fiefdom']], 'color' => '#339966', 'style' => ['fill_opacity' => 0.2, 'outline' => ['width' => 1.5, 'pattern' => 'solid', 'opacity' => 1]]]);
    $poly = ['type' => 'Polygon', 'coordinates' => [[[44.0, 40.0], [44.5, 40.0], [44.5, 40.5], [44.0, 40.0]]]];
    $in = ['names' => [['lang' => 'en', 'name' => 'S']], 'type' => 'fiefdom', 'color' => '#339966', 'opacity' => 0.5, 'label' => false, 'source' => '', 'date_from' => null, 'date_to' => null, 'geometry' => $poly];
    $s->save_shape($in);
    $s->save_shape($in);
    throws('/2 shapes use the type "fiefdom"/', function () use ($s) {
        $s->delete_type('fiefdom');
    });
    throws('/bad type/', function () use ($s) {
        $s->save(['place' => array_merge(BASE, ['type' => 'trade'])]);
    });
    ok($s->delete_type('road'), 'a built-in line type nobody uses can be removed');
});
