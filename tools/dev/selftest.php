<?php
/**
 * Writes through the store the way the map does (sql_repository + phpbb_gateway, the same lock file) and checks where it all went: rows,
 * topics, posts, revisions, and that no data file appeared. Run by tools/dev/phpbb-up.sh check. It leaves its objects in the board.
 * Usage: php tools/dev/selftest.php <phpBB dir>
 */
if (PHP_SAPI !== 'cli') {
    exit;
}
$board = isset($argv[1]) ? realpath($argv[1]) : false;
if (!$board || !is_file($board . '/config.php')) {
    fwrite(STDERR, "usage: php tools/dev/selftest.php <phpBB dir>\n");
    exit(2);
}
chdir($board);
define('IN_PHPBB', true);
$phpbb_root_path = $board . '/';
$phpEx = 'php';
include $phpbb_root_path . 'common.php';
include $phpbb_root_path . 'includes/functions_posting.php';
include $phpbb_root_path . 'includes/functions_user.php';
include $phpbb_root_path . 'includes/functions_admin.php';
$user->session_begin();
$auth->acl($user->data);
$user->setup();
$r = $db->sql_query('SELECT * FROM ' . USERS_TABLE . ' WHERE user_id = 2');
$user->data = $db->sql_fetchrow($r);
$db->sql_freeresult($r);
$auth->acl($user->data);
error_reporting(E_ERROR | E_PARSE);
foreach (['dates', 'store', 'sql_driver', 'dbal_driver', 'sql_transfer', 'card', 'post_gateway', 'phpbb_gateway', 'sql_repository'] as $c) {
    if (!class_exists('\\ahm\\map\\service\\' . $c) && !interface_exists('\\ahm\\map\\service\\' . $c)) {
        require_once dirname(__DIR__, 2) . "/service/$c.php";
    }
}
use ahm\map\service\dbal_driver;
use ahm\map\service\phpbb_gateway;
use ahm\map\service\sql_repository;
use ahm\map\service\store;

$data = $phpbb_root_path . 'store/ahm_map/';
$driver = new dbal_driver($db, $table_prefix);
$st = new store($data, new sql_repository($driver, new phpbb_gateway($db, $table_prefix, $phpbb_root_path), 2, $data . '.lock'));
$p = $table_prefix;
$bad = 0;
$say = function ($ok, $what) use (&$bad) {
    echo ($ok ? '  ok   ' : '  FAIL ') . $what . "\n";
    $bad += $ok ? 0 : 1;
};
$n = function ($sql, array $a = []) use ($driver) {
    return (int) $driver->value($sql, $a);
};
$tag = substr(md5(uniqid('', true)), 0, 6);

// 1. a place with its first note
$pid = $st->save(['place' => ['lat' => 40.2, 'lon' => 44.6, 'type' => 'village', 'names' => [['lang' => 'en', 'name' => "Selftest $tag"], ['lang' => 'hy', 'name' => 'Թեստ']]],
    'note' => ['lang' => 'en', 'title' => "First note $tag", 'text' => "A text with [brackets] and *markdown*\n\nsecond paragraph"]]);
$row = $driver->rows('SELECT topic_id, version FROM ' . $p . 'ahm_objects WHERE id = ?', [$pid])[0] ?? null;
$say($row && $row['topic_id'] !== null, 'a new place is a row of ahm_objects with a topic');
$topic = (int) $row['topic_id'];
$say($n('SELECT COUNT(*) FROM ' . $p . 'posts WHERE topic_id = ?', [$topic]) === 2, 'the topic has the card and the note as posts');
$say($driver->value('SELECT topic_title FROM ' . $p . 'topics WHERE topic_id = ?', [$topic]) === "Selftest $tag", 'the title of the topic is the name of the place');
$notes = $st->notes_index()['notes'];
$mine = array_values(array_filter($notes, function ($x) use ($pid) {
    return $x['place'] === $pid;
}));
$say(count($mine) === 1 && $mine[0]['title'] === "First note $tag" && $mine[0]['text'] === "A text with [brackets] and *markdown*\n\nsecond paragraph", 'the note comes back from the post exactly as it was written');
$nid = $mine[0]['id'] ?? '';
$say(strpos((string) $st->note_raw($pid, $nid), "\nsecond paragraph") !== false, 'the note body answer holds the text');

// 2. the note is edited: the same post changes, a second revision is written
$st->save(['place_id' => $pid, 'note' => ['id' => $nid, 'lang' => 'ru', 'title' => "Edited $tag", 'text' => 'new text']]);
$mine = array_values(array_filter($st->notes_index()['notes'], function ($x) use ($pid) {
    return $x['place'] === $pid;
}));
$say(count($mine) === 1 && $mine[0]['title'] === "Edited $tag" && $mine[0]['lang'] === 'ru', 'editing a note changes it, it does not add one');
$say($n('SELECT COUNT(*) FROM ' . $p . 'posts WHERE topic_id = ?', [$topic]) === 2, 'the topic still has two posts');
$say($n('SELECT COUNT(*) FROM ' . $p . "ahm_revisions WHERE entity_kind = 'note' AND entity_id IN (SELECT CAST(post_id AS CHAR) FROM " . $p . 'posts WHERE topic_id = ?)', [$topic]) === 2, 'the note has two revisions');

// 3. the place is moved and renamed: the card and the title follow
$st->save(['place_update' => ['id' => $pid, 'lat' => 40.3, 'lon' => 44.7, 'type' => 'village', 'names' => [['lang' => 'en', 'name' => "Renamed $tag"]]]]);
$say($driver->value('SELECT topic_title FROM ' . $p . 'topics WHERE topic_id = ?', [$topic]) === "Renamed $tag", 'renaming a place renames its topic');
$say($n('SELECT version FROM ' . $p . 'ahm_objects WHERE id = ?', [$pid]) === 2, 'the version of the place went up');

// 4. a layer with a note, then the layer is deleted
$lid = $st->save_layer(['names' => [['lang' => 'en', 'name' => "Layer $tag"]]]);
$say($n('SELECT COUNT(*) FROM ' . $p . "ahm_objects WHERE kind = 'layer' AND id = ? AND topic_id IS NOT NULL", [$lid]) === 1, 'a new layer is a row with a topic');
$st->save_layer_note(['layer_id' => $lid, 'note' => ['lang' => 'en', 'title' => "Layer note $tag", 'text' => 'about the layer']]);
$say(count(array_filter($st->layer_notes_index()['notes'], function ($x) use ($lid) {
    return $x['layer'] === $lid;
})) === 1, 'a layer note comes back from its post');
$ltopic = $n('SELECT topic_id FROM ' . $p . 'ahm_objects WHERE id = ?', [$lid]);
$st->delete_layer($lid);
$say($n('SELECT COUNT(*) FROM ' . $p . 'ahm_objects WHERE id = ?', [$lid]) === 0, 'a deleted layer is gone from the table');
$say($n('SELECT topic_status FROM ' . $p . 'topics WHERE topic_id = ?', [$ltopic]) === 1, 'its topic is closed');
$say($n('SELECT COUNT(*) FROM ' . $p . "ahm_revisions WHERE entity_kind = 'layer' AND entity_id = ? AND action = 'delete'", [$lid]) === 1, 'its last state is kept as a revision');

// 5. nothing went to files
$files = array_diff(scandir($data), ['.', '..', '.lock', 'overlays']);
$say(!$files, 'the store folder holds no data file' . ($files ? ' (found: ' . implode(', ', $files) . ')' : ''));
exit($bad ? 1 : 0);
