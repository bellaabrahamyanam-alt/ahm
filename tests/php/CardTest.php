<?php
namespace ahm\map\tests;

use ahm\map\service\card;
use ahm\map\service\pdo_driver;
use ahm\map\service\sql_transfer;

require_once dirname(__DIR__, 2) . '/service/sql_driver.php';
require_once dirname(__DIR__, 2) . '/service/pdo_driver.php';
require_once dirname(__DIR__, 2) . '/service/sql_transfer.php';
require_once dirname(__DIR__, 2) . '/service/card.php';

test('card: a date is written as the sidebar writes it', function () {
    $y = ['fmt' => 'y', 'ts' => '-000799-01-01T00:00:00Z', 'mode' => 'approx', 'ts_to' => null];
    same('c. 800 BCE', card::date_text($y));
    same('1500', card::date_text(['fmt' => 'y', 'ts' => '1500-01-01T00:00:00Z', 'mode' => 'exact', 'ts_to' => null]));
    same('21.03.1500', card::date_text(['fmt' => 'dmy', 'ts' => '1500-03-21T00:00:00Z', 'mode' => 'exact', 'ts_to' => null]));
    same('9th century BCE – 8th century BCE', card::date_text(['fmt' => 'c', 'ts' => '-000899-01-01T00:00:00Z', 'mode' => 'range', 'ts_to' => '-000799-01-01T00:00:00Z']));
    same('', card::date_text(null));
    same('from c. 800 BCE', card::span_text($y, null));
    same('until c. 800 BCE', card::span_text(null, $y));
    same('c. 800 BCE – 1500', card::span_text($y, ['fmt' => 'y', 'ts' => '1500-01-01T00:00:00Z', 'mode' => 'exact', 'ts_to' => null]));
});

test('card: it lists every name of a place with its language, in the order of the data, and the type and the place', function () {
    list($t) = round_trip(false);
    $lists = $t->lists();
    $two = null;
    foreach ($t->objects('place') as $o) {
        if (count(array_filter($o['data']['names'], function ($n) {
            return $n['lang'] === 'hy';
        })) > 1) {
            $two = $o;
            break;
        }
    }
    ok($two !== null);
    $text = card::text(['kind' => 'place', 'type' => $two['type'], 'lon' => $two['lon'], 'lat' => $two['lat'], 'data' => $two['data']], $lists);
    $at = -1;
    foreach ($two['data']['names'] as $n) {
        $line = '[*]' . $n['lang'] . ': ' . $n['name'];
        $p = strpos($text, $line);
        ok($p !== false && $p > $at, "name in order: $line");
        $at = $p;
    }
    ok(strpos($text, '[b]Type:[/b] ') !== false && strpos($text, '[b]Location:[/b] ') !== false);
    same($text, card::text(['kind' => 'place', 'type' => $two['type'], 'lon' => $two['lon'], 'lat' => $two['lat'], 'data' => $two['data']], $lists), 'the same data gives the same text');
});

test('card: the period of a name, the height and the sources are in the text; a square bracket in a value cannot make a tag', function () {
    $o = ['kind' => 'place', 'type' => 'city', 'lon' => 44.5, 'lat' => 40.125, 'data' => [
        'names' => [['lang' => 'en', 'name' => 'Old [b]name[/b]', 'date_from' => ['fmt' => 'y', 'ts' => '-000799-01-01T00:00:00Z', 'mode' => 'approx', 'ts_to' => null], 'date_to' => null], ['lang' => 'ru', 'name' => 'Имя']],
        'height_m' => 1850, 'sources' => ['s1', 'missing'], 'date_from' => null, 'date_to' => null]];
    $text = card::text($o, ['sources' => ['s1' => ['title' => 'A book', 'url' => 'https://example.org/b']], 'types' => ['city' => ['names' => [['lang' => 'en', 'name' => 'City']]]]]);
    ok(strpos($text, '(from c. 800 BCE)') !== false, $text);
    ok(strpos($text, '[b]Height:[/b] 1850 m') !== false);
    ok(strpos($text, '[b]Type:[/b] City') !== false);
    ok(strpos($text, '[b]Location:[/b] 40.125, 44.5') !== false);
    ok(strpos($text, '[*]A book (https://example.org/b)') !== false && strpos($text, '[*]missing') !== false);
    ok(strpos($text, 'Old [b]name') === false && strpos($text, "Old [\u{200B}b]name") !== false, 'the tag is broken by a zero-width space');
});
