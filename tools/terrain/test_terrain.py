"""Unit tests of the terrain tile builder (T-053). Run: python3 -I -m unittest discover -s tools/terrain -p "test_*.py"
Needs only numpy and Pillow. The GeoTIFF adapter (geotiff_source.py, rasterio) is NOT tested here: no rasterio, no real files."""
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import unittest
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import core  # noqa: E402

CONFIG_JS = os.path.join(HERE, '..', '..', 'app', 'js', 'config.js')
BBOX = [32, 29, 51, 44]  # Mesopotamia, the edge of Anatolia and the Caucasus (T-060)


class Synth(core.Mosaic):
    """A synthetic DEM: elevation = 1000 + 100 * (lon - west) + 50 * (lat - south), linear, so bilinear sampling is exact."""

    def __init__(self, bbox, ppd=60, fail_after=None):
        super().__init__(math.floor(bbox[0]), math.ceil(bbox[3]), (math.ceil(bbox[2]) - math.floor(bbox[0])) * ppd,
                         (math.ceil(bbox[3]) - math.floor(bbox[1])) * ppd, ppd)
        self.south = math.floor(bbox[1])
        self.reads = 0
        self.fail_after = fail_after

    def elev(self, lon, lat):
        return 1000 + 100 * (lon - self.west) + 50 * (lat - self.south)

    def read(self, c0, r0, c1, r1):
        self.reads += 1
        if self.fail_after is not None and self.reads > self.fail_after:
            raise RuntimeError('interrupted')
        cols = self.west + (np.arange(c0, c1) + 0.5) / self.ppd
        rows = self.north - (np.arange(r0, r1) + 0.5) / self.ppd
        return self.elev(cols[None, :], rows[:, None]).astype(np.float32)


class TileMaths(unittest.TestCase):
    def test_known_tiles(self):
        self.assertEqual((1, 1), core.lonlat_to_tile(0.0001, -0.0001, 1))
        self.assertEqual((0, 0), core.lonlat_to_tile(-179.9, 85, 1))
        w, s, e, n = core.tile_bounds(0, 0, 0)
        self.assertAlmostEqual(-180, w)
        self.assertAlmostEqual(180, e)
        self.assertAlmostEqual(85.0511287798, n, places=6)
        self.assertAlmostEqual(-85.0511287798, s, places=6)
        w, s, e, n = core.tile_bounds(1, 0, 0)
        self.assertEqual((-180, 0), (round(w, 9), round(s, 9)))
        self.assertAlmostEqual(0, e)

    def test_tile_counts_match_the_brief(self):
        total = sum(core.tile_count(BBOX, z) for z in range(0, 12))
        self.assertEqual(15812, total)  # zoom 0-11
        self.assertEqual(4040, sum(core.tile_count(BBOX, z) for z in range(0, 11)))  # zoom 0-10
        self.assertEqual(62250, core.tile_count(BBOX, 12) + total)  # zoom 0-12

    def test_tiles_cover_the_bbox(self):
        x0, y0, x1, y1 = core.tiles_for_bbox(BBOX, 8)
        w, s, e, n = core.tile_bounds(8, x0, y1)[0], core.tile_bounds(8, x0, y1)[1], core.tile_bounds(8, x1, y0)[2], core.tile_bounds(8, x1, y0)[3]
        self.assertTrue(w <= 32 and s <= 29 and e >= 51 and n >= 44)

    def test_squares(self):
        sq = core.squares_for_bbox(BBOX)
        self.assertEqual(285, len(sq))
        self.assertIn((40, 44), sq)
        self.assertEqual('Copernicus_DSM_COG_10_N40_00_E044_00_DEM', core.square_name(40, 44, 30))
        self.assertEqual('Copernicus_DSM_COG_30_N40_00_E044_00_DEM', core.square_name(40, 44, 90))
        self.assertEqual('Copernicus_DSM_COG_10_S01_00_W001_00_DEM', core.square_name(-1, -1, 30))
        self.assertEqual('Copernicus_DSM_COG_10_N00_00_E000_00_DEM', core.square_name(0, 0, 30))
        u = core.square_url(40, 44, 30)
        self.assertEqual('https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/Copernicus_DSM_COG_10_N40_00_E044_00_DEM/'
                         'Copernicus_DSM_COG_10_N40_00_E044_00_DEM.tif', u)
        self.assertTrue(core.square_url(40, 44, 90).startswith('https://copernicus-dem-90m.s3.eu-central-1.amazonaws.com/'))

    def test_bbox_is_read_from_config_js(self):
        self.assertEqual(BBOX, core.read_bbox(CONFIG_JS))


