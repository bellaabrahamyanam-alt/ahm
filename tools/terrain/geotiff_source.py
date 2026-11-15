"""The ONLY part of the terrain builder that reads real GeoTIFF files (rasterio). It is deliberately small and CANNOT be tested in the
development sandbox (no rasterio, no real Copernicus files): the first real run is the test. Use `terrain.py check` before `build`."""
import os

import numpy as np

import core


class SourceError(Exception):
    pass


def _rasterio():
    try:
        import rasterio
        from rasterio.enums import Resampling
        from rasterio.windows import Window
    except ImportError:
        raise SourceError('rasterio is not installed: run  pip install rasterio  (see docs/10, "Relief layer")')
    return rasterio, Resampling, Window


class GeoTiffMosaic(core.Mosaic):
    """The 1x1 degree squares of dem_dir as one virtual grid of 3600 pixels per degree. Per square: GLO-30 file if present, else GLO-90
    (resampled bilinearly to the grid), else sea level (0 m). Files are named like core.square_name()."""

    def __init__(self, dem_dir, bbox, ppd=3600):
        self.rasterio, self.Resampling, self.Window = _rasterio()
        import math
        w, s, e, n = math.floor(bbox[0]), math.floor(bbox[1]), math.ceil(bbox[2]), math.ceil(bbox[3])
        super().__init__(w, n, (e - w) * ppd, (n - s) * ppd, ppd)
        self.south = s
        self.dem_dir = dem_dir
        self.squares = {}  # (lat, lon) -> (path, res) or None
        for lat, lon in core.squares_for_bbox(bbox):
            self.squares[(lat, lon)] = None
            for res in (30, 90):
                p = os.path.join(dem_dir, core.square_name(lat, lon, res) + '.tif')
                if os.path.isfile(p):
                    self.squares[(lat, lon)] = (p, res)
                    break
        self._open = {}

    def _ds(self, lat, lon):
        key = (lat, lon)
        if key not in self._open:
            path, res = self.squares[key]
            ds = self.rasterio.open(path)
            self._check(ds, path, lat, lon)
            self._open[key] = ds
        return self._open[key]

    @staticmethod
    def _check(ds, path, lat, lon):
        name = os.path.basename(path)
        if ds.crs is None or ds.crs.to_epsg() != 4326:
            raise SourceError('%s: CRS is %s, expected EPSG:4326' % (name, ds.crs))
        if ds.count != 1:
            raise SourceError('%s: %d bands, expected 1' % (name, ds.count))
        if ds.dtypes[0] != 'float32':
            raise SourceError('%s: dtype is %s, expected float32' % (name, ds.dtypes[0]))
        b = ds.bounds
        if abs(b.left - lon) > 0.01 or abs(b.bottom - lat) > 0.01 or abs(b.right - (lon + 1)) > 0.01 or abs(b.top - (lat + 1)) > 0.01:
            raise SourceError('%s: bounds %s are not the square %s/%s (a wrong or renamed file?)' % (name, tuple(b), lat, lon))

    def inspect(self):
        """Opens every square: returns [(lat, lon, res or None, text)]; raises SourceError on the first bad file."""
        rows = []
        for (lat, lon), v in sorted(self.squares.items()):
            if v is None:
                rows.append((lat, lon, None, 'MISSING in both GLO-30 and GLO-90: will be 0 m (fine for sea, wrong for land)'))
                continue
            ds = self._ds(lat, lon)
            rows.append((lat, lon, v[1], 'GLO-%d %dx%d nodata=%s' % (v[1], ds.width, ds.height, ds.nodata)))
        return rows

    def read(self, c0, r0, c1, r1):
        out = np.zeros((r1 - r0, c1 - c0), dtype=np.float32)
        ppd = self.ppd
        for (lat, lon), v in self.squares.items():
            if v is None:
                continue
            sc, sr = (lon - self.west) * ppd, (self.north - (lat + 1)) * ppd
            a, b, c, d = max(c0, sc), min(c1, sc + ppd), max(r0, sr), min(r1, sr + ppd)
            if a >= b or c >= d:
                continue
            ds = self._ds(lat, lon)
            sx, sy = ds.width / ppd, ds.height / ppd
            win = self.Window((a - sc) * sx, (c - sr) * sy, (b - a) * sx, (d - c) * sy)
            res = self.Resampling.nearest if sx == 1 and sy == 1 else self.Resampling.bilinear
            arr = ds.read(1, window=win, out_shape=(d - c, b - a), resampling=res).astype(np.float32)
            bad = ~np.isfinite(arr)
            if ds.nodata is not None:
                bad |= arr == np.float32(ds.nodata)
            arr[bad] = 0.0  # no data = sea level
            out[c - r0:d - r0, a - c0:b - c0] = arr
        return out
