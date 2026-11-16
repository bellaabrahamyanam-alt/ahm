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
    res = core.resolutions(a.dataset)
    n90 = 0
    for lat, lon in sq:
        if a.dataset == 'auto' and core.expected_dataset(lat, lon) == 90:
            n90 += 1
            note = 'GLO-30 first; older sources predict GLO-30 is missing here, so GLO-90 is probably used (only a prediction)'
        elif a.dataset == 'auto':
            note = 'GLO-30 first, GLO-90 if the server has no GLO-30 file'
        else:
            note = 'GLO-%d only' % res[0]
        print('%s  # %s %s' % (core.square_url(lat, lon, res[0]), core.square_id(lat, lon), note))
    extra = ''
    if a.dataset == 'auto':
        extra = (' About %d may come from GLO-90 (Armenia/Azerbaijan, approximate boxes; this is a prediction from older sources: the first '
                 'download shows the truth, and prints how many squares came from which dataset).' % n90)
    print('# bbox %s: %d squares, dataset %s.%s Squares that are sea have no file. The first word of a line is the address; the addresses '
          'are from memory, UNVERIFIED: see docs/10.' % (bb, len(sq), a.dataset, extra), file=sys.stderr)


class DownloadStop(Exception):
    """The download cannot go on and must NOT be read as "no tile": the run stops and can be repeated."""


