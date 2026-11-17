<?php
/**
 * Controller tests WITHOUT phpBB: the few phpBB classes it uses are replaced by tiny stand-ins (below).
 * They check permissions, status codes and the JSON the controller returns. They do not prove it works inside a live forum.
 */
namespace Symfony\Component\HttpFoundation {
    class Response
    {
        public $content;
        public $status;
        public $headers;
        public function __construct($c = '', $s = 200, $h = [])
        {
            $this->content = $c;
            $this->status = $s;
            $this->headers = $h;
        }
    }
    class JsonResponse extends Response
    {
        public function __construct($d = [], $s = 200)
        {
            parent::__construct(json_encode($d), $s, []);
        }
    }
}
namespace phpbb\auth {
    class auth
    {
        public $admin = false;
        public function acl_get($x)
        {
            return $x === 'a_' && $this->admin;
        }
    }
}
namespace phpbb\controller {
    class helper
    {
        public function route($n, $p = [], $abs = true)
        {
            $q = '';
            foreach ($p as $v) {
                $q .= "/$v";
            }
            return "/app.php/$n$q";
        }
    }
}
namespace phpbb\request {
    class request
    {
        public $ct = 'application/json';
        public function server($k, $d = '')
        {
            return $k === 'CONTENT_TYPE' ? $this->ct : $d;
        }
    }
}
namespace phpbb {
    class user
    {
        public $data = ['user_id' => 2];
    }
    class path_helper
    {
        public function get_web_root_path()
        {
            return './';
        }
    }
}
namespace {
    if (!defined('ANONYMOUS')) {
        define('ANONYMOUS', 1);
    }
    if (!function_exists('generate_board_url')) {
        function generate_board_url()
        {
            return 'https://forum.test';
        }
    }
}
namespace ahm\map\tests {
    require_once dirname(__DIR__, 2) . '/controller/main.php';

    class TestController extends \ahm\map\controller\main
    {
        public $body = '';
        protected function read_body()
        {
            return $this->body;
        }
    }

    /** A controller for a visitor: $uid 1 = guest, $admin = phpBB administrator, $editors = 'members' | 'admins'. */
    function visitor($root, $editors, $uid, $admin, $contentType = 'application/json')
    {
        $a = new \phpbb\auth\auth();
        $a->admin = $admin;
        $r = new \phpbb\request\request();
        $r->ct = $contentType;
        $u = new \phpbb\user();
        $u->data['user_id'] = $uid;
        return new TestController($a, new \phpbb\controller\helper(), $r, $u, new \phpbb\path_helper(), $root, $editors);
    }

    /** a phpBB-like root with a store/ahm_map/ copy of the sample data */
    function forum_root()
    {
        $root = sandbox(false) . '/';
        mkdir($root . 'store/ahm_map', 0775, true);
        exec('cp -r ' . escapeshellarg(dirname(__DIR__, 2) . '/data') . '/. ' . escapeshellarg($root . 'store/ahm_map'));
        (new \ahm\map\service\store($root . 'store/ahm_map/'))->migrate();
        return $root;
    }

    function call($c, $method, $body = null)
    {
        $c->body = is_string($body) ? $body : json_encode($body);
        return $c->$method();
    }

    function status($r)
    {
        return $r->status;
    }

    $LAYER = ['layer' => ['names' => [['lang' => 'en', 'name' => 'X']]]];
    $PLACE = ['place' => ['lat' => 40, 'lon' => 44, 'type' => 'village', 'names' => [['lang' => 'en', 'name' => 'Newville']]]];

    // ---- who may write (editors = members) ----
    test('save: guest 401, member 200 (editors=members), member 403 (editors=admins), admin 200', function () use ($PLACE) {
        $root = forum_root();
        same(401, status(call(visitor($root, 'members', ANONYMOUS, false), 'save', $PLACE)));
        same(200, status(call(visitor($root, 'members', 5, false), 'save', $PLACE)));
        same(403, status(call(visitor($root, 'admins', 5, false), 'save', $PLACE)));
        same(200, status(call(visitor($root, 'admins', 2, true), 'save', $PLACE)));
    });

    test('source_save (T-046): guest 401, member 200 (editors=members), member 403 (editors=admins); a title is required (400)', function () {
        $root = forum_root();
        $src = ['title' => 'Strabo, Geography', 'citation' => 'book 11'];
        same(401, status(call(visitor($root, 'members', ANONYMOUS, false), 'source_save', $src)));
        same(200, status(call(visitor($root, 'members', 5, false), 'source_save', $src)));
        same(403, status(call(visitor($root, 'admins', 5, false), 'source_save', $src)));
        same(400, status(call(visitor($root, 'members', 5, false), 'source_save', ['title' => ''])));
        same(415, status(call(visitor($root, 'members', 5, false, 'text/plain'), 'source_save', $src)));
    });

