// Shapes (core domain): borders of countries, regions and other areas, lines, and historical routes (types with `route: true`).
// Types, loading, the filter rules and plain geometry helpers. No DOM and no map here (the sidebar draws the list, the map draws the shapes).
// A shape is a GeoJSON feature in data/shapes.geojson; layers hold shapes as `{ shape: id }` members next to `{ place: id }`.
// Its look follows its TYPE (line pattern, width, default colour and fill), exactly as the look of a place follows its type.
// `dash` is one of the four patterns the map can draw: solid, dashed, dotted, dashdot.
const SHAPE_TYPES = {
  country: { label: 'Country', dash: 'solid', width: 2.6, color: '#b3261e', fill: 0.1 },
  kingdom: { label: 'Kingdom or empire', dash: 'solid', width: 2.2, color: '#7b1fa2', fill: 0.18 },
  province: { label: 'Region or province', dash: 'dashed', width: 2, color: '#0b6e8a', fill: 0.12 },
  district: { label: 'District', dash: 'dotted', width: 2, color: '#8d6e63', fill: 0.1 },
  territory: { label: 'Territory or area', dash: 'solid', width: 1.4, color: '#2e7d32', fill: 0.2 },
  disputed: { label: 'Disputed area', dash: 'dashdot', width: 2.2, color: '#e07b39', fill: 0.12 },
  // Routes: lines through places and free waypoints. `twoway`: usable both ways (trade, roads) or one way only (marches, migrations: drawn with
  // direction arrows). Same store, layers and period filter as borders.
  trade: { label: 'Trade route', dash: 'dashed', width: 2.4, color: '#b7791f', fill: 1, route: true, twoway: true },
  military: { label: 'Military march', dash: 'solid', width: 3, color: '#c62828', fill: 1, route: true, twoway: false },
  migration: { label: 'Migration', dash: 'dotted', width: 2.8, color: '#6a1b9a', fill: 1, route: true, twoway: false },
  journey: { label: 'Journey or embassy', dash: 'dashdot', width: 2.4, color: '#00796b', fill: 1, route: true, twoway: false },
  road: { label: 'Road', dash: 'solid', width: 2, color: '#5d4037', fill: 1, route: true, twoway: true },
  // Rivers: lines that are not routes (no stops, never used by path finding); they have their own tab.
  waterway: { label: 'River', dash: 'solid', width: 3, color: '#1e88e5', fill: 1, river: true },
};
const isRouteType = (t) => !!(SHAPE_TYPES[t] && SHAPE_TYPES[t].route);
const isRoute = (s) => isRouteType(s.type);
const isRiverType = (t) => !!(SHAPE_TYPES[t] && SHAPE_TYPES[t].river);
const isRiver = (s) => isRiverType(s.type);
const shapeGroup = (s) => (isRoute(s) ? 'route' : isRiver(s) ? 'river' : 'border');
const BORDER_TYPES = Object.keys(SHAPE_TYPES).filter((t) => !isRouteType(t) && !isRiverType(t));
const ROUTE_TYPE_LIST = Object.keys(SHAPE_TYPES).filter(isRouteType);
const RIVER_TYPE_LIST = Object.keys(SHAPE_TYPES).filter(isRiverType);
const SHAPE_FALLBACK = { label: 'Area', dash: 'solid', width: 1.4, color: '#2e7d32', fill: 0.2 };
// A stored shape whose type is gone from the dictionary is drawn like the first area type.
const shapeType = (t) => SHAPE_TYPES[t] || SHAPE_TYPES[BORDER_TYPES[0]] || SHAPE_FALLBACK;
const MAP_DASH = ['solid', 'dashed', 'dotted', 'dashdot']; // the patterns the map draws; double and triple are drawn solid for now
/** The line, river and area types of the types dictionary replace the built-in ones above (a dictionary without any keeps them). Call it when the dictionary loads or changes. */
function setShapeTypes(list) {
  const kinds = (list || []).filter((t) => t.geometry === 'line' || t.geometry === 'area' || t.geometry === 'river');
  if (!kinds.length) return;
  Object.keys(SHAPE_TYPES).forEach((k) => delete SHAPE_TYPES[k]);
  BORDER_TYPES.length = 0;
  ROUTE_TYPE_LIST.length = 0;
  RIVER_TYPE_LIST.length = 0;
  kinds.forEach((t) => {
    const st = t.style || {},
      o = t.geometry === 'area' ? st.outline || {} : st,
      label = ((t.names || []).find((n) => n.lang === 'en') || (t.names || [])[0] || {}).name || t.code,
      look = { label, dash: MAP_DASH.includes(o.pattern) ? o.pattern : 'solid', width: o.width || 2, color: t.color };
    SHAPE_TYPES[t.code] =
      t.geometry === 'line'
        ? { ...look, fill: 1, route: true, twoway: st.arrow !== true }
        : t.geometry === 'river'
          ? { ...look, fill: 1, river: true }
          : { ...look, fill: st.fill_opacity == null ? 0.15 : st.fill_opacity };
    (t.geometry === 'line' ? ROUTE_TYPE_LIST : t.geometry === 'river' ? RIVER_TYPE_LIST : BORDER_TYPES).push(t.code);
  });
}
const MAX_SHAPE_POINTS = 20000; // the server refuses more; imports are simplified to IMPORT_POINTS
const IMPORT_POINTS = 3000;
let shapes = []; // [{ id, names, type, color, opacity, label, date_from, date_to, source, geometry, from_place?, to_place? }] (routes: stops = ordered ids of the places the line passes, twoway = boolean)

