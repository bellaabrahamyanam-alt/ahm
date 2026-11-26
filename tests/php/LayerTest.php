<?php
namespace ahm\map\tests;

use ahm\map\service\dates;

const NOPE = '22222222-2222-4222-8222-222222222222';

function layer_of($s, $id)
{
    return find_by($s->layers()['layers'], 'id', $id);
}

function members($s, $id)
{
    return array_column(layer_of($s, $id)['members'], 'place');
}

function new_layer($s, $extra = [])
{
    return $s->save_layer(array_merge(['names' => [['lang' => 'en', 'name' => 'Hammurabi campaigns']]], $extra));
}

function note_of($dir, $id)
{
    return find_by(note_index($dir), 'id', $id);
}

// ---- categories ----
test('sample data: 5 categories, one layer with 3 places and 1 border as members', function () {
    $s = fresh_store($dir);
    same(5, count($s->categories()['categories']));
    $l = $s->layers()['layers'];
    same(1, count($l));
    same(4, count($l[0]['members']));
    foreach ($l[0]['members'] as $m) {
        if (isset($m['shape'])) {
            ok(preg_match(\ahm\map\service\store::UUID, $m['shape']) === 1, 'border member has a valid id');
        } else {
            ok(in_array($m['place'], place_ids($dir), true), 'member exists');
        }
    }
    ok(find_by($s->categories()['categories'], 'id', $l[0]['category']) !== null, 'its category exists');
});

test('category: add with several names, rename keeps the id and replaces the names', function () {
    $s = fresh_store();
    $id = $s->save_category(['names' => [['lang' => 'en', 'name' => 'Dynasty'], ['lang' => 'hy', 'name' => 'Արքայատուն']]]);
    same(6, count($s->categories()['categories']));
    $s->save_category(['id' => $id, 'names' => [['lang' => 'en', 'name' => 'Dynasties']]]);
    $c = find_by($s->categories()['categories'], 'id', $id);
    same([['lang' => 'en', 'name' => 'Dynasties']], $c['names']);
    same(6, count($s->categories()['categories']), 'rename does not add');
});

test('category: validation', function () {
    $s = fresh_store();
    throws('/not in the list/', function () use ($s) {
        $s->save_category(['names' => [['lang' => 'zz', 'name' => 'x']]]);
    });
    throws('/at least one name/', function () use ($s) {
        $s->save_category(['names' => []]);
    });
    throws('/unknown category/', function () use ($s) {
        $s->save_category(['id' => NOPE, 'names' => [['lang' => 'en', 'name' => 'x']]]);
    });
});

