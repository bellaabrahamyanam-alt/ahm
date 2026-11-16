<?php
namespace ahm\map\tests;

/** T-041: versions of one shape in time (`series`). The rules that fit the parity table are in tests/fixtures/rules.json; these need an existing shape. */
function version_body($from, $to, $series, $extra = [])
{
    $y = function ($n) {
        return $n === null ? null : ['fmt' => 'y', 'ts' => sprintf('%04d-01-01T00:00:00Z', $n), 'mode' => 'exact', 'ts_to' => null];
    };
    return $extra + [
        'names' => [['lang' => 'en', 'name' => 'V']], 'type' => 'kingdom', 'color' => '#336699', 'opacity' => 0.5, 'label' => false,
        'source' => '', 'date_from' => $y($from), 'date_to' => $y($to), 'series' => $series,
        'geometry' => ['type' => 'Polygon', 'coordinates' => [[[44.0, 40.0], [44.5, 40.0], [44.5, 40.5], [44.0, 40.0]]]]
    ];
}

test('series: changing a version so that it overlaps another is refused; saving it again unchanged, or moved apart, works', function () {
    $s = fresh_store($dir);
    $sid = '5e1f0000-0000-4000-8000-000000000041';
    $a = $s->save_shape(version_body(100, 199, $sid));
    $b = $s->save_shape(version_body(200, 299, $sid));
    $s->save_shape(version_body(100, 199, $sid, ['id' => $a]));
    throws('/versions of one series overlap/', function () use ($s, $sid, $a) {
        $s->save_shape(version_body(100, 250, $sid, ['id' => $a]));
    });
    $s->save_shape(version_body(200, 399, $sid, ['id' => $b]));
    $s->save_shape(version_body(null, null, $sid, ['id' => $b])); // dates removed: no longer compared
});

test('series: an update that gives no series keeps the series; deleting one version leaves the others', function () {
    $s = fresh_store($dir);
    $sid = '5e1f0000-0000-4000-8000-000000000041';
    $a = $s->save_shape(version_body(100, 199, $sid));
    $b = $s->save_shape(version_body(200, 299, $sid));
    $body = version_body(100, 199, $sid, ['id' => $a]);
    unset($body['series']);
    $s->save_shape($body);
    $left = array_values(array_filter($s->shapes()['features'], function ($f) use ($sid) {
        return ($f['properties']['series'] ?? '') === $sid;
    }));
    same(2, count($left), 'both versions still have the series');
    $s->delete_shape($a);
    $ids = array_map(function ($f) {
        return $f['properties']['id'];
    }, $s->shapes()['features']);
    ok(in_array($b, $ids, true) && !in_array($a, $ids, true), 'only the deleted version is gone');
});
