<?php
namespace ahm\map\tests;

test('languages: the sample dictionary has the languages the sample data uses', function () {
    $s = fresh_store($dir);
    $codes = array_column($s->languages()['languages'], 'code');
    foreach (note_index($dir) as $n) {
        ok(in_array($n['lang'], $codes, true), 'note language ' . $n['lang']);
    }
    foreach (json_file("$dir/places.geojson")['features'] as $f) {
        foreach ($f['properties']['names'] as $nm) {
            ok(in_array($nm['lang'], $codes, true), 'name language ' . $nm['lang']);
        }
    }
});

test('languages: a missing file is created from the languages in use', function () {
    $dir = sandbox();
    unlink("$dir/languages.json");
    $s = new \ahm\map\service\store($dir);
    $codes = array_column($s->languages()['languages'], 'code');
    ok(in_array('en', $codes, true) && in_array('hy', $codes, true));
});

test('save_language: adds, lower-cases the code, then the language can be used', function () {
    $s = fresh_store($dir);
    $s->save_language(['code' => 'XCL', 'name' => 'Classical Armenian', 'native' => 'Գրաբար']);
    $l = find_by($s->languages()['languages'], 'code', 'xcl');
    same('Classical Armenian', $l['name']);
    same('Գրաբար', $l['native']);
    ok(preg_match('/^[0-9a-f-]{36}$/', $s->save(['place' => array_merge(BASE, ['names' => [['lang' => 'xcl', 'name' => 'Y']]])])));
});

test('save_language: bad code, duplicate, missing name', function () {
    $s = fresh_store($dir);
    throws('/already/', function () use ($s) {
        $s->save_language(['code' => 'en', 'name' => 'X']);
    });
    throws('/already/', function () use ($s) {
        $s->save_language(['code' => 'EN', 'name' => 'X']);
    }, 'case-insensitive duplicate');
    foreach (['x1', 'a', 'abcdefghi', '', 'e n'] as $bad) {
        throws('/2-8 letters/', function () use ($s, $bad) {
            $s->save_language(['code' => $bad, 'name' => 'X']);
        }, $bad);
    }
    throws('/needs a name/', function () use ($s) {
        $s->save_language(['code' => 'abc', 'name' => ' ']);
    });
});

test('save_language: archives the old dictionary', function () {
    skip_unless_files();
    $s = fresh_store($dir);
    $s->save_language(['code' => 'abc', 'name' => 'Abc']);
    ok(count(glob("$dir/archive/languages-*.json")) >= 1);
});
