<?php
namespace ahm\map\tests;

use ahm\map\service\pdo_driver;
use ahm\map\service\sql_transfer;

require_once dirname(__DIR__, 2) . '/service/sql_driver.php';
require_once dirname(__DIR__, 2) . '/service/pdo_driver.php';
require_once dirname(__DIR__, 2) . '/service/sql_transfer.php';

/** The tables of one schema file: table => columns. */
function schema_tables($file)
{
    $sql = implode("\n", array_filter(file($file, FILE_IGNORE_NEW_LINES), function ($l) {
        return !preg_match('/^\s*--/', $l);
    }));
    $out = [];
    preg_match_all('/CREATE TABLE \{p\}(\w+) \((.*?)\n\)/s', $sql, $m, PREG_SET_ORDER);
    foreach ($m as $t) {
        $cols = [];
        foreach (explode("\n", $t[2]) as $line) {
            if (preg_match('/^\s+(\w+) /', $line, $c) && !in_array($c[1], ['PRIMARY', 'KEY', 'UNIQUE', 'INDEX'], true)) {
                $cols[] = $c[1];
            }
        }
        $out[$t[1]] = $cols;
    }
    return $out;
}

function need_pdo($driver)
{
    if (!extension_loaded('pdo_' . $driver)) {
        throw new Failure("PHP needs the extension pdo_$driver for this test (apt install php-$driver)");
    }
}

test('sql schema: the MySQL file and the SQLite file make the same five tables with the same columns', function () {
    $dir = dirname(__DIR__, 2) . '/service/sql/';
    $my = schema_tables($dir . 'schema.mysql.sql');
    $lite = schema_tables($dir . 'schema.sqlite.sql');
    same(sql_transfer::TABLES, array_keys($my));
    same($my, $lite, 'the two schema files must not drift apart');
    ok(in_array('data', $my['ahm_objects'], true) && in_array('snapshot', $my['ahm_revisions'], true));
});

test('sql schema: statements() puts the table prefix in and splits at the semicolons', function () {
    $st = sql_transfer::statements(dirname(__DIR__, 2) . '/service/sql/schema.sqlite.sql', 'phpbb_');
    ok(count($st) >= 5);
    ok(strpos($st[0], 'CREATE TABLE phpbb_ahm_objects') === 0, $st[0]);
    foreach ($st as $s) {
        ok(strpos($s, '{p}') === false && strpos($s, ';') === false, $s);
    }
});

test('sql schema: a driver other than SQLite or MySQL is refused with a clear message', function () {
    throws('/SQLite or MySQL/', function () {
        sql_transfer::schema_file('postgres');
    });
    same(true, is_file(sql_transfer::schema_file('mysqli')) && is_file(sql_transfer::schema_file('sqlite3')));
});

test('sql schema: on SQLite the tables are made and a column `data` that is not JSON is refused', function () {
    need_pdo('sqlite');
    $db = new \PDO('sqlite::memory:');
    (new sql_transfer(new pdo_driver($db)))->create_schema();
    $names = $db->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ahm_%' ORDER BY name")->fetchAll(\PDO::FETCH_COLUMN);
    same(['ahm_imports', 'ahm_lists', 'ahm_note_meta', 'ahm_objects', 'ahm_revisions'], $names);
    $db->exec("INSERT INTO ahm_note_meta (post_id, data) VALUES (1, '{\"lang\":\"en\"}')");
    $refused = false;
    try {
        $db->exec("INSERT INTO ahm_note_meta (post_id, data) VALUES (2, '{bad')");
    } catch (\PDOException $e) {
        $refused = (bool) preg_match('/CHECK|constraint/i', $e->getMessage());
    }
    ok($refused, 'the database refuses a text that is not JSON');
    (new sql_transfer(new pdo_driver($db)))->drop_schema();
    same(0, (int) $db->query("SELECT COUNT(*) FROM sqlite_master WHERE name LIKE 'ahm_%'")->fetchColumn());
});