const normShape = (f) => ({
  ...f.properties,
  geometry: f.geometry,
  ...(isRouteType(f.properties.type)
    ? { stops: Array.isArray(f.properties.stops) ? f.properties.stops : [], twoway: typeof f.properties.twoway === 'boolean' ? f.properties.twoway : shapeType(f.properties.type).twoway }
    : {}),
  date_from: f.properties.date_from ? dateUpgrade(f.properties.date_from) : null,
  date_to: f.properties.date_to ? dateUpgrade(f.properties.date_to) : null,
});
/** Shapes are an optional file: a store without it behaves as "no borders". */
const loadShapes = () => loadOpt(AHM_CONFIG.url.shapes, (fc) => fc.features.map(normShape));
const shapeById = (id) => shapes.find((s) => s.id === id);
const shapeKind = (g) => (/Polygon/.test(g.type) ? 'area' : 'line');
const shapeName = (s, l) => nameIn(s.names, l);
const shapeWhen = (s) => spanText(s.date_from, s.date_to);
/** The other versions of the same shape in time (T-041: same `series`), oldest first; [] for a shape with no series. */
const shapeVersions = (s) =>
  s.series
    ? shapes.filter((x) => x.series === s.series && x.id !== s.id).sort((a, b) => (dateKey(a.date_from) < dateKey(b.date_from) ? -1 : dateKey(a.date_from) > dateKey(b.date_from) ? 1 : 0))
    : [];
/** The end date that closes version `prev` the day before a new version starting at `from` begins; null when `prev` already has an end or starts at or after `from`. */
function versionEndBefore(prev, from) {
  if (!from || prev.date_to) return null;
  const start = dateBounds(from)[0];
  if (prev.date_from && dateBounds(prev.date_from)[0] >= start) return null;
  return { fmt: 'ymd', ts: secToIso(start - 86400), mode: 'exact', ts_to: null };
}
/** The values a new shape of this type starts with. */
const shapeDefaults = (type, kind) => ({
  color: shapeType(type).color,
  opacity: kind === 'line' ? 1 : shapeType(type).fill,
  label: true,
  ...(isRouteType(type) ? { twoway: shapeType(type).twoway, stops: [] } : {}),
});

/** The shapes that pass the filters, sorted by name. options: q = text, lang = language code or '', types = Set (empty = all), period = [start, end) in seconds,
 *  group = 'border' | 'route' | 'river' (omitted = all). */
function shapesRun({ q: text = '', lang: l = '', types = new Set(), period: [a, b] = [null, null], group = '' } = {}) {
  const q = norm(text);
  return shapes
    .filter((s) => {
      if (group && shapeGroup(s) !== group) return false;
      if (types.size && !types.has(s.type)) return false;
      if (!layerAllows(s.id)) return false; // the Only / Hide filters of the layers work on shapes too
      if (timeLook(s) === 'no') return false; // the time slider (T-040)
      if (a !== null || b !== null) {
        // the same rule as for places: with a period set, only shapes whose life is known and overlaps it
        if (!s.date_from && !s.date_to) return false;
        const [lo, hi] = spanBounds(s.date_from, s.date_to);
        if (a !== null && hi <= a) return false;
        if (b !== null && lo >= b) return false;
      }
      return !q || s.names.some((n) => norm(n.name).includes(q));
    })
    .sort((x, y) => shapeName(x, l).localeCompare(shapeName(y, l)));
}

