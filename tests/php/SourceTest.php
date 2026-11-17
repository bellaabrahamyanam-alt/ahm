<?php
namespace ahm\map\tests;

/** T-046 phase 1: the dictionary of sources, and certainty / radius / sources on places and borders. The verdict rules are in tests/fixtures/rules.json. */
function cs_feature(array $features, $id)
{
    foreach ($features as $f) {
        if (($f['properties']['id'] ?? '') === $id) {
            return $f;
        }
    }
    return null;
}

function cs_place($dir, $id)
{
    return cs_feature(json_file("$dir/places.geojson")['features'], $id);
}

const CS_BASE = ['lat' => 40.1, 'lon' => 44.5, 'type' => 'village', 'names' => [['lang' => 'en', 'name' => 'Certain']]];

test('sources: add, rename, change the link; a missing link is removed; the list keeps its order', function () {
    $s = fresh_store($dir);
    $n = count($s->sources()['sources']);
    $id = $s->save_source(['title' => 'Pliny, Natural History', 'citation' => 'Pliny, NH 6', 'url' => 'https://example.org/pliny']);
    $list = $s->sources()['sources'];
    same($n + 1, count($list));
    same($id, $list[$n]['id']);
    same('https://example.org/pliny', $list[$n]['url']);
    $s->save_source(['id' => $id, 'title' => 'Pliny the Elder', 'citation' => 'NH 6']);
    $now = $s->sources()['sources'][$n];
    same('Pliny the Elder', $now['title']);
    ok(!array_key_exists('url', $now), 'the link is gone when it is not sent');
    ok(count(glob("$dir/archive/sources-*.json")) >= 1, 'the old file is archived');
});

test('certainty: a place keeps certainty, radius and sources when an update does not send them, and null / [] clears them', function () {
    $s = fresh_store($dir);
    $src = array_column($s->sources()['sources'], 'id');
    $id = $s->save(['place' => CS_BASE + ['certainty' => 'disputed', 'radius_m' => 8000, 'sources' => [$src[0], $src[0], $src[1]]]]);
    $p = cs_place($dir, $id)['properties'];
    same('disputed', $p['certainty']);
    same(8000, $p['radius_m']);
    same([$src[0], $src[1]], $p['sources'], 'a source is listed once');
    $s->save(['place_update' => ['id' => $id, 'names' => [['lang' => 'en', 'name' => 'Renamed']]] + CS_BASE]);
    $p = cs_place($dir, $id)['properties'];
    same('Renamed', $p['label']);
    same('disputed', $p['certainty'], 'kept');
    same(8000, $p['radius_m'], 'kept');
    $s->save(['place_update' => ['id' => $id, 'certainty' => null, 'radius_m' => '', 'sources' => []] + CS_BASE]);
    $p = cs_place($dir, $id)['properties'];
    ok(!array_key_exists('certainty', $p) && !array_key_exists('radius_m', $p) && !array_key_exists('sources', $p), 'all three removed');
});

test('certainty: a place that sends nothing of it gets no new properties (old data is unchanged)', function () {
    $s = fresh_store($dir);
    $id = $s->save(['place' => CS_BASE]);
    $p = cs_place($dir, $id)['properties'];
    ok(!array_key_exists('certainty', $p) && !array_key_exists('radius_m', $p) && !array_key_exists('sources', $p));
});

test('certainty: a border keeps certainty and sources when an update does not send them', function () {
    $s = fresh_store($dir);
    $src = array_column($s->sources()['sources'], 'id');
    $body = ['names' => [['lang' => 'en', 'name' => 'B']], 'type' => 'kingdom', 'color' => '#336699', 'opacity' => 0.5, 'label' => false, 'source' => '',
        'date_from' => null, 'date_to' => null, 'geometry' => ['type' => 'Polygon', 'coordinates' => [[[44.0, 40.0], [44.5, 40.0], [44.5, 40.5], [44.0, 40.0]]]]];
    $id = $s->save_shape($body + ['certainty' => 'approximate', 'sources' => [$src[1]]]);
    $s->save_shape(['id' => $id] + $body);
    $f = cs_feature($s->shapes()['features'], $id);
    same('approximate', $f['properties']['certainty']);
    same([$src[1]], $f['properties']['sources']);
    $s->save_shape(['id' => $id, 'certainty' => null, 'sources' => []] + $body);
    $f = cs_feature($s->shapes()['features'], $id);
    ok(!array_key_exists('certainty', $f['properties']) && !array_key_exists('sources', $f['properties']));
});