// ---- layers ----
test('layer: created with names, descriptions, category, dates, colour; no members yet', function () {
    $s = fresh_store();
    $cat = $s->categories()['categories'][0]['id'];
    $from = day(-1791, 1, 1, 'y', 'approx');
    $to = day(-1749, 1, 1, 'y');
    $id = new_layer($s, ['descriptions' => [['lang' => 'en', 'text' => "One\n\nTwo"], ['lang' => 'ru', 'text' => 'Кампании']],
        'category' => $cat, 'date_from' => $from, 'date_to' => $to, 'color' => '#AA3344']);
    $l = layer_of($s, $id);
    same('#aa3344', $l['color'], 'colour lower-cased');
    same([], $l['members']);
    same($cat, $l['category']);
    same(2, count($l['descriptions']));
    same('approx', $l['date_from']['mode']);
    ok(preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', $l['created']), 'created is ISO UTC');
});

test('layer: everything except the name is optional', function () {
    $s = fresh_store();
    $l = layer_of($s, new_layer($s));
    same(null, $l['category']);
    same(null, $l['color']);
    same(null, $l['date_from']);
    same(null, $l['date_to']);
    same([], $l['descriptions']);
});

test('layer: validation', function () {
    $s = fresh_store();
    $en = [['lang' => 'en', 'name' => 'x']];
    throws('/at least one name/', function () use ($s) {
        $s->save_layer(['names' => []]);
    });
    throws('/not in the list/', function () use ($s) {
        $s->save_layer(['names' => [['lang' => 'zz', 'name' => 'x']]]);
    });
    throws('/unknown category/', function () use ($s, $en) {
        $s->save_layer(['names' => $en, 'category' => NOPE]);
    });
    foreach (['red', '#fff', '#12345g', '123456'] as $bad) {
        throws('/colour/', function () use ($s, $en, $bad) {
            $s->save_layer(['names' => $en, 'color' => $bad]);
        }, $bad);
    }
    throws('/one description per language/', function () use ($s, $en) {
        $s->save_layer(['names' => $en, 'descriptions' => [['lang' => 'en', 'text' => 'a'], ['lang' => 'en', 'text' => 'b']]]);
    });
    throws('/after/', function () use ($s, $en) {
        $s->save_layer(['names' => $en, 'date_from' => day(2000, 1, 1), 'date_to' => day(1000, 1, 1)]);
    });
    throws('/time stamp|not a valid|match/', function () use ($s, $en) {
        $s->save_layer(['names' => $en, 'date_from' => ['fmt' => 'y', 'ts' => 5, 'mode' => 'exact']]);
    });
    throws('/unknown layer/', function () use ($s, $en) {
        $s->save_layer(['id' => NOPE, 'names' => $en]);
    });
});

test('layer: update replaces the fields (so a field can be cleared) and keeps members and created', function () {
    $s = fresh_store();
    $id = new_layer($s, ['color' => '#112233', 'category' => $s->categories()['categories'][0]['id']]);
    $s->save_members(['id' => $id, 'add' => [place_ids(sandbox())[0]]]);
    $created = layer_of($s, $id)['created'];
    $s->save_layer(['id' => $id, 'names' => [['lang' => 'en', 'name' => 'Renamed']], 'category' => null, 'color' => null]);
    $l = layer_of($s, $id);
    same('Renamed', $l['names'][0]['name']);
    same(null, $l['color']);
    same(null, $l['category']);
    same(1, count($l['members']));
    same($created, $l['created']);
});

// ---- members ----
test('members: ordered, no duplicates, add and remove in one call', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $id = new_layer($s);
    same(2, $s->save_members(['id' => $id, 'add' => [$P[3], $P[1], $P[3]]]), 'duplicate ignored');
    same([$P[3], $P[1]], members($s, $id), 'order of adding');
    same(2, $s->save_members(['id' => $id, 'add' => [$P[5]], 'remove' => [$P[3]]]));
    same([$P[1], $P[5]], members($s, $id));
    same(3, $s->save_members(['id' => $id, 'add' => [$P[3]]]));
    same([$P[1], $P[5], $P[3]], members($s, $id), 'a re-added place goes to the end');
});

test('members: unknown place, unknown layer, non-list are refused and change nothing', function () {
    $s = fresh_store($dir);
    $id = new_layer($s);
    throws('/unknown place/', function () use ($s, $id) {
        $s->save_members(['id' => $id, 'add' => [NOPE]]);
    });
    throws('/unknown layer/', function () use ($s, $id, $dir) {
        $s->save_members(['id' => NOPE, 'add' => [place_ids($dir)[0]]]);
    });
    throws('/list/', function () use ($s, $id) {
        $s->save_members(['id' => $id, 'add' => 'x']);
    });
    same([], members($s, $id));
});

test('members: removing a place from a layer never touches the place itself', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $id = new_layer($s);
    $s->save_members(['id' => $id, 'add' => [$P[1]]]);
    $s->save_members(['id' => $id, 'remove' => [$P[1]]]);
    same($P, place_ids($dir), 'all places still there');
});

// ---- notes tied to layers ----
test('note tags: a note can be tied to layers its place belongs to; shown in the index', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $id = new_layer($s);
    $s->save_members(['id' => $id, 'add' => [$P[1]]]);
    $s->save(['place_id' => $P[1], 'note' => ['lang' => 'en', 'title' => 'Tagged', 'text' => 'b', 'layers' => [$id]]]);
    same([$id], find_by(note_index($dir), 'title', 'Tagged')['layers']);
});

test('note tags: a layer the place is not in, or an unknown layer, is refused', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $id = new_layer($s);
    throws('/not in the layer/', function () use ($s, $P, $id) {
        $s->save(['place_id' => $P[7], 'note' => ['lang' => 'en', 'title' => 'T', 'text' => 'x', 'layers' => [$id]]]);
    });
    throws('/unknown layer/', function () use ($s, $P) {
        $s->save(['place_id' => $P[1], 'note' => ['lang' => 'en', 'title' => 'T', 'text' => 'x', 'layers' => [NOPE]]]);
    });
});

