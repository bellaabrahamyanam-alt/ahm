"""Pure core of the terrain tile builder (T-053): tile maths, resampling, Terrarium encoding, pyramid, WebP writing, notice files, pack,
preview. Needs only numpy and Pillow. It never reads a GeoTIFF: a `Mosaic` subclass (geotiff_source.py for the real data) gives it pixels."""
import math
import os
import re
import tarfile
import zipfile

import numpy as np
from PIL import Image

TILE = 256
VERSION = 'v1'  # the folder of the tiles; a new version = a new folder (never overwrite tiles that browsers cache for a year)
# Required wording for ADAPTED data (the licence text, do not paraphrase). The same texts are in app/js/config.js (comment of basemap.terrain).
# GLO-30: verified. GLO-90: read on the Copernicus Data Space page of COP-DEM and in the ESA licence PDF (Art. 6(b)) through a summarising fetch tool,
# not as raw text; the PDF is said to write "WorldDEM(TM)-90" with a trademark sign, the page without. Compare with the licence before you publish.
ATTRIBUTION_30 = ('produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 '
                  'provided under COPERNICUS by the European Union and ESA; all rights reserved')
ATTRIBUTION_90 = ATTRIBUTION_30.replace('WorldDEM-30', 'WorldDEM-90')
ATTRIBUTION = ATTRIBUTION_30  # the text of a build that uses GLO-30 only (the default config text)
# --dataset: which Copernicus datasets a step may use, in the order they are tried. auto = GLO-30, GLO-90 for a square GLO-30 does not have.
DATASETS = {'auto': (30, 90), 'glo30': (30,), 'glo90': (90,)}


def resolutions(dataset):
    if dataset not in DATASETS:
        raise ValueError('unknown dataset %r (use %s)' % (dataset, ', '.join(DATASETS)))
    return DATASETS[dataset]


def attribution_for(used):
    """The required credit for the products really used: a set of 30 and/or 90. A mixed build names both (one sentence each)."""
    used = set(used)
    if used == {30, 90}:
        return ATTRIBUTION_30 + '; ' + ATTRIBUTION_90
    return ATTRIBUTION_90 if used == {90} else ATTRIBUTION_30
LICENCE_URL = 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model'
MAX_LAT = 85.0511287798066
EARTH_CIRC_M = 40075016.686


# ---------------------------------------------------------------- tile maths

def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    lat = max(-MAX_LAT, min(MAX_LAT, lat))
    x = math.floor((lon + 180.0) / 360.0 * n)
    y = math.floor((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_bounds(z, x, y):
    """(west, south, east, north) in degrees of tile z/x/y."""
    n = 2 ** z

    def lat(yy):
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))

    return x / n * 360.0 - 180.0, lat(y + 1), (x + 1) / n * 360.0 - 180.0, lat(y)


def tiles_for_bbox(bbox, z):
    """(x0, y0, x1, y1), inclusive, of the tiles of zoom z that touch bbox = (west, south, east, north)."""
    w, s, e, n = bbox
    eps = 1e-9
    x0, y0 = lonlat_to_tile(w, n, z)
    x1, y1 = lonlat_to_tile(e - eps, s + eps, z)
    return x0, y0, x1, y1


def tile_count(bbox, z):
    x0, y0, x1, y1 = tiles_for_bbox(bbox, z)
    return (x1 - x0 + 1) * (y1 - y0 + 1)


def read_bbox(config_js):
    """The `bbox: [W, S, E, N]` of app/js/config.js: the only copy of the area."""
    m = re.search(r'\bbbox:\s*\[([^\]]+)\]', open(config_js, encoding='utf-8').read())
    if not m:
        raise ValueError('no "bbox: [W, S, E, N]" found in ' + config_js)
    v = [float(p) for p in m.group(1).split(',')]
    if len(v) != 4 or v[0] >= v[2] or v[1] >= v[3]:
        raise ValueError('bbox must be [west, south, east, north]: ' + m.group(1))
    return [int(p) if p == int(p) else p for p in v]


# ---------------------------------------------------------------- Copernicus squares (names are UNVERIFIED, see docs/10)

def squares_for_bbox(bbox):
    """[(lat, lon)] of the south-west corners of the 1x1 degree squares that cover bbox."""
    w, s, e, n = bbox
    return [(la, lo) for la in range(math.floor(s), math.ceil(n)) for lo in range(math.floor(w), math.ceil(e))]


