<?php
/** A very small test harness: test(), assertions, and a sandbox copy of the sample data. */
namespace ahm\map\tests;

$root = dirname(__DIR__, 2);
require_once $root . '/service/dates.php';
require_once $root . '/service/store.php';
foreach (['sql_driver', 'pdo_driver', 'sql_transfer', 'card', 'post_gateway', 'memory_gateway', 'sql_repository'] as $f) {
    require_once $root . "/service/$f.php";
}

use ahm\map\service\file_repository;
use ahm\map\service\memory_gateway;
use ahm\map\service\pdo_driver;
use ahm\map\service\sql_repository;
use ahm\map\service\sql_transfer;
use ahm\map\service\store;

class Failure extends \Exception
{
}

/** Thrown by a test that is about the files themselves when it runs on the tables: it is not counted. */
class Skip extends \Exception
{
}

class Ctx
{
    public static $tests = [];
    public static $dirs = [];
    public static $asserts = 0;
    public static $file = '';
    /** 'file' or 'sql': every test that uses fresh_store() runs on both repositories */
    public static $mode = 'file';
    public static $fresh = false;
    /** sandbox dir => [repository, driver, store] of a store that lives in an SQLite database (the dir is only a mirror, see sync()) */
    public static $sql = [];
}

function files_mode()
{
    return Ctx::$mode === 'file';
}

function skip_unless_files()
{
    if (!files_mode()) {
        throw new Skip();
    }
}

/** Runs $fn only when the data is in files (archive folders, index files and the like have no meaning in the tables). */
function files_only(callable $fn)
{
    if (files_mode()) {
        $fn();
    }
}

/** Registers a test. Tests of one file run in order; each should create its own sandbox. */
function test($name, callable $fn)
{
    Ctx::$tests[] = [basename(debug_backtrace()[0]['file'], '.php') . ': ' . $name, $fn];
}

function ok($cond, $msg = '')
{
    Ctx::$asserts++;
    if (!$cond) {
        $at = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1)[0];
        throw new Failure(($msg ?: 'expected true') . ' (' . basename($at['file']) . ':' . $at['line'] . ')');
    }
}

/** The same data with the keys of objects in one order (a JSON column of MySQL keeps its own); lists keep their order. */
function sorted_keys($v)
{
    if (!is_array($v)) {
        return $v;
    }
    $list = $v === [] || array_keys($v) === range(0, count($v) - 1);
    $v = array_map(__NAMESPACE__ . '\\sorted_keys', $v);
    if (!$list) {
        ksort($v);
    }
    return $v;
}

function same($expected, $actual, $msg = '')
{
    Ctx::$asserts++;
    if (sorted_keys($expected) !== sorted_keys($actual)) {
        throw new Failure(($msg ? "$msg\n" : '') . '  expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) .
            "\n  actual:   " . json_encode($actual, JSON_UNESCAPED_UNICODE));
    }
}

/** $fn must throw \InvalidArgumentException whose message matches $regex. */
function throws($regex, callable $fn, $msg = '')
{
    Ctx::$asserts++;
    try {
        $fn();
    } catch (\InvalidArgumentException $e) {
        if (!preg_match($regex, $e->getMessage())) {
            throw new Failure(($msg ? "$msg\n" : '') . "  wrong message: {$e->getMessage()} (wanted $regex)");
        }
        return;
    }
    throw new Failure(($msg ? "$msg\n" : '') . "  no error, wanted $regex");
}

/** A temporary copy of the sample data (data/); removed after the test. */
function sandbox($copySample = true)
{
    $dir = sys_get_temp_dir() . '/ahm_test_' . getmypid() . '_' . count(Ctx::$dirs);
    mkdir($dir, 0775, true);
    if ($copySample) {
        exec('cp -r ' . escapeshellarg(dirname(__DIR__, 2) . '/data') . '/. ' . escapeshellarg($dir));
    }
    Ctx::$dirs[] = $dir;
    return $dir;
}

/** A store on files whatever the mode is (the tests of the SQL transfer start from the files of the sample). */
function file_store(&$dir = null)
{
    $dir = sandbox();
    $s = new store($dir);
    $s->migrate();
    return $s;
}

/**
 * A store on a sandbox with the sample data already migrated to the current format: in files, or in an SQLite database in memory with the
 * posts of a memory_gateway (then the sandbox holds only the pictures; sync() writes what the tables hold as files for the assertions).
 */
