<?php
namespace ahm\map;

/**
 * When it is enabled, makes the tables (migrations) and, if they are empty, loads the sample data (ext/ahm/map/data) into them, or the files
 * of an older version when store/ahm_map holds them. The map keeps its data in the database (T-104); store/ahm_map keeps only the pictures
 * of overlays. Notes are posts: they are made together with the topics of the forum Map (see tools/dev/seed.php for the notes of the sample).
 */
class ext extends \phpbb\extension\base
{
    private static $files = ['places.geojson', 'shapes.geojson', 'layers.json', 'languages.json', 'categories.json', 'types.json', 'sources.json', 'overlays.json'];

    private static function remove($path)
    {
        if (is_dir($path) && !is_link($path)) {
            foreach (scandir($path) as $f) {
                if ($f !== '.' && $f !== '..') {
                    self::remove($path . '/' . $f);
                }
            }
            @rmdir($path);
        } else {
            @unlink($path);
        }
    }

    public function enable_step($old_state)
    {
        $more = parent::enable_step($old_state);   // runs the migrations (the tables), one step at a time
        if ($more) {
            return $more;
        }
        $dst = $this->container->getParameter('core.root_path') . 'store/ahm_map/';
        @mkdir($dst, 0775, true);
        $db = new \ahm\map\service\dbal_driver($this->container->get('dbal.conn'), $this->container->getParameter('core.table_prefix'));
        if ((int) $db->value('SELECT COUNT(*) FROM ' . $db->prefix() . 'ahm_objects')) {
            return false;
        }
        $src = is_file($dst . 'places.geojson') ? $dst : __DIR__ . '/data/';
        $tmp = $dst . 'import-' . getmypid() . '/';
        @mkdir($tmp, 0775, true);
        foreach (self::$files as $f) {
            if (is_file($src . $f)) {
                copy($src . $f, $tmp . $f);
            }
        }
        try {
            (new \ahm\map\service\store($tmp))->migrate();      // the loader reads the current format: convert this copy
            (new \ahm\map\service\sql_transfer($db))->import($tmp, 'first enable');
        } finally {
            self::remove($tmp);
        }
        return false;
    }
}