# A PREDICTION, not a fact: older sources (Google Earth Engine catalog, ASF HyP3) say GLO-30 leaves out Armenia and Azerbaijan; the Copernicus
# Data Space page says release 2023_1 opened them. Whether the public bucket holds those squares is UNVERIFIED: the download tells. Only used
# to print a note in `squares`; the download always asks the server and decides by its answer.
NO_GLO30_BOXES = [(43.4, 38.8, 46.7, 41.3), (44.7, 38.3, 50.9, 41.95)]  # Armenia with Nakhchivan, Azerbaijan (approximate)


def expected_dataset(lat, lon):
    """30 or 90: what older sources predict for the square whose south-west corner is (lat, lon). Only a prediction."""
    for w, s, e, n in NO_GLO30_BOXES:
        if lon < e and lon + 1 > w and lat < n and lat + 1 > s:
            return 90
    return 30


def square_id(lat, lon):
    return '%s%02d_%s%03d' % ('N' if lat >= 0 else 'S', abs(lat), 'E' if lon >= 0 else 'W', abs(lon))


def no_tile_marker(dem_dir, lat, lon):
    """File that says: the server answered HTTP 404 for this square (sea or no data: elevation 0). Its text lists the datasets that were tried
    ("30 90", "90"); an empty file means both (older runs)."""
    return os.path.join(dem_dir, 'NO_TILE_%s.txt' % square_id(lat, lon))


def marker_tried(dem_dir, lat, lon):
    """Set of datasets (30, 90) the marker covers, or None when there is no marker."""
    p = no_tile_marker(dem_dir, lat, lon)
    if not os.path.isfile(p):
        return None
    got = {int(t) for t in open(p, encoding='utf-8').read().split() if t in ('30', '90')}
    return got or {30, 90}


def dem_status(dem_dir, bbox, dataset='auto'):
    """{(lat, lon): 30 | 90 | 'none' | None}: a file of an allowed dataset (first in the order of `dataset`), confirmed no tile (a marker that
    covers every allowed dataset), or not downloaded yet (None)."""
    want = resolutions(dataset)
    out = {}
    for lat, lon in squares_for_bbox(bbox):
        out[(lat, lon)] = None
        for res in want:
            if os.path.isfile(os.path.join(dem_dir, square_name(lat, lon, res) + '.tif')):
                out[(lat, lon)] = res
                break
        else:
            tried = marker_tried(dem_dir, lat, lon)
            if tried and set(want) <= tried:
                out[(lat, lon)] = 'none'
    return out


def used_datasets(status):
    return {v for v in status.values() if v in (30, 90)}


def square_name(lat, lon, res=30):
    code = {30: '10', 90: '30'}[res]
    return 'Copernicus_DSM_COG_%s_%s%02d_00_%s%03d_00_DEM' % (code, 'N' if lat >= 0 else 'S', abs(lat), 'E' if lon >= 0 else 'W', abs(lon))


def square_url(lat, lon, res=30):
    name = square_name(lat, lon, res)
    return 'https://copernicus-dem-%dm.s3.eu-central-1.amazonaws.com/%s/%s.tif' % (res, name, name)


# ---------------------------------------------------------------- the source: a virtual mosaic of pixels

class Mosaic:
    """A regular grid in EPSG:4326: pixel (col, row) covers lon west + col/ppd .. +1/ppd, lat north - row/ppd .. -1/ppd.
    ppd = pixels per degree (3600 for GLO-30). A subclass implements read()."""

    def __init__(self, west, north, width, height, ppd=3600):
        self.west, self.north, self.width, self.height, self.ppd = west, north, width, height, ppd

    def read(self, c0, r0, c1, r1):
        """float32 array (r1 - r0, c1 - c0) of elevations in metres; the window is inside the grid. Missing data = 0."""
        raise NotImplementedError

    def datasets(self):
        """Set of the Copernicus datasets (30, 90) the pixels come from; it decides the credit in NOTICE.txt. A synthetic source: {30}."""
        return {30}


# ---------------------------------------------------------------- resampling

def supersample(source_px_m, tile_px_m):
    """Sub-samples per output pixel and axis: 1 when the source is coarser than the tile pixel, otherwise at least 2 (cap 4)."""
    ratio = tile_px_m / source_px_m
    return 1 if ratio <= 1 else min(4, max(2, math.ceil(ratio)))


