<?php
/**
 * Fills a phpBB board that runs this extension (tools/dev/phpbb-up.sh) with the sample data: the objects and lists (the extension loads them
 * when it is enabled), the forum "Map" with a topic and a card for every place, shape and layer, and the notes of the sample as posts. It uses
 * the code of the extension itself: sql_repository and phpbb_gateway, so what it makes is what the map makes.
 * Usage: php tools/dev/seed.php <phpBB dir> [--check]. It does nothing when the notes are already there.
 */
if (PHP_SAPI !== 'cli') {
    exit;
}
$board = isset($argv[1]) ? realpath($argv[1]) : false;
if (!$board || !is_file($board . '/config.php')) {
    fwrite(STDERR, "usage: php tools/dev/seed.php <phpBB dir> [--check]\n");
    exit(2);
}
$check = in_array('--check', $argv, true);
chdir($board);
define('IN_PHPBB', true);
$phpbb_root_path = $board . '/';
$phpEx = 'php';
include $phpbb_root_path . 'common.php';
include $phpbb_root_path . 'includes/functions_posting.php';
include $phpbb_root_path . 'includes/functions_user.php';
include $phpbb_root_path . 'includes/functions_admin.php';
include $phpbb_root_path . 'includes/functions_acp.php';
include $phpbb_root_path . 'includes/acp/acp_forums.php';
$user->session_begin();
$auth->acl($user->data);
$user->setup();
$r = $db->sql_query('SELECT * FROM ' . USERS_TABLE . ' WHERE user_id = 2');
$user->data = $db->sql_fetchrow($r);
$db->sql_freeresult($r);
$auth->acl($user->data);
error_reporting(E_ERROR | E_PARSE);   // phpBB 3.3 prints notices of PHP 8 for a script without a request

foreach (['dates', 'store', 'sql_driver', 'dbal_driver', 'sql_transfer', 'card', 'post_gateway', 'phpbb_gateway', 'sql_repository'] as $c) {
    if (!class_exists('\\ahm\\map\\service\\' . $c) && !interface_exists('\\ahm\\map\\service\\' . $c)) {
        require_once dirname(__DIR__, 2) . "/service/$c.php";
    }
}
use ahm\map\service\dbal_driver;
use ahm\map\service\phpbb_gateway;
use ahm\map\service\sql_repository;
use ahm\map\service\sql_transfer;
use ahm\map\service\store;

$driver = new dbal_driver($db, $table_prefix);
$p = $table_prefix;
$n = function ($sql) use ($driver) {
    return (int) $driver->value($sql);
};

if ($check) {
    $bad = 0;
    $say = function ($ok, $what) use (&$bad) {
        echo ($ok ? '  ok   ' : '  FAIL ') . $what . "\n";
        $bad += $ok ? 0 : 1;
    };
    foreach (sql_transfer::TABLES as $tab) {
        $say($n("SELECT COUNT(*) FROM {$p}$tab") >= 0, "table {$p}$tab exists");
    }
    $objects = $n("SELECT COUNT(*) FROM {$p}ahm_objects");
    $say($objects > 0, "$objects objects (" . $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'place'") . ' places, ' . $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'shape'") . ' shapes, ' . $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'layer'") . ' layers)');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_lists") > 0, $n("SELECT COUNT(*) FROM {$p}ahm_lists") . ' list entries');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE topic_id IS NULL") === 0, 'every object has a topic');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_objects o LEFT JOIN {$p}topics t ON t.topic_id = o.topic_id WHERE t.topic_id IS NULL") === 0, 'every topic of an object exists');
    $map = $n("SELECT forum_id FROM {$p}forums WHERE forum_name = 'Map' AND parent_id = 0");
    $kids = $n("SELECT COUNT(*) FROM {$p}forums WHERE parent_id = $map AND forum_name IN ('Places', 'Layers', 'Shapes')");
    $say($map > 0 && $kids === 3, 'forum Map with Places, Layers and Shapes');
    $topics = $n("SELECT COUNT(*) FROM {$p}topics WHERE forum_id IN (SELECT forum_id FROM {$p}forums WHERE parent_id = $map)");
    $posts = $n("SELECT COUNT(*) FROM {$p}posts WHERE forum_id IN (SELECT forum_id FROM {$p}forums WHERE parent_id = $map)");
    $meta = $n("SELECT COUNT(*) FROM {$p}ahm_note_meta");
    $say($topics > 0 && $posts === $topics + $meta, "$topics topics = $topics cards, $meta notes, $posts posts");
    $say($n("SELECT COUNT(*) FROM {$p}ahm_note_meta m LEFT JOIN {$p}posts s ON s.post_id = m.post_id WHERE s.post_id IS NULL") === 0, 'every note meta has its post');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_revisions") > 0, $n("SELECT COUNT(*) FROM {$p}ahm_revisions") . ' revisions');
    // what the map reads: the same repository the controller builds
    $repo = new sql_repository($driver, new phpbb_gateway($db, $table_prefix, $phpbb_root_path), 2);
    $st = new store($phpbb_root_path . 'store/ahm_map/', $repo);
    $say(count($st->places()['features']) === $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'place'"), 'the store reads all places from the tables');
    $say(count($st->notes_index()['notes']) + count($st->layer_notes_index()['notes']) === $meta, 'the store reads all notes from the posts');
    exit($bad ? 1 : 0);
}

if ($n("SELECT COUNT(*) FROM {$p}ahm_note_meta") > 0) {
    echo "already seeded\n";
    exit(0);
}

$repo = new sql_repository($driver, new phpbb_gateway($db, $table_prefix, $phpbb_root_path), 2);
$sample = dirname(__DIR__, 2) . '/data/';
$tmp = sys_get_temp_dir() . '/ahm-seed-' . getmypid() . '/';
exec('mkdir -p ' . escapeshellarg($tmp) . ' && cp -r ' . escapeshellarg($sample) . '. ' . escapeshellarg($tmp));
try {
    (new store($tmp))->migrate();                // the sample is in an older format until it is converted once
    $loaded = null;
    if (!$n("SELECT COUNT(*) FROM {$p}ahm_objects")) {
        $loaded = (new sql_transfer($driver))->import($tmp, 'seed: sample data', 2);
    }
    $topics = $repo->ensure_topics();
    $notes = 0;
    foreach (sql_transfer::read_notes($tmp) as $note) {
        $repo->put_note(['id' => $note['uuid']] + $note);
        $notes++;
    }
} finally {
    exec('rm -rf ' . escapeshellarg($tmp));
}
echo 'seeded: ' . ($loaded ? "{$loaded['places']} places, {$loaded['shapes']} shapes, {$loaded['layers']} layers, {$loaded['lists']} list entries" : 'the objects were there') . ", $topics topics with a card, $notes notes as posts\n";