test('note tags: editing without "layers" keeps them; [] removes them; two layers work', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $a = new_layer($s);
    $b = new_layer($s, ['names' => [['lang' => 'en', 'name' => 'Second']]]);
    $s->save_members(['id' => $a, 'add' => [$P[1]]]);
    $s->save_members(['id' => $b, 'add' => [$P[1]]]);
    $s->save(['place_id' => $P[1], 'note' => ['lang' => 'en', 'title' => 'N', 'text' => 'x', 'layers' => [$a]]]);
    $nid = find_by(note_index($dir), 'title', 'N')['id'];
    $edit = function ($extra) use ($s, $P, $nid) {
        $s->save(['place_id' => $P[1], 'note' => array_merge(['id' => $nid, 'lang' => 'en', 'title' => 'N', 'text' => 'y'], $extra)]);
    };
    $edit([]);
    same([$a], note_of($dir, $nid)['layers'], 'kept');
    $edit(['layers' => [$a, $b]]);
    same(2, count(note_of($dir, $nid)['layers']));
    $edit(['layers' => []]);
    same([], note_of($dir, $nid)['layers']);
});

test('new place can join layers at once; its note is tied to them; bad input writes nothing', function () {
    $s = fresh_store($dir);
    $a = new_layer($s);
    $b = new_layer($s, ['names' => [['lang' => 'en', 'name' => 'B']]]);
    $before = count(place_ids($dir));
    throws('/unknown layer/', function () use ($s) {
        $s->save(['place' => BASE, 'layer_ids' => [NOPE]]);
    });
    throws('/not in the layer/', function () use ($s, $a, $b) {
        $s->save(['place' => BASE, 'layer_ids' => [$a], 'note' => ['lang' => 'en', 'title' => 't', 'text' => 'x', 'layers' => [$b]]]);
    });
    throws('/list/', function () use ($s) {
        $s->save(['place' => BASE, 'layer_ids' => 'x']);
    });
    same($before, count(place_ids($dir)), 'nothing written');
    $new = $s->save(['place' => BASE, 'layer_ids' => [$a], 'layer_id' => $b, 'note' => ['lang' => 'en', 'title' => 'First', 'text' => 'x', 'layers' => [$a]]]);
    same([$new], members($s, $a));
    same([$new], members($s, $b), '"layer_id" and "layer_ids" both count');
    same([$a], find_by(note_index($dir), 'title', 'First')['layers']);
});

test('leaving a layer untags the place\'s notes (archived first) and keeps the notes', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $a = new_layer($s);
    $s->save_members(['id' => $a, 'add' => [$P[1]]]);
    $s->save(['place_id' => $P[1], 'note' => ['lang' => 'en', 'title' => 'Tagged', 'text' => 'x', 'layers' => [$a]]]);
    $s->save_members(['id' => $a, 'remove' => [$P[1]]]);
    same([], find_by(note_index($dir), 'title', 'Tagged')['layers']);
    files_only(function () use ($dir) {
        ok(count(glob("$dir/archive/note-*-untag-*.md")) >= 1, 'archived');
    });
});

// ---- layer notes ----
test('layer notes: add, edit, index; language and title are checked', function () {
    $s = fresh_store($dir);
    $id = new_layer($s);
    $nid = $s->save_layer_note(['layer_id' => $id, 'note' => ['lang' => 'en', 'title' => 'Overview', 'text' => 'The campaigns', 'date' => day(-1791, 1, 1, 'y', 'approx')]]);
    $ix = $s->layer_notes_index()['notes'];
    same(1, count($ix));
    same($id, $ix[0]['layer']);
    same('approx', $ix[0]['date']['mode']);
    $s->save_layer_note(['layer_id' => $id, 'note' => ['id' => $nid, 'lang' => 'en', 'title' => 'Overview 2', 'text' => 'edited']]);
    $ix = $s->layer_notes_index()['notes'];
    same(1, count($ix));
    same('Overview 2', $ix[0]['title']);
    same(null, $ix[0]['date']);
    throws('/not in the list/', function () use ($s, $id) {
        $s->save_layer_note(['layer_id' => $id, 'note' => ['lang' => 'zz', 'title' => 't', 'text' => 'x']]);
    });
    throws('/needs a language/', function () use ($s, $id) {
        $s->save_layer_note(['layer_id' => $id, 'note' => ['lang' => 'en', 'title' => '', 'text' => 'x']]);
    });
    throws('/unknown note/', function () use ($s, $id) {
        $s->save_layer_note(['layer_id' => $id, 'note' => ['id' => '44444444-4444-4444-8444-444444444444', 'lang' => 'en', 'title' => 't', 'text' => 'x']]);
    });
    throws('/unknown layer/', function () use ($s) {
        $s->save_layer_note(['layer_id' => NOPE, 'note' => ['lang' => 'en', 'title' => 't', 'text' => 'x']]);
    });
});