def sample_tile(src, z, x, y, supersample_n=None, supersample=None):
    """Elevation (float32, 256x256) of tile z/x/y: every output pixel centre is mapped from Web Mercator to lon/lat, the source is
    sampled bilinearly at ss x ss points inside the pixel and the points are averaged. Outside the mosaic the edge value repeats."""
    ss = supersample if supersample is not None else supersample_n
    world = TILE * 2 ** z
    if ss is None:
        ss = globals()['supersample'](111320.0 / src.ppd, EARTH_CIRC_M / world)
    n = TILE * ss
    k = (np.arange(n) + 0.5) / ss
    lon = (x * TILE + k) / world * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y * TILE + k) / world))))
    c = np.clip((lon - src.west) * src.ppd - 0.5, 0, src.width - 1)
    r = np.clip((src.north - lat) * src.ppd - 0.5, 0, src.height - 1)
    c0, r0 = int(math.floor(c.min())), int(math.floor(r.min()))
    c1, r1 = min(src.width, int(math.floor(c.max())) + 2), min(src.height, int(math.floor(r.max())) + 2)
    b = np.asarray(src.read(c0, r0, c1, r1), dtype=np.float64)
    if b.shape != (r1 - r0, c1 - c0):
        raise ValueError('the source returned %s, expected %s' % (b.shape, (r1 - r0, c1 - c0)))
    cf, rf = c - c0, r - r0
    ci = np.clip(np.floor(cf).astype(int), 0, max(0, b.shape[1] - 2))
    ri = np.clip(np.floor(rf).astype(int), 0, max(0, b.shape[0] - 2))
    cj, rj = np.minimum(ci + 1, b.shape[1] - 1), np.minimum(ri + 1, b.shape[0] - 1)
    fx, fy = (cf - ci)[None, :], (rf - ri)[:, None]
    top = b[np.ix_(ri, ci)] * (1 - fx) + b[np.ix_(ri, cj)] * fx
    bot = b[np.ix_(rj, ci)] * (1 - fx) + b[np.ix_(rj, cj)] * fx
    v = top * (1 - fy) + bot * fy
    return v.reshape(TILE, ss, TILE, ss).mean(axis=(1, 3)).astype(np.float32)


def downsample_children(children):
    """Parent tile from its four children [top-left, top-right, bottom-left, bottom-right]: 2x2 blocks are averaged."""
    big = np.empty((2 * TILE, 2 * TILE), dtype=np.float32)
    big[:TILE, :TILE], big[:TILE, TILE:], big[TILE:, :TILE], big[TILE:, TILE:] = children
    return big.reshape(TILE, 2, TILE, 2).mean(axis=(1, 3)).astype(np.float32)


# ---------------------------------------------------------------- Terrarium

