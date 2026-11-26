<?php
namespace ahm\map\tests;

use ahm\map\service\store;

function a_place($s, $dir)
{
    return place_ids($dir)[0];
}

test('note: created with a language, title, text; stored as Markdown; found in the index', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    $before = count(note_index($dir));
    $s->save(['place_id' => $pid, 'note' => ['lang' => 'en', 'title' => '  A   title ', 'text' => "Line 1\n\nLine 2"]]);
    $n = find_by(note_index($dir), 'title', 'A title');
    ok($n !== null, 'in the index with a collapsed title');
    same($pid, $n['place']);
    same('en', $n['lang']);
    same(null, $n['date']);
    same([], $n['layers']);
    same("Line 1\n\nLine 2", $n['text']);
    same($before + 1, count(note_index($dir)));
    sync($dir);
    ok(is_file("$dir/notes/$pid/{$n['id']}.md"));
});

test('note: language title and text are required', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    foreach ([['title' => 't', 'text' => ''], ['title' => '', 'text' => 'x'], ['title' => '  ', 'text' => 'x'], ['text' => 'x'], ['title' => 't']] as $bad) {
        throws('/needs a language, a title and a text/', function () use ($s, $pid, $bad) {
            $s->save(['place_id' => $pid, 'note' => $bad + ['lang' => 'en']]);
        });
    }
    throws('/needs a language/', function () use ($s, $pid) {
        $s->save(['place_id' => $pid, 'note' => ['title' => 't', 'text' => 'x']]);
    });
});

test('note: a language outside the dictionary is refused', function () {
    $s = fresh_store($dir);
    throws('/not in the list/', function () use ($s, $dir) {
        $s->save(['place_id' => place_ids($dir)[0], 'note' => ['lang' => 'zz', 'title' => 't', 'text' => 'x']]);
    });
});

test('note: the date is optional and kept in the chosen format', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    $s->save(['place_id' => $pid, 'note' => ['lang' => 'en', 'title' => 'dated', 'text' => 'x', 'date' => day(1500, 3, 21, 'dmy')]]);
    $n = find_by(note_index($dir), 'title', 'dated');
    same('dmy', $n['date']['fmt']);
    same('1500-03-21T00:00:00Z', $n['date']['ts']);
    throws('/note date/', function () use ($s, $pid) {
        $s->save(['place_id' => $pid, 'note' => ['lang' => 'en', 'title' => 'x', 'text' => 'x', 'date' => ['fmt' => 'y', 'ts' => 'bad', 'mode' => 'exact', 'ts_to' => null]]]);
    });
});

test('note: many notes per place and language', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    for ($i = 0; $i < 3; $i++) {
        $s->save(['place_id' => $pid, 'note' => ['lang' => 'en', 'title' => "n$i", 'text' => 'x']]);
    }
    $mine = array_filter(note_index($dir), function ($n) use ($pid) {
        return $n['place'] === $pid && preg_match('/^n\d$/', $n['title']);
    });
    same(3, count($mine));
});

test('note edit: same id, archived copy of the old file, index updated', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    $s->save(['place_id' => $pid, 'note' => ['lang' => 'en', 'title' => 'v1', 'text' => 'one']]);
    $id = find_by(note_index($dir), 'title', 'v1')['id'];
    $s->save(['place_id' => $pid, 'note' => ['id' => $id, 'lang' => 'en', 'title' => 'v2', 'text' => 'two']]);
    $n = find_by(note_index($dir), 'id', $id);
    same('v2', $n['title']);
    same('two', $n['text']);
    files_only(function () use ($dir, $id, $pid) {
        ok(count(glob("$dir/archive/note-$pid-$id-*.md")) >= 1, 'old note archived');
    });
});

test('note edit: unknown or malformed id is refused', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    throws('/unknown note/', function () use ($s, $pid) {
        $s->save(['place_id' => $pid, 'note' => ['id' => NIL, 'lang' => 'en', 'title' => 't', 'text' => 'x']]);
    });
    throws('/unknown note/', function () use ($s, $pid) {
        $s->save(['place_id' => $pid, 'note' => ['id' => '../../places', 'lang' => 'en', 'title' => 't', 'text' => 'x']]);
    });
});

test('note body that looks like a header cannot break the file', function () {
    $s = fresh_store($dir);
    $pid = place_ids($dir)[0];
    $s->save(['place_id' => $pid, 'note' => ['lang' => 'en', 'title' => 'tricky', 'text' => "before\n---\nid: injected\n---\nafter"]]);
    $n = find_by(note_index($dir), 'title', 'tricky');
    ok($n !== null && $n['id'] !== 'injected', 'the real id survives');
    ok(strpos($n['text'], 'after') !== false, 'the full text is kept');
});

test('index: rebuild_index recreates a deleted index from the note files', function () {
    $s = fresh_store($dir);
    $n = count(note_index($dir));
    ok($n > 0);
    unlink("$dir/notes/index.json");
    $s->rebuild_index();
    same($n, count(note_index($dir)));
});

test('index: contains id, place, lang, title, date, layers and the full text', function () {
    $dir = sandbox();
    $s = new store($dir);
    $s->migrate();
    foreach (note_index($dir) as $n) {
        foreach (['id', 'place', 'lang', 'title', 'date', 'layers', 'text'] as $k) {
            ok(array_key_exists($k, $n), "key $k");
        }
    }
});
