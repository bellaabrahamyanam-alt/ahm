<?php
namespace ahm\map\service;

/**
 * The text of the first post of a topic, the "card" (T-079): all names with their languages and periods, the type, the dates, the place,
 * the sources. BBCode, made from the data of the object alone, so it is the same every time; the extension rewrites it when the object changes.
 */
class card
{
    private static $months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    /** A value as plain text: no square bracket can start a BBCode tag. */
    private static function plain($s)
    {
        return str_replace('[', "[\u{200B}", trim((string) $s));
    }

    private static function ordinal($n)
    {
        return $n . ($n % 100 >= 11 && $n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][$n % 10 > 3 ? 0 : $n % 10]);
    }

    private static function one($fmt, $ts)
    {
        $sec = dates::iso_to_sec($ts);
        list($a, $m, $d) = dates::civil_from_days((int) floor($sec / 86400));
        $bce = $a < 1;
        $y = $bce ? 1 - $a : $a;
        $k = $fmt === 'm' ? 1000 : 100;
        $n = $bce ? (int) floor(-$a / $k) + 1 : (int) floor(($a - 1) / $k) + 1;
        $y4 = str_pad((string) $y, 4, '0', STR_PAD_LEFT);
        $p2 = function ($v) {
            return str_pad((string) $v, 2, '0', STR_PAD_LEFT);
        };
        if ($fmt === 'ymd') {
            $s = "$y4-{$p2($m)}-{$p2($d)}";
        } elseif ($fmt === 'dmy') {
            $s = "{$p2($d)}.{$p2($m)}.$y4";
        } elseif ($fmt === 'mdy') {
            $s = "{$p2($m)}/{$p2($d)}/$y4";
        } elseif ($fmt === 'dmony') {
            $s = $d . ' ' . self::$months[$m - 1] . ' ' . $y;
        } elseif ($fmt === 'mony') {
            $s = self::$months[$m - 1] . ' ' . $y;
        } elseif ($fmt === 'y') {
            $s = (string) $y;
        } else {
            $s = self::ordinal($n) . ' ' . ($fmt === 'c' ? 'century' : 'millennium');
        }
        return $s . ($bce ? ' BCE' : '');
    }

    /** "21.03.1500", "c. 800 BCE", "12th century BCE – 10th century BCE" (the same as the sidebar shows it). */
    public static function date_text($d)
    {
        if (!$d) {
            return '';
        }
        if ($d['mode'] === 'range') {
            return self::one($d['fmt'], $d['ts']) . ' – ' . self::one($d['fmt'], $d['ts_to']);
        }
        return ($d['mode'] === 'approx' ? 'c. ' : '') . self::one($d['fmt'], $d['ts']);
    }

    /** "c. 840 BCE – 590 BCE", "from 335", "until 1236", '' when both are unknown. */
    public static function span_text($from, $to)
    {
        if ($from && $to) {
            if ($from['mode'] === 'range' || $to['mode'] === 'range') {
                return 'from ' . self::date_text($from) . ' to ' . self::date_text($to);
            }
            return self::date_text($from) . ' – ' . self::date_text($to);
        }
        if ($from) {
            return 'from ' . self::date_text($from);
        }
        return $to ? 'until ' . self::date_text($to) : '';
    }

    /**
     * @param array $o     kind, type, lon, lat, data (decoded) of an object
     * @param array $lists list => [key => entry], as sql_transfer::lists() gives it (types, sources, categories are used)
     */
    public static function text(array $o, array $lists = [])
    {
        $d = $o['data'];
        $out = [];
        $out[] = "[b]Names[/b]\n[list]";
        foreach ($d['names'] ?? [] as $n) {
            $span = self::span_text($n['date_from'] ?? null, $n['date_to'] ?? null);
            $out[] = '[*]' . self::plain($n['lang']) . ': ' . self::plain($n['name']) . ($span !== '' ? ' (' . $span . ')' : '');
        }
        $out[] = '[/list]';
        foreach ($d['descriptions'] ?? [] as $x) {
            $out[] = '[b]Description[/b] (' . self::plain($x['lang']) . ")\n" . self::plain($x['text']);
        }
        if (!empty($o['type'])) {
            $t = $lists['types'][$o['type']]['names'] ?? [];
            $out[] = '[b]Type:[/b] ' . self::plain(sql_transfer::label($t) ?: $o['type']);
        }
        if (!empty($d['category']) && isset($lists['categories'][$d['category']])) {
            $out[] = '[b]Category:[/b] ' . self::plain(sql_transfer::label($lists['categories'][$d['category']]['names']));
        }
        $span = self::span_text($d['date_from'] ?? null, $d['date_to'] ?? null);
        if ($span !== '') {
            $out[] = '[b]Period:[/b] ' . $span;
        }
        if ($o['kind'] === 'place') {
            $out[] = '[b]Location:[/b] ' . self::coord($o['lat']) . ', ' . self::coord($o['lon']);
            if (isset($d['height_m'])) {
                $out[] = '[b]Height:[/b] ' . (float) $d['height_m'] . ' m';
            }
            if (isset($d['radius_m'])) {
                $out[] = '[b]Radius:[/b] ' . (float) $d['radius_m'] . ' m';
            }
        }
        if (isset($d['certainty'])) {
            $out[] = '[b]Certainty:[/b] ' . self::plain(is_scalar($d['certainty']) ? $d['certainty'] : json_encode($d['certainty']));
        }
        if (!empty($d['sources'])) {
            $out[] = "[b]Sources[/b]\n[list]";
            foreach ($d['sources'] as $id) {
                $s = $lists['sources'][$id] ?? null;
                $out[] = '[*]' . ($s ? self::plain($s['title']) . (!empty($s['url']) ? ' (' . self::plain($s['url']) . ')' : '') : self::plain($id));
            }
            $out[] = '[/list]';
        }
        return implode("\n", $out);
    }

    private static function coord($v)
    {
        return rtrim(rtrim(number_format((float) $v, 6, '.', ''), '0'), '.');
    }
}