class Terrarium(unittest.TestCase):
    def test_round_trip_within_step(self):
        e = np.array([[-430.0, -1.5, 0, 0.4, 5.5], [1234.56, 5137.0, 8848.86, -32768, 32767]], dtype=np.float32)
        for step in (1.0, 0.5, 2.0):
            rgb = core.terrarium_encode(e, step)
            self.assertEqual(np.uint8, rgb.dtype)
            self.assertEqual((2, 5, 3), rgb.shape)
            back = core.terrarium_decode(rgb)
            self.assertLessEqual(float(np.abs(back - e).max()), step / 2 + 1e-6, step)

    def test_known_value(self):
        rgb = core.terrarium_encode(np.array([[0.0]]), 1.0)
        self.assertEqual([128, 0, 0], list(rgb[0, 0]))  # (128*256 + 0 + 0/256) - 32768 = 0
        rgb = core.terrarium_encode(np.array([[1.0]]), 1.0)
        self.assertEqual([128, 1, 0], list(rgb[0, 0]))

    def test_blue_channel_is_flat_for_whole_metres(self):
        rgb = core.terrarium_encode(np.random.default_rng(1).uniform(-100, 5000, (16, 16)), 1.0)
        self.assertEqual(0, int(rgb[..., 2].max()))

    def test_nan_becomes_zero(self):
        back = core.terrarium_decode(core.terrarium_encode(np.array([[np.nan, 3.0]]), 1.0))
        self.assertEqual([0.0, 3.0], list(back[0]))


class Pyramid(unittest.TestCase):
    def test_parent_averages_children(self):
        a, b, c, d = (np.full((256, 256), v, dtype=np.float32) for v in (0, 100, 200, 300))
        p = core.downsample_children([a, b, c, d])
        self.assertEqual((256, 256), p.shape)
        self.assertEqual([0, 100, 200, 300], [float(p[10, 10]), float(p[10, 200]), float(p[200, 10]), float(p[200, 200])])

    def test_averages_not_picks(self):
        checker = (np.indices((256, 256)).sum(axis=0) % 2 * 100).astype(np.float32)  # 0 / 100 alternating
        p = core.downsample_children([checker] * 4)
        self.assertTrue(np.allclose(p, 50.0))


class Sampling(unittest.TestCase):
    def test_supersampling(self):
        self.assertEqual(1, core.supersample(source_px_m=30, tile_px_m=20))
        self.assertGreaterEqual(core.supersample(30, 60), 2)  # source finer than the tile pixel: at least 2x2
        self.assertEqual(4, core.supersample(1, 1000))  # capped

    def test_tile_follows_web_mercator(self):
        src = Synth([43, 39, 46, 42], ppd=120)
        z = 9
        x, y = core.lonlat_to_tile(44.5, 40.5, z)
        w, s, e, n = core.tile_bounds(z, x, y)
        self.assertTrue(43 < w and e < 46 and 39 < s and n < 42, (w, s, e, n))
        t = core.sample_tile(src, z, x, y, supersample=1)
        self.assertEqual((256, 256), t.shape)
        for i, j in ((0, 0), (100, 30), (255, 255), (7, 200)):
            X = x * 256 + j + 0.5
            Y = y * 256 + i + 0.5
            lon = X / (256 * 2 ** z) * 360 - 180
            lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * Y / (256 * 2 ** z)))))
            self.assertAlmostEqual(src.elev(lon, lat), float(t[i, j]), delta=0.05, msg=(i, j))

    def test_outside_the_mosaic_repeats_the_edge(self):
        src = Synth([44, 40, 45, 41], ppd=60)
        z = 5
        x, y = core.lonlat_to_tile(44.0, 41.0, z)
        t = core.sample_tile(src, z, x - 1, y - 1)  # up and left of the mosaic corner
        self.assertTrue(np.isfinite(t).all())
        self.assertLess(float(t.max()), 1000 + 100 + 50 + 1)


