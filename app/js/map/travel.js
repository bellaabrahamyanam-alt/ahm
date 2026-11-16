// Travel time and least-cost path from the terrain (T-045). An ESTIMATE on the modern relief (Terrarium tiles, terrain.js): no rivers,
// lakes, snow, seasons, roads or borders as obstacles. Walking speed by Tobler's hiking function v = 6 * exp(-3.5 * |slope + 0.05|) km/h
// (slope = rise / run), times a mode multiplier (AHM_CONFIG.travel.modes). The search is Dijkstra with a binary heap over a grid of
// 8-neighbour cells (250 m to 1 km), run in a Web Worker so the page does not freeze (inline when there is no Worker).
// Commands (AHM.map.*, I-2 [1.9]): travel({ from, to?, places?, along?, mode?, hoursPerDay?, days? }), travelClear().
//   from: [lon, lat] or { shape: id } (all the cells of a route or river are sources at cost 0); to: [lon, lat];
//   places: [{ id, lon, lat }] (answered with the hours to each); along: a shape id: only the walking time along its own line, there and
//   back (answered with { hoursPerDay, along: { km, hours, backHours } }). Resolves to
//   { cellKm, hoursPerDay, clipped (the area was cut at 105 km from the start), bands: [{ day, hours }], path: { coordinates, hours, km } | null,
//   reach: [{ id, hours }] } or { error }.
//   The map shows the lines of 1, 2, 3 ... days (labelled) and the path.
// Pure functions (tests): toblerKmh, travelGrid, leastCost, pathTo, cellAt, travelTimeOf.

/** Walking speed (km/h) on a slope (rise / run; positive uphill): fastest, 6 km/h, on a gentle downhill of 5 %; never below 0.15 km/h. */
function toblerKmh(slope) {
  const s = Math.max(-1, Math.min(1, slope)); // a slope beyond 45 degrees counts as 45: noise in the heights must not give an endless time
  return 6 * Math.exp(-3.5 * Math.abs(s + 0.05));
}
/** The grid of a box [west, east, south, north] with cells about `cellKm` wide: { w, e, s, n, nx, ny }. */
function travelGrid([w, e, s, n], cellKm) {
  const lat0 = (s + n) / 2,
    kmLon = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  return { w, e, s, n, nx: Math.max(2, Math.round(((e - w) * kmLon) / cellKm) + 1), ny: Math.max(2, Math.round(((n - s) * 111.32) / cellKm) + 1) };
}
/** The cell index of a point, or -1 outside the grid. */
function cellAt(g, lon, lat) {
  const i = Math.round(((lon - g.w) / (g.e - g.w)) * (g.nx - 1)),
    j = Math.round(((lat - g.s) / (g.n - g.s)) * (g.ny - 1));
  return i < 0 || j < 0 || i >= g.nx || j >= g.ny ? -1 : j * g.nx + i;
}
/** Least cost (hours) from the cells `sources` (cost 0) to every cell: { cost, prev } (cost Infinity where not reached, prev -1 at a
 *  source). h: heights (m, NaN = no data, never crossed) row by row from the south; kmLon / kmLat: km per degree; mult: the mode
 *  multiplier; maxHours: cells farther than this are not expanded. Self-contained (and toblerKmh): it is also run in a worker. */