function fresh_store(&$dir = null)
{
    Ctx::$fresh = true;
    $dir = sandbox();
    $s = new store($dir);
    $s->migrate();
    if (files_mode()) {
        return $s;
    }
    if (Ctx::$mode === 'mysql') {
        $drv = new pdo_driver(new \PDO(getenv('AHM_TEST_MYSQL_DSN'), (string) getenv('AHM_TEST_MYSQL_USER'), (string) getenv('AHM_TEST_MYSQL_PASS')), 'tst_');
    } else {
        $drv = new pdo_driver(new \PDO('sqlite::memory:'));
    }
    $t = new sql_transfer($drv);
    $t->drop_schema();
    $t->create_schema();
    $t->import($dir, 'test');
    $repo = new sql_repository($drv, new memory_gateway(), 2);
    $repo->ensure_topics();
    foreach (sql_transfer::read_notes($dir) as $n) {
        $repo->put_note(['owner' => $n['owner'], 'kind' => $n['kind'], 'id' => $n['uuid']] + $n);
    }
    $sql = new store($dir, $repo);
    Ctx::$sql[$dir] = [$repo, $drv, $sql];
    return $sql;
}

/** Writes what the tables of a sandbox hold as the files of a store, so that a test can read them like the files of a file store. */
function sync($dir)
{
    if (!isset(Ctx::$sql[$dir])) {
        return;
    }
    list($repo, , $store) = Ctx::$sql[$dir];
    foreach (file_repository::DOCS as $name => $def) {
        $d = $repo->doc($name);
        if ($d === null) {
            @unlink("$dir/{$def[0]}");
        } else {
            file_put_contents("$dir/{$def[0]}", json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }
    }
    rrmdir("$dir/notes");
    rrmdir("$dir/layer-notes");
    $notes = [];
    foreach ($repo->notes() as $n) {
        $notes[] = $n + ['uuid' => $n['id']];
    }
    sql_transfer::write_notes($dir, $notes);
    @mkdir("$dir/notes");
    @mkdir("$dir/layer-notes");
    file_put_contents("$dir/notes/index.json", json_encode($store->notes_index()));
    file_put_contents("$dir/layer-notes/index.json", json_encode($store->layer_notes_index()));
}

/** The text of a file of a sandbox (after sync() when the data is in tables). */
function raw($path)
{
    foreach (Ctx::$sql as $d => $_) {
        if (strpos($path, $d . '/') === 0) {
            sync($d);
        }
    }
    return file_get_contents($path);
}

/** Forgets a document of a store (a test of the first start): deletes the file, or the rows of the list. */
function drop_doc($dir, $name)
{
    if (isset(Ctx::$sql[$dir])) {
        Ctx::$sql[$dir][1]->exec('DELETE FROM ' . Ctx::$sql[$dir][1]->prefix() . 'ahm_lists WHERE list = ?', [$name]);
    } else {
        @unlink("$dir/{$name}.json");
    }
}

function json_file($path)
{
    return json_decode(raw($path), true);
}

/** ids of all places in a sandbox, in file order */
function place_ids($dir)
{
    return array_map(function ($f) {
        return $f['properties']['id'];
    }, json_file("$dir/places.geojson")['features']);
}

function note_index($dir)
{
    return json_file("$dir/notes/index.json")['notes'];
}

function find_by($list, $key, $value)
{
    foreach ($list as $x) {
        if (($x[$key] ?? null) === $value) {
            return $x;
        }
    }
    return null;
}

function rrmdir($d)
{
    exec('rm -rf ' . escapeshellarg($d));
}

function run($filter = '')
{
    $pass = $fail = 0;
    $t0 = microtime(true);
    // 'sql': SQLite in memory; 'mysql' too when AHM_TEST_MYSQL_DSN (and _USER, _PASS) say where
    foreach (array_merge(['file', 'sql'], getenv('AHM_TEST_MYSQL_DSN') ? ['mysql'] : []) as $mode) {
        Ctx::$mode = $mode;
        foreach (Ctx::$tests as [$name, $fn]) {
            if ($filter !== '' && stripos($name, $filter) === false) {
                continue;
            }
            Ctx::$fresh = false;
            $label = $mode === 'file' ? $name : "$name [$mode]";
            try {
                $fn();
                if ($mode !== 'file' && !Ctx::$fresh) {
                    $label = null;   // a test of the files themselves (it did not ask for a fresh store): it ran once already
                } else {
                    $pass++;
                    echo "  ok   $label\n";
                }
            } catch (Skip $e) {
                $label = null;
            } catch (\Throwable $e) {
                if ($mode !== 'file' && !Ctx::$fresh) {
                    $label = null;
                } else {
                    $fail++;
                    echo "  FAIL $label\n    " . str_replace("\n", "\n    ", $e->getMessage()) . "\n";
                    if (!($e instanceof Failure)) {
                        echo '    at ' . basename($e->getFile()) . ':' . $e->getLine() . "\n";
                    }
                }
            }
            foreach (Ctx::$dirs as $d) {
                rrmdir($d);
            }
            clearstatcache(); // the next sandbox may reuse a path
            Ctx::$dirs = [];
            Ctx::$sql = [];
        }
    }
    printf("\n%d passed, %d failed, %d assertions, %.1fs\n", $pass, $fail, Ctx::$asserts, microtime(true) - $t0);
    return $fail === 0;
}