class Build(unittest.TestCase):
    BB = [44.2, 40.2, 44.8, 40.8]

    def expected(self, maxzoom):
        return sum(core.tile_count(self.BB, z) for z in range(maxzoom + 1))

    def files(self, out):
        r = []
        for d, _, fs in os.walk(os.path.join(out, 'v1')):
            r += [f for f in fs if f.endswith('.webp')]
        return r

    def test_end_to_end_resume_force(self):
        with tempfile.TemporaryDirectory() as out:
            src = Synth(self.BB, ppd=120)
            st = core.build(src, out, self.BB, maxzoom=5, step=1.0)
            n = self.expected(5)
            self.assertEqual(n, len(self.files(out)))
            self.assertEqual(n, st['written'])
            self.assertEqual(0, st['skipped'])
            self.assertTrue(os.path.isfile(os.path.join(out, 'v1', '0', '0', '0.webp')))
            self.assertGreater(st['bytes'], 0)
            im = Image.open(os.path.join(out, 'v1', '0', '0', '0.webp'))
            self.assertEqual(((256, 256), 'RGB'), (im.size, im.mode))
            # every written tile decodes to the right elevation at the top zoom (centre of the bbox)
            x, y = core.lonlat_to_tile(44.5, 40.5, 5)
            t = core.terrarium_decode(np.asarray(Image.open(os.path.join(out, 'v1', '5', str(x), str(y) + '.webp'))))
            w, s, e, nn = core.tile_bounds(5, x, y)
            lon, lat = (w + e) / 2, None
            self.assertTrue(1000 <= float(t.mean()) <= 1200, float(t.mean()))
            # NOTICE and .htaccess
            notice = open(os.path.join(out, 'NOTICE.txt'), encoding='utf-8').read()
            self.assertIn(core.ATTRIBUTION, notice)
            self.assertIn('do not incur any liability for any use of the Copernicus WorldDEM-30', notice)
            self.assertRegex(notice, r'(?i)endorse')
            self.assertIn('https://', notice)
            ht = open(os.path.join(out, '.htaccess'), encoding='utf-8').read()
            for need in ('RewriteEngine Off', 'Options -Indexes', 'max-age=31536000', 'immutable'):
                self.assertIn(need, ht)
            # resume: nothing is written again, source is not read
            src.reads = 0
            st2 = core.build(src, out, self.BB, maxzoom=5, step=1.0)
            self.assertEqual((0, 0), (st2['written'], src.reads))
            self.assertEqual(n, st2['skipped'])
            # force: all again
            st3 = core.build(src, out, self.BB, maxzoom=5, step=1.0, force=True)
            self.assertEqual(n, st3['written'])

    def test_interrupted_run_is_resumed(self):
        with tempfile.TemporaryDirectory() as out:
            n = self.expected(10)
            with self.assertRaises(RuntimeError):
                core.build(Synth(self.BB, ppd=120, fail_after=3), out, self.BB, maxzoom=10)
            first = len(self.files(out))
            self.assertTrue(0 < first < n, first)
            self.assertEqual([], [f for d, _, fs in os.walk(out) for f in fs if f.endswith('.tmp')])  # no half-written file
            st = core.build(Synth(self.BB, ppd=120), out, self.BB, maxzoom=10)
            self.assertEqual(n, len(self.files(out)))
            self.assertEqual(n - first, st['written'])

    def test_version_folder(self):
        with tempfile.TemporaryDirectory() as out:
            core.build(Synth(self.BB, ppd=120), out, self.BB, maxzoom=2, version='v2')
            self.assertTrue(os.path.isfile(os.path.join(out, 'v2', '0', '0', '0.webp')))
            self.assertFalse(os.path.exists(os.path.join(out, 'v1')))

    def test_step_is_used(self):
        with tempfile.TemporaryDirectory() as out:
            core.build(Synth(self.BB, ppd=120), out, self.BB, maxzoom=2, step=0.5)
            t = core.terrarium_decode(np.asarray(Image.open(os.path.join(out, 'v1', '2', *[str(v) for v in core.lonlat_to_tile(44.5, 40.5, 2)]) + '.webp')))
            self.assertLessEqual(float(np.abs(t * 2 - np.round(t * 2)).max()), 1e-6)  # multiples of 0.5

    def test_pack_and_preview(self):
        with tempfile.TemporaryDirectory() as out, tempfile.TemporaryDirectory() as o2:
            core.build(Synth(self.BB, ppd=120), out, self.BB, maxzoom=3)
            z = os.path.join(o2, 'terrain.zip')
            info = core.pack(out, z)
            names = zipfile.ZipFile(z).namelist()
            self.assertIn('ahm-terrain/NOTICE.txt', names)
            self.assertIn('ahm-terrain/.htaccess', names)
            self.assertIn('ahm-terrain/v1/0/0/0.webp', names)
            self.assertEqual(self.expected(3) + 2, len(names))
            self.assertEqual(len(names), info['files'])
            png = os.path.join(o2, 'p.png')
            core.preview(out, png, zoom=3)
            im = Image.open(png)
            self.assertGreater(im.size[0], 100)


