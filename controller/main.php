<?php
namespace ahm\map\controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class main
{
    protected $auth, $helper, $request, $user, $path_helper, $editors, $data, $store;

    public function __construct(
        \phpbb\auth\auth $auth,
        \phpbb\controller\helper $helper,
        \phpbb\request\request $request,
        \phpbb\user $user,
        \phpbb\path_helper $path_helper,
        $root_path,
        $editors
    ) {
        $this->auth = $auth;
        $this->helper = $helper;
        $this->request = $request;
        $this->user = $user;
        $this->path_helper = $path_helper;
        $this->editors = $editors;
        $this->data = $root_path . 'store/ahm_map/'; // live data: writable, outside the extension, survives upgrades
        $this->store = new \ahm\map\service\store($this->data);
    }

    private function anon()
    {
        return $this->user->data['user_id'] == ANONYMOUS;
    }

    /** Guests can only look. Logged-in members may edit when editors = 'members'; otherwise only administrators. */
    private function can_edit()
    {
        return !$this->anon() && ($this->editors === 'members' || $this->auth->acl_get('a_'));
    }

    /** Administrators only: historical map images and the dictionary of languages. */
    private function can_admin()
    {
        return !$this->anon() && $this->auth->acl_get('a_');
    }

    private function can_overlay()
    {
        return $this->can_admin();
    }

    private function json($d, $code = 200)
    {
        return new JsonResponse($d, $code);
    }

    protected function read_body()
    {
        return file_get_contents('php://input');
    }