// ---- geometry helpers (plain GeoJSON, longitude first) ----
const GEOM_LINES = { Polygon: (c) => c, MultiPolygon: (c) => c.flat(), LineString: (c) => [c], MultiLineString: (c) => c };
/** Every line or ring of a geometry, as a list of point lists. */
const geomLines = (g) => GEOM_LINES[g.type](g.coordinates);
const geomPoints = (g) => geomLines(g).flat();
/** Length in km of one list of points [lon, lat] (haversine). */
function lineKm(pts) {
  const rad = Math.PI / 180;
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      p = pts[i],
      h = Math.sin(((p[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(p[1] * rad) * Math.sin(((p[0] - a[0]) * rad) / 2) ** 2;
    km += 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return km;
}
/** Length of a line in km (MultiLineString: the parts added). */
const geomLengthKm = (g) => geomLines(g).reduce((n, l) => n + lineKm(l), 0);
/** The line the other way round (a route's direction is its point order). */
const geomReverse = (g) => ({ type: g.type, coordinates: g.type === 'LineString' ? g.coordinates.slice().reverse() : g.coordinates.map((l) => l.slice().reverse()).reverse() });
const geomCount = (g) => geomPoints(g).length;
/** [west, south, east, north] */
function geomBBox(g) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  geomPoints(g).forEach(([x, y]) => {
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  });
  return b;
}
const bboxCorners = (b) => [
  [b[0], b[1]],
  [b[2], b[3]],
];
const bboxArea = (b) => (b[2] - b[0]) * (b[3] - b[1]);
// Douglas-Peucker (iterative, so a long coastline cannot overflow the stack): keeps the points that matter within `tol` degrees.
function simplifyLine(pts, tol) {
  const n = pts.length;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n),
    stack = [[0, n - 1]];
  keep[0] = keep[n - 1] = 1;
  const dist2 = (p, a, b) => {
    let dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len = dx * dx + dy * dy,
      t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
    dx = a[0] + t * dx - p[0];
    dy = a[1] + t * dy - p[1];
    return dx * dx + dy * dy;
  };
  while (stack.length) {
    const [i, j] = stack.pop();
    let max = 0,
      at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = dist2(pts[k], pts[i], pts[j]);
      if (d > max) (max = d), (at = k);
    }
    if (at > 0 && max > tol * tol) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
/** The same geometry with at most `max` points (a ring keeps at least 4, a line at least 2); the tolerance grows until it fits. */
function simplifyGeometry(g, max = IMPORT_POINTS) {
  if (geomCount(g) <= max) return g;
  const ring = g.type === 'Polygon' || g.type === 'MultiPolygon',
    one = (l, tol) => {
      const s = simplifyLine(l, tol);
      return s.length >= (ring ? 4 : 2) ? s : l.length >= (ring ? 4 : 2) && ring ? [l[0], l[Math.floor(l.length / 3)], l[Math.floor((2 * l.length) / 3)], l[0]] : s;
    },
    build = (tol) => {
      const f = (l) => one(l, tol);
      return {
        type: g.type,
        coordinates:
          g.type === 'Polygon'
            ? g.coordinates.map(f)
            : g.type === 'MultiPolygon'
              ? g.coordinates.map((p) => p.map(f))
              : g.type === 'LineString'
                ? f(g.coordinates)
                : g.coordinates.map(f),
      };
    };
  let tol = 0.0005,
    out = build(tol);
  while (geomCount(out) > max && tol < 5) out = build((tol *= 1.6));
  return out;
}
/** The geometry a drawing gives: an area needs 3 points, a line 2; null when there are fewer. */
function geomFromDraw(kind, pts) {
  if (kind === 'area') return pts.length >= 3 ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] } : null;
  return pts.length >= 2 ? { type: 'LineString', coordinates: pts } : null;
}
/** The points of a drawable geometry (one ring or one line), or null for a shape the drawing tool cannot edit (several parts or holes). */
function geomToDraw(g) {
  if (g.type === 'Polygon' && g.coordinates.length === 1) return g.coordinates[0].slice(0, -1);
  return g.type === 'LineString' ? g.coordinates : null;
}
// A guess of the border type from what OpenStreetMap says about a search result (addresstype).
function guessShapeType(x) {
  const t = x.addresstype || x.type || '';
  const pick = (c) => (SHAPE_TYPES[c] ? c : BORDER_TYPES[0] || 'territory'); // the guess names a type that exists
  if (t === 'country') return pick('country');
  if (['state', 'region', 'province', 'state_district'].includes(t)) return pick('province');
  if (['county', 'district', 'municipality', 'city', 'town', 'village', 'suburb', 'borough', 'city_district'].includes(t)) return pick('district');
  return pick('territory');
}
// ---- a section of a river between two clicks (the river twin of "follow modern roads" for routes) ----
const RIVER_CLICK_KM = 1; // a click farther than this from the river is not on it (two rivers closer than that cannot be told apart by clicks)
const RIVER_JOIN_KM = 0.3; // pieces of a river whose ends are closer than this count as joined
const riverGraphs = new WeakMap(); // geometry -> { pts, adj }, built once per geometry
function riverGraph(g) {
  let r = riverGraphs.get(g);
  if (r) return r;
  const pts = [],
    adj = [],
    ends = [];
  geomLines(g).forEach((l) => {
    if (l.length < 2) return;
    ends.push(pts.length);
    l.forEach((p, i) => {
      pts.push(p), adj.push([]);
      if (!i) return;
      const k = pts.length - 1,
        w = lineKm([pts[k - 1], p]);
      adj[k - 1].push([k, w]), adj[k].push([k - 1, w]);
    });
    ends.push(pts.length - 1);
  });
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const w = lineKm([pts[ends[i]], pts[ends[j]]]);
      if (w <= RIVER_JOIN_KM) adj[ends[i]].push([ends[j], w]), adj[ends[j]].push([ends[i], w]);
    }
  riverGraphs.set(g, (r = { pts, adj }));
  return r;
}
/** The way along the river `g` (LineString or MultiLineString, pieces may touch) from the point nearest to `a` to the point nearest to `b`.
 *  Returns { coords, km, offKm } (offKm: how far the clicks were from the river) or { error: 'far' | 'apart' }: a click more than
 *  `maxKm` (1 km) from the river, or the two points are on pieces that do not join. */