def terrarium_encode(elev, step=1.0):
    """uint8 (h, w, 3). Elevation is rounded to `step` metres; (R * 256 + G + B / 256) - 32768 = metres. NaN becomes 0."""
    e = np.nan_to_num(np.asarray(elev, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
    e = np.clip(np.round(e / step) * step, -32768.0, 32767.99)
    u = np.rint((e + 32768.0) * 256.0).astype(np.int64)
    return np.stack([(u >> 16) & 255, (u >> 8) & 255, u & 255], axis=-1).astype(np.uint8)


def terrarium_decode(rgb):
    a = np.asarray(rgb, dtype=np.float64)
    return (a[..., 0] * 256.0 + a[..., 1] + a[..., 2] / 256.0 - 32768.0).astype(np.float32)


# ---------------------------------------------------------------- the files next to the tiles

def notice_text(step, maxzoom, used=(30,)):
    used = sorted(set(used) or {30})
    return '\n'.join([
        'Terrain tiles of the ahm/map extension (relief layer). Keep this file with the tiles.',
        '',
        'Attribution (required, the licence wording for adapted data):',
        attribution_for(used),
        '',
        'Disclaimer: the licence states that the providers do not incur any liability for any use of the %s.'
        % ' and the '.join('Copernicus WorldDEM-%d' % r for r in used),
        'No endorsement: this product is not endorsed by, and no endorsement by the European Union or ESA may be implied.',
        'Subsequent users: whoever receives these tiles must receive this notice and is bound by the same obligations.',
        '',
        'Licence: ' + LICENCE_URL,
        'Processing: Copernicus DEM %s (%s) resampled to Web Mercator,'
        % ('GLO-30 and GLO-90' if used == [30, 90] else 'GLO-%d' % used[0], 'sea and squares with no tile = 0 m'),
        'zoom 0 to %d, 256 px, Terrarium encoding, lossless WebP, elevation rounded to %g m.' % (maxzoom, step),
        '',
    ])


def config_block(attribution, maxzoom, bbox, version=VERSION):
    """The lines to put into `basemap.terrain` of app/js/config.js after the tiles are uploaded (docs/10)."""
    return '\n'.join([
        '      tiles: ["https://YOUR-FORUM/ahm-terrain/%s/{z}/{x}/{y}.webp"],  // your forum address' % version,
        '      maxzoom: %d,' % maxzoom,
        '      bounds: [%s],  // the same numbers as bbox: no requests (and no PHP start) for tiles that were not built' % ', '.join('%g' % v for v in bbox),
        '      attribution: "%s",' % attribution,
    ])


def pack_facts(out):
    """(attribution, maxzoom, version) read back from an output folder, for the config block that `pack` prints."""
    text = open(os.path.join(out, 'NOTICE.txt'), encoding='utf-8').read().split('\n')
    att = text[text.index('Attribution (required, the licence wording for adapted data):') + 1]
    vs = sorted(d for d in os.listdir(out) if re.fullmatch(r'v\d+', d))
    ver = vs[-1] if vs else VERSION
    zs = [int(d) for d in os.listdir(os.path.join(out, ver)) if d.isdigit()]
    return att, max(zs), ver


HTACCESS = """# Static terrain tiles: Apache serves them directly, never through PHP (phpBB's rewrite rules must not see this folder).
# These directives are generated by tools/terrain/terrain.py and are NOT tested on a real server.
Options -Indexes
RewriteEngine Off
AddType image/webp .webp
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 year"
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.webp$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
"""


# ---------------------------------------------------------------- build

def tile_path(out, z, x, y, version=VERSION):
    return os.path.join(out, version, str(z), str(x), str(y) + '.webp')


def write_webp(path, elev, step):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    try:
        Image.fromarray(terrarium_encode(elev, step), 'RGB').save(tmp, 'WEBP', lossless=True, quality=100, method=4)
        os.replace(tmp, path)  # a tile is either complete or absent
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    return os.path.getsize(path)


def read_tile(path):
    return terrarium_decode(np.asarray(Image.open(path).convert('RGB')))


def build(src, out, bbox, maxzoom=11, step=1.0, force=False, version=VERSION, progress=None):
    """Writes zoom 0..maxzoom of the tiles that touch bbox into out/<version>/z/x/y.webp, depth first and post-order: the top-zoom tiles are
    sampled from src, every other tile is the average of its four children, and a tile is written after its children, so a tile on disk
    means its whole subtree is on disk (an interrupted run resumes by skipping what exists). Returns {written, skipped, bytes}."""
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'NOTICE.txt'), 'w', encoding='utf-8') as f:
        f.write(notice_text(step, maxzoom, src.datasets()))
    with open(os.path.join(out, '.htaccess'), 'w', encoding='utf-8') as f:
        f.write(HTACCESS)
    rng = {z: tiles_for_bbox(bbox, z) for z in range(maxzoom + 1)}
    st = {'written': 0, 'skipped': 0, 'bytes': 0}

    def subtree(z, x, y):
        total = 0
        for zz in range(z, maxzoom + 1):
            d = zz - z
            x0, y0, x1, y1 = rng[zz]
            a, b = max(x0, x << d), min(x1, ((x + 1) << d) - 1)
            c, e = max(y0, y << d), min(y1, ((y + 1) << d) - 1)
            total += max(0, b - a + 1) * max(0, e - c + 1)
        return total

    def tile(z, x, y, need):
        p = tile_path(out, z, x, y, version)
        if os.path.exists(p) and not force:
            st['skipped'] += subtree(z, x, y)
            return read_tile(p) if need else None
        if z == maxzoom:
            elev = sample_tile(src, z, x, y)
        else:
            kids = []
            for dy in (0, 1):
                for dx in (0, 1):
                    cx, cy = 2 * x + dx, 2 * y + dy
                    x0, y0, x1, y1 = rng[z + 1]
                    inside = x0 <= cx <= x1 and y0 <= cy <= y1
                    kids.append(tile(z + 1, cx, cy, True) if inside else np.zeros((TILE, TILE), np.float32))
            elev = downsample_children(kids)
        st['bytes'] += write_webp(p, elev, step)
        st['written'] += 1
        if progress and st['written'] % 100 == 0:
            progress(st)
        return elev

    x0, y0, x1, y1 = rng[0]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            tile(0, x, y, False)
    if st['bytes'] == 0:  # nothing written this time (resumed): report the real size on disk
        st['bytes'] = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(os.path.join(out, version)) for f in fs)
    return st


