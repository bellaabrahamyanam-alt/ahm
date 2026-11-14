<?php
namespace ahm\map\tests;

/** The same rule table as tests/js/parity.test.js: PHP store and Node dev server must agree on every case. */
function expand($body, $P, $L0, $C0)
{
    $s = json_encode($body, JSON_UNESCAPED_UNICODE);
    $s = preg_replace_callback('/@P(\d+)/', function ($m) use ($P) {
        return $P[(int) $m[1]];
    }, $s);
    return json_decode(str_replace(['@L0', '@C0'], [$L0, $C0], $s), true);
}

test('parity table: every case gets the verdict the table says (the Node dev server is checked against the same table)', function () {
    $table = json_file(dirname(__DIR__) . '/fixtures/rules.json')['cases'];
    $s = fresh_store($dir);
    $P = place_ids($dir);
    $L0 = $s->layers()['layers'][0]['id'];
    $C0 = $s->categories()['categories'][0]['id'];
    ok(count($table) >= 50, 'table has ' . count($table) . ' cases');
    foreach ($table as $c) {
        $body = expand($c['body'], $P, $L0, $C0);
        try {
            switch ($c['via']) {
                case 'save':
                    $s->save($body);
                    break;
                case 'layer':
                    $s->layer_save($body);
                    break;
                case 'category':
                    $s->save_category($body);
                    break;
                case 'language':
                    $s->save_language($body);
                    break;
                case 'type':
                    $s->save_type($body);
                    break;
                case 'shape':
                    $s->save_shape($body);
                    break;
            }
            $got = 'ok';
        } catch (\InvalidArgumentException $e) {
            $got = $e->getMessage();
        }
        if ($c['expect'] === 'ok') {
            same('ok', $got, $c['name']);
        } else {
            ok($got !== 'ok' && preg_match('/' . $c['expect'] . '/i', $got) === 1, "{$c['name']}: wanted /{$c['expect']}/, got " . $got);
        }
    }
});