function leastCost(nx, ny, h, w, e, s, n, sources, mult, maxHours) {
  const N = nx * ny,
    cost = new Float64Array(N).fill(Infinity), // Float64, not Float32: a stored cost must equal the one in the heap
    prev = new Int32Array(N).fill(-1),
    heap = [],
    dLat = (n - s) / (ny - 1),
    dLon = (e - w) / (nx - 1),
    kmLat = dLat * 111.32,
    push = (c, i) => {
      heap.push([c, i]);
      for (let k = heap.length - 1, p; k > 0 && heap[(p = (k - 1) >> 1)][0] > heap[k][0]; k = p) [heap[p], heap[k]] = [heap[k], heap[p]];
    },
    pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ; ) {
          let m = k;
          const l = 2 * k + 1,
            r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
  sources.forEach((i) => i >= 0 && h[i] === h[i] && ((cost[i] = 0), push(0, i)));
  while (heap.length) {
    const [c, u] = pop();
    if (c > cost[u]) continue;
    if (c > maxHours) continue;
    const ui = u % nx,
      uj = (u - ui) / nx,
      kmLon = dLon * 111.32 * Math.cos(((s + uj * dLat) * Math.PI) / 180);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const vi = ui + di,
          vj = uj + dj;
        if (vi < 0 || vj < 0 || vi >= nx || vj >= ny) continue;
        const v = vj * nx + vi;
        if (h[v] !== h[v]) continue; // no height: never crossed
        const km = Math.hypot(di * kmLon, dj * kmLat),
          t = c + km / (toblerKmh((h[v] - h[u]) / (km * 1000)) * mult);
        if (t < cost[v]) (cost[v] = t), (prev[v] = u), push(t, v);
      }
  }
  return { cost, prev };
}
/** The cells from a source to cell `i` along `prev` (the way back from i), as [lon, lat] pairs in the direction source -> i. */
function pathTo(g, prev, i) {
  const out = [];
  for (let c = i; c >= 0; c = prev[c]) {
    const ci = c % g.nx;
    out.push([g.w + ((g.e - g.w) * ci) / (g.nx - 1), g.s + ((g.n - g.s) * ((c - ci) / g.nx)) / (g.ny - 1)]);
  }
  return out.reverse();
}
/** The walking time (hours) along a height profile (profileOf: dist in km, h in metres, NaN skipped), forward or backward. */
function travelTimeOf(p, mult = 1, backward = false) {
  const idx = p.h.map((x, i) => (Number.isNaN(x) ? -1 : i)).filter((i) => i >= 0);
  if (backward) idx.reverse();
  let t = 0;
  for (let k = 1; k < idx.length; k++) {
    const a = idx[k - 1],
      b = idx[k],
      km = Math.abs(p.dist[b] - p.dist[a]);
    if (km > 0) t += km / (toblerKmh((p.h[b] - p.h[a]) / (km * 1000)) * mult);
  }
  return t;
}

// ---- running it: the grid is read from the tiles, the search runs in a worker, the result is drawn ----
const travelSource = () =>
  `${toblerKmh}\n${leastCost}\nonmessage = (e) => { const d = e.data, r = leastCost(d.nx, d.ny, d.h, d.w, d.e, d.s, d.n, d.sources, d.mult, d.maxHours); postMessage(r, [r.cost.buffer, r.prev.buffer]); };`;