    test('write routes: a form post (not JSON) is refused with 415, a broken body with 400', function () use ($PLACE, $LAYER) {
        $root = forum_root();
        foreach (['save' => $PLACE, 'layer_save' => $LAYER] as $m => $body) {
            same(415, status(call(visitor($root, 'members', 5, false, 'text/plain'), $m, $body)), "$m content type");
            same(400, status(call(visitor($root, 'members', 5, false), $m, 'garbage')), "$m body");
        }
    });

    test('save: a validation error is 400 with the readable message', function () {
        $root = forum_root();
        $r = call(visitor($root, 'members', 5, false), 'save', ['place' => ['lat' => 999, 'lon' => 0, 'type' => 'village', 'names' => []]]);
        same(400, status($r));
        ok(strpos($r->content, 'bad coordinates') !== false);
    });

    test('save: answers {ok, id} for the new place', function () use ($PLACE) {
        $r = call(visitor(forum_root(), 'members', 5, false), 'save', $PLACE);
        $j = json_decode($r->content, true);
        same(true, $j['ok']);
        ok(preg_match('/^[0-9a-f-]{36}$/', $j['id']));
    });

    // ---- layers ----
    test('layer_save: guest 401, member 403 when editors=admins, member OK, bad input 400', function () use ($LAYER) {
        $root = forum_root();
        same(401, status(call(visitor($root, 'members', ANONYMOUS, false), 'layer_save', $LAYER)));
        same(403, status(call(visitor($root, 'admins', 5, false), 'layer_save', $LAYER)));
        $r = call(visitor($root, 'members', 5, false), 'layer_save', ['layer' => ['names' => []]]);
        same(400, status($r));
        ok(strpos($r->content, 'at least one name') !== false);
        $r = call(visitor($root, 'members', 5, false), 'layer_save', $LAYER);
        same(200, status($r));
        ok(preg_match('/^[0-9a-f-]{36}$/', json_decode($r->content, true)['id']));
    });

    test('layer_delete: administrators only; deleting twice is 400', function () use ($LAYER) {
        $root = forum_root();
        $id = json_decode(call(visitor($root, 'members', 5, false), 'layer_save', $LAYER)->content, true)['id'];
        same(401, status(call(visitor($root, 'members', ANONYMOUS, false), 'layer_delete', ['id' => $id])));
        same(403, status(call(visitor($root, 'members', 5, false), 'layer_delete', ['id' => $id])));
        $r = call(visitor($root, 'members', 2, true), 'layer_delete', ['id' => $id]);
        same(200, status($r));
        same(true, json_decode($r->content, true)['ok']);
        same(400, status(call(visitor($root, 'members', 2, true), 'layer_delete', ['id' => $id])));
    });

    test('category_save and language_save: administrators only', function () {
        $root = forum_root();
        $cat = ['names' => [['lang' => 'en', 'name' => 'Z']]];
        $lang = ['code' => 'xcl', 'name' => 'Classical Armenian'];
        same(403, status(call(visitor($root, 'members', 5, false), 'category_save', $cat)));
        same(403, status(call(visitor($root, 'members', 5, false), 'language_save', $lang)));
        same(401, status(call(visitor($root, 'members', ANONYMOUS, false), 'category_save', $cat)));
        same(400, status(call(visitor($root, 'members', 2, true), 'category_save', ['names' => []])));
        same(200, status(call(visitor($root, 'members', 2, true), 'category_save', $cat)));
        same(200, status(call(visitor($root, 'members', 2, true), 'language_save', $lang)));
        same(400, status(call(visitor($root, 'members', 2, true), 'language_save', $lang)), 'duplicate language');
    });

    test('type_save and type_delete: administrators only, 400 when a place still uses the type', function () {
        $root = forum_root();
        $type = ['geometry' => 'point', 'names' => [['lang' => 'en', 'name' => 'Iron mine']], 'color' => '#a0522d', 'style' => ['symbol' => 'pickaxe', 'size' => 9]];
        same(403, status(call(visitor($root, 'members', 5, false), 'type_save', $type)));
        same(401, status(call(visitor($root, 'members', ANONYMOUS, false), 'type_save', $type)));
        same(400, status(call(visitor($root, 'members', 2, true), 'type_save', ['geometry' => 'point'])));
        $r = call(visitor($root, 'members', 2, true), 'type_save', $type);
        same(200, status($r));
        same('iron-mine', json_decode($r->content, true)['code']);
        same(403, status(call(visitor($root, 'members', 5, false), 'type_delete', ['code' => 'iron-mine'])));
        same(400, status(call(visitor($root, 'members', 2, true), 'type_delete', ['code' => 'mountain'])));
        same(200, status(call(visitor($root, 'members', 2, true), 'type_delete', ['code' => 'iron-mine'])));
        same(400, status(call(visitor($root, 'members', 2, true), 'type_delete', ['code' => 'iron-mine'])), 'already gone');
    });