    /** The map page: the same app/index.html used by browser-sync, with asset and data URLs filled in. */
    public function page()
    {
        // Relative to the current URL, like phpBB's own assets, so it works whatever 'Server URL settings' say.
        $ext = $this->path_helper->get_web_root_path() . 'ext/ahm/map/app/';
        $p = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        $n = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        $cfg = [
            'places' => $this->helper->route('ahm_map_data', ['f' => 'places'], false),
            'notesIndex' => $this->helper->route('ahm_map_data', ['f' => 'notes-index'], false),
            'note' => str_replace(
                [$p, $n],
                ['{place}', '{id}'],
                $this->helper->route('ahm_map_note', ['place' => $p, 'id' => $n], false)
            ),
            'save' => $this->helper->route('ahm_map_save', [], false),
            'canEdit' => $this->can_edit(),
            'loggedIn' => !$this->anon(),
            'loginUrl' => generate_board_url() . '/ucp.php?mode=login'
        ];
        $o = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        $cfg += [
            'overlays' => $this->helper->route('ahm_map_data', ['f' => 'overlays'], false),
            'overlayImage' => str_replace(
                $o,
                '{id}',
                $this->helper->route('ahm_map_overlay_image', ['id' => $o], false)
            ),
            'overlaySave' => $this->helper->route('ahm_map_overlay_save', [], false),
            'overlayUpload' => str_replace(
                $o,
                '{id}',
                $this->helper->route('ahm_map_overlay_upload', ['id' => $o], false)
            ),
            'overlayDelete' => $this->helper->route('ahm_map_overlay_delete', [], false),
            'canOverlay' => $this->can_overlay(),
            'languages' => $this->helper->route('ahm_map_data', ['f' => 'languages'], false),
            'languageSave' => $this->helper->route('ahm_map_language_save', [], false),
            'canLanguage' => $this->can_admin(),
            'types' => $this->helper->route('ahm_map_data', ['f' => 'types'], false),
            'typeSave' => $this->helper->route('ahm_map_type_save', [], false),
            'typeDelete' => $this->helper->route('ahm_map_type_delete', [], false),
            'canTypeAdmin' => $this->can_admin(), // add, change and remove place types
            'layers' => $this->helper->route('ahm_map_data', ['f' => 'layers'], false),
            'layerNotesIndex' => $this->helper->route('ahm_map_data', ['f' => 'layer-notes-index'], false),
            'categories' => $this->helper->route('ahm_map_data', ['f' => 'categories'], false),
            'layerSave' => $this->helper->route('ahm_map_layer_save', [], false),
            'layerDelete' => $this->helper->route('ahm_map_layer_delete', [], false),
            'categorySave' => $this->helper->route('ahm_map_category_save', [], false),
            'canLayerAdmin' => $this->can_admin(), // delete layers, manage categories
            'sources' => $this->helper->route('ahm_map_data', ['f' => 'sources'], false),
            'sourceSave' => $this->helper->route('ahm_map_source_save', [], false),
            'shapes' => $this->helper->route('ahm_map_data', ['f' => 'shapes'], false),
            'shapeSave' => $this->helper->route('ahm_map_shape_save', [], false),
            'shapeDelete' => $this->helper->route('ahm_map_shape_delete', [], false)
        ];
        $html = file_get_contents(__DIR__ . '/../app/index.html');
        // Production: the committed bundle app/dist (tools/build.js, minified JS and CSS) replaces the marked blocks of
        // index.html; ?v= is the build hash, so a new build is fetched at once and an old one stays cached. No bundle: the sources.
        $first = 'js/config.js';
        $dist = @file_get_contents(__DIR__ . '/../app/dist/manifest.json');
        $m = $dist === false ? null : json_decode($dist, true);
        if (
            is_array($m) && isset($m['hash']) && preg_match('/^[0-9a-f]{64}$/', $m['hash'])
            && is_file(__DIR__ . '/../app/dist/app.min.js') && is_file(__DIR__ . '/../app/dist/app.min.css')
        ) {
            $v = '?v=' . substr($m['hash'], 0, 12);
            $html = preg_replace(
                '#<!-- ahm:css -->.*?<!-- /ahm:css -->#s',
                '<link rel="stylesheet" href="dist/app.min.css' . $v . '" />',
                $html
            );
            $html = preg_replace(
                '#<!-- ahm:js -->.*?<!-- /ahm:js -->#s',
                '<script src="dist/app.min.js' . $v . '"></script>',
                $html
            );
            $first = 'dist/app.min.js';
        }
        $html = str_replace(
            ['href="css/', 'src="js/', 'href="dist/', 'src="dist/'],
            ['href="' . $ext . 'css/', 'src="' . $ext . 'js/', 'href="' . $ext . 'dist/', 'src="' . $ext . 'dist/'],
            $html
        );
        $html = str_replace(
            '<script src="' . $ext . $first,
            '<script>window.AHM_BACKEND=' .
                json_encode($cfg, JSON_UNESCAPED_SLASHES) .
                ';</script><script src="' .
                $ext .
                $first,
            $html
        );
        return new Response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    public function data($f)
    {
        $lists = ['overlays', 'languages', 'layers', 'layer-notes-index', 'categories', 'shapes', 'types', 'sources'];
        if (in_array($f, $lists, true)) {
            $d = [
                'overlays' => 'overlays',
                'languages' => 'languages',
                'layers' => 'layers',
                'layer-notes-index' => 'layer_notes_index',
                'categories' => 'categories',
                'shapes' => 'shapes',
                'types' => 'types',
                'sources' => 'sources'
            ][$f];
            return new Response(
                json_encode($this->store->$d(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                200,
                ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'private, no-cache']
            );
        }
        $file = $f === 'places' ? 'places.geojson' : ($f === 'notes-index' ? 'notes/index.json' : null);
        return $this->send($file, $f === 'places' ? 'application/geo+json' : 'application/json');
    }

    public function note($place, $id)
    {
        if (!preg_match(\ahm\map\service\store::UUID, $place) || !preg_match(\ahm\map\service\store::UUID, $id)) {
            return new Response('', 400);
        }
        return $this->send('notes/' . $place . '/' . $id . '.md', 'text/markdown');
    }

    private function send($file, $type)
    {
        if ($file === null || !is_file($this->data . $file)) {
            return new Response('', 404);
        }
        $etag = '"' . md5_file($this->data . $file) . '"'; // browsers re-check every time; unchanged files cost only a 304
        $h = ['ETag' => $etag, 'Cache-Control' => 'private, no-cache'];
        if ($this->request->server('HTTP_IF_NONE_MATCH', '') === $etag) {
            return new Response('', 304, $h);
        }
        return new Response(
            file_get_contents($this->data . $file),
            200,
            $h + ['Content-Type' => $type . '; charset=utf-8']
        );
    }

    /** POST /map/save: add or edit a place, add or edit a note. Names and notes must use a language of the dictionary. */
    public function save()
    {
        if ($this->anon()) {
            return $this->json(['error' => 'login required'], 401);
        }
        if (!$this->can_edit()) {
            return $this->json(['error' => 'only administrators can edit the map'], 403);
        }
        if (stripos($this->request->server('CONTENT_TYPE', ''), 'application/json') !== 0) {
            // blocks cross-site form posts
            return $this->json(['error' => 'JSON required'], 415);
        }
        $in = json_decode($this->read_body(), true);
        if (!is_array($in)) {
            return $this->json(['error' => 'bad request'], 400);
        }
        try {
            return $this->json(['ok' => true, 'id' => $this->store->save($in)]);
        } catch (\InvalidArgumentException $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            return $this->json(['error' => 'server error: ' . $e->getMessage()], 500);
        }
    }

    // ------------------------------------------------------------------ historical map images (administrators)
    private function is_json()
    {
        return stripos($this->request->server('CONTENT_TYPE', ''), 'application/json') === 0;
    }

    private function admin_guard($what)
    {
        if ($this->anon()) {
            return $this->json(['error' => 'login required'], 401);
        }
        if (!$this->can_admin()) {
            return $this->json(['error' => "only administrators can $what"], 403);
        }
        return null;
    }

    private function overlay_guard()
    {
        return $this->admin_guard('manage historical maps');
    }

    /** Layers and the notes of layers may be changed by the same people as places (editors). */
    private function editor_guard()
    {
        if ($this->anon()) {
            return $this->json(['error' => 'login required'], 401);
        }
        if (!$this->can_edit()) {
            return $this->json(['error' => 'only administrators can edit the map'], 403);
        }
        return null;
    }

    private function json_body()
    {
        $in = json_decode($this->read_body(), true);
        return is_array($in) ? $in : null;
    }

    /** POST JSON {layer} | {layer_members} | {layer_note}: create or change a layer, its places or its notes. Editors. */
    public function layer_save()
    {
        if ($g = $this->editor_guard()) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true] + $this->store->layer_save($in);
        });
    }

    /** POST JSON {names, type, color, opacity, label, date_from?, date_to?, source?, geometry, id?}: creates or changes a border or line. Editors. */
    public function shape_save()
    {
        if ($g = $this->editor_guard()) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true, 'id' => $this->store->save_shape($in)];
        });
    }

    /** POST JSON {id}: deletes a border (it leaves its layers; a copy of the old file is archived). Editors, like places. */
    public function shape_delete()
    {
        if ($g = $this->editor_guard()) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => $this->store->delete_shape((string) ($in['id'] ?? ''))];
        });
    }

    /** POST JSON {id}: deletes a layer (its places and their notes stay; a copy is archived). Administrators only. */
    public function layer_delete()
    {
        if ($g = $this->admin_guard('delete layers')) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => $this->store->delete_layer((string) ($in['id'] ?? ''))];
        });
    }

    /** POST JSON {id?, title, citation?, url?}: adds a source or changes one. Editors, like places (T-046). */
    public function source_save()
    {
        if ($g = $this->editor_guard()) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true, 'id' => $this->store->save_source($in)];
        });
    }

    /** POST JSON {id?, names: [{lang, name}]}: adds a category or renames one. Administrators only. */
    public function category_save()
    {
        if ($g = $this->admin_guard('manage categories')) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true, 'id' => $this->store->save_category($in)];
        });
    }

    /** POST JSON {code?, geometry, names: [{lang, name}], color, style, edit?}: adds a place type or changes one. Administrators only. */
    public function type_save()
    {
        if ($g = $this->admin_guard('manage place types')) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true, 'code' => $this->store->save_type($in)];
        });
    }

    /** POST JSON {code}: removes a place type that no place uses (400 with the count otherwise). Administrators only. */
    public function type_delete()
    {
        if ($g = $this->admin_guard('manage place types')) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        if (($in = $this->json_body()) === null) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => $this->store->delete_type((string) ($in['code'] ?? ''))];
        });
    }

    /** POST JSON {code, name, native}: adds a language to the dictionary. Administrators only. */
    public function language_save()
    {
        if ($g = $this->admin_guard('add languages')) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        $in = json_decode($this->read_body(), true);
        if (!is_array($in)) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true, 'code' => $this->store->save_language($in)];
        });
    }

    private function overlay_run(callable $fn)
    {
        try {
            return $this->json($fn());
        } catch (\InvalidArgumentException $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            return $this->json(['error' => 'server error: ' . $e->getMessage()], 500);
        }
    }

    /** The image file of one overlay. */
    public function overlay_image($id)
    {
        $f = $this->store->overlay_file($id);
        if (!$f) {
            return new Response('', 404);
        }
        $etag = '"' . md5_file($f[0]) . '"';
        $h = ['ETag' => $etag, 'Cache-Control' => 'private, no-cache'];
        if ($this->request->server('HTTP_IF_NONE_MATCH', '') === $etag) {
            return new Response('', 304, $h);
        }
        return new Response(file_get_contents($f[0]), 200, $h + ['Content-Type' => $f[1]]);
    }

    /** POST JSON: create or update an overlay's settings (title, four corners, zoom range, opacity). */
    public function overlay_save()
    {
        if ($g = $this->overlay_guard()) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        $in = json_decode($this->read_body(), true);
        if (!is_array($in)) {
            return $this->json(['error' => 'bad request'], 400);
        }
        return $this->overlay_run(function () use ($in) {
            return ['ok' => true, 'id' => $this->store->save_overlay($in)];
        });
    }

    /** POST raw image bytes (Content-Type image/*) for an existing overlay. */
    public function overlay_upload($id)
    {
        if ($g = $this->overlay_guard()) {
            return $g;
        }
        if (stripos($this->request->server('CONTENT_TYPE', ''), 'image/') !== 0) {
            return $this->json(['error' => 'image required'], 415);
        }
        $bytes = $this->read_body();
        return $this->overlay_run(function () use ($id, $bytes) {
            return ['ok' => true, 'file' => $this->store->save_overlay_image($id, $bytes)];
        });
    }

    public function overlay_delete()
    {
        if ($g = $this->overlay_guard()) {
            return $g;
        }
        if (!$this->is_json()) {
            return $this->json(['error' => 'JSON required'], 415);
        }
        $in = json_decode($this->read_body(), true);
        return $this->overlay_run(function () use ($in) {
            return ['ok' => $this->store->delete_overlay((string) ($in['id'] ?? ''))];
        });
    }
}