/** leastCost in a worker (a blob made from the source of the functions above); inline when no Worker can be made. */
function travelSearch(job) {
  const inline = () => leastCost(job.nx, job.ny, job.h, job.w, job.e, job.s, job.n, job.sources, job.mult, job.maxHours);
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return Promise.resolve(inline());
  return new Promise((res) => {
    let url, w;
    try {
      url = URL.createObjectURL(new Blob([travelSource()], { type: 'text/javascript' }));
      w = new Worker(url);
    } catch (e) {
      return res(inline());
    }
    const done = (r) => (URL.revokeObjectURL(url), w.terminate(), res(r));
    w.onmessage = (m) => done(m.data);
    w.onerror = () => done(inline()); // a worker that cannot run (a blocked blob): do it here
    w.postMessage(job);
  });
}
const TRAVEL_MAX_CELLS = 48000;
const TRAVEL_RADIUS_KM = 105; // the area around a start is cut at this radius: a box of 210 km is 210 cells of 1 km
/** The line of a shape from the last setShapes (a route, a river, the outline of an area): [lon, lat] pairs, all its parts together. */
function travelShapeLine(id) {
  const out = [];
  ((typeof shapesNow !== 'undefined' && shapesNow && shapesNow.features) || []).forEach((f) => {
    const g = f.properties.id === id && (f.properties.kind === 'line' || f.properties.kind === 'area') ? f.geometry : null;
    if (!g) return;
    if (g.type === 'LineString') out.push(g.coordinates);
    else if (g.type === 'MultiLineString') out.push(...g.coordinates);
    else if (g.type === 'Polygon') out.push(g.coordinates[0]);
    else if (g.type === 'MultiPolygon') out.push(...g.coordinates.map((p) => p[0]));
  });
  return out;
}
/** The whole job: sources, box, heights, search, then the numbers (and the drawing, when `draw` is true). */
async function travelRun(o, draw = true) {
  const cfg = (typeof AHM_CONFIG !== 'undefined' && AHM_CONFIG.travel) || { hoursPerDay: 8, modes: { foot: { label: 'On foot', mult: 1 } } },
    mode = (cfg.modes && cfg.modes[o.mode]) || (cfg.modes && Object.values(cfg.modes)[0]) || { mult: 1 },
    perDay = o.hoursPerDay > 0 ? o.hoursPerDay : cfg.hoursPerDay || 8,
    days = Math.max(1, Math.min(10, Math.round(o.days || 3)));
  if (o.along) {
    // the walking time along the shape's own line (a route or a river), there and back, from its height profile
    const p = await AHM.map.profile(o.along, { samples: 400 });
    if (!p) return { error: 'No heights for this line (the relief tiles are not available).' };
    return { hoursPerDay: perDay, along: { km: p.length, hours: travelTimeOf(p, mode.mult), backHours: travelTimeOf(p, mode.mult, true) } };
  }
  let src = [];
  if (Array.isArray(o.from)) src = [o.from];
  else if (o.from && o.from.shape) travelShapeLine(o.from.shape).forEach((l) => src.push(...resampleLine(l, Math.max(2, Math.round(terrainLineKm(l) / 0.5))).pts));
  if (!src.length) return { error: 'There is no start: choose a place, a route or a point.' };
  // the box: around the start by the farthest a walker can go in `days` (6 km/h is the best speed), or around start and target
  const lat0 = src.reduce((s, p) => s + p[1], 0) / src.length,
    kmLon = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  let box,
    clipped = false;
  if (o.to) {
    const pts = src.concat([o.to]),
      xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]),
      mx = Math.max(0.1, (Math.max(...xs) - Math.min(...xs)) * 0.3),
      my = Math.max(0.1, (Math.max(...ys) - Math.min(...ys)) * 0.3);
    box = [Math.min(...xs) - mx, Math.max(...xs) + mx, Math.min(...ys) - my, Math.max(...ys) + my];
  } else {
    const far = days * perDay * 5.5 * mode.mult; // the farthest a walker can go (the best speed is 6 km/h, on a gentle downhill)
    clipped = far > TRAVEL_RADIUS_KM;
    const r = Math.min(far, TRAVEL_RADIUS_KM),
      xs = src.map((p) => p[0]),
      ys = src.map((p) => p[1]);
    box = [Math.min(...xs) - r / kmLon, Math.max(...xs) + r / kmLon, Math.min(...ys) - r / 111.32, Math.max(...ys) + r / 111.32];
  }
  const spanKm = Math.max((box[1] - box[0]) * kmLon, (box[3] - box[2]) * 111.32);
  if (spanKm > 250) return { error: `The area is too large (${Math.round(spanKm)} km across): at most about 250 km.` };
  let cellKm = Math.max(0.25, Math.min(1, spanKm / 220));
  let g = travelGrid(box, cellKm);
  while (g.nx * g.ny > TRAVEL_MAX_CELLS && cellKm < 1) g = travelGrid(box, (cellKm *= 1.25));
  if (g.nx * g.ny > TRAVEL_MAX_CELLS) return { error: `The area is too large (${Math.round(spanKm)} km across).` };
  const pts = [];
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) pts.push([g.w + ((g.e - g.w) * i) / (g.nx - 1), g.s + ((g.n - g.s) * j) / (g.ny - 1)]);
  const z = profileLevel(cellKm, lat0, 2);
  const hs = Float32Array.from(await (o.read ? terrainSample(pts, z, o.read) : terrainSample(pts, z)));
  if (!hs.some((x) => x === x)) return { error: 'No heights (the relief tiles are not available).' };
  const sources = src.map((p) => cellAt(g, p[0], p[1]));
  const { cost, prev } = await travelSearch({ nx: g.nx, ny: g.ny, h: hs, w: g.w, e: g.e, s: g.s, n: g.n, sources, mult: mode.mult, maxHours: days * perDay + perDay });
  const res = { cellKm, hoursPerDay: perDay, bands: [], path: null, reach: [], clipped };
  for (let d = 1; d <= days; d++) res.bands.push({ day: d, hours: d * perDay });
  (o.places || []).forEach((p) => {
    const c = cellAt(g, p.lon, p.lat);
    if (c >= 0 && cost[c] < Infinity) res.reach.push({ id: p.id, hours: cost[c] });
  });
  res.reach.sort((a, b) => a.hours - b.hours);
  if (o.to) {
    const c = cellAt(g, o.to[0], o.to[1]);
    if (c < 0 || !(cost[c] < Infinity)) return { ...res, error: 'No way was found to that point (no heights or too far).' };
    const coordinates = pathTo(g, prev, c);
    res.path = { coordinates, hours: cost[c], km: coordinates.reduce((s, q, i) => (i ? s + terrainKm(coordinates[i - 1], q) : 0), 0) };
  }
  if (draw && typeof map !== 'undefined') travelDraw(g, cost, res);
  return res;
}
const terrainLineKm = (l) => l.reduce((s, q, i) => (i ? s + terrainKm(l[i - 1], q) : 0), 0);
// ---- drawing: the lines of 1, 2, 3 ... days (marching squares of map.js on the cost grid) and the path ----
function ensureTravel() {
  if (map.getSource('ahm-travel')) return;
  const before = map.getStyle().layers.find((l) => l.type === 'symbol' && !l.id.startsWith('ahm-'));
  map.addSource('ahm-travel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'ahm-travel-band', type: 'line', source: 'ahm-travel', filter: ['==', ['get', 'kind'], 'band'], paint: { 'line-color': '#7b3294', 'line-width': 2, 'line-dasharray': [2, 1] } }, before && before.id);
  map.addLayer({ id: 'ahm-travel-path', type: 'line', source: 'ahm-travel', filter: ['==', ['get', 'kind'], 'path'], paint: { 'line-color': '#d7191c', 'line-width': 3.5 } }, before && before.id);
  map.addLayer({
    id: 'ahm-travel-label', type: 'symbol', source: 'ahm-travel', filter: ['==', ['get', 'kind'], 'band'],
    layout: { 'symbol-placement': 'line', 'text-field': ['get', 'label'], 'text-font': typeof labelFont !== 'undefined' && labelFont ? labelFont : ['Noto Sans Regular'], 'text-size': 11 },
    paint: { 'text-color': '#4d2a5f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
  }, before && before.id);
}
function travelDraw(g, cost, res) {
  ensureTravel();
  const big = new Float32Array(cost.length);
  for (let k = 0; k < cost.length; k++) big[k] = cost[k] < Infinity ? cost[k] : 1e6; // not reached = far away, so the lines close around what is reached
  const hsm = smoothGrid(Array.from(big), g.nx, g.ny),
    features = [];
  res.bands.forEach((b) =>
    contourLines(hsm, g.nx, g.ny, b.hours).forEach((line0) =>
      features.push({
        type: 'Feature',
        properties: { kind: 'band', label: b.day === 1 ? '1 day' : b.day + ' days' },
        geometry: { type: 'LineString', coordinates: chaikin(line0, 2).map(([x, y]) => [g.w + ((g.e - g.w) * x) / (g.nx - 1), g.s + ((g.n - g.s) * y) / (g.ny - 1)]) },
      }),
    ),
  );
  if (res.path) features.push({ type: 'Feature', properties: { kind: 'path' }, geometry: { type: 'LineString', coordinates: res.path.coordinates } });
  const src = map.getSource('ahm-travel');
  if (src) src.setData({ type: 'FeatureCollection', features });
}
if (typeof AHM !== 'undefined' && AHM.map)
  Object.assign(AHM.map, {
    /** See the head of this file. */
    travel: (o) => travelRun(o || {}).catch((e) => ({ error: String((e && e.message) || e) })),
    travelClear() {
    const s = typeof map !== 'undefined' && map.getSource && map.getSource('ahm-travel');
    if (s) s.setData({ type: 'FeatureCollection', features: [] });
  },
});
