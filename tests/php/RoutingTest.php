<?php
namespace ahm\map\tests;

use ahm\map\service\store;

function routes()
{
    $yml = file_get_contents(dirname(__DIR__, 2) . '/config/routing.yml');
    $out = [];
    foreach (preg_split('/\n(?=\S)/', trim($yml)) as $block) {
        if (!preg_match('/^(\w+):/', $block, $n)) {
            continue;
        }
        preg_match('/path:\s*(\S+)/', $block, $p);
        preg_match('/_controller:\s*([\w.]+):(\w+)/', $block, $c);
        preg_match('/methods:\s*\[(\w+)\]/', $block, $m);
        $out[$n[1]] = ['path' => $p[1] ?? '', 'service' => $c[1] ?? '', 'method' => $c[2] ?? '', 'http' => $m[1] ?? 'GET', 'block' => $block];
    }
    return $out;
}

test('routing: every route points at a public controller method', function () {
    $routes = routes();
    ok(count($routes) >= 12, 'expected 12 routes, found ' . count($routes));
    $class = new \ReflectionClass(\ahm\map\controller\main::class);
    foreach ($routes as $name => $r) {
        ok($class->hasMethod($r['method']) && $class->getMethod($r['method'])->isPublic(), "$name -> {$r['method']}");
        same('ahm.map.controller', $r['service'], $name);
    }
});

test('routing: every write route is POST only, every read route is GET', function () {
    foreach (routes() as $name => $r) {
        $write = preg_match('/save|delete|upload/', $name);
        same($write ? 'POST' : 'GET', $r['http'], $name);
    }
});

test('routing: paths are unique and below /map', function () {
    $paths = array_column(routes(), 'path');
    same(count($paths), count(array_unique($paths)));
    foreach ($paths as $p) {
        ok(strpos($p, '/map') === 0, $p);
    }
});

test('routing: the data route offers exactly the lists the controller serves', function () {
    preg_match("/f:\s*'([^']+)'/", file_get_contents(dirname(__DIR__, 2) . '/config/routing.yml'), $m);
    $offered = explode('|', $m[1]);
    sort($offered);
    same(['categories', 'languages', 'layer-notes-index', 'layers', 'notes-index', 'overlays', 'places', 'shapes', 'sources', 'types'], $offered);
});

test('routing: id requirements accept UUIDs only (the same rule as the store)', function () {
    $yml = file_get_contents(dirname(__DIR__, 2) . '/config/routing.yml');
    ok(strpos($yml, "[0-9a-f-]{36}") !== false);
    ok(preg_match(store::UUID, '8ae77c2d-6563-59e6-a340-b0c9dab9e3c0') === 1);
    ok(preg_match(store::UUID, '../../etc/passwd') === 0);
});

test('config: services.yml wires the controller with its arguments; every PHP file lints', function () {
    $root = dirname(__DIR__, 2);
    ok(strpos(file_get_contents("$root/config/services.yml"), 'ahm.map.controller') !== false);
    foreach (array_merge(glob("$root/*.php"), glob("$root/*/*.php")) as $f) {
        if (strpos($f, '/tests/') !== false) {
            continue;
        }
        exec('php -l ' . escapeshellarg($f) . ' 2>&1', $out, $code);
        same(0, $code, "php -l $f");
    }
});