    test('overlay routes: administrators only', function () {
        $root = forum_root();
        $ov = ['title' => 'x', 'coordinates' => [[40, 41], [46, 41], [46, 37], [40, 37]]];
        same(403, status(call(visitor($root, 'members', 5, false), 'overlay_save', $ov)));
        same(200, status(call(visitor($root, 'members', 2, true), 'overlay_save', $ov)));
        same(403, status(call(visitor($root, 'members', 5, false), 'overlay_delete', ['id' => NIL])));
    });

    // ---- reading ----
    test('data: guests can read every list as JSON', function () {
        $c = visitor(forum_root(), 'members', ANONYMOUS, false);
        foreach (['places', 'notes-index', 'overlays', 'languages', 'layers', 'layer-notes-index', 'categories', 'types', 'sources'] as $f) {
            $r = $c->data($f);
            same(200, status($r), $f);
            ok(is_array(json_decode($r->content, true)), "$f is JSON");
        }
    });

    test('data: an unknown list name is 404', function () {
        same(404, status(visitor(forum_root(), 'members', 5, false)->data('passwd')));
    });

    test('note: serves a note body to guests; a bad or unknown id is 404', function () {
        $root = forum_root();
        $c = visitor($root, 'members', ANONYMOUS, false);
        $dir = $root . 'store/ahm_map';
        $n = note_index($dir)[0];
        same(200, status($c->note($n['place'], $n['id'])));
        same(404, status($c->note($n['place'], NIL)));
        ok(in_array(status($c->note('../..', 'x')), [400, 404], true), 'a path-like id is refused');
    });

    test('page: configuration has every URL and the right permission flags', function () {
        $root = forum_root();
        $html = visitor($root, 'members', 2, true)->page()->content;
        foreach (['"places"', '"notesIndex"', '"save"', '"languages"', '"languageSave"', '"layers"', '"layerSave"', '"layerDelete"', '"categories"',
            '"categorySave"', '"sources"', '"sourceSave"', '"layerNotesIndex"', '"canLayerAdmin":true', '"canEdit":true', '"types"', '"typeSave"', '"typeDelete"', '"canTypeAdmin":true'] as $k) {
            ok(strpos($html, $k) !== false, "admin page has $k");
        }
        $m = visitor($root, 'members', 5, false)->page()->content;
        ok(strpos($m, '"canLayerAdmin":false') !== false, 'member: no layer admin');
        ok(strpos($m, '"canTypeAdmin":false') !== false, 'member: no type admin');
        ok(strpos($m, '"canEdit":true') !== false, 'member can edit when editors=members');
        $g = visitor($root, 'members', ANONYMOUS, false)->page()->content;
        ok(strpos($g, '"canEdit":false') !== false, 'guest cannot edit');
        $a = visitor($root, 'admins', 5, false)->page()->content;
        ok(strpos($a, '"canEdit":false') !== false, 'editors=admins: a member cannot edit');
    });

    test('page: serves the minified bundle of app/dist, with the configuration before it and a cache-busting hash', function () {
        $html = visitor(forum_root(), 'members', 2, true)->page()->content;
        $m = json_decode(file_get_contents(__DIR__ . '/../../app/dist/manifest.json'), true);
        $v = substr($m['hash'], 0, 12);
        ok(preg_match('#<script>window\.AHM_BACKEND=\{.*?\};</script><script src="[^"]*ext/ahm/map/app/dist/app\.min\.js\?v=' . $v . '"></script>#s', $html) === 1, 'configuration, then the bundle');
        ok(preg_match('#<link rel="stylesheet" href="[^"]*ext/ahm/map/app/dist/app\.min\.css\?v=' . $v . '" />#', $html) === 1, 'the minified style');
        same(1, substr_count($html, 'app.min.js'));
        same(0, substr_count($html, 'js/config.js'));
        same(0, substr_count($html, 'js/sidebar/'));
        same(0, substr_count($html, 'css/base.css'));
        ok(strpos($html, 'maplibre-gl.js') !== false && strpos($html, 'maplibre-gl.css') !== false, 'the map library still comes from its CDN');
    });

    test('page: a manifest without its bundle files serves the sources (a partial copy must not break the page)', function () {
        $dist = __DIR__ . '/../../app/dist/';
        foreach (['app.min.js', 'app.min.css'] as $f) {
            rename($dist . $f, $dist . $f . '.hidden');
            try {
                $html = visitor(forum_root(), 'members', 2, true)->page()->content;
                same(0, substr_count($html, 'dist/app.min'), "$f missing: no link to the bundle");
                same(1, substr_count($html, 'js/config.js'), "$f missing: the sources are served");
                same(1, substr_count($html, 'css/base.css'), "$f missing: the sources are served");
            } finally {
                rename($dist . $f . '.hidden', $dist . $f);
            }
        }
    });
}
