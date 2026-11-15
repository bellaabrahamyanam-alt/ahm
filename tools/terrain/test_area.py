"""Tests of the enlarged area (T-055): the download rule (a real 404 is "no tile", anything else is never "sea"), the squares list, the guard
before a build, the mixed GLO-30 / GLO-90 mosaic (with a stand-in for rasterio: the window arithmetic is tested, GDAL itself is NOT), the
open-file limit and the preview position. Run: python3 -I -m unittest discover -s tools/terrain -p "test_*.py" """
import io
import math
import os
import re
import socket
import subprocess
import sys
import tempfile
import unittest
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import core  # noqa: E402
import geotiff_source  # noqa: E402
import terrain  # noqa: E402

BBOX = [32, 29, 51, 44]


def http(code):
    return urllib.error.HTTPError('https://x/y.tif', code, 'msg', {}, io.BytesIO(b''))


class FakeFetch:
    """Stand-in for terrain.fetch: `plan` maps a resolution (30 or 90) to 'ok', an HTTP code, or an exception."""

    def __init__(self, plan):
        self.plan, self.calls = plan, []

    def __call__(self, url, dest):
        res = 30 if 'dem-30m' in url else 90
        self.calls.append(res)
        what = self.plan[res]
        if what == 'ok':
            open(dest, 'wb').write(b'tif')
            return
        raise http(what) if isinstance(what, int) else what