def fetch(url, dest):
    tmp = dest + '.part'
    req = urllib.request.Request(url, headers={'User-Agent': 'ahm-terrain/1'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r, open(tmp, 'wb') as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def fetch_square(dem, lat, lon, dataset='auto', fetch=fetch, log=print):
    """Gets the square from the datasets `dataset` allows, in order. Returns 30, 90, or 'none' (HTTP 404 in every allowed dataset: sea or no
    data, 0 m; remembered in a marker file). ONLY an HTTP 404 means "no tile". 403, 5xx, network errors and timeouts raise DownloadStop
    (a flattened mountain would look like sea)."""
    want = core.resolutions(dataset)
    for res in want:
        if os.path.isfile(os.path.join(dem, core.square_name(lat, lon, res) + '.tif')):
            return res
    tried = core.marker_tried(dem, lat, lon)
    if tried and set(want) <= tried:
        return 'none'
    for res in want:
        if tried and res in tried:
            continue  # a 404 for this dataset is already known
        url = core.square_url(lat, lon, res)
        log('        trying %s' % url)
        try:
            fetch(url, os.path.join(dem, core.square_name(lat, lon, res) + '.tif'))
            return res
        except urllib.error.HTTPError as e:
            if e.code == 404:
                log('        404: not in GLO-%d' % res)
                continue
            raise DownloadStop(
                'HTTP %s for %s: not treated as sea. %sNothing is lost: fix the cause and run the same command again, finished files are skipped.'
                % (e.code, url, 'S3 answers 403 for a missing file when it forbids listing: open the address in the browser; if the file exists the '
                   'server refuses you, if it is missing see docs/10. ' if e.code == 403 else ''))
        except (urllib.error.URLError, OSError) as e:  # a timeout and a reset connection are OSError
            raise DownloadStop('network error for %s: %s. Not treated as sea. Nothing is lost: run the same command again, finished files are '
                               'skipped.' % (url, e))
    with open(core.no_tile_marker(dem, lat, lon), 'w', encoding='utf-8') as f:
        f.write(' '.join(str(r) for r in sorted(set(want) | (tried or set()))) + '\n')
    log('        no tile (HTTP 404 in %s): taken as sea / no data, elevation 0 m (noted in %s)'
        % (' and '.join('GLO-%d' % r for r in want), os.path.basename(core.no_tile_marker(dem, lat, lon))))
    return 'none'


def cmd_download(a):
    os.makedirs(a.dem, exist_ok=True)
    sq = core.squares_for_bbox(bbox_of(a))
    none = []
    got = {30: 0, 90: 0}
    for i, (lat, lon) in enumerate(sq, 1):
        print('[%d/%d] %s' % (i, len(sq), core.square_id(lat, lon)))
        try:
            r = fetch_square(a.dem, lat, lon, a.dataset)
        except DownloadStop as e:
            sys.exit('stopped: %s' % e)
        if r == 'none':
            none.append((lat, lon))
        else:
            got[r] += 1
    print('\nDone (dataset %s): %d squares from GLO-30, %d from GLO-90, %d without a tile.' % (a.dataset, got[30], got[90], len(none)))
    if none:
        print('Without a tile (HTTP 404, taken as 0 m): %s\nFine for sea (Persian Gulf, Black Sea, Caspian). If one of them is land, '
              'the file names are probably wrong: list the bucket (docs/10).' % ', '.join('%s/%s' % m for m in none))


def need_downloaded(a):
    """Stops when a square was neither downloaded nor confirmed absent: building from it would flatten real mountains to 0 m."""
    todo = [k for k, v in core.dem_status(a.dem, bbox_of(a), a.dataset).items() if v is None]
    if todo:
        sys.exit('error: %d square(s) not downloaded yet (first: %s/%s). Run  python terrain.py download --dem %s --dataset %s  again; it continues '
                 'where it stopped.' % (len(todo), todo[0][0], todo[0][1], a.dem, a.dataset))


def mosaic(a):
    import geotiff_source
    try:
        return geotiff_source.GeoTiffMosaic(a.dem, bbox_of(a), dataset=a.dataset)
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
    n90 = sum(1 for r in rows if r[2] == 90)
    print('%d squares: %d GLO-30, %d GLO-90, %d without a tile (0 m). Mosaic %d x %d px (virtual, nothing of that size is held in memory).'
          % (len(rows), len(rows) - miss - n90, n90, miss, m.width, m.height))
    seams = core.seam_edges(m.status)
    if seams:
        print('%d borders between a GLO-30 square and a GLO-90 square (different products: a seam is possible there). Look at some after the '
              'build, for example:' % len(seams))
        for lon, lat in seams[:3]:
            print('  python terrain.py preview --out ahm-terrain --zoom 10 --at %g %g --png seam.png' % (lon, lat))
    print('Credit for this data: ' + core.attribution_for(m.datasets()))
    need_downloaded(a)
    bb = bbox_of(a)
    print('Tiles for zoom 0..%d: %d' % (a.maxzoom, sum(core.tile_count(bb, z) for z in range(a.maxzoom + 1))))


def cmd_build(a):
    import geotiff_source
    need_downloaded(a)
    m = mosaic(a)
    bb = bbox_of(a)
    total = sum(core.tile_count(bb, z) for z in range(a.maxzoom + 1))
    print('Building %d tiles (zoom 0..%d, step %g m) into %s' % (total, a.maxzoom, a.step, a.out))
    try:
        st = core.build(m, a.out, bb, a.maxzoom, a.step, a.force, a.version, progress=lambda s: print('  %d / %d tiles' % (s['written'], total), flush=True))
    except geotiff_source.SourceError as e:
        sys.exit('error: %s\nTiles already written are kept; run the same command again to continue.' % e)
    files, size = core.disk_totals(a.out, a.version)
    print('Done: written %d, skipped (already there) %d. On disk: %d tiles, %s.' % (st['written'], st['skipped'], files, core.human(size)))
    print('\nAfter you upload the tiles, put this into basemap.terrain of app/js/config.js:\n' + core.config_block(core.attribution_for(m.datasets()), a.maxzoom, bb, a.version))


def cmd_preview(a):
    z, lo, hi = core.preview(a.out, a.png, a.zoom, a.version, tuple(a.at) if a.at else None)
    print('Wrote %s (zoom %d, elevations %.0f to %.0f m). Look for: mountains lit from the top left, no seams between tiles, '
          'flat sea at 0 m, no stripes or blocks. Near a border of Armenia or Azerbaijan (GLO-90 next to GLO-30) also look for a straight line '
          'where the sharpness or the height changes: use --at LON LAT.' % (a.png, z, lo, hi))


def cmd_pack(a):
    info = core.pack(a.out, a.archive)
    print('Wrote %s: %d files, %s. Unpack it in the forum folder: it creates ahm-terrain/.' % (a.archive, info['files'], core.human(info['bytes'])))
    att, maxzoom, ver = core.pack_facts(a.out)
    print('\nAfter you upload the tiles, put this into basemap.terrain of app/js/config.js:\n' + core.config_block(att, maxzoom, bbox_of(a), ver))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)

    def add(name, fn, h, dem=False, out=False, dataset=False):
        s = sub.add_parser(name, help=h)
        s.set_defaults(fn=fn)
        if dataset or dem:
            s.add_argument('--dataset', choices=list(core.DATASETS), default='auto',
                           help='auto (default): GLO-30, GLO-90 for a square GLO-30 does not have; glo30: only GLO-30; glo90: only GLO-90 (90 m)')
        s.add_argument('--bbox', nargs=4, type=float, metavar=('W', 'S', 'E', 'N'), help='default: bbox of app/js/config.js')
        if dem:
            s.add_argument('--dem', required=True, help='folder of the downloaded .tif squares')
        if out:
            s.add_argument('--out', required=True, help='output folder (becomes <forum>/ahm-terrain/)')
        return s

    add('squares', cmd_squares, 'print the URL of every square and the dataset it comes from', dataset=True)
    add('download', cmd_download, 'download the squares (--dataset decides GLO-30, GLO-90 or both)', dem=True)
    c = add('check', cmd_check, 'open every square, report problems (dry run, writes nothing)', dem=True)
    c.add_argument('--maxzoom', type=int, default=11)
    b = add('build', cmd_build, 'build the tiles (resumable)', dem=True, out=True)
    b.add_argument('--maxzoom', type=int, default=11)
    b.add_argument('--step', type=float, default=1.0, help='elevation rounding in metres (1, or 0.5 for flat plains)')
    b.add_argument('--version', default=core.VERSION, help='version folder of the tiles (v1; a new build for users gets v2)')
    b.add_argument('--force', action='store_true', help='rewrite tiles that exist')
    v = add('preview', cmd_preview, 'write a hillshade contact sheet PNG of 3x3 tiles', out=True)
    v.add_argument('--zoom', type=int)
    v.add_argument('--at', nargs=2, type=float, metavar=('LON', 'LAT'), help='centre the sheet on this place (default: the middle of the tiles)')
    v.add_argument('--png', default='preview.png')
    v.add_argument('--version', default=core.VERSION)
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