class Datasets(unittest.TestCase):
    """--dataset (auto, glo30, glo90): selection, credit, download rules, the config block (docs/10)."""

    def http(self, code):
        import urllib.error
        return urllib.error.HTTPError('u', code, 'x', None, None)

    def fake(self, answers):
        calls = []

        def fetch(url, dest):
            calls.append(url)
            a = answers.get('30' if 'dem-30m' in url else '90')
            if isinstance(a, Exception):
                raise a
            open(dest, 'wb').write(b'x')
        return fetch, calls

    def test_dataset_selection(self):
        self.assertEqual((30, 90), core.resolutions('auto'))
        self.assertEqual((90,), core.resolutions('glo90'))
        self.assertEqual((30,), core.resolutions('glo30'))
        with self.assertRaises(ValueError):
            core.resolutions('glo60')
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'terrain.py'), 'squares', '--dataset', 'glo60'], capture_output=True, text=True)
        self.assertNotEqual(0, r.returncode)

    def test_attribution_texts_and_config(self):
        self.assertEqual(core.ATTRIBUTION_30, core.ATTRIBUTION)
        self.assertTrue(core.ATTRIBUTION_90.startswith('produced using Copernicus WorldDEM-90 \u00a9 DLR e.V. 2010-2014 and '))
        self.assertTrue(core.ATTRIBUTION_90.endswith('provided under COPERNICUS by the European Union and ESA; all rights reserved'))
        self.assertNotIn('WorldDEM-30', core.ATTRIBUTION_90)
        self.assertEqual(core.ATTRIBUTION_30, core.attribution_for({30}))
        self.assertEqual(core.ATTRIBUTION_90, core.attribution_for({90}))
        mixed = core.attribution_for({30, 90})
        self.assertIn('WorldDEM-30', mixed)
        self.assertIn('WorldDEM-90', mixed)
        self.assertEqual(core.ATTRIBUTION_30, core.attribution_for(set()))  # nothing downloaded (all sea): the default text
        cfg = open(CONFIG_JS, encoding='utf-8').read()  # the three texts are in config.js, word for word, for the owner to paste
        for t in (core.ATTRIBUTION_30, core.ATTRIBUTION_90, mixed):
            self.assertIn(t, cfg)

    def test_squares_glo90(self):
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'terrain.py'), 'squares', '--bbox', '44', '40', '46', '41', '--dataset', 'glo90'],
                           capture_output=True, text=True)
        self.assertEqual(0, r.returncode, r.stderr)
        urls = re.findall(r'^(https://\S+)', r.stdout, re.M)
        self.assertEqual(2, len(urls))
        self.assertTrue(all('copernicus-dem-90m' in u for u in urls) and not any('dem-30m' in u for u in urls), urls)
        self.assertIn('Copernicus_DSM_COG_30_N40_00_E044_00_DEM/Copernicus_DSM_COG_30_N40_00_E044_00_DEM.tif', urls[0])
        self.assertNotIn('prediction', r.stdout)
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'terrain.py'), 'squares', '--bbox', '44', '40', '46', '41'], capture_output=True, text=True)
        self.assertIn('prediction', r.stderr)  # the Armenia/Azerbaijan note is a prediction, never a fact
        self.assertNotRegex(r.stderr + r.stdout, r'(?i)not in GLO-30\b(?!;)')

    def test_download_url_and_names(self):
        self.assertEqual('https://copernicus-dem-90m.s3.eu-central-1.amazonaws.com/Copernicus_DSM_COG_30_N40_00_E044_00_DEM/'
                         'Copernicus_DSM_COG_30_N40_00_E044_00_DEM.tif', core.square_url(40, 44, 90))
        self.assertEqual('Copernicus_DSM_COG_30_S01_00_W002_00_DEM', core.square_name(-1, -2, 90))

    def test_glo90_downloads_only_90_and_prints_each_url(self):
        import terrain
        with tempfile.TemporaryDirectory() as d:
            fetch, calls = self.fake({'90': None})
            log = []
            self.assertEqual(90, terrain.fetch_square(d, 40, 44, 'glo90', fetch, log.append))
            self.assertEqual(1, len(calls))
            self.assertIn('dem-90m', calls[0])
            self.assertTrue(any(calls[0] in l for l in log), 'the URL it tries is printed')
            self.assertEqual(90, terrain.fetch_square(d, 40, 44, 'glo90', fetch))  # the file is there: no second request
            self.assertEqual(1, len(calls))

    def test_auto_falls_back_per_square_and_glo30_only_does_not(self):
        import terrain
        with tempfile.TemporaryDirectory() as d:
            fetch, calls = self.fake({'30': self.http(404), '90': None})
            self.assertEqual(90, terrain.fetch_square(d, 40, 44, 'auto', fetch, lambda m: None))
            self.assertEqual(['dem-30m' in c for c in calls], [True, False])
        with tempfile.TemporaryDirectory() as d:
            fetch, calls = self.fake({'30': self.http(404), '90': None})
            self.assertEqual('none', terrain.fetch_square(d, 40, 44, 'glo30', fetch, lambda m: None))
            self.assertEqual(1, len(calls))

    def test_404_marker_covers_only_the_datasets_tried(self):
        import terrain
        with tempfile.TemporaryDirectory() as d:
            fetch, calls = self.fake({'90': self.http(404)})
            self.assertEqual('none', terrain.fetch_square(d, 38, 44, 'glo90', fetch, lambda m: None))
            self.assertEqual({90}, core.marker_tried(d, 38, 44))
            self.assertEqual('none', terrain.fetch_square(d, 38, 44, 'glo90', fetch, lambda m: None))
            self.assertEqual(1, len(calls), 'known: not asked again')
            self.assertEqual('none', core.dem_status(d, [44, 38, 45, 39], 'glo90')[(38, 44)])
            self.assertIsNone(core.dem_status(d, [44, 38, 45, 39], 'auto')[(38, 44)], 'a 404 in GLO-90 says nothing about GLO-30')
            fetch2, calls2 = self.fake({'30': self.http(404), '90': self.http(404)})
            self.assertEqual('none', terrain.fetch_square(d, 38, 44, 'auto', fetch2, lambda m: None))
            self.assertEqual(1, len(calls2), 'only GLO-30 is asked: GLO-90 is known to be missing')
            self.assertEqual({30, 90}, core.marker_tried(d, 38, 44))
            open(core.no_tile_marker(d, 10, 10), 'w').close()  # an old empty marker means both
            self.assertEqual({30, 90}, core.marker_tried(d, 10, 10))

    def test_only_404_is_no_tile(self):
        import terrain
        for err in (self.http(403), self.http(500), OSError('timed out')):
            with tempfile.TemporaryDirectory() as d:
                fetch, calls = self.fake({'90': err})
                with self.assertRaises(terrain.DownloadStop):
                    terrain.fetch_square(d, 40, 44, 'glo90', fetch, lambda m: None)
                self.assertFalse(os.path.exists(core.no_tile_marker(d, 40, 44)), 'no marker after %r' % err)

    def test_notice_names_the_products_used(self):
        for used, need, absent in (((30,), 'WorldDEM-30', 'WorldDEM-90'), ((90,), 'WorldDEM-90', 'WorldDEM-30')):
            n = core.notice_text(1.0, 11, used)
            self.assertIn(core.attribution_for(used), n)
            self.assertIn('any use of the Copernicus ' + need, n)
            self.assertNotIn(absent, n)
        n = core.notice_text(1.0, 11, (30, 90))
        self.assertIn(core.attribution_for({30, 90}), n)
        self.assertIn('GLO-30 and GLO-90', n)

    def test_build_writes_the_notice_of_the_source(self):
        class S90(Synth):
            def datasets(self):
                return {90}
        bb = [44, 40, 45, 41]
        with tempfile.TemporaryDirectory() as out:
            core.build(S90(bb, ppd=60), out, bb, maxzoom=1)
            n = open(os.path.join(out, 'NOTICE.txt'), encoding='utf-8').read()
            self.assertIn(core.ATTRIBUTION_90, n)
            self.assertNotIn('WorldDEM-30', n)

    def test_config_block_and_pack_printout(self):
        b = core.config_block(core.ATTRIBUTION_90, 11, [32, 29, 51, 44])
        for need in ('tiles: ["https://YOUR-FORUM/ahm-terrain/v1/{z}/{x}/{y}.webp"]', 'maxzoom: 11,', 'bounds: [32, 29, 51, 44]',
                     'attribution: "%s"' % core.ATTRIBUTION_90):
            self.assertIn(need, b)
        bb = [44, 40, 45, 41]
        with tempfile.TemporaryDirectory() as out, tempfile.TemporaryDirectory() as o2:
            class S90(Synth):
                def datasets(self):
                    return {90}
            core.build(S90(bb, ppd=60), out, bb, maxzoom=2)
            r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'terrain.py'), 'pack', '--out', out, '--archive', os.path.join(o2, 't.zip'),
                                '--bbox', '44', '40', '45', '41'], capture_output=True, text=True)
            self.assertEqual(0, r.returncode, r.stderr)
            self.assertIn('maxzoom: 2,', r.stdout)
            self.assertIn('bounds: [44, 40, 45, 41]', r.stdout)
            self.assertIn(core.ATTRIBUTION_90, r.stdout)


class Cli(unittest.TestCase):
    def run_cli(self, *a):
        return subprocess.run([sys.executable, '-I', os.path.join(HERE, 'terrain.py'), *a], capture_output=True, text=True)

    def test_squares_lists_285_urls(self):
        r = self.run_cli('squares')
        self.assertEqual(0, r.returncode, r.stderr)
        self.assertEqual(285, len(re.findall(r'^https://copernicus-dem-30m', r.stdout, re.M)))

    def test_attribution_matches_config_js(self):
        cfg = open(CONFIG_JS, encoding='utf-8').read()
        self.assertIn(core.ATTRIBUTION, cfg)

    def test_check_without_rasterio_says_how_to_install(self):
        try:
            import rasterio  # noqa: F401
            self.skipTest('rasterio is installed')
        except ImportError:
            pass
        r = self.run_cli('check', '--dem', tempfile.gettempdir())
        self.assertNotEqual(0, r.returncode)
        self.assertIn('pip install rasterio', r.stderr)


if __name__ == '__main__':
    unittest.main()