class DownloadRule(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dem = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def run_square(self, plan):
        f = FakeFetch(plan)
        return terrain.fetch_square(self.dem, 40, 44, fetch=f, log=lambda *_: None), f

    def test_glo30_present(self):
        r, f = self.run_square({30: 'ok', 90: 500})
        self.assertEqual((30, [30]), (r, f.calls))

    def test_404_on_glo30_falls_back_to_glo90(self):
        r, f = self.run_square({30: 404, 90: 'ok'})
        self.assertEqual((90, [30, 90]), (r, f.calls))
        self.assertTrue(os.path.isfile(os.path.join(self.dem, core.square_name(40, 44, 90) + '.tif')))

    def test_404_on_both_is_no_tile_and_is_remembered(self):
        r, f = self.run_square({30: 404, 90: 404})
        self.assertEqual('none', r)
        self.assertEqual('none', core.dem_status(self.dem, [44, 40, 45, 41])[(40, 44)])
        # the next run does not ask again
        r2, f2 = self.run_square({30: 500, 90: 500})
        self.assertEqual(('none', []), (r2, f2.calls))

    def test_other_errors_are_never_sea(self):
        for bad in (403, 500, 503, urllib.error.URLError('no route'), socket.timeout('timed out'), TimeoutError('t'), ConnectionResetError('r')):
            with self.subTest(bad=repr(bad)):
                for plan in ({30: bad, 90: 'ok'}, {30: 404, 90: bad}):
                    with self.assertRaises(terrain.DownloadStop):
                        self.run_square(plan)
                    # nothing says "no tile": status stays "not downloaded" (None) or a real GLO-90 file, never 'none'
                    st = core.dem_status(self.dem, [44, 40, 45, 41])[(40, 44)]
                    self.assertNotEqual('none', st)
                    self.assertFalse([f for f in os.listdir(self.dem) if f.endswith('.part')])
                    for f in os.listdir(self.dem):
                        os.remove(os.path.join(self.dem, f))

    def test_403_message_explains_the_s3_behaviour(self):
        with self.assertRaises(terrain.DownloadStop) as c:
            self.run_square({30: 403, 90: 'ok'})
        self.assertIn('403', str(c.exception))
        self.assertIn('not treated as sea', str(c.exception))


class Status(unittest.TestCase):
    def test_status_and_seams(self):
        with tempfile.TemporaryDirectory() as d:
            for lat, lon, res in ((40, 43, 30), (40, 44, 90), (41, 43, 30)):
                open(os.path.join(d, core.square_name(lat, lon, res) + '.tif'), 'wb').close()
            open(core.no_tile_marker(d, 41, 44), 'w').close()
            st = core.dem_status(d, [43, 40, 45, 42])
            self.assertEqual({(40, 43): 30, (40, 44): 90, (40, 45): None, (41, 43): 30, (41, 44): 'none', (41, 45): None}, st)
            self.assertEqual([(44.0, 40.5)], core.seam_edges(st))  # only 30|90 neighbours count; 'none' and None do not

    def test_expected_dataset(self):
        self.assertEqual(90, core.expected_dataset(40, 44))   # Armenia (Ararat plain)
        self.assertEqual(90, core.expected_dataset(40, 48))   # Azerbaijan
        self.assertEqual(90, core.expected_dataset(39, 45))   # Nakhchivan
        self.assertEqual(30, core.expected_dataset(33, 44))   # Iraq
        self.assertEqual(30, core.expected_dataset(39, 32))   # Anatolia
        self.assertEqual(30, core.expected_dataset(43, 42))   # Greater Caucasus, Russia/Georgia


class Cli(unittest.TestCase):
    def run_cli(self, *a):
        return subprocess.run([sys.executable, '-I', os.path.join(HERE, 'terrain.py'), *a], capture_output=True, text=True)

    def test_squares_says_which_dataset_and_summarises(self):
        r = self.run_cli('squares')
        self.assertEqual(0, r.returncode, r.stderr)
        lines = [l for l in r.stdout.splitlines() if l.startswith('https://')]
        self.assertEqual(285, len(lines))
        by = {re.search(r'(N\d+_00_E\d+)', l).group(1): l for l in lines}
        self.assertIn('GLO-90', by['N40_00_E044'])
        self.assertIn('Armenia/Azerbaijan', by['N40_00_E044'])
        self.assertNotIn('GLO-90', by['N33_00_E044'])
        self.assertTrue(by['N33_00_E044'].startswith('https://copernicus-dem-30m'))
        self.assertRegex(r.stderr, r'285 squares')
        self.assertRegex(r.stderr, r'GLO-90')
        self.assertRegex(r.stderr, r'sea')

    def test_build_refuses_squares_that_were_never_downloaded(self):
        with tempfile.TemporaryDirectory() as dem, tempfile.TemporaryDirectory() as out:
            r = self.run_cli('build', '--dem', dem, '--out', out, '--bbox', '44', '40', '46', '41')
            self.assertNotEqual(0, r.returncode)
            self.assertIn('not downloaded', r.stderr)
            self.assertIn('download', r.stderr)
            self.assertFalse(os.path.exists(os.path.join(out, 'v1')))  # nothing was built from zeros

    def test_preview_at_a_place(self):
        bb = [44.2, 40.2, 44.8, 40.8]
        sys.path.insert(0, HERE)
        import test_terrain
        with tempfile.TemporaryDirectory() as out, tempfile.TemporaryDirectory() as o2:
            core.build(test_terrain.Synth(bb, ppd=120), out, bb, maxzoom=6)
            png = os.path.join(o2, 'p.png')
            z, lo, hi = core.preview(out, png, zoom=6, at=(44.5, 40.5))
            self.assertEqual(6, z)
            self.assertGreater(hi, lo)
            x, y = core.lonlat_to_tile(44.5, 40.5, 6)
            self.assertEqual((x, y), core.preview_centre(out, 6, (44.5, 40.5)))


# ------------------------------------------------------------------ the mosaic with a stand-in for rasterio

def field(lon, lat):
    return 500.0 + 800.0 * (lon - 32.0) + 300.0 * (lat - 29.0)


class FakeDS:
    """One square as rasterio would show it. GDAL reads a window into out_shape by mapping the centre of every output pixel into the source
    (documented GDAL behaviour; NOT checked against real GDAL here), so the stand-in evaluates the field at those centres."""

    def __init__(self, path, closed, value=field):
        m = re.search(r'_COG_(10|30)_N(\d+)_00_E(\d+)_00', path)
        self.res = 30 if m.group(1) == '10' else 90
        self.lat0, self.lon0 = int(m.group(2)), int(m.group(3))
        self.width = self.height = 3600 if self.res == 30 else 1200
        self.crs, self.count, self.dtypes, self.nodata = self, 1, ['float32'], -9999.0
        self.bounds = type('B', (), {'left': self.lon0, 'bottom': self.lat0, 'right': self.lon0 + 1, 'top': self.lat0 + 1})()
        self.value, self.closed = value, closed

    def to_epsg(self):
        return 4326

    def close(self):
        self.closed.append(self)

    def read(self, band, window=None, out_shape=None, resampling=None):
        c, r, w, h = (0, 0, self.width, self.height) if window is None else window
        oh, ow = out_shape or (self.height, self.width)
        sc = c + (np.arange(ow) + 0.5) * w / ow
        sr = r + (np.arange(oh) + 0.5) * h / oh
        lon = self.lon0 + sc / self.width
        lat = self.lat0 + 1 - sr / self.height
        return self.value(lon[None, :], lat[:, None]).astype(np.float32) * np.ones((oh, ow), np.float32)


class Rasterio:
    def __init__(self, value=field):
        self.opened, self.closed, self.value = [], [], value

    def open(self, path):
        ds = FakeDS(path, self.closed, self.value)
        self.opened.append(ds)
        return ds


def install(rio):
    geotiff_source._rasterio = lambda: (rio, type('R', (), {'nearest': 0, 'bilinear': 1}), lambda *a: a)


class Mosaic(unittest.TestCase):
    def setUp(self):
        self.orig = geotiff_source._rasterio
        self.tmp = tempfile.TemporaryDirectory()
        self.dem = self.tmp.name

    def tearDown(self):
        geotiff_source._rasterio = self.orig
        self.tmp.cleanup()

    def touch(self, lat, lon, res):
        open(os.path.join(self.dem, core.square_name(lat, lon, res) + '.tif'), 'wb').close()

    def test_mixed_30_and_90_squares_leave_no_step_or_offset(self):
        bb = [43, 40, 46, 42]  # 3 x 2 squares, a chessboard of GLO-30 and GLO-90
        for lat in (40, 41):
            for lon in (43, 44, 45):
                self.touch(lat, lon, 30 if (lat + lon) % 2 == 0 else 90)
        install(Rasterio())
        ppd = 60
        m = geotiff_source.GeoTiffMosaic(self.dem, bb, ppd=ppd)
        got = m.read(0, 0, m.width, m.height)
        cols = 43 + (np.arange(m.width) + 0.5) / ppd
        rows = 42 - (np.arange(m.height) + 0.5) / ppd
        want = field(cols[None, :], rows[:, None])
        self.assertLess(float(np.abs(got - want).max()), 0.01)  # a half-pixel shift of the 90 m grid would be 6.7 m east-west here
        # the step across each border (one pixel to the next) is the slope of the field, with no jump
        self.assertLess(float(np.abs(np.diff(got, axis=1) - 800.0 / ppd).max()), 0.01)

    def test_no_tile_square_is_zero_and_others_unharmed(self):
        bb = [43, 40, 45, 41]
        self.touch(40, 43, 30)
        open(core.no_tile_marker(self.dem, 40, 44), 'w').close()
        install(Rasterio())
        m = geotiff_source.GeoTiffMosaic(self.dem, bb, ppd=10)
        a = m.read(0, 0, m.width, m.height)
        self.assertEqual(0.0, float(a[:, 10:].max()))
        self.assertGreater(float(a[:, :10].min()), 0)

    def test_open_files_are_limited(self):
        bb = [32, 29, 40, 31]  # 16 squares
        for lat in (29, 30):
            for lon in range(32, 40):
                self.touch(lat, lon, 30)
        rio = Rasterio()
        install(rio)
        m = geotiff_source.GeoTiffMosaic(self.dem, bb, ppd=4)
        m.MAX_OPEN = 5
        m.read(0, 0, m.width, m.height)
        self.assertLessEqual(len(m._open), 5)
        self.assertEqual(16, len(rio.opened))
        self.assertEqual(11, len(rio.closed))

    def test_inspect_reports_void_share_and_missing(self):
        bb = [44, 40, 46, 41]
        self.touch(40, 44, 30)  # right half of the square is nodata (a border square of Armenia/Azerbaijan)
        install(Rasterio(lambda lon, lat: np.where(lon > 44.5, -9999.0, 100.0)))
        m = geotiff_source.GeoTiffMosaic(self.dem, bb, ppd=10)
        rows = {(a, b): (r, t) for a, b, r, t in m.inspect()}
        self.assertIn('void=50.0%', rows[(40, 44)][1])
        self.assertEqual(30, rows[(40, 44)][0])
        self.assertIn('NOT DOWNLOADED', rows[(40, 45)][1])
        open(core.no_tile_marker(self.dem, 40, 45), 'w').close()
        m = geotiff_source.GeoTiffMosaic(self.dem, bb, ppd=10)
        rows = {(a, b): (r, t) for a, b, r, t in m.inspect()}
        self.assertIn('no tile (404 in GLO-30 and GLO-90)', rows[(40, 45)][1])


if __name__ == '__main__':
    unittest.main()
