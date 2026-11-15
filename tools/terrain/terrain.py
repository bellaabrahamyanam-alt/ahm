#!/usr/bin/env python3
"""Builds the relief (terrain) tiles for ahm/map from Copernicus DEM. Steps: squares, download, check, build, preview, pack.
The area is `bbox` of app/js/config.js. Guide: docs/10-deployment-instructions.md, "Relief layer (optional)". Run `python terrain.py <step> -h`.
Needs numpy and Pillow (build, preview, pack) and rasterio (check, build)."""
import argparse
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import core  # noqa: E402

CONFIG_JS = os.path.join(HERE, '..', '..', 'app', 'js', 'config.js')


def bbox_of(a):
    return list(a.bbox) if a.bbox else core.read_bbox(CONFIG_JS)


def cmd_squares(a):
    bb = bbox_of(a)
    sq = core.squares_for_bbox(bb)
    print('# bbox %s: %d squares. URLs are from memory, UNVERIFIED: see docs/10 to list the bucket.' % (bb, len(sq)), file=sys.stderr)
    for lat, lon in sq:
        print(core.square_url(lat, lon, 30))


def fetch(url, dest):
    tmp = dest + '.part'
    req = urllib.request.Request(url, headers={'User-Agent': 'ahm-terrain/1'})
    with urllib.request.urlopen(req, timeout=60) as r, open(tmp, 'wb') as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, dest)


def cmd_download(a):
    os.makedirs(a.dem, exist_ok=True)
    bb = bbox_of(a)
    missing = []
    sq = core.squares_for_bbox(bb)
    for i, (lat, lon) in enumerate(sq, 1):
        have = [r for r in (30, 90) if os.path.isfile(os.path.join(a.dem, core.square_name(lat, lon, r) + '.tif'))]
        if have:
            print('[%d/%d] have GLO-%d %s/%s' % (i, len(sq), have[0], lat, lon))
            continue
        for res in (30, 90):
            url = core.square_url(lat, lon, res)
            print('[%d/%d] trying %s' % (i, len(sq), url))
            try:
                fetch(url, os.path.join(a.dem, core.square_name(lat, lon, res) + '.tif'))
                break
            except urllib.error.HTTPError as e:
                print('        HTTP %s' % e.code)
            except (urllib.error.URLError, OSError) as e:
                sys.exit('network error: %s\nNothing is lost: run the same command again, finished files are skipped.' % e)
        else:
            missing.append((lat, lon))
    if missing:
        print('\nNo file in GLO-30 or GLO-90 for %d square(s): %s\nIf they are sea this is fine (0 m). If they are land, the file names '
              'are probably wrong: list the bucket (docs/10).' % (len(missing), ', '.join('%s/%s' % m for m in missing)))


def mosaic(a):
    import geotiff_source
    try:
        return geotiff_source.GeoTiffMosaic(a.dem, bbox_of(a))
    except geotiff_source.SourceError as e:
        sys.exit('error: %s' % e)


def cmd_check(a):
    import geotiff_source
    m = mosaic(a)
    try:
        rows = m.inspect()
    except geotiff_source.SourceError as e:
        sys.exit('error: %s' % e)
    for lat, lon, res, text in rows:
        print('%4s %5s  %s' % (lat, lon, text))
    miss = sum(1 for r in rows if r[2] is None)
    print('%d squares, %d missing. Mosaic %d x %d px.' % (len(rows), miss, m.width, m.height))
    bb = bbox_of(a)
    print('Tiles for zoom 0..%d: %d' % (a.maxzoom, sum(core.tile_count(bb, z) for z in range(a.maxzoom + 1))))


def cmd_build(a):
    import geotiff_source
    m = mosaic(a)
    bb = bbox_of(a)
    total = sum(core.tile_count(bb, z) for z in range(a.maxzoom + 1))
    print('Building %d tiles (zoom 0..%d, step %g m) into %s' % (total, a.maxzoom, a.step, a.out))
    try:
        st = core.build(m, a.out, bb, a.maxzoom, a.step, a.force, progress=lambda s: print('  %d / %d tiles' % (s['written'], total), flush=True))
    except geotiff_source.SourceError as e:
        sys.exit('error: %s\nTiles already written are kept; run the same command again to continue.' % e)
    files, size = core.disk_totals(a.out)
    print('Done: written %d, skipped (already there) %d. On disk: %d tiles, %s.' % (st['written'], st['skipped'], files, core.human(size)))


def cmd_preview(a):
    z, lo, hi = core.preview(a.out, a.png, a.zoom)
    print('Wrote %s (zoom %d, elevations %.0f to %.0f m). Look for: mountains lit from the top left, no seams between tiles, '
          'flat sea at 0 m, no stripes or blocks.' % (a.png, z, lo, hi))


def cmd_pack(a):
    info = core.pack(a.out, a.archive)
    print('Wrote %s: %d files, %s. Unpack it in the forum folder: it creates ahm-terrain/.' % (a.archive, info['files'], core.human(info['bytes'])))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)

    def add(name, fn, h, dem=False, out=False):
        s = sub.add_parser(name, help=h)
        s.set_defaults(fn=fn)
        s.add_argument('--bbox', nargs=4, type=float, metavar=('W', 'S', 'E', 'N'), help='default: bbox of app/js/config.js')
        if dem:
            s.add_argument('--dem', required=True, help='folder of the downloaded .tif squares')
        if out:
            s.add_argument('--out', required=True, help='output folder (becomes <forum>/ahm-terrain/)')
        return s

    add('squares', cmd_squares, 'print the GLO-30 URLs of the squares')
    add('download', cmd_download, 'download the squares (GLO-90 for a square missing in GLO-30)', dem=True)
    c = add('check', cmd_check, 'open every square, report problems (dry run, writes nothing)', dem=True)
    c.add_argument('--maxzoom', type=int, default=11)
    b = add('build', cmd_build, 'build the tiles (resumable)', dem=True, out=True)
    b.add_argument('--maxzoom', type=int, default=11)
    b.add_argument('--step', type=float, default=1.0, help='elevation rounding in metres (1, or 0.5 for flat plains)')
    b.add_argument('--force', action='store_true', help='rewrite tiles that exist')
    v = add('preview', cmd_preview, 'write a hillshade contact sheet PNG of 3x3 tiles', out=True)
    v.add_argument('--zoom', type=int)
    v.add_argument('--png', default='preview.png')
    k = add('pack', cmd_pack, 'one .zip (or .tar) of the output for upload', out=True)
    k.add_argument('--archive', default='terrain.zip')
    a = p.parse_args(argv)
    try:
        a.fn(a)
    except Exception as e:  # noqa: BLE001
        if e.__class__.__name__ == 'SourceError':
            sys.exit('error: %s' % e)
        raise


if __name__ == '__main__':
    main()