// ---- dispatcher ----
test('layer_save dispatches {layer}, {layer_members}, {layer_note} and refuses an empty body', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $id = $s->layer_save(['layer' => ['names' => [['lang' => 'en', 'name' => 'Via dispatcher']]]])['id'];
    ok(layer_of($s, $id) !== null);
    same(1, $s->layer_save(['layer_members' => ['id' => $id, 'add' => [$P[0]]]])['members']);
    ok($s->layer_save(['layer_note' => ['layer_id' => $id, 'note' => ['lang' => 'en', 'title' => 'N', 'text' => 'x']]])['id'] !== '');
    throws('/nothing to save/', function () use ($s) {
        $s->layer_save([]);
    });
});

// ---- delete ----
test('delete layer: untags every note, archives layer notes, keeps places and notes', function () {
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $id = new_layer($s);
    $s->save_members(['id' => $id, 'add' => [$P[1]]]);
    $s->save(['place_id' => $P[1], 'note' => ['lang' => 'en', 'title' => 'Late tag', 'text' => 'x', 'layers' => [$id]]]);
    $s->save_layer_note(['layer_id' => $id, 'note' => ['lang' => 'en', 'title' => 'L1', 'text' => 'x']]);
    $notes = count(note_index($dir));
    ok($s->delete_layer($id));
    same(null, layer_of($s, $id));
    same(0, count($s->layer_notes_index()['notes']));
    sync($dir);
    ok(!is_dir("$dir/layer-notes/$id"));
    files_only(function () use ($dir, $id) {
        same(1, count(glob("$dir/archive/layer-note-$id-*.md")), 'layer note archived');
    });
    same($P, place_ids($dir), 'places kept');
    same($notes, count(note_index($dir)), 'place notes kept');
    foreach (note_index($dir) as $n) {
        ok(!in_array($id, $n['layers'], true), 'no note keeps the deleted layer');
    }
    throws('/unknown layer/', function () use ($s, $id) {
        $s->delete_layer($id);
    });
});

test('layers.json is archived before every change, under unique names', function () {
    skip_unless_files();
    $s = fresh_store($dir);
    $id = new_layer($s);
    for ($i = 0; $i < 4; $i++) {
        $s->save_layer(['id' => $id, 'names' => [['lang' => 'en', 'name' => "v$i"]]]);
    }
    $names = glob("$dir/archive/layers-*.json");
    ok(count($names) >= 5, 'one copy per change even within a second: ' . count($names));
    same(count($names), count(array_unique($names)));
});

// ---- notes of a border or a route (stored with the layer notes, owner = the shape id) ----
function new_shape($s, $type = 'trade')
{
    return $s->save_shape([
        'names' => [['lang' => 'en', 'name' => 'Silk Road']], 'type' => $type, 'color' => '#aa3344', 'opacity' => 1, 'label' => true,
        'source' => '', 'date_from' => null, 'date_to' => null,
        'geometry' => ['type' => 'LineString', 'coordinates' => [[44.5, 40.2], [45.0, 40.5]]]
    ]);
}

test('shape notes: a route or border can have notes; they are indexed under the shape id', function () {
    $s = fresh_store($dir);
    $sid = new_shape($s);
    $nid = $s->save_layer_note(['layer_id' => $sid, 'note' => ['lang' => 'en', 'title' => 'Goods', 'text' => 'Silk and salt']]);
    $ix = $s->layer_notes_index()['notes'];
    same(1, count($ix));
    same($sid, $ix[0]['layer']);
    $s->save_layer_note(['layer_id' => $sid, 'note' => ['id' => $nid, 'lang' => 'en', 'title' => 'Goods 2', 'text' => 'edited']]);
    same('Goods 2', $s->layer_notes_index()['notes'][0]['title']);
    throws('/unknown layer or border/', function () use ($s) {
        $s->save_layer_note(['layer_id' => NOPE, 'note' => ['lang' => 'en', 'title' => 't', 'text' => 'x']]);
    });
});

test('shape notes: deleting the shape moves its notes to archive/ and out of the index; other notes stay', function () {
    $s = fresh_store($dir);
    $sid = new_shape($s);
    $lid = new_layer($s);
    $s->save_layer_note(['layer_id' => $sid, 'note' => ['lang' => 'en', 'title' => 'Goods', 'text' => 'x']]);
    $s->save_layer_note(['layer_id' => $lid, 'note' => ['lang' => 'en', 'title' => 'Kept', 'text' => 'x']]);
    $s->delete_shape($sid);
    $ix = $s->layer_notes_index()['notes'];
    same(1, count($ix));
    same('Kept', $ix[0]['title']);
    sync($dir);
    same([], glob("$dir/layer-notes/$sid"));
    files_only(function () use ($dir, $sid) {
        ok(count(glob("$dir/archive/layer-note-$sid-*.md")) === 1, 'archived');
    });
});
