<?php
/**
 * Fills a phpBB board that runs this extension (tools/dev/phpbb-up.sh): the forum "Map" with the forums Places, Layers and Shapes, the SQL
 * tables from the files of the store, a topic with a card for every place, shape and layer, and the notes as posts with their ahm_note_meta.
 * Usage: php tools/dev/seed.php <phpBB dir> [--check]. It does nothing when the tables already hold objects.
 * The posting calls are here only for the board of development; the class that holds them for the extension is T-079.
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

foreach (['sql_transfer', 'card', 'dates'] as $c) {
    if (!class_exists('\\ahm\\map\\service\\' . $c)) {
        require_once dirname(__DIR__, 2) . "/service/$c.php";
    }
}
use ahm\map\service\card;
use ahm\map\service\sql_transfer;

// the same database for PDO as phpBB uses
if (stripos($dbms, 'sqlite') !== false) {
    $pdo = new PDO('sqlite:' . $dbhost);
    $pdo->exec('PRAGMA busy_timeout = 10000');
} else {
    $pdo = new PDO('mysql:host=' . $dbhost . ($dbport ? ';port=' . $dbport : '') . ';dbname=' . $dbname . ';charset=utf8mb4', $dbuser, $dbpasswd);
}
$t = new sql_transfer($pdo, $table_prefix);
$q = function ($sql) use ($db) {
    $r = $db->sql_query($sql);
    $row = $db->sql_fetchrow($r);
    $db->sql_freeresult($r);
    return $row;
};
$forum_id = function ($name, $parent) use ($q) {
    $row = $q('SELECT forum_id FROM ' . FORUMS_TABLE . " WHERE forum_name = '" . str_replace("'", "''", $name) . "' AND parent_id = " . (int) $parent);
    return $row ? (int) $row['forum_id'] : 0;
};

if ($check) {
    $bad = 0;
    $say = function ($ok, $what) use (&$bad) {
        echo ($ok ? '  ok   ' : '  FAIL ') . $what . "\n";
        $bad += $ok ? 0 : 1;
    };
    $n = function ($sql) use ($pdo) {
        return (int) $pdo->query($sql)->fetchColumn();
    };
    $p = $table_prefix;
    foreach (sql_transfer::TABLES as $tab) {
        $say($n("SELECT COUNT(*) FROM {$p}$tab") >= 0, "table {$p}$tab exists");
    }
    $objects = $n("SELECT COUNT(*) FROM {$p}ahm_objects");
    $say($objects > 0, "$objects objects (" . $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'place'") . ' places, ' . $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'shape'") . ' shapes, ' . $n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE kind = 'layer'") . ' layers)');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_lists") > 0, $n("SELECT COUNT(*) FROM {$p}ahm_lists") . ' list entries');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_objects WHERE topic_id IS NULL") === 0, 'every object has a topic');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_objects o LEFT JOIN {$p}topics t ON t.topic_id = o.topic_id WHERE t.topic_id IS NULL") === 0, 'every topic of an object exists');
    $map = $forum_id('Map', 0);
    $say($map > 0 && $forum_id('Places', $map) > 0 && $forum_id('Layers', $map) > 0 && $forum_id('Shapes', $map) > 0, 'forum Map with Places, Layers and Shapes');
    $topics = $n("SELECT COUNT(*) FROM {$p}topics WHERE forum_id IN (SELECT forum_id FROM {$p}forums WHERE parent_id = " . (int) $map . ')');
    $posts = $n("SELECT COUNT(*) FROM {$p}posts WHERE forum_id IN (SELECT forum_id FROM {$p}forums WHERE parent_id = " . (int) $map . ')');
    $meta = $n("SELECT COUNT(*) FROM {$p}ahm_note_meta");
    $say($topics > 0 && $posts === $topics + $meta, "$topics topics = $topics cards, $meta notes, $posts posts");
    $say($n("SELECT COUNT(*) FROM {$p}ahm_note_meta m LEFT JOIN {$p}posts s ON s.post_id = m.post_id WHERE s.post_id IS NULL") === 0, 'every note meta has its post');
    $say($n("SELECT COUNT(*) FROM {$p}ahm_revisions") > 0, $n("SELECT COUNT(*) FROM {$p}ahm_revisions") . ' revisions');
    exit($bad ? 1 : 0);
}

if ((int) $pdo->query('SELECT COUNT(*) FROM ' . $table_prefix . 'ahm_objects')->fetchColumn() > 0) {
    echo "already seeded\n";
    exit(0);
}

// the forum "Map"
$acp = new acp_forums();
$acp->parent_id = 0;
$make_forum = function ($name, $parent, $type) use ($acp, $forum_id) {
    if ($id = $forum_id($name, $parent)) {
        return $id;
    }
    $d = ['parent_id' => $parent, 'forum_type' => $type, 'type_action' => '', 'forum_status' => ITEM_UNLOCKED, 'forum_parents' => '', 'forum_name' => $name, 'forum_link' => '', 'forum_link_track' => false,
        'forum_desc' => '', 'forum_desc_uid' => '', 'forum_desc_options' => 7, 'forum_desc_bitfield' => '', 'forum_rules' => '', 'forum_rules_uid' => '', 'forum_rules_options' => 7, 'forum_rules_bitfield' => '',
        'forum_rules_link' => '', 'forum_image' => '', 'forum_style' => 0, 'display_subforum_list' => true, 'display_subforum_limit' => false, 'display_on_index' => true, 'forum_topics_per_page' => 0,
        'enable_indexing' => true, 'enable_icons' => false, 'enable_prune' => false, 'enable_post_review' => true, 'enable_quick_reply' => false, 'enable_shadow_prune' => false, 'prune_days' => 7,
        'prune_viewed' => 7, 'prune_freq' => 1, 'prune_old_polls' => false, 'prune_announce' => false, 'prune_sticky' => false, 'prune_shadow_days' => 7, 'prune_shadow_freq' => 1, 'forum_password' => '',
        'forum_password_confirm' => '', 'forum_password_unset' => false, 'forum_flags' => 32, 'forum_options' => 0, 'show_active' => true];
    $errors = $acp->update_forum_data($d);
    if ($errors) {
        throw new RuntimeException('forum ' . $name . ': ' . implode('; ', $errors));
    }
    return (int) $d['forum_id'];
};
$map = $make_forum('Map', 0, FORUM_CAT);
$forum = ['place' => $make_forum('Places', $map, FORUM_POST), 'layer' => $make_forum('Layers', $map, FORUM_POST), 'shape' => $make_forum('Shapes', $map, FORUM_POST)];

$post = function ($mode, $fid, $tid, $subject, $text, $locked = 0) use ($user) {
    $uid = $bitfield = '';
    $opt = 0;
    $text = trim($text) === '' ? '-' : $text;
    generate_text_for_storage($text, $uid, $bitfield, $opt, true, true, true);
    $poll = [];
    $data = ['forum_id' => $fid, 'topic_id' => $tid, 'icon_id' => 0, 'poster_id' => $user->data['user_id'], 'enable_bbcode' => true, 'enable_smilies' => true, 'enable_urls' => true,
        'enable_sig' => false, 'message' => $text, 'message_md5' => md5($text), 'attachment_data' => [], 'filename_data' => ['filename' => ''], 'bbcode_bitfield' => $bitfield, 'bbcode_uid' => $uid,
        'post_edit_locked' => $locked, 'topic_title' => $subject, 'notify_set' => false, 'notify' => false, 'post_time' => 0, 'forum_name' => '', 'enable_indexing' => true,
        'force_approved_state' => true, 'force_visibility' => true];
    submit_post($mode, $subject, '', POST_NORMAL, $poll, $data);
    return $data;
};

$store = $phpbb_root_path . 'store/ahm_map/';
if (!is_file($store . 'places.geojson')) {
    throw new RuntimeException("the store $store is not there: open the map once, or enable the extension");
}
$n = $t->import($store, 'seed: store/ahm_map', 2);
$lists = $t->lists();
$topic_of = [];
$series_topic = [];
$cards = 0;
foreach (['place', 'shape', 'layer'] as $kind) {
    foreach ($t->objects($kind) as $o) {
        $series = $o['data']['series'] ?? null;
        if ($series !== null && isset($series_topic[$series])) {
            $topic = $series_topic[$series];   // a version of a series shares the topic of the first one (T-041)
        } else {
            $names = $o['data']['names'];
            $row = $post('post', $forum[$kind], 0, mb_substr(sql_transfer::label($names), 0, 255), card::text(['kind' => $kind] + $o, $lists), 1);
            $topic = (int) $row['topic_id'];
            $cards++;
            if ($series !== null) {
                $series_topic[$series] = $topic;
            }
        }
        $t->set_topic($o['id'], $topic);
        $topic_of[$o['id']] = [$topic, $forum[$kind]];
    }
}
$notes = 0;
$skipped = 0;
foreach (sql_transfer::read_notes($store) as $note) {
    if (!isset($topic_of[$note['owner']])) {
        $skipped++;
        continue;
    }
    list($topic, $fid) = $topic_of[$note['owner']];
    $row = $post('reply', $fid, $topic, mb_substr($note['title'], 0, 255), $note['text']);
    $t->add_note_meta((int) $row['post_id'], sql_transfer::note_meta($note));
    $notes++;
}
echo "seeded: {$n['places']} places, {$n['shapes']} shapes, {$n['layers']} layers, {$n['lists']} list entries, $cards topics with a card, $notes notes as posts" . ($skipped ? ", $skipped notes skipped (no such object)" : '') . "\n";