function riverSection(g, a, b, maxKm = RIVER_CLICK_KM) {
  const { pts, adj } = riverGraph(g),
    near = (p) => {
      const c = Math.cos((p[1] * Math.PI) / 180);
      let best = -1,
        d = Infinity;
      pts.forEach((q, i) => {
        const e = ((q[0] - p[0]) * c) ** 2 + (q[1] - p[1]) ** 2;
        if (e < d) (d = e), (best = i);
      });
      return best;
    },
    s = near(a),
    t = near(b);
  if (s < 0 || t < 0) return { error: 'far' };
  const offKm = Math.max(lineKm([a, pts[s]]), lineKm([b, pts[t]]));
  if (offKm > maxKm) return { error: 'far', offKm };
  const dist = new Float64Array(pts.length).fill(Infinity),
    prev = new Int32Array(pts.length).fill(-1),
    heap = [[0, s]];
  dist[s] = 0;
  const push = (x) => {
      heap.push(x);
      for (let i = heap.length - 1, p; i > 0 && heap[(p = (i - 1) >> 1)][0] > heap[i][0]; i = p) [heap[p], heap[i]] = [heap[i], heap[p]];
    },
    pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ; ) {
          let m = i;
          const l = 2 * i + 1,
            r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    if (u === t) break;
    for (const [v, w] of adj[u])
      if (d + w < dist[v]) (dist[v] = d + w), (prev[v] = u), push([d + w, v]);
  }
  if (dist[t] === Infinity) return { error: 'apart' };
  const coords = [];
  for (let v = t; v !== -1; v = prev[v]) {
    const q = pts[v],
      l = coords[coords.length - 1];
    if (!l || l[0] !== q[0] || l[1] !== q[1]) coords.push(q.slice()); // two pieces that meet share a point
  }
  return { coords: coords.reverse(), km: dist[t], offKm };
}
/** The colour of the name drawn on the map: the shape colour, darkened so it reads on the white halo. */
function shapeInk(hex) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.5).toString(16).padStart(2, '0')).join('');
}
/** Where to write the name: inside the largest part of an area (the point farthest from every edge, found on a grid), the middle of a line. */
function geomLabelPoint(g) {
  if (g.type === 'LineString' || g.type === 'MultiLineString') {
    const l = geomLines(g).reduce((a, b) => (b.length > a.length ? b : a));
    return l[Math.floor(l.length / 2)];
  }
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates,
    box = (r) => geomBBox({ type: 'LineString', coordinates: r }),
    best = polys.reduce((a, p) => (bboxArea(box(p[0])) > bboxArea(box(a[0])) ? p : a)),
    segs = best.flatMap((r) => r.slice(1).map((p, i) => [r[i], p])),
    inside = (x, y) => {
      let c = false;
      best.forEach((r) => {
        for (let i = 0, j = r.length - 1; i < r.length; j = i++)
          if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
      });
      return c;
    },
    dist = (x, y) => {
      let m = Infinity;
      for (const [a, b] of segs) {
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          len = dx * dx + dy * dy,
          t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0,
          ex = a[0] + t * dx - x,
          ey = a[1] + t * dy - y;
        m = Math.min(m, ex * ex + ey * ey);
      }
      return m;
    };
  const b = box(best[0]);
  let at = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
    top = -1,
    w = (b[2] - b[0]) / 2,
    h = (b[3] - b[1]) / 2;
  for (let round = 0, c = at.slice(); round < 3; round++) {
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++) {
        const x = c[0] + (i / 6) * w,
          y = c[1] + (j / 6) * h;
        if (!inside(x, y)) continue;
        const d = dist(x, y);
        if (d > top) (top = d), (at = [x, y]);
      }
    c = at.slice();
    w /= 4;
    h /= 4;
  }
  return at;
}
