// Heights from the Terrarium tiles (metres = R*256 + G + B/256 - 32768) and height profiles of lines (T-044). No map object here:
// the zoom is a parameter, so the same code serves the relief panel (map.js), the "Height profile" of a shape (shapes.js) and the
// travel cost grid (T-045). Needs AHM_CONFIG.basemap.terrain. Without CORS headers on the tile server the fetch fails and every
// height is NaN: the readout, the contours and the profiles then stay empty.
//   terrainSample(points, z, read?)  heights (m, NaN where a tile is missing) of points [lng, lat] at tile level z
//   resampleLine(coords, n)          n points spread evenly along a line: { pts, dist (km from the start), total (km) }
//   profileStats(h, total)           { length, min, max, up, down, fall, slope } of heights spread along `total` km
//   lineSection(coords, a, b)        the part of a line (or the shorter way round a ring) between the vertices nearest to a and b
//   profileLevel(total, lat, n?)     the tile level whose pixel is about as wide as the gap between samples
//   profileOf(coords, z?, n?, read?) the above together: { length, dist, pts, h, min, max, up, down, fall, slope } (z from profileLevel when absent)
const heightTiles = new Map(); // a fetched tile stays in a small cache of promises (one fetch per tile even when many points ask at once)
function terrainLocate(lng, lat, z) {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const sn = Math.sin((lat * Math.PI) / 180);
  const fy = (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  if (!(y >= 0 && y < n)) return null;
  const xw = ((x % n) + n) % n;
  return { key: z + '/' + xw + '/' + y, z, x: xw, y, u: fx - x, v: fy - y };
}
function terrainTile(l) {
  let tile = heightTiles.get(l.key);
  if (!tile) {
    const url = AHM_CONFIG.basemap.terrain.tiles[0].replace('{z}', l.z).replace('{x}', l.x).replace('{y}', l.y);
    tile = (async () => {
      const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none' });
      const cx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d', { willReadFrequently: true });
      cx.drawImage(bmp, 0, 0);
      return cx.getImageData(0, 0, bmp.width, bmp.height);
    })();
    if (heightTiles.size >= 60) heightTiles.delete(heightTiles.keys().next().value);
    heightTiles.set(l.key, tile);
    tile.catch(() => heightTiles.delete(l.key)); // a failed fetch is tried again next time
  }
  return tile;
}
function terrainDecode(img, u, v) {
  const px = Math.min(img.width - 1, Math.floor(u * img.width));
  const py = Math.min(img.height - 1, Math.floor(v * img.height));
  const i = (py * img.width + px) * 4;
  return img.data[i] * 256 + img.data[i + 1] + img.data[i + 2] / 256 - 32768;
}
/** Heights of many points [lng, lat] at tile level z (cut to the zoom of the tiles): metres, NaN where a tile is missing.
 *  `read(location)` gives a tile (a promise of { width, height, data }); tests pass a stand-in. */
async function terrainSample(points, z, read = terrainTile) {
  const t = AHM_CONFIG.basemap.terrain;
  if (!t || t.encoding !== 'terrarium') return points.map(() => NaN);
  z = Math.max(0, Math.min(t.maxzoom, Math.round(z)));
  const locs = points.map(([lng, lat]) => terrainLocate(lng, lat, z));
  const need = new Map();
  locs.forEach((l) => l && !need.has(l.key) && need.set(l.key, read(l)));
  const done = new Map();
  await Promise.all([...need].map(async ([k, pr]) => { try { done.set(k, await pr); } catch (e) { /* missing tile */ } }));
  return locs.map((l) => (l && done.get(l.key) ? terrainDecode(done.get(l.key), l.u, l.v) : NaN));
}

const terrainKm = (a, b) => {
  const r = Math.PI / 180;
  const q = Math.sin(((b[1] - a[1]) * r) / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(q));
};
/** n points spread evenly along the line `coords` ([lng, lat] pairs): { pts, dist (km from the start of each), total (km) }. */
function resampleLine(coords, n = 120) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + terrainKm(coords[i - 1], coords[i]));
  const total = cum[cum.length - 1];
  const pts = [],
    dist = [];
  for (let k = 0, i = 1; k < n; k++) {
    const d = n > 1 ? (total * k) / (n - 1) : 0;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = cum[i] === cum[i - 1] ? 0 : Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1]));
    pts.push([coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f]);
    dist.push(d);
  }
  return { pts, dist, total };
}
/** Statistics of heights `h` (metres, NaN skipped) spread along `total` km: length, min, max, ascent and descent (m, summed over
 *  the samples), fall (first height minus last: positive downhill, as for a river) and slope (the fall as % of the length). */
function profileStats(h, total) {
  const v = h.filter((x) => !Number.isNaN(x));
  if (v.length < 2) return null;
  let up = 0,
    down = 0;
  v.forEach((x, i) => i && (x > v[i - 1] ? (up += x - v[i - 1]) : (down += v[i - 1] - x)));
  const fall = v[0] - v[v.length - 1];
  return { length: total, min: Math.min(...v), max: Math.max(...v), up, down, fall, slope: total > 0 ? (fall / (total * 1000)) * 100 : 0 };
}
/** The part of a line between the vertices nearest to the points a and b (in the direction a to b). A closed ring (an outline of
 *  an area) gives the shorter of its two ways round. Returns [lng, lat] pairs, or null for a line with fewer than 2 points. */
function lineSection(coords, a, b) {
  if (!coords || coords.length < 2) return null;
  const nearest = (p) => coords.reduce((best, q, i) => { const d = terrainKm(p, q); return d < best[1] ? [i, d] : best; }, [-1, Infinity])[0];
  const i = nearest(a),
    j = nearest(b);
  const closed = coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
  const arc = (from, to) => (from <= to ? coords.slice(from, to + 1) : coords.slice(to, from + 1).reverse());
  if (!closed) return arc(i, j);
  const ring = coords.slice(0, -1),
    m = ring.length,
    fwd = [],
    back = [];
  for (let k = i; ; k = (k + 1) % m) { fwd.push(ring[k]); if (k === j) break; }
  for (let k = i; ; k = (k - 1 + m) % m) { back.push(ring[k]); if (k === j) break; }
  const len = (l) => l.reduce((s, p, x) => (x ? s + terrainKm(l[x - 1], p) : 0), 0);
  return len(fwd) <= len(back) ? fwd : back;
}
/** The tile level (3 to 12) whose pixel is about as wide as the gap between two samples of a line of `total` km at latitude `lat`:
 *  a long river is read from coarse tiles (few fetches), a short section from fine ones. */
function profileLevel(total, lat, n = 120) {
  const gap = Math.max(total / (n - 1), 0.001);
  const z = Math.ceil(Math.log2((40075 * Math.cos((lat * Math.PI) / 180)) / (256 * gap)));
  return Math.max(3, Math.min(12, z));
}
/** The height profile of a line: heights of `n` points spread evenly along it, and the statistics. Null when no heights came. */
async function profileOf(coords, z, n = 120, read) {
  const r = resampleLine(coords, n);
  if (z == null) z = profileLevel(r.total, r.pts[0][1], n);
  const h = Array.from(await terrainSample(r.pts, z, read));
  const s = profileStats(h, r.total);
  return s ? { ...s, dist: r.dist, pts: r.pts, h } : null;
}