def disk_totals(out, version=VERSION):
    files = size = 0
    for d, _, fs in os.walk(os.path.join(out, version)):
        for f in fs:
            if f.endswith('.webp'):
                files += 1
                size += os.path.getsize(os.path.join(d, f))
    return files, size


def human(n):
    for u in ('B', 'KB', 'MB', 'GB'):
        if n < 1024 or u == 'GB':
            return '%.1f %s' % (n, u) if u != 'B' else '%d B' % n
        n /= 1024.0


# ---------------------------------------------------------------- pack and preview

def pack(out, archive, top='ahm-terrain'):
    """One archive of the whole output folder; its single top folder `ahm-terrain/` unpacks into the forum folder. .zip or .tar."""
    items = []
    for d, _, fs in os.walk(out):
        for f in sorted(fs):
            full = os.path.join(d, f)
            items.append((full, top + '/' + os.path.relpath(full, out).replace(os.sep, '/')))
    items.sort(key=lambda t: t[1])
    if archive.endswith('.tar'):
        with tarfile.open(archive, 'w') as t:
            for full, name in items:
                t.add(full, arcname=name)
    else:
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_STORED) as zf:  # WebP is already compressed
            for full, name in items:
                zf.write(full, name)
    return {'files': len(items), 'bytes': os.path.getsize(archive)}


def hillshade(elev, cell_m, azimuth=315.0, altitude=45.0, exaggeration=1.0):
    """Grey values 0..255 (simple Horn hillshade) for eyeballing a tile before upload."""
    z = np.pad(elev.astype(np.float64) * exaggeration, 1, mode='edge')
    dzdx = ((z[:-2, 2:] + 2 * z[1:-1, 2:] + z[2:, 2:]) - (z[:-2, :-2] + 2 * z[1:-1, :-2] + z[2:, :-2])) / (8 * cell_m)
    dzdy = ((z[2:, :-2] + 2 * z[2:, 1:-1] + z[2:, 2:]) - (z[:-2, :-2] + 2 * z[:-2, 1:-1] + z[:-2, 2:])) / (8 * cell_m)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(dzdy, -dzdx)
    az, alt = math.radians(360.0 - azimuth + 90.0), math.radians(altitude)
    s = math.sin(alt) * np.cos(slope) + math.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(s * 255.0, 0, 255).astype(np.uint8)


def preview(out, png, zoom=None, version=VERSION):
    """A contact sheet (up to 3x3 tiles around the middle of what exists at `zoom`) of hillshaded tiles. Returns (zoom, min m, max m)."""
    root = os.path.join(out, version)
    zooms = sorted(int(d) for d in os.listdir(root) if d.isdigit())
    if not zooms:
        raise ValueError('no tiles in ' + root)
    z = zoom if zoom is not None else min(max(zooms), 8)
    xs = sorted(int(d) for d in os.listdir(os.path.join(root, str(z))))
    xm = xs[len(xs) // 2]
    ys = sorted(int(f[:-5]) for f in os.listdir(os.path.join(root, str(z), str(xm))) if f.endswith('.webp'))
    ym = ys[len(ys) // 2]
    sheet = Image.new('L', (3 * TILE, 3 * TILE), 40)
    lo, hi = 1e9, -1e9
    for j in range(3):
        for i in range(3):
            p = tile_path(out, z, xm + i - 1, ym + j - 1, version)
            if not os.path.exists(p):
                continue
            e = read_tile(p)
            lo, hi = min(lo, float(e.min())), max(hi, float(e.max()))
            lat = tile_bounds(z, xm + i - 1, ym + j - 1)
            cell = EARTH_CIRC_M / (TILE * 2 ** z) * math.cos(math.radians((lat[1] + lat[3]) / 2))
            sheet.paste(Image.fromarray(hillshade(e, cell, exaggeration=2.0)), (i * TILE, j * TILE))
    sheet.save(png)
    return z, lo, hi
